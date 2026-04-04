// ============================================================
//  Roblox AI Plugin – Backend Server  (Final v8 – Qwen + OpenAI)
//
//  Supports Qwen (default) and OpenAI.
//  Set AI_PROVIDER=qwen or AI_PROVIDER=openai in .env to choose.
//  If AI_PROVIDER is not set, auto-detects based on which API key exists.
//
//  Fixes implemented:
//  [B1] JSON structure validation (not Lua syntax – deferred to Studio)
//  [B2] Structured, actionable error messages
//  [B3] Exponential backoff retry for transient API failures
//  [B4] Extended type support documented in system prompt
//  [B5] IP-based rate limiting (conversationId is client-spoofable)
//  [B6] Fail-fast environment validation at startup
//  [B7] Backend URL configurable from plugin UI (no hardcode)
//
//  Additions beyond bugfixes:
//  [G1] Game-mode system prompt with templates for rounds, teams,
//       leaderboards, lobby, and other common Roblox game structures
//  [G2] Task complexity + phasing schema – AI signals when a request
//       needs multiple turns and what each phase should contain
//  [G3] Cross-reference warning – scripts that reference instance names
//       not present in the same response are flagged to the plugin
//
//  Run   : node server.js
//  Setup : npm install express cors openai dotenv express-rate-limit
//  Env   : QWEN_API_KEY or OPENAI_API_KEY   AI_PROVIDER=qwen|openai   PORT=3000
// ============================================================

'use strict';

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI    = require('openai');
require('dotenv').config();

// ── [B6] Fail-fast environment validation ────────────────────
// Supports Qwen and OpenAI: at least one API key must be present.
// AI_PROVIDER env var selects explicitly; otherwise auto-detect.
function validateEnvironment() {
    const hasQwen = process.env.QWEN_API_KEY && process.env.QWEN_API_KEY.trim() !== '';
    const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '';

    if (!hasQwen && !hasOpenAI) {
        console.error('❌  Missing API key. Set at least one in .env:');
        console.error('    QWEN_API_KEY=sk-...   (Alibaba Cloud Model Studio / DashScope)');
        console.error('    OPENAI_API_KEY=sk-...    (paid at platform.openai.com)');
        process.exit(1);
    }

    console.log('✅  Environment validation passed.');
    if (hasQwen) console.log('    ✓ Qwen API key detected');
    if (hasOpenAI) console.log('    ✓ OpenAI API key detected');
}
validateEnvironment();

// ── Provider selection ───────────────────────────────────────
// AI_PROVIDER=qwen    → use Qwen via DashScope OpenAI-compatible API
// AI_PROVIDER=openai  → use OpenAI GPT-4o
// Not set              → prefer Qwen if key exists, else OpenAI
function selectProvider() {
    const explicit = (process.env.AI_PROVIDER || '').toLowerCase().trim();
    const hasQwen = process.env.QWEN_API_KEY && process.env.QWEN_API_KEY.trim() !== '';
    const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '';

    if (explicit === 'qwen') {
        if (!hasQwen) { console.error('❌  AI_PROVIDER=qwen but QWEN_API_KEY is missing.'); process.exit(1); }
        return 'qwen';
    }
    if (explicit === 'openai') {
        if (!hasOpenAI) { console.error('❌  AI_PROVIDER=openai but OPENAI_API_KEY is missing.'); process.exit(1); }
        return 'openai';
    }
    return hasQwen ? 'qwen' : 'openai';
}

const PROVIDER_CONFIG = {
    qwen: {
        displayName: 'Qwen',
        keyName: 'QWEN_API_KEY',
        apiKey: process.env.QWEN_API_KEY,
        model: process.env.QWEN_MODEL || 'qwen3.5-plus',
        baseURL: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        temperature: 0.7,
        maxTokenField: 'max_tokens',
    },
    openai: {
        displayName: 'OpenAI',
        keyName: 'OPENAI_API_KEY',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        baseURL: process.env.OPENAI_BASE_URL || undefined,
        temperature: 0.7,
        maxTokenField: 'max_tokens',
    },
};

const AI_PROVIDER     = selectProvider();
const ACTIVE_PROVIDER = PROVIDER_CONFIG[AI_PROVIDER];
const AI_MODEL        = ACTIVE_PROVIDER.model;

const aiClient = new OpenAI({
    apiKey: ACTIVE_PROVIDER.apiKey,
    ...(ACTIVE_PROVIDER.baseURL ? { baseURL: ACTIVE_PROVIDER.baseURL } : {}),
});

console.log(`🤖  AI Provider: ${ACTIVE_PROVIDER.displayName} → model: ${AI_MODEL}`);

// ── App setup ────────────────────────────────────────────────
const app    = express();
const port   = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Constants ────────────────────────────────────────────────
const CONVERSATION_TTL  = 3_600_000;   // 1 hour
const MAX_HISTORY_TURNS = 10;          // user+assistant pairs kept
const MAX_CONVERSATIONS = 500;         // hard memory cap

const ALLOWED_PARENTS = new Set([
    'Workspace', 'ServerScriptService',
    'StarterPlayerScripts', 'ReplicatedStorage', 'StarterGui',
]);
const ALLOWED_SCRIPT_TYPES = new Set(['Script', 'LocalScript', 'ModuleScript']);

// ── Conversation store ───────────────────────────────────────
const conversations = new Map();

// ── [B5] IP-based rate limiter ───────────────────────────────
// conversationId is client-generated (GenerateGUID) and trivially
// spoofable. IP is the only key that provides real protection.
const apiLimiter = rateLimit({
    windowMs: 60_000,   // 1 minute
    max: 15,            // requests per window per IP
    keyGenerator: req => req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
        error: 'Rate Limit Exceeded',
        details: {
            type:    'Rate Limit',
            message: 'Too many requests from your IP address.',
            limit:   '15 requests per minute',
        },
        suggestion: 'Wait a moment then try again.',
    }),
});

// ── [G1] Game-mode system prompt ─────────────────────────────
// This is the most important addition for meeting the client spec.
// The prompt teaches the AI:
//   • The JSON schema it must return
//   • All supported Roblox type formats (fixes B4 prompt side)
//   • Game-mode templates so "create a round system" produces
//     correct, coordinated multi-script output
//   • Task phasing so complex requests are broken into steps
const SYSTEM_PROMPT = `You are an expert Roblox Luau developer embedded inside Roblox Studio.
Your job is to help developers build server games using natural language commands.

════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════
Return ONLY a single valid JSON object. No prose, no markdown, no code fences.

{
  "explanation":  "Plain-English summary of what was generated (max 150 chars).",

  "complexity":   "simple" | "moderate" | "complex",

  "phases": [
    "Phase 1: Create the kill brick and touch handler",
    "Phase 2: Add the leaderboard and score tracking"
  ],

  "currentPhase": 1,
  "totalPhases":  2,

  "instances": [
    {
      "className": "Part",
      "properties": {
        "Name":      "KillBrick",
        "Size":      [4, 1, 4],
        "Position":  [0, 0.5, 0],
        "Color":     [255, 0, 0],
        "Anchored":  true,
        "Material":  "SmoothPlastic",
        "CFrame":    {"position": [0, 5, 0], "rotation": [0, 45, 0]}
      }
    }
  ],

  "scripts": [
    {
      "name":   "KillBrickHandler",
      "type":   "Script",
      "parent": "ServerScriptService",
      "source": "-- Luau code here\\nlocal part = workspace.KillBrick"
    }
  ]
}

════════════════════════════════════════════════════════════
PROPERTY TYPE FORMATS  (use these exact formats every time)
════════════════════════════════════════════════════════════
Vector3   → [x, y, z]                       e.g. "Size": [4, 1, 4]
Color3    → [R, G, B] integers 0-255         e.g. "Color": [255, 0, 0]
CFrame    → {"position":[x,y,z], "rotation":[rx,ry,rz]}   rotation in degrees
UDim2     → {"X":{"Scale":s,"Offset":o}, "Y":{"Scale":s,"Offset":o}}
BrickColor→ string name                      e.g. "BrickColor": "Bright red"
Enum      → string value name               e.g. "Material": "SmoothPlastic"
boolean   → true / false
number    → plain number
string    → plain string

════════════════════════════════════════════════════════════
TASK COMPLEXITY RULES
════════════════════════════════════════════════════════════
"simple"   – 1 script or 1-2 instances. Complete in one response.
"moderate" – 2-4 scripts, some instances. Complete in one response.
"complex"  – 5+ scripts, multiple systems, cross-script dependencies.
             MUST use phases. Return phase 1 only. Include "phases"
             array listing ALL phases so the user knows what's coming.
             End explanation with: "Reply 'continue' for phase 2."

════════════════════════════════════════════════════════════
GAME MODE TEMPLATES  (use these patterns when asked)
════════════════════════════════════════════════════════════

── ROUND-BASED GAME ──────────────────────────────────────
Required scripts:
  • RoundManager (Script → ServerScriptService)
    - IntValue "RoundTime" in ReplicatedStorage
    - Fires RemoteEvent "RoundStarted" / "RoundEnded"
    - Handles player respawning: Players.RespawnEnabled = false during round
    - Loop: Intermission (30s) → Round (N seconds) → End → repeat
  • RoundUI (LocalScript → StarterPlayerScripts)
    - Listens to RoundStarted / RoundEnded RemoteEvents
    - Updates a ScreenGui countdown label

── TEAM GAME ─────────────────────────────────────────────
Required scripts:
  • TeamManager (Script → ServerScriptService)
    - Uses game:GetService("Teams") to create Team instances
    - Assigns players to teams on PlayerAdded
    - Each team has a SpawnLocation with TeamColor set
  • TeamUI (LocalScript → StarterPlayerScripts)
    - Shows current team and score

── LEADERBOARD / DATASTORE ───────────────────────────────
Required scripts:
  • LeaderboardManager (Script → ServerScriptService)
    - Creates leaderstats folder in Player on PlayerAdded
    - IntValue children: Kills, Deaths, Score
    - DataStoreService:GetDataStore("PlayerData")
    - Saves on PlayerRemoving, loads on PlayerAdded
  • StatUpdater (Script → ServerScriptService)
    - Listens to RemoteEvent "PlayerKilled"
    - Increments attacker Kills, victim Deaths

── LOBBY + ARENA SYSTEM ──────────────────────────────────
Required:
  • LobbyManager (Script → ServerScriptService)
    - Separate Workspace.Lobby and Workspace.Arena models
    - MinPlayers threshold before round starts
    - Teleports players to Arena SpawnLocations on round start
    - Teleports back to Lobby on round end
  • LobbyCountdown (LocalScript → StarterPlayerScripts)
    - Shows waiting-for-players UI

── KILL BRICK ────────────────────────────────────────────
  • Part in Workspace with Touched event
  • Script checks if hit.Parent is a Player character
  • Calls Humanoid:TakeDamage(100) or sets Health to 0
  • Optionally fires RemoteEvent for kill credit

── CHECKPOINT SYSTEM ─────────────────────────────────────
  • Array of Parts in Workspace model "Checkpoints"
  • Script stores last checkpoint per player in a table
  • On CharacterAdded, respawn at stored checkpoint CFrame

── SPECTATOR MODE ────────────────────────────────────────
  • On death, move character to Workspace.SpectatorArea
  • LocalScript switches Camera to Scriptable mode
  • Cycles through living players every 5 seconds

════════════════════════════════════════════════════════════
STRICT RULES
════════════════════════════════════════════════════════════
1.  Return ONLY the JSON object. Nothing else.
2.  "type" must be: Script | LocalScript | ModuleScript
3.  "parent" must be one of:
      Workspace | ServerScriptService | StarterPlayerScripts
      ReplicatedStorage | StarterGui
4.  Use game:GetService() inside script source, not direct globals.
5.  Escape newlines in source as \\n. Escape double-quotes as \\".
6.  Never generate code that deletes DataStores, crashes the server,
    or gives unfair advantages (infinite yield, speed hacks, etc.).
7.  If the user's message references a previous turn ("make it blue",
    "add a timer to that"), use the conversation context.
8.  For complex requests, ALWAYS use phases. Never try to generate
    10 scripts in one response — quality drops significantly.`;

// ── [B1] JSON structure validator ────────────────────────────
// Validates the AI response matches expected schema.
// Does NOT validate Lua syntax — luaparse only handles Lua 5.1
// and rejects valid Luau (continue, type annotations, //, generics).
// Roblox Studio is the authoritative Luau validator.
function validateResponseStructure(data) {
    const errors = [];

    if (typeof data !== 'object' || data === null) {
        return { valid: false, errors: ['Response is not an object'] };
    }

    // explanation is required
    if (!data.explanation || typeof data.explanation !== 'string') {
        errors.push('explanation must be a non-empty string');
    }

    // scripts validation
    if (data.scripts !== undefined) {
        if (!Array.isArray(data.scripts)) {
            errors.push('scripts must be an array');
        } else {
            data.scripts.forEach((s, i) => {
                if (!s.name   || typeof s.name   !== 'string') errors.push(`scripts[${i}].name must be a string`);
                if (!s.source || typeof s.source !== 'string') errors.push(`scripts[${i}].source must be a string`);
                if (!ALLOWED_SCRIPT_TYPES.has(s.type))         errors.push(`scripts[${i}].type must be Script | LocalScript | ModuleScript, got: ${s.type}`);
                if (!ALLOWED_PARENTS.has(s.parent))            errors.push(`scripts[${i}].parent must be one of ${[...ALLOWED_PARENTS].join(', ')}, got: ${s.parent}`);
            });
        }
    }

    // instances validation
    if (data.instances !== undefined) {
        if (!Array.isArray(data.instances)) {
            errors.push('instances must be an array');
        } else {
            data.instances.forEach((inst, i) => {
                if (!inst.className || typeof inst.className !== 'string')  errors.push(`instances[${i}].className must be a string`);
                if (!inst.properties || typeof inst.properties !== 'object') errors.push(`instances[${i}].properties must be an object`);
            });
        }
    }

    // phases validation (optional but must be array of strings if present)
    if (data.phases !== undefined) {
        if (!Array.isArray(data.phases) || !data.phases.every(p => typeof p === 'string')) {
            errors.push('phases must be an array of strings');
        }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

// ── [G3] Cross-reference checker ─────────────────────────────
// Warns when a script source references an instance name that
// is not present in the instances array of the same response.
// This catches the most common cause of runtime errors after apply.
function checkCrossReferences(data) {
    const warnings = [];
    if (!Array.isArray(data.instances) || !Array.isArray(data.scripts)) return warnings;

    const instanceNames = new Set(
        data.instances
            .map(i => i.properties?.Name)
            .filter(Boolean)
    );

    data.scripts.forEach(script => {
        // Find workspace references in script source not present in instances
        const workspaceRefs = script.source.match(/workspace\.(\w+)|Workspace\.(\w+)/g) || [];
        workspaceRefs.forEach(ref => {
            const refName = ref.split('.')[1];
            // Only warn for non-standard names (skip 'CurrentCamera' etc.)
            const skipList = new Set(['CurrentCamera', 'Terrain', 'Camera']);
            if (!instanceNames.has(refName) && !skipList.has(refName)) {
                warnings.push(
                    `Script "${script.name}" references workspace.${refName} ` +
                    `but no instance named "${refName}" was generated in this response. ` +
                    `Create it manually or re-prompt to include it.`
                );
            }
        });
    });

    return warnings;
}

function extractJsonText(rawText) {
    const text = String(rawText || '').trim();

    // Some compatible providers may prepend reasoning text or wrap responses with <think> tags.
    const withoutThink = text.replace(/^<think>[\s\S]*?<\/think>\s*/i, '').trim();
    const withoutFences = withoutThink
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/```$/i, '')
        .trim();

    if (withoutFences.startsWith('{') && withoutFences.endsWith('}')) {
        return withoutFences;
    }

    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return withoutFences.slice(firstBrace, lastBrace + 1);
    }

    return withoutFences;
}

function buildCompletionRequest(messages) {
    const request = {
        model: AI_MODEL,
        temperature: ACTIVE_PROVIDER.temperature,
        messages,
    };

    request[ACTIVE_PROVIDER.maxTokenField] = 4096;

    if (AI_PROVIDER === 'openai') {
        request.response_format = { type: 'json_object' };
    }

    return request;
}

// ── [B3] Retry with exponential backoff ──────────────────────
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const errorText = [
                err.message,
                err.type,
                err.error && err.error.message,
                err.error && err.error.type,
            ].filter(Boolean).join(' ');
            const isBalanceIssue = /insufficient balance/i.test(errorText)
                || err.type === 'insufficient_balance_error'
                || (err.error && err.error.type === 'insufficient_balance_error');
            const isTransient = !isBalanceIssue && (
                err.code === 'ETIMEDOUT'  ||
                err.code === 'ECONNRESET' ||
                err.code === 'ENOTFOUND'  ||
                err.status === 429        ||
                err.status === 503
            );

            const isLast = attempt === maxRetries - 1;

            if (!isTransient || isLast) throw err;

            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`  ↻ Retry ${attempt + 1}/${maxRetries - 1} after ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ── POST /generate ───────────────────────────────────────────
app.post('/generate', apiLimiter, async (req, res) => {
    const { prompt, conversationId } = req.body;

    // Input validation — before touching any state
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        return res.status(400).json({
            error: 'Bad Request',
            details: { message: 'prompt is required and must be a non-empty string.' },
            suggestion: 'Type something in the prompt box before clicking Generate.',
        });
    }
    if (!conversationId || typeof conversationId !== 'string') {
        return res.status(400).json({
            error: 'Bad Request',
            details: { message: 'conversationId is required.' },
            suggestion: 'This is a plugin bug — please restart the plugin.',
        });
    }

    // Enforce conversation cap — evict oldest on overflow
    if (!conversations.has(conversationId) && conversations.size >= MAX_CONVERSATIONS) {
        const oldest = conversations.keys().next().value;
        conversations.delete(oldest);
    }

    // Retrieve or create session
    let session = conversations.get(conversationId) || {
        messages: [],
        lastAccessed: Date.now(),
    };
    session.lastAccessed = Date.now();

    // Append user message AFTER validation
    session.messages.push({ role: 'user', content: prompt.slice(0, 4000) });

    // Trim to last N turns
    if (session.messages.length > MAX_HISTORY_TURNS * 2) {
        session.messages = session.messages.slice(-(MAX_HISTORY_TURNS * 2));
    }

    try {
        // [B3] Wrapped in retry with backoff
        const completion = await retryWithBackoff(() =>
            aiClient.chat.completions.create(buildCompletionRequest([
                { role: 'system', content: SYSTEM_PROMPT },
                ...session.messages,
            ]))
        );

        const responseMessage = completion.choices[0].message || {};
        const rawText  = typeof responseMessage.content === 'string' ? responseMessage.content : '';
        const jsonText = extractJsonText(rawText);

        // Parse
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (_) {
            console.error('AI returned unparseable JSON:\n', rawText.slice(0, 500));
            return res.status(502).json({
                error: 'AI Response Parse Error',
                details: { message: 'The AI returned text that is not valid JSON.' },
                suggestion: 'Try rephrasing your prompt more specifically.',
            });
        }

        // [B1] JSON structure validation
        const validation = validateResponseStructure(parsed);
        if (!validation.valid) {
            console.error('AI response failed structure validation:', validation.errors);
            return res.status(502).json({
                error: 'Invalid AI Response Structure',
                details: {
                    message: 'AI response did not match expected schema.',
                    errors:  validation.errors,
                },
                suggestion: 'Try rephrasing your prompt. If this persists, report it.',
            });
        }

        // Sanitise — cap string lengths and enforce allowlists
        const safe = {
            explanation:  String(parsed.explanation || 'Done').slice(0, 200),
            complexity:   ['simple','moderate','complex'].includes(parsed.complexity)
                            ? parsed.complexity : 'simple',
            currentPhase: typeof parsed.currentPhase === 'number' ? parsed.currentPhase : 1,
            totalPhases:  typeof parsed.totalPhases  === 'number' ? parsed.totalPhases  : 1,
            phases:       Array.isArray(parsed.phases)
                            ? parsed.phases.filter(p => typeof p === 'string').slice(0, 10)
                            : [],
        };

        if (Array.isArray(parsed.instances)) {
            safe.instances = parsed.instances
                .filter(i => i && typeof i.className === 'string')
                .map(i => {
                    const props = {};
                    for (const [k, v] of Object.entries(i.properties || {})) {
                        if (['Size','Position','Color'].includes(k)) {
                            if (Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number'))
                                props[k] = v;
                        } else if (k === 'CFrame') {
                            if (typeof v === 'object') props[k] = v;
                        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                            props[k] = v;
                        }
                    }
                    return { className: i.className.slice(0, 64), properties: props };
                });
        }

        if (Array.isArray(parsed.scripts)) {
            safe.scripts = parsed.scripts
                .filter(s => ALLOWED_SCRIPT_TYPES.has(s.type) && ALLOWED_PARENTS.has(s.parent))
                .map(s => ({
                    name:   String(s.name   || 'GeneratedScript').slice(0, 64),
                    type:   s.type,
                    parent: s.parent,
                    source: String(s.source || '').slice(0, 60_000),
                }));
        }

        // [G3] Cross-reference check
        const warnings = checkCrossReferences(safe);
        if (warnings.length > 0) {
            safe.warnings = warnings;
            console.warn('Cross-reference warnings:', warnings);
        }

        // Store assistant reply in history
        session.messages.push({
            role: 'assistant',
            content: rawText,
            ...(responseMessage.reasoning_details ? { reasoning_details: responseMessage.reasoning_details } : {}),
        });
        conversations.set(conversationId, session);

        return res.json(safe);

    } catch (err) {
        // [B2] Structured, actionable error messages
        console.error(`${AI_PROVIDER} error after retries:`, err);

        const providerName = ACTIVE_PROVIDER.displayName;
        const keyName      = ACTIVE_PROVIDER.keyName;

        const resp = {
            error:      'AI Generation Failed',
            details:    {},
            suggestion: '',
        };

        if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
            resp.details  = { type: 'Network Error', message: `Could not reach the ${providerName} API.` };
            resp.suggestion = 'Check your internet connection and try again.';
        } else if (
            err.type === 'insufficient_balance_error' ||
            (err.error && err.error.type === 'insufficient_balance_error') ||
            /insufficient balance/i.test(`${err.message || ''} ${err.error && err.error.message || ''}`)
        ) {
            resp.details  = { type: 'Billing Error', message: `${providerName} account has insufficient balance.` };
            resp.suggestion = `Add balance to ${providerName} or switch to another provider/model.`;
        } else if (err.status === 429) {
            resp.details  = { type: 'Rate Limit', message: `${providerName} API rate limit exceeded.` };
            resp.suggestion = 'Wait a minute for the rate limit to reset.';
        } else if (err.status === 401) {
            resp.details  = { type: 'Auth Error', message: `Invalid ${providerName} API key.` };
            resp.suggestion = `Check the ${keyName} value in your .env file.`;
        } else if (err.status === 503) {
            resp.details  = { type: 'Service Unavailable', message: `${providerName} API is temporarily down.` };
            resp.suggestion = 'Wait a few minutes and try again.';
        } else {
            resp.details  = { type: 'Unknown Error', message: err.message || 'Unknown error.' };
            resp.suggestion = 'Check server console logs for details.';
        }

        return res.status(err.status || 500).json(resp);
    }
});

// ── GET /health ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status:    'ok',
        provider:  AI_PROVIDER,
        model:     AI_MODEL,
        sessions:  conversations.size,
        timestamp: new Date().toISOString(),
    });
});

// ── Periodic TTL cleanup ─────────────────────────────────────
setInterval(() => {
    const now = Date.now();
    let evicted = 0;
    for (const [id, session] of conversations.entries()) {
        if (now - session.lastAccessed > CONVERSATION_TTL) {
            conversations.delete(id);
            evicted++;
        }
    }
    if (evicted > 0) console.log(`  🧹 Evicted ${evicted} stale conversation(s).`);
}, 600_000);  // every 10 min

// ── Start ────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`\n🚀  Roblox AI backend → http://localhost:${port}`);
    console.log(`    Deploy to Railway/Render and paste the URL into the plugin.\n`);
});
