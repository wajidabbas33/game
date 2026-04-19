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

// ── Phase 2 modules ─────────────────────────────────────────
const { getTemplateCatalogText, resolveTemplatePlacements } = require('./templates');
const {
    SCENE_PLANNER_PROMPT,
    buildScenePlanContext,
    validateScenePlan,
    resolveScenePlanTemplates,
    generateEnvironment,
    validateSceneOutput,
} = require('./scene-planner');
const {
    analyzeReferenceImages,
    imageAnalysisToContext,
    normalizeReferenceImages,
    resolveReferenceImages,
} = require('./image-analyzer');
const {
    analysisToOverrides,
    mergeOverridesIntoLayout,
    buildAnalysisSummaryCard,
} = require('./image-to-layout');

// ── Phase 3 modules: Layout engine + quality evaluation ──────
const {
    identifyRoomType,
    layoutToScenePlan,
    generateArchitecturalShell,
    generateCustomObjectInstances,
    getRoomTypeCatalogText,
    promptRequestsInteriorOnly,
    promptRequestsExpandedSurroundings,
} = require('./room-layouts');
const {
    evaluateSceneQuality,
} = require('./quality-evaluator');

// ── Phase 4 modules: Dense props + building generator ────────
const {
    autoPopulateSurfaces,
    menuBoard,
    storeNameSign,
    tubeLightFixture,
    neonAccentStrip,
    generateFormalOfficeProps,
    generateCorridorProps,
} = require('./dense-props');
const {
    generateBuilding,
    generateBuildingRow,
} = require('./building-generator');
const {
    generateTown,
    generateSociety,
} = require('./world-generator');
const {
    generateHouseBlock,
} = require('./house-generator');

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
        model: process.env.QWEN_MODEL || 'qwen3-coder-plus',
        baseURL: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        temperature: 0.7,
        maxTokenField: 'max_tokens',
    },
    openai: {
        displayName: 'OpenAI',
        keyName: 'OPENAI_API_KEY',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

function getVisionRoutingTarget() {
    const fallbackVisionModel = AI_PROVIDER === 'qwen' ? 'qwen-vl-plus' : 'gpt-4o-mini';
    const visionModel = process.env.VISION_MODEL || fallbackVisionModel;
    const visionApiKey = process.env.VISION_API_KEY || ACTIVE_PROVIDER.apiKey;
    if (!visionApiKey || !visionModel) {
        return null;
    }

    const visionBaseURL = process.env.VISION_BASE_URL
        || ACTIVE_PROVIDER.baseURL
        || undefined;
    const visionClient = new OpenAI({
        apiKey: visionApiKey,
        ...(visionBaseURL ? { baseURL: visionBaseURL } : {}),
    });

    return {
        client: visionClient,
        provider: ACTIVE_PROVIDER,
        model: visionModel,
        routed: true,
    };
}

function getGenerationTarget(hasReferenceImages) {
    const useVisionForGeneration = String(process.env.USE_VISION_FOR_GENERATION || '').toLowerCase() === 'true';
    if (hasReferenceImages && useVisionForGeneration) {
        return getVisionRoutingTarget() || {
            client: aiClient,
            provider: ACTIVE_PROVIDER,
            model: AI_MODEL,
            routed: false,
        };
    }
    return {
        client: aiClient,
        provider: ACTIVE_PROVIDER,
        model: AI_MODEL,
        routed: false,
    };
}

// ── App setup ────────────────────────────────────────────────
const app    = express();
const port   = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '8mb' }));

// ── Constants ────────────────────────────────────────────────
const CONVERSATION_TTL  = 3_600_000;   // 1 hour
const MAX_HISTORY_TURNS = 6;           // user+assistant pairs kept
const MAX_CONVERSATIONS = 500;         // hard memory cap

const ALLOWED_PARENTS = new Set([
    'Workspace', 'ServerScriptService',
    'StarterPlayerScripts', 'ReplicatedStorage', 'StarterGui',
]);
const ALLOWED_SCRIPT_TYPES = new Set(['Script', 'LocalScript', 'ModuleScript']);
const ALLOWED_TERRAIN_SHAPES = new Set(['Block', 'Ball', 'Cylinder']);

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
      "className": "Model",
      "parent":    "Workspace",
      "properties": {
        "Name":      "Arena"
      }
    },
    {
      "className": "Part",
      "parent":    "Arena",
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

  "terrain": [
    {
      "shape":    "Block",
      "material": "Grass",
      "position": [0, 6, 0],
      "size":     [96, 12, 96],
      "rotation": [0, 0, 0]
    },
    {
      "shape":    "Ball",
      "material": "Rock",
      "position": [0, 18, 0],
      "radius":   22
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
Terrain Block    → {"shape":"Block","material":"Grass","position":[x,y,z],"size":[x,y,z],"rotation":[rx,ry,rz]}
Terrain Ball     → {"shape":"Ball","material":"Rock","position":[x,y,z],"radius":number}
Terrain Cylinder → {"shape":"Cylinder","material":"Sand","position":[x,y,z],"radius":number,"height":number,"rotation":[rx,ry,rz]}

════════════════════════════════════════════════════════════
TASK COMPLEXITY RULES
════════════════════════════════════════════════════════════
"simple"   – 1 script or 1-2 instances. Complete in one response.
"moderate" – 2-4 scripts, some instances. Complete in one response.
"complex"  – 5+ scripts, nested map structures, multiple systems,
             cross-script dependencies, or combined map + gameplay requests.
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

── CAPTURE THE FLAG ───────────────────────────────────────
Required scripts:
  • FlagManager (Script → ServerScriptService)
    - Creates or manages RedFlag and BlueFlag objectives
    - Tracks flag pickup, drop, return, and capture states
    - Awards team score on successful capture
  • FlagUI (LocalScript → StarterPlayerScripts)
    - Shows flag status and team score

── KING OF THE HILL ───────────────────────────────────────
Required scripts:
  • HillManager (Script → ServerScriptService)
    - Tracks players inside a hill zone
    - Awards score over time to the controlling team
    - Resets control when hill is empty or contested
  • HillUI (LocalScript → StarterPlayerScripts)
    - Shows current owner and control progress

── SURVIVAL WAVES ─────────────────────────────────────────
Required scripts:
  • WaveManager (Script → ServerScriptService)
    - Tracks wave number, alive enemies, and intermission
    - Starts the next wave only after current enemies are cleared
    - Scales difficulty gradually per wave
  • WaveUI (LocalScript → StarterPlayerScripts)
    - Shows wave number, remaining enemies, and countdowns

── NPC / ENEMY SYSTEMS ────────────────────────────────────
When the user asks for NPCs, enemies, bosses, or shopkeepers:
  • Generate the NPC model, spawn markers, or folders they need.
  • Use Humanoid / HumanoidRootPart patterns for humanoid NPCs.
  • Add the server scripts that control patrol, chase, combat, dialog, or shop logic.
  • Give NPCs and spawn points explicit names like GuardNPC, VendorNPC, EnemySpawn1.

── SOUND / AUDIO SYSTEMS ──────────────────────────────────
When the user asks for music, ambience, beeps, or sound effects:
  • Generate Sound instances with clear names like RoundMusic, CaptureSFX, LobbyAmbience.
  • Set SoundId, Volume, Looped, PlaybackSpeed, and RollOffMaxDistance when relevant.
  • Parent UI sounds to StarterGui, world sounds to Workspace, and reusable sounds to ReplicatedStorage.
  • Add scripts that play or stop the sounds when the request implies runtime behavior.

════════════════════════════════════════════════════════════
SCALE REFERENCE (Roblox studs)
════════════════════════════════════════════════════════════
1 stud ≈ 0.28 meters (roughly 1 foot = 3.5 studs)

Common real-world sizes in studs:
  • Roblox character standing height: ~5.5 studs
  • Standard door: 4 wide × 7 tall × 0.5 thick
  • Ceiling height for interiors: 12–16 studs
  • Interior wall thickness: 1 stud
  • Exterior wall thickness: 1.5–2 studs
  • Single desk: 5 wide × 3 deep × 3.4 tall
  • Chair seat height: 2.2 studs from floor
  • Window: 4 wide × 5 tall, bottom edge 4 studs above floor
  • Small tree: ~12 studs tall (trunk ~8 studs + canopy)
  • Medium tree: ~19 studs tall
  • Street lamp: ~15 studs tall
  • Road width: 12 studs single lane, 24 studs two-lane
  • Sidewalk: 4–6 studs wide
  • Fence: 4 studs tall
  • Residential floor: 14–18 studs per story
  • Park bench: 6 wide × 2 deep × 2.5 seat height

Object spacing (center to center):
  • Desks in classroom: 6–8 studs apart
  • Trees in forest: 15–30 studs apart
  • Trees along path: 12–18 studs apart
  • Street lamps along road: 30–40 studs apart
  • Flower clusters: 3–6 studs apart
  • Park benches: 15–25 studs apart
  • Buildings on street: 20–40 studs apart

Color palettes (use curated palettes, not raw primary colors):
  • Natural grass:     [67, 140, 49] to [82, 158, 58]
  • Natural wood:      [101, 67, 33] to [156, 114, 68]
  • Stone/rock:        [120, 115, 105] to [148, 148, 140]
  • Water:             [68, 140, 190] to [95, 170, 220]
  • Warm light:        [255, 220, 140] to [255, 200, 100]
  • Cool interior:     [200, 195, 185] to [220, 215, 208]
  • Metal/dark:        [55, 55, 60] to [80, 80, 85]
  • Sand:              [210, 195, 150] to [230, 215, 175]

════════════════════════════════════════════════════════════
MAP / LAYOUT GENERATION RULES
════════════════════════════════════════════════════════════
When the user asks for a map, terrain, room, arena, classroom, base,
or architecture, generate structured Roblox instances, not only scripts.

Scene composition approach:
  1. Start with the overall dimensions and ground plane.
  2. Build the structural shell (floor, walls, ceiling/roof).
  3. Add major features (platforms, hills, water, roads).
  4. Place objects with correct spacing using the scale reference above.
  5. Add detail objects (lights, decor, spawn markers).
  6. Include surrounding environment (terrain, props, boundaries).

For map generation:
  • Create major containers first using Model instances with unique Name values.
  • Use floor, walls, platforms, landmarks, spawn areas, and cover pieces.
  • ALWAYS include enough objects to make the scene feel complete — not just a floor.
  • For a classroom: include floor, 4 walls, ceiling, windows, whiteboard, 10+ desk/chair pairs, lighting.
  • For an island: include terrain layers (grass top, rock/dirt sides), hills, trees, paths, water around edges, props.
  • For an arena: include floor, boundary walls, cover spots, spawns, center objective, spectator areas.
  • Use Anchored = true for environment pieces unless movement is required.
  • Give gameplay-critical objects clear names: RedSpawn, BlueSpawn, HillZone, FlagBase, LobbySpawn.
  • If scripts will reference an object, that object MUST be named and generated in the same response.

Environment — the surrounding world:
  • NEVER leave the area around the main build as empty baseplate.
  • Generate ground terrain extending beyond the main structure.
  • Add environmental props: trees, rocks, lamp posts, benches, flower beds.
  • Define map boundaries with invisible walls or terrain edges.
  • For floating islands: add underside detail (rock), surrounding water/sky.
  • For ground-level maps: add surrounding terrain, roads leading to edges, background structures.
  • SCHOOL / CLASSROOM / CAMPUS maps: exterior should be a quiet institutional campus (roads, lawns, trees, school-building shells). Do NOT add vehicles, buses, shops, restaurants, bars, clubs, casinos, airports, hospitals, factories, jungles, animals, humans, or NPCs unless the user explicitly asked for them.
  • Use 10–20 terrain operations and 15–30 instances for environmental detail.

Optional instance parenting:
  • instances[].parent may be:
      - "Workspace"  → parent directly to Workspace
      - "StarterGui" / "ReplicatedStorage" / "StarterPlayerScripts" → parent to safe Roblox services
      - "Selection"  → parent to the currently selected Studio object
      - "<Name>"     → parent to another generated instance with that Name
  • Use this to build nested layouts such as Model -> Parts.
  • GUI trees should usually start with a ScreenGui parented to StarterGui.
  • Sound instances should parent to Workspace, ReplicatedStorage, StarterGui, or a generated instance by name.

Recommended map patterns:
  • Arena map → Arena model, floor, boundary walls, center objective/platform, team spawns, cover blocks, surrounding terrain
  • Lobby map → Lobby model, waiting area, signage area, spawn point, teleport path, decorative plants
  • Classroom/interior → container model, floor, 4 walls, ceiling, windows, front board, desk rows, chair at each desk, lights
  • Island → terrain base (Grass block), terrain hills (Ball), trees, paths, pond/water, flower clusters, edge rocks, boundary water
  • Town/outdoor → ground terrain, road network, buildings (shells), trees along streets, lamp posts, benches, boundary terrain

════════════════════════════════════════════════════════════
TERRAIN GENERATION RULES
════════════════════════════════════════════════════════════
When the user asks for terrain, hills, cliffs, rivers, caves,
islands, mountains, or natural landforms, use the "terrain" array in addition
to or instead of parts/models.

Terrain rules:
  • Use "terrain" for natural surfaces and landforms. Use "instances" for buildings, props, spawns, and precise gameplay markers.
  • Use multiple terrain operations to build complex landscapes — not just one flat block.
  • A proper island needs: Grass top block, Rock/Ground underside ball, Water surrounding block, + hills and features.
  • A proper hill needs at least 2 terrain balls (grass cap + ground core) for a natural shape.
  • Use shape "Block" for plateaus, ramps, river cuts, and flat ground.
  • Use shape "Ball" for hills, mounds, craters, and rounded landforms.
  • Use shape "Cylinder" for vertical shafts, cliffs, pillars, and tunnels.
  • Use material names from Roblox terrain materials: Grass, Ground, Rock, Sand, Mud, Snow, Slate, Water, Air.
  • Use material "Air" to carve or clear terrain volumes when needed.
  • Always provide "position". Provide "rotation" for Block/Cylinder when tilt or direction matters.
  • Layer multiple terrain ops to create natural-looking landscapes with material transitions.
  • If the user asks for both terrain and gameplay, prefer phases:
      Phase 1: Base terrain, landforms, environment, and key structures
      Phase 2: Gameplay objects, spawns, and objectives
      Phase 3: Scripts, UI, and polish

════════════════════════════════════════════════════════════
ADVANCED LOGIC + OPTIMIZATION
════════════════════════════════════════════════════════════
1. Prefer server-authoritative logic for rounds, scoring, captures, and wave state.
2. Cache services and commonly used instances at the top of each script.
3. Avoid tight infinite loops; use task.wait with sensible intervals.
4. Use ModuleScripts for shared logic when systems are large or reused.
5. Reuse or check for existing RemoteEvents, Folders, and values with FindFirstChild before creating duplicates.
6. Clean up event connections, temporary state, and player tables when players leave or rounds end.
7. Keep map part counts reasonable and use symmetrical layouts when the user asks for competitive maps.
8. When asked for map + systems together, prefer phases:
     Phase 1: Create the complete map with terrain, structures, and environment
     Phase 2: Add gameplay systems and scripts
     Phase 3: Add UI, polish, or optional extras
9. Produce working, maintainable Luau rather than clever but fragile code.
10. When modifying an existing script from a prior turn, reuse the same script name and parent so it can be updated in place instead of duplicated.

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
    10 scripts in one response — quality drops significantly.
9.  If you generate nested maps, use instances[].parent to keep
    the hierarchy organized and predictable.
10. For map/scene requests, generate a RICH output with 15–40 instances,
    not just a floor and 2 walls. Include props, lights, and detail.`;

const FAST_SYSTEM_PROMPT = `You are an expert Roblox Luau developer embedded inside Roblox Studio.
Return ONLY a single valid JSON object. No prose, no markdown, no code fences.

Schema:
{
  "explanation": "short summary",
  "complexity": "simple" | "moderate" | "complex",
  "phases": ["Phase 1", "Phase 2"],
  "currentPhase": 1,
  "totalPhases": 1,
  "instances": [
    {
      "className": "Part",
      "parent": "Workspace",
      "properties": {
        "Name": "Example",
        "Size": [4, 1, 4],
        "Position": [0, 1, 0],
        "Color": [255, 0, 0],
        "Anchored": true,
        "Material": "SmoothPlastic",
        "CFrame": {"position": [0, 1, 0], "rotation": [0, 0, 0]}
      }
    }
  ],
  "terrain": [
    {
      "shape": "Block",
      "material": "Grass",
      "position": [0, 6, 0],
      "size": [64, 12, 64],
      "rotation": [0, 0, 0]
    }
  ],
  "scripts": [
    {
      "name": "ExampleScript",
      "type": "Script",
      "parent": "ServerScriptService",
      "source": "-- Luau code here\\nlocal Players = game:GetService(\\"Players\\")"
    }
  ]
}

Type formats:
- Vector3: [x, y, z]
- Color3: [R, G, B]
- CFrame: {"position":[x,y,z], "rotation":[rx,ry,rz]}
- UDim2: {"X":{"Scale":s,"Offset":o}, "Y":{"Scale":s,"Offset":o}}
- Terrain Block: {"shape":"Block","material":"Grass","position":[x,y,z],"size":[x,y,z],"rotation":[rx,ry,rz]}
- Terrain Ball: {"shape":"Ball","material":"Rock","position":[x,y,z],"radius":number}
- Terrain Cylinder: {"shape":"Cylinder","material":"Sand","position":[x,y,z],"radius":number,"height":number,"rotation":[rx,ry,rz]}
- BrickColor: string
- Enum: string
- boolean, number, string: plain values

Rules:
- Return valid JSON only.
- "type" must be Script | LocalScript | ModuleScript.
- Script "parent" must be Workspace | ServerScriptService | StarterPlayerScripts | ReplicatedStorage | StarterGui.
- instances[].parent may be Workspace | Selection | ServerScriptService | StarterPlayerScripts | ReplicatedStorage | StarterGui | "<Name>".
- Use game:GetService() inside Luau source.
- When the user asks for a map or arena, generate instances, not only scripts.
- When the user asks for natural landforms or terrain, generate "terrain" operations, not just Parts.
- GUI trees should usually start with a ScreenGui under StarterGui.
- Generate Sound instances when the user asks for music, ambience, or SFX.
- For NPC or enemy requests, generate both the NPC/spawn structure and the scripts that drive it.
- When updating an existing script, keep the same script name and parent so the plugin can edit it in place.
- For complex requests, use phases and return only the current phase.
- Keep the response compact and avoid decorative extras unless explicitly requested.`;

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
                if (inst.parent !== undefined && typeof inst.parent !== 'string') {
                    errors.push(`instances[${i}].parent must be a string when provided`);
                }
            });
        }
    }

    const isFiniteTriple = value => Boolean(sanitizeNumericArray(value, [3]));

    // terrain validation
    if (data.terrain !== undefined) {
        if (!Array.isArray(data.terrain)) {
            errors.push('terrain must be an array');
        } else {
            data.terrain.forEach((op, i) => {
                if (!op || typeof op !== 'object' || Array.isArray(op)) {
                    errors.push(`terrain[${i}] must be an object`);
                    return;
                }

                if (!ALLOWED_TERRAIN_SHAPES.has(op.shape)) {
                    errors.push(`terrain[${i}].shape must be one of ${[...ALLOWED_TERRAIN_SHAPES].join(', ')}, got: ${op.shape}`);
                }
                if (typeof op.material !== 'string' || op.material.trim() === '') {
                    errors.push(`terrain[${i}].material must be a non-empty string`);
                }
                if (!isFiniteTriple(op.position)) {
                    errors.push(`terrain[${i}].position must be a finite [x, y, z] array`);
                }
                if (op.rotation !== undefined && !isFiniteTriple(op.rotation)) {
                    errors.push(`terrain[${i}].rotation must be a finite [rx, ry, rz] array when provided`);
                }

                if (op.shape === 'Block') {
                    if (!isFiniteTriple(op.size) || op.size.some(entry => entry <= 0)) {
                        errors.push(`terrain[${i}].size must be a positive [x, y, z] array for Block terrain`);
                    }
                } else if (op.shape === 'Ball') {
                    if (typeof op.radius !== 'number' || !Number.isFinite(op.radius) || op.radius <= 0) {
                        errors.push(`terrain[${i}].radius must be a positive finite number for Ball terrain`);
                    }
                } else if (op.shape === 'Cylinder') {
                    if (typeof op.radius !== 'number' || !Number.isFinite(op.radius) || op.radius <= 0) {
                        errors.push(`terrain[${i}].radius must be a positive finite number for Cylinder terrain`);
                    }
                    if (typeof op.height !== 'number' || !Number.isFinite(op.height) || op.height <= 0) {
                        errors.push(`terrain[${i}].height must be a positive finite number for Cylinder terrain`);
                    }
                }
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

function normalizeModelText(rawText) {
    return String(rawText || '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
}

function normalizeJsonCandidate(candidate) {
    return String(candidate || '')
        .replace(/^\uFEFF/, '')
        .replace(/^json\s*/i, '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, '\'')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
}

function collectBalancedJsonObjects(text) {
    const candidates = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            if (depth === 0) {
                start = index;
            }
            depth += 1;
            continue;
        }

        if (char === '}' && depth > 0) {
            depth -= 1;
            if (depth === 0 && start !== -1) {
                candidates.push(text.slice(start, index + 1));
                start = -1;
            }
        }
    }

    return candidates;
}

function extractJsonCandidates(rawText) {
    const text = normalizeModelText(rawText);
    const candidates = [];
    const seen = new Set();

    const pushCandidate = value => {
        const candidate = normalizeJsonCandidate(value);
        if (!candidate || seen.has(candidate)) {
            return;
        }
        seen.add(candidate);
        candidates.push(candidate);
    };

    pushCandidate(text);

    const fencedMatches = text.matchAll(/```(?:json|javascript|js)?\s*([\s\S]*?)```/gi);
    for (const match of fencedMatches) {
        pushCandidate(match[1]);
    }

    for (const candidate of collectBalancedJsonObjects(text)) {
        pushCandidate(candidate);
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        pushCandidate(text.slice(firstBrace, lastBrace + 1));
    }

    return candidates;
}

function tryParseJsonCandidate(candidate) {
    const normalized = normalizeJsonCandidate(candidate);
    if (!normalized) {
        return null;
    }

    try {
        const parsed = JSON.parse(normalized);
        if (typeof parsed === 'string') {
            return JSON.parse(normalizeJsonCandidate(parsed));
        }
        return parsed;
    } catch (_) {
        // Fall through to the caller.
    }

    return null;
}

function parseJsonResponse(rawText) {
    const candidates = extractJsonCandidates(rawText);
    let bestParsed = null;
    let bestScore = -1;

    for (const candidate of candidates) {
        const parsed = tryParseJsonCandidate(candidate);
        if (parsed && typeof parsed === 'object') {
            const score = [
                typeof parsed.explanation === 'string',
                typeof parsed.complexity === 'string',
                Array.isArray(parsed.instances),
                Array.isArray(parsed.scripts),
                Array.isArray(parsed.phases),
                typeof parsed.currentPhase === 'number',
                typeof parsed.totalPhases === 'number',
            ].filter(Boolean).length;

            if (score > bestScore) {
                bestParsed = parsed;
                bestScore = score;
            }
        }
    }

    if (bestParsed) {
        return bestParsed;
    }

    const error = new Error('Could not parse AI JSON response');
    error.rawText = String(rawText || '').slice(0, 500);
    throw error;
}

function extractJsonText(rawText) {
    const candidates = extractJsonCandidates(rawText);
    return candidates[0] || normalizeModelText(rawText);
}

function countKeywordHits(text, keywords) {
    return keywords.reduce((count, keyword) => (
        text.includes(keyword) ? count + 1 : count
    ), 0);
}

function isContinuePrompt(prompt) {
    const normalized = String(prompt || '').trim().toLowerCase();
    return normalized === 'continue'
        || normalized === 'next phase'
        || normalized === 'continue next phase'
        || normalized.startsWith('continue ');
}

function isContextualFollowUpPrompt(prompt, session) {
    if (!session || !session.lastResponse) {
        return false;
    }

    const text = String(prompt || '').trim().toLowerCase();
    if (text === '') {
        return false;
    }

    const followUpVerb = /^(add|also|then|next|make|update|change|refine|improve|polish|include|give)\b/.test(text);
    const referencesExistingState = /\b(it|that|those|them|existing|current|previous|same)\b/.test(text);
    const featureFollowUp = /\b(ui|hud|timer|scoreboard|leaderboard|spawn protection|polish|effects|vfx|sfx|music|audio)\b/.test(text);

    return text.length <= 220 && (
        followUpVerb
        || (referencesExistingState && featureFollowUp)
        || featureFollowUp
    );
}

function looksComplexPrompt(prompt) {
    const text = String(prompt || '').toLowerCase();
    const buildKeywords = [
        'capture the flag', 'king of the hill', 'round', 'lobby',
        'team', 'spawn', 'leaderboard', 'datastore', 'ui',
        'wave', 'waves', 'survival', 'npc', 'enemy', 'enemies',
        'arena', 'base', 'flag', 'score', 'timer',
        'polish', 'hud', 'manager', 'system', 'terrain',
        'hill', 'mountain', 'river', 'island', 'cliff',
    ];
    const isSystemHeavyPrompt = /\b(survival|waves?|npc|enemy|enemies|capture the flag|king of the hill|leaderboard|datastore)\b/.test(text)
        && /\b(system|manager|spawn|timer|team|score|round|ai)\b/.test(text);

    return text.length > 160
        || countKeywordHits(text, buildKeywords) >= 3
        || isSystemHeavyPrompt;
}

function shouldUseFastSystemPrompt(prompt, session) {
    return isContinuePrompt(prompt)
        || isContextualFollowUpPrompt(prompt, session)
        || !looksComplexPrompt(prompt);
}

function estimateMaxTokens(prompt, session, mode) {
    const text = String(prompt || '').toLowerCase();
    const isSystemHeavyPrompt = /\b(survival|waves?|npc|enemy|enemies|capture the flag|king of the hill|leaderboard|datastore)\b/.test(text)
        && /\b(system|manager|spawn|timer|team|score|round|ai)\b/.test(text);

    // Detailed mode gets higher token budgets for richer output
    if (mode === 'detailed') {
        if (isContinuePrompt(text) || isContextualFollowUpPrompt(prompt, session)) {
            return 3000;
        }
        if (looksComplexPrompt(text) || isSystemHeavyPrompt) {
            return 5000;
        }
        return 4000;
    }

    // Quick mode (single-pass) — original limits raised slightly
    if (isContinuePrompt(text) || isContextualFollowUpPrompt(prompt, session)) {
        return 2400;
    }

    if (looksComplexPrompt(text) || isSystemHeavyPrompt) {
        return 3500;
    }

    if (text.length < 100) {
        return 1600;
    }

    return 2400;
}

function buildPerformanceSystemMessage(prompt, session) {
    if (session.lastResponse && (isContinuePrompt(prompt) || isContextualFollowUpPrompt(prompt, session))) {
        const nextPhaseNumber = Math.min(
            (session.lastResponse.currentPhase || 1) + 1,
            session.lastResponse.totalPhases || 1
        );
        const nextPhaseLabel = session.lastResponse.phases?.[nextPhaseNumber - 1]
            || `Phase ${nextPhaseNumber}`;

        const modeLine = isContinuePrompt(prompt)
            ? `Return only ${nextPhaseLabel}.`
            : `Treat this as a follow-up modification request. Prefer ${nextPhaseLabel} if more phased work remains.`;

        return [
            'Latency-critical follow-up mode.',
            modeLine,
            'Do not repeat previous phases or regenerate the map shell.',
            'Reuse already-generated instance names whenever possible.',
            'Return only the new or updated assets needed for this follow-up.',
            'Keep the response compact: at most 8 instances and 3 scripts unless strictly necessary.',
        ].join(' ');
    }

    if (looksComplexPrompt(prompt)) {
        return [
            'Latency-critical generation mode.',
            'Return only the smallest viable next phase.',
            'For map plus gameplay requests, phase 1 must be a simple blockout only.',
            'Avoid decorative pieces and extra polish.',
            'Keep the response compact: at most 10 instances and 2 scripts unless strictly necessary.',
        ].join(' ');
    }

    return null;
}

function buildAssistantHistoryEntry(safe) {
    const summary = {
        explanation: safe.explanation,
        complexity: safe.complexity,
        currentPhase: safe.currentPhase,
        totalPhases: safe.totalPhases,
    };

    if (Array.isArray(safe.phases) && safe.phases.length > 0) {
        summary.phases = safe.phases.slice(0, 10);
    }

    if (Array.isArray(safe.instances) && safe.instances.length > 0) {
        summary.instances = safe.instances.slice(0, 12).map(instance => ({
            name: instance.properties?.Name || instance.className,
            className: instance.className,
            parent: instance.parent || 'Workspace',
        }));
    }

    if (Array.isArray(safe.terrain) && safe.terrain.length > 0) {
        summary.terrain = safe.terrain.slice(0, 8).map(operation => ({
            shape: operation.shape,
            material: operation.material,
            position: operation.position,
        }));
    }

    if (Array.isArray(safe.scripts) && safe.scripts.length > 0) {
        summary.scripts = safe.scripts.slice(0, 6).map(script => ({
            name: script.name,
            type: script.type,
            parent: script.parent,
        }));
    }

    if (Array.isArray(safe.warnings) && safe.warnings.length > 0) {
        summary.warnings = safe.warnings.slice(0, 5);
    }

    return JSON.stringify(summary);
}

function buildLastResponseState(safe) {
    return {
        currentPhase: safe.currentPhase || 1,
        totalPhases: safe.totalPhases || 1,
        phases: Array.isArray(safe.phases) ? safe.phases.slice(0, 10) : [],
        generatedNames: Array.isArray(safe.instances)
            ? safe.instances
                .map(instance => instance.properties?.Name || instance.className)
                .filter(Boolean)
                .slice(0, 12)
            : [],
        terrainOperationCount: Array.isArray(safe.terrain) ? safe.terrain.length : 0,
    };
}

function buildUserMessage(prompt, session) {
    const trimmedPrompt = String(prompt || '').slice(0, 4000);

    if (!session.lastResponse) {
        return trimmedPrompt;
    }

    if (!isContinuePrompt(trimmedPrompt) && isContextualFollowUpPrompt(trimmedPrompt, session)) {
        const nextPhaseNumber = Math.min(
            (session.lastResponse.currentPhase || 1) + 1,
            session.lastResponse.totalPhases || 1
        );
        const nextPhaseLabel = session.lastResponse.phases?.[nextPhaseNumber - 1]
            || `Phase ${nextPhaseNumber}`;
        const generatedNames = session.lastResponse.generatedNames?.length
            ? session.lastResponse.generatedNames.join(', ')
            : 'none recorded';

        return [
            'Follow-up request for the existing Roblox Studio build.',
            `Requested change: ${trimmedPrompt}`,
            `Current phase state: ${session.lastResponse.currentPhase || 1} of ${session.lastResponse.totalPhases || 1}.`,
            `If phased work remains, continue with ${nextPhaseLabel} while applying this request.`,
            `Existing generated instance names: ${generatedNames}.`,
            'Return only the new or updated assets and scripts needed for this follow-up.',
        ].join(' ');
    }

    if (!isContinuePrompt(trimmedPrompt)) {
        return trimmedPrompt;
    }

    const nextPhaseNumber = Math.min(
        (session.lastResponse.currentPhase || 1) + 1,
        session.lastResponse.totalPhases || 1
    );
    const nextPhaseLabel = session.lastResponse.phases?.[nextPhaseNumber - 1]
        || `Phase ${nextPhaseNumber}`;
    const generatedNames = session.lastResponse.generatedNames?.length
        ? session.lastResponse.generatedNames.join(', ')
        : 'none recorded';

    return [
        `Continue with ${nextPhaseLabel}.`,
        'Use the existing generated structure instead of rebuilding earlier phases.',
        `Existing generated instance names: ${generatedNames}.`,
        'Return only the assets and scripts needed for this phase.',
    ].join(' ');
}

function sanitizeNumericArray(value, allowedLengths) {
    if (!Array.isArray(value) || !allowedLengths.includes(value.length)) {
        return undefined;
    }
    if (!value.every(entry => typeof entry === 'number' && Number.isFinite(entry))) {
        return undefined;
    }
    return value.slice();
}

function sanitizeUDimAxisValue(axis) {
    if (!axis || typeof axis !== 'object' || Array.isArray(axis)) {
        return undefined;
    }
    const scale = axis.Scale;
    const offset = axis.Offset;
    if (typeof scale !== 'number' || !Number.isFinite(scale)) {
        return undefined;
    }
    if (typeof offset !== 'number' || !Number.isFinite(offset)) {
        return undefined;
    }
    return { Scale: scale, Offset: offset };
}

function sanitizeCFrameValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const position = sanitizeNumericArray(value.position, [3]);
    if (!position) {
        return undefined;
    }

    const rotation = sanitizeNumericArray(value.rotation, [3]) || [0, 0, 0];
    return { position, rotation };
}

function sanitizeUDim2Value(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const xAxis = sanitizeUDimAxisValue(value.X);
    const yAxis = sanitizeUDimAxisValue(value.Y);
    if (!xAxis || !yAxis) {
        return undefined;
    }

    return { X: xAxis, Y: yAxis };
}

function sanitizePropertyValue(key, value) {
    if (typeof value === 'string') {
        return value.slice(0, 500);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return sanitizeNumericArray(value, [3, 12]);
    }

    if (!value || typeof value !== 'object') {
        return undefined;
    }

    if (key === 'CFrame') {
        return sanitizeCFrameValue(value);
    }

    return sanitizeUDim2Value(value);
}

function sanitizeTerrainMaterial(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 64) : undefined;
}

function sanitizeTerrainOperation(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        return undefined;
    }

    const shape = typeof operation.shape === 'string'
        ? operation.shape.trim()
        : '';
    const canonicalShape = shape ? `${shape.charAt(0).toUpperCase()}${shape.slice(1).toLowerCase()}` : '';
    const position = sanitizeNumericArray(operation.position, [3]);
    const material = sanitizeTerrainMaterial(operation.material);

    if (!ALLOWED_TERRAIN_SHAPES.has(canonicalShape) || !position || !material) {
        return undefined;
    }

    const safe = {
        shape: canonicalShape,
        material,
        position,
    };

    if (operation.rotation !== undefined) {
        const rotation = sanitizeNumericArray(operation.rotation, [3]);
        if (rotation) {
            safe.rotation = rotation;
        }
    }

    if (canonicalShape === 'Block') {
        const size = sanitizeNumericArray(operation.size, [3]);
        if (!size || size.some(entry => entry <= 0)) {
            return undefined;
        }
        safe.size = size;
    } else if (canonicalShape === 'Ball') {
        if (typeof operation.radius !== 'number' || !Number.isFinite(operation.radius) || operation.radius <= 0) {
            return undefined;
        }
        safe.radius = Math.abs(operation.radius);
    } else if (canonicalShape === 'Cylinder') {
        if (typeof operation.radius !== 'number' || !Number.isFinite(operation.radius) || operation.radius <= 0) {
            return undefined;
        }
        if (typeof operation.height !== 'number' || !Number.isFinite(operation.height) || operation.height <= 0) {
            return undefined;
        }
        safe.radius = Math.abs(operation.radius);
        safe.height = Math.abs(operation.height);
    }

    return safe;
}

function wantsNoScripts(prompt) {
    return /\b(?:no|without)\s+scripts?\b/i.test(String(prompt || ''));
}

function looksLikeTerrainPrompt(prompt) {
    const text = String(prompt || '').toLowerCase();
    const terrainKeywords = [
        'terrain', 'hill', 'hills', 'mountain', 'mountains', 'cliff', 'cliffs',
        'river', 'lake', 'waterfall', 'canyon', 'valley', 'island', 'shore',
        'cave', 'plateau', 'crater', 'grassland', 'sand dune', 'snowfield',
    ];

    return countKeywordHits(text, terrainKeywords) >= 1;
}

function looksLikeMapLayoutPrompt(prompt) {
    const text = String(prompt || '').toLowerCase();
    const mapKeywords = [
        'lobby', 'arena', 'wall', 'walls', 'base', 'bases', 'spawn', 'spawns',
        'lane', 'flag', 'stands', 'map', 'layout', 'floor', 'architecture',
    ];

    return countKeywordHits(text, mapKeywords) >= 3;
}

function buildTerrainFallback(prompt) {
    if (!looksLikeTerrainPrompt(prompt)) {
        return null;
    }

    const text = String(prompt || '').toLowerCase();
    const noScripts = wantsNoScripts(prompt);
    const phases = noScripts ? [] : [
        'Phase 1: Create the terrain shell and landforms',
        'Phase 2: Add structures, spawns, and gameplay markers',
        'Phase 3: Add scripts, NPCs, and polish',
    ];

    const terrain = [];
    const instances = [];
    const baseMaterial = text.includes('snow')
        ? 'Snow'
        : text.includes('sand') || text.includes('desert')
            ? 'Sand'
            : 'Grass';

    terrain.push({
        shape: 'Block',
        material: baseMaterial,
        position: [0, 6, 0],
        size: text.includes('island') ? [96, 12, 96] : [128, 12, 128],
        rotation: [0, 0, 0],
    });

    if (text.includes('hill') || text.includes('mountain') || text.includes('cliff')) {
        terrain.push({
            shape: 'Ball',
            material: 'Rock',
            position: [0, 28, 0],
            radius: text.includes('mountain') ? 34 : 22,
        });
    }

    if (text.includes('river') || text.includes('lake') || text.includes('water')) {
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [0, 4, 0],
            size: text.includes('lake') ? [36, 6, 36] : [18, 6, 96],
            rotation: [0, 0, 0],
        });
    }

    if (text.includes('canyon') || text.includes('crater') || text.includes('valley')) {
        terrain.push({
            shape: 'Ball',
            material: 'Air',
            position: [0, 12, 0],
            radius: text.includes('canyon') ? 26 : 18,
        });
    }

    if (text.includes('island')) {
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [0, 1, 0],
            size: [180, 4, 180],
            rotation: [0, 0, 0],
        });
    }

    instances.push({
        className: 'Part',
        parent: 'Workspace',
        properties: {
            Name: 'PlayerSpawn',
            Size: [8, 1, 8],
            Position: [0, 14, 0],
            Color: [103, 192, 128],
            Anchored: true,
            Material: 'SmoothPlastic',
            Transparency: 0.35,
        },
    });

    return {
        explanation: noScripts
            ? 'Created a terrain blockout preview.'
            : "Created the terrain shell for phase 1. Reply 'continue' for phase 2.",
        complexity: noScripts ? 'moderate' : 'complex',
        phases,
        currentPhase: 1,
        totalPhases: noScripts ? 1 : phases.length,
        terrain,
        instances,
        scripts: [],
    };
}

function buildMapLayoutFallback(prompt) {
    if (!looksLikeMapLayoutPrompt(prompt)) {
        return null;
    }

    const text = String(prompt || '').toLowerCase();
    const includeLobby = text.includes('lobby');
    const noScripts = wantsNoScripts(prompt);
    const phases = noScripts ? [] : [
        'Phase 1: Create the lobby and arena blockout',
        'Phase 2: Add gameplay scripts and polish',
    ];
    const instances = [];

    if (includeLobby) {
        instances.push(
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Lobby' },
            },
            {
                className: 'Part',
                parent: 'Lobby',
                properties: {
                    Name: 'LobbyFloor',
                    Size: [48, 1, 32],
                    Position: [0, 0.5, -72],
                    Color: [120, 124, 135],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
            {
                className: 'Part',
                parent: 'Lobby',
                properties: {
                    Name: 'LobbySpawn',
                    Size: [8, 1, 8],
                    Position: [0, 1, -72],
                    Color: [103, 192, 128],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            }
        );
    }

    instances.push(
        {
            className: 'Model',
            parent: 'Workspace',
            properties: { Name: 'Arena' },
        },
        {
            className: 'Part',
            parent: 'Arena',
            properties: {
                Name: 'ArenaFloor',
                Size: [120, 1, 84],
                Position: [0, 0.5, 0],
                Color: [89, 98, 112],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'Arena',
            properties: {
                Name: 'NorthWall',
                Size: [120, 18, 2],
                Position: [0, 9, -42],
                Color: [70, 76, 87],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'Arena',
            properties: {
                Name: 'SouthWall',
                Size: [120, 18, 2],
                Position: [0, 9, 42],
                Color: [70, 76, 87],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'Arena',
            properties: {
                Name: 'WestWall',
                Size: [2, 18, 84],
                Position: [-60, 9, 0],
                Color: [70, 76, 87],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'Arena',
            properties: {
                Name: 'EastWall',
                Size: [2, 18, 84],
                Position: [60, 9, 0],
                Color: [70, 76, 87],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'Arena',
            properties: {
                Name: 'CenterLane',
                Size: [72, 1, 12],
                Position: [0, 1, 0],
                Color: [176, 180, 188],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Model',
            parent: 'Arena',
            properties: { Name: 'RedBase' },
        },
        {
            className: 'Part',
            parent: 'RedBase',
            properties: {
                Name: 'RedBasePlatform',
                Size: [20, 1, 16],
                Position: [-44, 1, 0],
                Color: [205, 88, 88],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'RedBase',
            properties: {
                Name: 'RedSpawn',
                Size: [8, 1, 8],
                Position: [-48, 2, 0],
                Color: [255, 102, 102],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'RedBase',
            properties: {
                Name: 'RedFlagStand',
                Size: [4, 6, 4],
                Position: [-38, 3, 0],
                Color: [180, 50, 50],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Model',
            parent: 'Arena',
            properties: { Name: 'BlueBase' },
        },
        {
            className: 'Part',
            parent: 'BlueBase',
            properties: {
                Name: 'BlueBasePlatform',
                Size: [20, 1, 16],
                Position: [44, 1, 0],
                Color: [91, 132, 215],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'BlueBase',
            properties: {
                Name: 'BlueSpawn',
                Size: [8, 1, 8],
                Position: [48, 2, 0],
                Color: [95, 162, 255],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        },
        {
            className: 'Part',
            parent: 'BlueBase',
            properties: {
                Name: 'BlueFlagStand',
                Size: [4, 6, 4],
                Position: [38, 3, 0],
                Color: [46, 104, 214],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        }
    );

    return {
        explanation: noScripts
            ? 'Created a lobby and arena blockout preview.'
            : "Created the map shell for phase 1. Reply 'continue' for phase 2.",
        complexity: noScripts ? 'moderate' : 'complex',
        phases,
        currentPhase: 1,
        totalPhases: noScripts ? 1 : phases.length,
        instances,
        scripts: [],
    };
}

function buildDeterministicFallback(prompt) {
    const text = String(prompt || '').toLowerCase();
    if (/\b(scene|map|island|terrain|campus|building|classroom|arena|lobby|town|world|layout|architecture|school|interior)\b/.test(text)) {
        return {
            explanation: "Created a core map shell for phase 1. Reply 'continue' for phase 2.",
            complexity: 'complex',
            phases: [
                'Phase 1: Build core structure and base layout',
                'Phase 2: Add gameplay structures and interior/exterior details',
                'Phase 3: Add exterior environment, boundaries, and polish',
            ],
            currentPhase: 1,
            totalPhases: 3,
            instances: [
                { className: 'Model', parent: 'Workspace', properties: { Name: 'MainStructure' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'MainFloor', Size: [52, 1, 34], Position: [0, 0.5, 0], Color: [212, 212, 205], Anchored: true, Material: 'Concrete' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'MainRoof', Size: [52, 1, 34], Position: [0, 14.5, 0], Color: [150, 150, 160], Anchored: true, Material: 'Concrete' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'WallNorth', Size: [52, 14, 1], Position: [0, 7, -17], Color: [236, 236, 236], Anchored: true, Material: 'Concrete' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'WallSouth', Size: [52, 14, 1], Position: [0, 7, 17], Color: [236, 236, 236], Anchored: true, Material: 'Concrete' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'WallWest', Size: [1, 14, 34], Position: [-26, 7, 0], Color: [236, 236, 236], Anchored: true, Material: 'Concrete' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'WallEast', Size: [1, 14, 34], Position: [26, 7, 0], Color: [236, 236, 236], Anchored: true, Material: 'Concrete' } },
                { className: 'Part', parent: 'MainStructure', properties: { Name: 'MainEntrance', Size: [4, 7, 0.4], Position: [0, 3.5, 17.3], Color: [102, 74, 48], Anchored: true, Material: 'Wood' } },
                { className: 'Part', parent: 'Workspace', properties: { Name: 'PrimarySpawn', Size: [8, 1, 8], Position: [0, 1, 24], Color: [103, 192, 128], Anchored: true, Material: 'SmoothPlastic' } },
            ],
            terrain: [],
            scripts: [],
        };
    }
    return buildTerrainFallback(prompt) || buildMapLayoutFallback(prompt);
}

function buildDeterministicScenePlan(prompt) {
    const text = String(prompt || '').toLowerCase();
    const isIsland = /\b(island|floating)\b/.test(text);
    const isSchoolLike = /\b(class|classroom|school|academy|campus)\b/.test(text);
    const wantsExpandedSchoolWorld = /\b(campus|grounds|parking|road|street|outside|outdoor|exterior|courtyard)\b/.test(text);
    const isCTF = /\b(capture the flag|ctf|flag)\b/.test(text);
    const isSurvival = /\b(survival|wave|waves|zombie|enemy)\b/.test(text);
    const isArena = /\b(arena|pvp|battle|combat)\b/.test(text);
    const sceneType = isIsland ? 'floating_island' : (isSchoolLike ? 'classroom' : 'custom');
    const dims = isIsland ? { width: 180, depth: 180, height: 48 } : { width: 140, depth: 140, height: 40 };
    const boundaryType = isIsland ? 'water_border' : 'terrain_fade';

    const objects = [
        { type: 'custom', name: 'MainStructure', className: 'Model', description: 'Primary playable structure centered in map', position: [0, 0, 0], size: [52, 16, 36], material: 'Concrete', color: [220, 220, 220] },
        { template: 'stone_path', count: 4, zone: 'core_play_area', spacing: 'line', notes: 'Connect center structure to edges' },
        { template: 'deciduous_tree_medium', count: 8, zone: 'outer_environment', spacing: 'scattered', notes: 'Keep away from core playable structure' },
        { template: 'street_lamp', count: 4, zone: 'outer_environment', spacing: 'along_path', notes: 'Perimeter lighting' },
    ];

    if (isSchoolLike) {
        objects.push(
            { template: 'desk', count: 8, zone: 'core_play_area', spacing: 'grid', notes: 'Interior classroom layout' },
            { template: 'chair', count: 8, zone: 'core_play_area', spacing: 'grid', notes: 'Pair with desks' }
        );
    }
    if (isCTF) {
        objects.push(
            { type: 'custom', name: 'RedBase', className: 'Model', description: 'Red team base platform', position: [-32, 0, 0], size: [18, 3, 18], material: 'Concrete', color: [205, 88, 88] },
            { type: 'custom', name: 'BlueBase', className: 'Model', description: 'Blue team base platform', position: [32, 0, 0], size: [18, 3, 18], material: 'Concrete', color: [95, 162, 255] },
            { type: 'custom', name: 'CenterObjective', className: 'Model', description: 'Center objective marker', position: [0, 0, 0], size: [8, 6, 8], material: 'Metal', color: [230, 210, 80] }
        );
    }
    if (isSurvival) {
        objects.push(
            { type: 'custom', name: 'DefenseZone', className: 'Model', description: 'Player defense zone', position: [0, 0, 0], size: [24, 2, 24], material: 'Concrete', color: [180, 180, 180] },
            { type: 'custom', name: 'EnemySpawnRing', className: 'Model', description: 'Spawn ring around play area', position: [0, 0, 0], size: [120, 2, 120], material: 'Ground', color: [120, 115, 105] }
        );
    }
    if (isArena && !isCTF) {
        objects.push(
            { type: 'custom', name: 'ArenaCenter', className: 'Model', description: 'Central arena combat zone', position: [0, 0, 0], size: [28, 2, 28], material: 'Concrete', color: [170, 170, 176] },
            { template: 'rock_formation', count: 4, zone: 'core_play_area', spacing: 'scattered', notes: 'Cover objects for combat flow' }
        );
    }

    return {
        sceneType,
        title: isSchoolLike ? 'Deterministic School Map Plan' : 'Deterministic Game Map Plan',
        dimensions: dims,
        groundLevel: 0,
        zones: [
            {
                name: 'core_play_area',
                purpose: 'Main playable structure and immediate interaction area',
                bounds: { minX: -36, maxX: 36, minZ: -30, maxZ: 30 },
                elevation: 0,
                terrainMaterial: isSchoolLike ? 'SmoothPlastic' : 'Grass',
            },
            {
                name: 'outer_environment',
                purpose: 'Surroundings, paths, props, and boundary transition',
                bounds: { minX: -80, maxX: 80, minZ: -80, maxZ: 80 },
                elevation: 0,
                terrainMaterial: 'Grass',
            },
        ],
        objects,
        lighting: {
            timeOfDay: 'golden_hour',
            ambience: 'warm',
            fogDensity: 'light',
            pointLightCount: 4,
            pointLightColor: [255, 220, 140],
        },
        environment: {
            generateSurroundings: true,
            expandedWorld: wantsExpandedSchoolWorld,
            interiorOnly: false,
            skipTerrainOperations: isSchoolLike && !wantsExpandedSchoolWorld,
            schoolCampusExterior: isSchoolLike,
            boundaryType,
            surroundingTerrain: isSchoolLike && !wantsExpandedSchoolWorld ? 'Ground' : 'Grass',
            surroundingElements: isSchoolLike && !wantsExpandedSchoolWorld
                ? ['roads', 'background_structures', 'lamps', 'trees_sparse']
                : ['trees_sparse', 'roads', 'benches', 'background_structures', 'rocks_scattered'],
            mapBoundarySize: {
                width: dims.width * (isSchoolLike && wantsExpandedSchoolWorld ? 1.5 : 1.65),
                depth: dims.depth * (isSchoolLike && wantsExpandedSchoolWorld ? 1.5 : 1.65),
            },
        },
        colorPalette: {
            primary: [82, 158, 58],
            secondary: [148, 148, 140],
            accent: [255, 220, 140],
            style: 'modern_clean',
        },
    };
}

function buildDeterministicBoundaryInstances(scenePlan) {
    const env = scenePlan?.environment || {};
    const dims = scenePlan?.dimensions || { width: 128, depth: 128 };
    const mapWidth = env.mapBoundarySize?.width || dims.width * 1.6;
    const mapDepth = env.mapBoundarySize?.depth || dims.depth * 1.6;
    const halfW = mapWidth / 2;
    const halfD = mapDepth / 2;
    const wallHeight = 22;
    const boundaryType = env.boundaryType || 'invisible_walls';
    const makeWall = (name, size, pos) => ({
        className: 'Part',
        parent: 'Workspace',
        properties: {
            Name: name,
            Size: size,
            Position: pos,
            Anchored: true,
            CanCollide: true,
            // Fully invisible boundaries read as "missing" geometry in Studio (wireframe only).
            Transparency: 0.86,
            Color: [202, 205, 212],
            Material: 'SmoothPlastic',
            CastShadow: false,
        },
    });

    if (boundaryType === 'water_border') {
        return [
            makeWall('WaterBoundN', [mapWidth + 20, wallHeight, 2], [0, wallHeight / 2, -halfD - 10]),
            makeWall('WaterBoundS', [mapWidth + 20, wallHeight, 2], [0, wallHeight / 2, halfD + 10]),
            makeWall('WaterBoundW', [2, wallHeight, mapDepth + 20], [-halfW - 10, wallHeight / 2, 0]),
            makeWall('WaterBoundE', [2, wallHeight, mapDepth + 20], [halfW + 10, wallHeight / 2, 0]),
        ];
    }

    return [
        makeWall('BoundaryNorth', [mapWidth, wallHeight, 2], [0, wallHeight / 2, -halfD]),
        makeWall('BoundarySouth', [mapWidth, wallHeight, 2], [0, wallHeight / 2, halfD]),
        makeWall('BoundaryWest', [2, wallHeight, mapDepth], [-halfW, wallHeight / 2, 0]),
        makeWall('BoundaryEast', [2, wallHeight, mapDepth], [halfW, wallHeight / 2, 0]),
    ];
}

function isSceneLikePrompt(prompt) {
    const text = String(prompt || '').toLowerCase();
    return /\b(scene|map|island|terrain|campus|building|classroom|arena|lobby|town|world|layout|architecture|outdoor|exterior|neighborhood|village|city|street)\b/.test(text);
}

/**
 * Returns true for any prompt describing an outdoor / exterior world.
 * Used to always trigger the full society generator.
 */
function isExteriorPrompt(prompt) {
    const text = String(prompt || '').toLowerCase();
    return /\b(town|city|neighborhood|neighbourhood|village|suburb|residential|street|outdoor|exterior|open world|game world|game map|map|world|society|estate|campus|plaza|theme park|park|district)\b/.test(text);
}

function inferRequestedPhase(prompt, session) {
    if (!session?.lastResponse) {
        return 1;
    }
    if (isContinuePrompt(prompt)) {
        return Math.min(
            (session.lastResponse.currentPhase || 1) + 1,
            session.lastResponse.totalPhases || 1
        );
    }
    return session.lastResponse.currentPhase || 1;
}

function buildPhaseExecutionSystemMessage(prompt, session) {
    if (!isSceneLikePrompt(prompt)) {
        return null;
    }

    const phase = inferRequestedPhase(prompt, session);
    if (phase <= 1) {
        return [
            'PHASE 1 EXECUTION RULES (MANDATORY):',
            '1) Create a coherent core structure first (floor + walls + roof + entrance) and keep it centered.',
            '2) Include at least one named root model for the primary build.',
            '3) Do not return terrain-only or decor-only output for phase 1.',
            '4) Keep environment light in phase 1; prioritize architecture and primary layout anchors.',
        ].join(' ');
    }
    if (phase === 2) {
        return [
            'PHASE 2 EXECUTION RULES (MANDATORY):',
            '1) Expand and detail the primary structure created in phase 1 (interior objects, gameplay-relevant layout pieces).',
            '2) Add connected structures/paths and playable navigation flow, not random scattered props.',
            '3) Preserve phase-1 anchors and names where possible; avoid replacing the entire map shell.',
            '4) Include meaningful object density for the core play area.',
        ].join(' ');
    }
    return [
        'PHASE 3 EXECUTION RULES (MANDATORY):',
        '1) Finalize world composition around the main build (surrounding terrain, roads/paths, props, background structures).',
        '2) Ensure explicit map boundaries for a complete playable area.',
        '3) Add polish and consistency (lighting/environment coherence) without breaking prior phases.',
        '4) Output should feel complete and game-ready, not an isolated build on empty baseplate.',
    ].join(' ');
}

function countStructuralInstances(instances) {
    if (!Array.isArray(instances)) {
        return 0;
    }
    const structuralNamePattern = /(mainbuilding|building|class(room)?|school|room|hall|lobby|arena|base|house|tower|office|wall|roof|floor|door|window)/i;
    return instances.reduce((count, inst) => {
        const name = String(inst?.properties?.Name || '');
        const cls = String(inst?.className || '');
        const isRoadLike = /(road|path|lamp|bench|tree|flower|rock|pond|boundary)/i.test(name);
        if (structuralNamePattern.test(name) && !isRoadLike) {
            return count + 1;
        }
        return count;
    }, 0);
}

function hasClosedShell(instances) {
    if (!Array.isArray(instances) || instances.length === 0) {
        return false;
    }
    const names = new Set(
        instances
            .map(inst => String(inst?.properties?.Name || '').toLowerCase())
            .filter(Boolean)
    );
    const hasFloor = [...names].some(name => /floor/.test(name));
    const hasRoof = [...names].some(name => /roof/.test(name));
    const wallCount = [...names].filter(name => /wall/.test(name)).length;
    return hasFloor && hasRoof && wallCount >= 2;
}

function hasExistingLayoutShell(instances) {
    if (!Array.isArray(instances)) {
        return false;
    }
    const names = instances
        .map(inst => String(inst?.properties?.Name || '').toLowerCase())
        .filter(Boolean);
    const hasArenaShell = names.some(name => /(arenafloor|northwall|southwall|eastwall|westwall|arena)/.test(name));
    const hasClassShell = names.some(name => /(classroomfloor|classroomroof|wallnorth|wallsouth|wallwest|walleast|schoolbuilding|mainbuilding)/.test(name));
    return hasArenaShell || hasClassShell;
}

function countEnvironmentSignals(instances, terrain) {
    let score = 0;
    if (Array.isArray(instances)) {
        for (const inst of instances) {
            const name = String(inst?.properties?.Name || '').toLowerCase();
            if (/(road|path|campusdrive|tree|rock|flower|bench|lamp|boundary|waterbound|bgbuilding|schoolwing)/.test(name)) {
                score += 1;
            }
        }
    }
    if (Array.isArray(terrain)) {
        for (const op of terrain) {
            const material = String(op?.material || '').toLowerCase();
            if (/(grass|ground|rock|water|sand|mud|snow)/.test(material)) {
                score += 1;
            }
        }
    }
    return score;
}

function buildCoreStructureFallback(scenePlan) {
    const dims = scenePlan?.dimensions || { width: 128, depth: 128 };
    const groundLevel = scenePlan?.groundLevel || 0;
    const buildW = Math.max(26, Math.min(64, Math.round(dims.width * 0.28)));
    const buildD = Math.max(20, Math.min(52, Math.round(dims.depth * 0.24)));
    const wallH = 14;
    const wallT = 1;
    const cx = 0;
    const cz = 0;

    return [
        { className: 'Model', parent: 'Workspace', properties: { Name: 'MainBuilding' } },
        {
            className: 'Part',
            parent: 'MainBuilding',
            properties: {
                Name: 'MainFloor',
                Size: [buildW, 1, buildD],
                Position: [cx, groundLevel + 0.5, cz],
                Color: [205, 205, 198],
                Anchored: true,
                Material: 'Concrete',
            },
        },
        {
            className: 'Part',
            parent: 'MainBuilding',
            properties: {
                Name: 'Roof',
                Size: [buildW, 1, buildD],
                Position: [cx, groundLevel + wallH + 0.5, cz],
                Color: [160, 160, 168],
                Anchored: true,
                Material: 'Concrete',
            },
        },
        {
            className: 'Part',
            parent: 'MainBuilding',
            properties: {
                Name: 'WallNorth',
                Size: [buildW, wallH, wallT],
                Position: [cx, groundLevel + wallH / 2, cz - buildD / 2],
                Color: [235, 235, 235],
                Anchored: true,
                Material: 'Concrete',
            },
        },
        {
            className: 'Part',
            parent: 'MainBuilding',
            properties: {
                Name: 'WallSouth',
                Size: [buildW, wallH, wallT],
                Position: [cx, groundLevel + wallH / 2, cz + buildD / 2],
                Color: [235, 235, 235],
                Anchored: true,
                Material: 'Concrete',
            },
        },
        {
            className: 'Part',
            parent: 'MainBuilding',
            properties: {
                Name: 'WallWest',
                Size: [wallT, wallH, buildD],
                Position: [cx - buildW / 2, groundLevel + wallH / 2, cz],
                Color: [232, 232, 232],
                Anchored: true,
                Material: 'Concrete',
            },
        },
        {
            className: 'Part',
            parent: 'MainBuilding',
            properties: {
                Name: 'WallEast',
                Size: [wallT, wallH, buildD],
                Position: [cx + buildW / 2, groundLevel + wallH / 2, cz],
                Color: [232, 232, 232],
                Anchored: true,
                Material: 'Concrete',
            },
        },
    ];
}

function shouldUseDeterministicLayoutPreview(prompt) {
    return wantsNoScripts(prompt) && looksLikeMapLayoutPrompt(prompt);
}

function shouldUseDeterministicTerrainPreview(prompt) {
    return wantsNoScripts(prompt) && looksLikeTerrainPrompt(prompt);
}

function withTimeout(promise, timeoutMs, code = 'AI_TIMEOUT') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                const err = new Error(`Timed out after ${timeoutMs}ms`);
                err.code = code;
                reject(err);
            }, timeoutMs);
        }),
    ]);
}

function buildCompletionRequest(messages, target, options = {}) {
    const request = {
        model: target.model,
        temperature: target.provider.temperature,
        messages,
    };

    request[target.provider.maxTokenField] = options.maxTokens || 1000;

    if (AI_PROVIDER === 'openai') {
        request.response_format = { type: 'json_object' };
    }

    return request;
}

function getCompletionText(message) {
    const content = message && message.content;

    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map(part => {
                if (typeof part === 'string') {
                    return part;
                }
                if (part && typeof part.text === 'string') {
                    return part.text;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n')
            .trim();
    }

    return '';
}

function normalizeInstanceShape(instance) {
    if (!instance || typeof instance !== 'object' || Array.isArray(instance)) {
        return instance;
    }

    const normalized = { ...instance };
    const originalProperties = (
        normalized.properties
        && typeof normalized.properties === 'object'
        && !Array.isArray(normalized.properties)
    ) ? { ...normalized.properties } : {};

    const normalizePropertyKey = (key) => {
        if (typeof key !== 'string') {
            return key;
        }

        const aliases = new Map([
            ['name', 'Name'],
            ['size', 'Size'],
            ['position', 'Position'],
            ['color', 'Color'],
            ['backgroundcolor3', 'BackgroundColor3'],
            ['textcolor3', 'TextColor3'],
            ['resetonspawn', 'ResetOnSpawn'],
            ['text', 'Text'],
            ['anchored', 'Anchored'],
            ['material', 'Material'],
            ['transparency', 'Transparency'],
            ['cancollide', 'CanCollide'],
            ['cframe', 'CFrame'],
            ['brickcolor', 'BrickColor'],
            ['teamcolor', 'TeamColor'],
        ]);

        return aliases.get(key.toLowerCase()) || key;
    };

    const normalizedProperties = {};
    for (const [key, value] of Object.entries(originalProperties)) {
        normalizedProperties[normalizePropertyKey(key)] = value;
    }

    for (const [key, value] of Object.entries(normalized)) {
        if (key === 'className' || key === 'parent' || key === 'properties') {
            continue;
        }
        const normalizedKey = normalizePropertyKey(key);
        if (normalizedProperties[normalizedKey] === undefined) {
            normalizedProperties[normalizedKey] = value;
        }
        delete normalized[key];
    }

    normalized.properties = normalizedProperties;
    return normalized;
}

function normalizeScriptParent(parent) {
    if (typeof parent !== 'string') {
        return parent;
    }

    const normalized = parent.trim();
    const aliases = new Map([
        ['StarterPlayer.StarterPlayerScripts', 'StarterPlayerScripts'],
        ['game.StarterPlayer.StarterPlayerScripts', 'StarterPlayerScripts'],
        ['game.ServerScriptService', 'ServerScriptService'],
        ['game.ReplicatedStorage', 'ReplicatedStorage'],
        ['game.StarterGui', 'StarterGui'],
        ['game.Workspace', 'Workspace'],
        ['workspace', 'Workspace'],
    ]);

    return aliases.get(normalized) || normalized;
}

function normalizeScriptShape(script) {
    if (!script || typeof script !== 'object' || Array.isArray(script)) {
        return script;
    }

    const normalized = { ...script };
    normalized.parent = normalizeScriptParent(normalized.parent);
    return normalized;
}

function normalizeTerrainOperationShape(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        return operation;
    }

    const normalized = { ...operation };

    if (!normalized.shape && typeof normalized.type === 'string') {
        normalized.shape = normalized.type;
    }
    if (!normalized.position && Array.isArray(normalized.center)) {
        normalized.position = normalized.center;
    }
    if (!normalized.position && normalized.cframe && Array.isArray(normalized.cframe.position)) {
        normalized.position = normalized.cframe.position;
    }
    if (!normalized.rotation && normalized.cframe && Array.isArray(normalized.cframe.rotation)) {
        normalized.rotation = normalized.cframe.rotation;
    }

    return normalized;
}

function normalizeParsedResponseShape(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return data;
    }

    const normalized = { ...data };

    if (Array.isArray(normalized.instances)) {
        normalized.instances = normalized.instances.map(normalizeInstanceShape);
    }

    if (Array.isArray(normalized.scripts)) {
        normalized.scripts = normalized.scripts.map(normalizeScriptShape);
    }

    if (Array.isArray(normalized.terrain)) {
        normalized.terrain = normalized.terrain.map(normalizeTerrainOperationShape);
    }

    return normalized;
}

async function repairStructuredResponse({ prompt, rawText, performanceSystemMessage, validationErrors, target }) {
    const repairMessages = [
        { role: 'system', content: FAST_SYSTEM_PROMPT },
        {
            role: 'system',
            content: [
                'Your previous reply was invalid for the Roblox plugin.',
                'Return only one valid JSON object that matches the required schema.',
                'Do not include markdown, bullets, code fences, or explanation outside JSON.',
                'If the request is large, return a smaller valid first phase instead of failing.',
            ].join(' '),
        },
    ];

    if (performanceSystemMessage) {
        repairMessages.push({ role: 'system', content: performanceSystemMessage });
    }

    repairMessages.push({
        role: 'user',
        content: `Original request:\n${String(prompt || '').slice(0, 3000)}`,
    });

    if (validationErrors && validationErrors.length > 0) {
        repairMessages.push({
            role: 'user',
            content: `Schema issues to fix:\n- ${validationErrors.join('\n- ').slice(0, 2000)}`,
        });
    }

    repairMessages.push({
        role: 'assistant',
        content: String(rawText || '').slice(0, 12000),
    });

    repairMessages.push({
        role: 'user',
        content: 'Rewrite the previous answer as strict JSON only.',
    });

    const repairCompletion = await withTimeout(
        retryWithBackoff(() =>
            target.client.chat.completions.create(buildCompletionRequest(repairMessages, target, {
                maxTokens: Math.max(900, Math.min(1400, estimateMaxTokens(prompt))),
            }))
        ),
        20_000,
        'AI_REPAIR_TIMEOUT'
    );

    const repairMessage = repairCompletion.choices[0].message || {};
    const repairRawText = getCompletionText(repairMessage);
    return parseJsonResponse(repairRawText);
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
    const { prompt, conversationId, mode, generateEnv, imageUrls, referenceImages } = req.body;
    const requestedMode = (mode === 'detailed') ? 'detailed' : 'quick';
    const requestId = Math.random().toString(36).slice(2, 8);
    const startedAt = Date.now();

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
        lastResponse: null,
    };
    session.lastAccessed = Date.now();

    const normalizedReferenceResult = normalizeReferenceImages(referenceImages, imageUrls);
    const normalizedReferenceImages = normalizedReferenceResult.images;
    const generationTarget = getGenerationTarget(normalizedReferenceImages.length > 0);
    const sceneQualityKeywords = /\b(scene|layout|map|campus|classroom|class|school|academy|arena|lobby|town|island|terrain|environment|surroundings|architecture|building|world|cafe|café|coffee|restaurant|shop|store|retail|office|meeting|conference|foyer|reception|apartment|bedroom|kitchen|bathroom|corridor|hallway|living room|interior|indoor|inside|room)\b/i;
    // Also upgrade to detailed mode whenever a known room-type preset matches the prompt.
    const promptMatchesRoomPreset = !!identifyRoomType(prompt);
    const shouldForceDetailed = requestedMode === 'quick' && (
        sceneQualityKeywords.test(prompt)
        || promptMatchesRoomPreset
        || normalizedReferenceImages.length > 0
    );
    const generationMode = shouldForceDetailed ? 'detailed' : requestedMode;
    const modeReason = shouldForceDetailed
        ? (normalizedReferenceImages.length > 0 ? 'reference_images' : 'scene_prompt')
        : 'requested';

    console.log(
        `[${requestId}] /generate mode=${requestedMode}->${generationMode} reason=${modeReason} refs=${normalizedReferenceImages.length} generateEnv=${generateEnv !== false}`
    );
    console.log(
        `[${requestId}] model-route=${generationTarget.model}${generationTarget.routed ? ' (vision-routed)' : ''}`
    );

    const userMessage = buildUserMessage(prompt, session);
    const historyLengthBeforeTurn = session.messages.length;

    // Append user message AFTER validation
    session.messages.push({ role: 'user', content: userMessage });

    // Trim to last N turns
    if (session.messages.length > MAX_HISTORY_TURNS * 2) {
        session.messages = session.messages.slice(-(MAX_HISTORY_TURNS * 2));
    }

    try {
        const performanceSystemMessage = buildPerformanceSystemMessage(prompt, session);
        const phaseExecutionSystemMessage = buildPhaseExecutionSystemMessage(prompt, session);

        // ── Image analysis (if reference images were provided) ─
        let imageContext = '';
        const imageWarnings = [];
        let imageAnalysisState = 'not_requested';
        let imageLayoutOverrides = null;    // image-to-layout override bundle
        let imageAnalysisSummaryCard = null; // for plugin UI preview

        if (normalizedReferenceResult.warnings.length > 0) {
            imageWarnings.push(...normalizedReferenceResult.warnings);
        }

        if (normalizedReferenceImages.length > 0) {
            try {
                const resolvedReferenceResult = await resolveReferenceImages(normalizedReferenceImages);
                if (resolvedReferenceResult.warnings.length > 0) {
                    imageWarnings.push(...resolvedReferenceResult.warnings);
                }

                if (resolvedReferenceResult.images.length > 0) {
                    const imageAnalysis = await analyzeReferenceImages(resolvedReferenceResult.images, prompt);
                    if (imageAnalysis) {
                        // 1. Build planner context text (used in AI prompt)
                        imageContext = imageAnalysisToContext(imageAnalysis);

                        // 2. Convert to deterministic overrides (NEW)
                        imageLayoutOverrides = analysisToOverrides(imageAnalysis, prompt);

                        // 3. Build summary card for plugin UI (NEW)
                        imageAnalysisSummaryCard = buildAnalysisSummaryCard(imageAnalysis, imageLayoutOverrides);

                        imageAnalysisState = 'used';
                        console.log(`[${requestId}] 📷 Image analysis complete — model=qwen-vl-max detail=high`);
                        console.log(`[${requestId}]    detected roomType: ${imageLayoutOverrides.detectedRoomType} confidence: ${imageLayoutOverrides.confidence}`);
                        if (imageAnalysisSummaryCard?.specialFlags?.length > 0) {
                            console.log(`[${requestId}]    special flags: ${imageAnalysisSummaryCard.specialFlags.join(', ')}`);
                        }
                    } else {
                        imageAnalysisState = 'skipped_or_empty';
                        imageWarnings.push('Reference images were resolved, but the vision model did not return usable analysis.');
                    }
                } else {
                    imageAnalysisState = 'no_resolved_images';
                    imageWarnings.push('No valid reference images could be resolved for analysis.');
                }
            } catch (imgErr) {
                imageAnalysisState = 'failed';
                imageWarnings.push('Failed to analyze reference images: ' + imgErr.message);
                console.warn('⚠️  Image analysis failed:', imgErr.message);
            }
        } else {
            imageAnalysisState = 'no_reference_images';
        }
        console.log(`[${requestId}] image-analysis=${imageAnalysisState}`);

        // ── Two-pass pipeline (Detailed mode) ───────────────
        let scenePlan = null;
        let scenePlanText = null;
        let usedDeterministicScenePlan = false;
        let detectedRoomType = null;
        let roomLayout = null;

        if (generationMode === 'detailed' && !isContinuePrompt(prompt) && !isContextualFollowUpPrompt(prompt, session)) {
            // ── Room layout engine: check for known room types ──
            // If image analysis detected a room type with >= 0.55 confidence, use it
            let roomMatch = null;
            if (imageLayoutOverrides?.detectedRoomType && imageLayoutOverrides.confidence >= 0.55) {
                const { identifyRoomType: irt } = require('./room-layouts');
                roomMatch = irt(imageLayoutOverrides.detectedRoomType);
                if (roomMatch) {
                    console.log(`📷 Image overrides room type: ${roomMatch.key} (confidence ${imageLayoutOverrides.confidence})`);
                }
            }
            // Fall back to prompt-based detection
            if (!roomMatch) {
                roomMatch = identifyRoomType(prompt);
            }

            if (roomMatch) {
                detectedRoomType = roomMatch.key;
                roomLayout = roomMatch.layout;

                // ── Apply image-derived overrides onto the layout ──────
                if (imageLayoutOverrides?.hasImageOverrides) {
                    roomLayout = mergeOverridesIntoLayout(roomLayout, imageLayoutOverrides);
                    console.log(`📐 Image overrides merged into layout (dims, walls, lighting, special flags)`);
                }

                scenePlan = layoutToScenePlan(detectedRoomType, roomLayout, prompt);
                scenePlanText = JSON.stringify(scenePlan, null, 2);
                console.log(`🏗️  Room layout engine matched: "${detectedRoomType}" — ${roomLayout.zones.length} zones, ${scenePlan.objects.length} planned objects`);
            }

            // ── AI scene planner (if no room layout match) ───────
            if (!scenePlan) {
            console.log('🔬 Detailed mode: running scene planner...');
            const plannerMessages = [
                { role: 'system', content: SCENE_PLANNER_PROMPT },
            ];
            if (imageContext) {
                plannerMessages.push({ role: 'system', content: imageContext });
            }
            plannerMessages.push({ role: 'user', content: String(prompt).slice(0, 4000) });

            try {
                const planCompletion = await withTimeout(
                    retryWithBackoff(() =>
                        generationTarget.client.chat.completions.create(buildCompletionRequest(plannerMessages, generationTarget, {
                            maxTokens: 1200,
                        }))
                    ),
                    15_000,
                    'PLANNER_TIMEOUT'
                );
                const planRaw = getCompletionText(planCompletion.choices[0].message || {});
                try {
                    scenePlan = parseJsonResponse(planRaw);
                    const planValidation = validateScenePlan(scenePlan);
                    if (planValidation.warnings.length > 0) {
                        console.warn('Scene plan warnings:', planValidation.warnings);
                    }
                    scenePlanText = JSON.stringify(scenePlan, null, 2);
                    console.log('✅ Scene plan generated:', scenePlan.title || scenePlan.sceneType);
                } catch (planParseErr) {
                    console.warn('⚠️  Scene planner returned unparseable JSON, attempting repair pass...');
                    try {
                        const plannerRepairMessages = [
                            ...plannerMessages,
                            { role: 'assistant', content: String(planRaw || '').slice(0, 10_000) },
                            {
                                role: 'user',
                                content: 'Rewrite your previous answer as strict ScenePlan JSON only. No prose, no markdown, no code fences.',
                            },
                        ];
                        const repairCompletion = await withTimeout(
                            retryWithBackoff(() =>
                                generationTarget.client.chat.completions.create(buildCompletionRequest(plannerRepairMessages, generationTarget, {
                                    maxTokens: 1200,
                                }))
                            ),
                            30_000,
                            'PLANNER_REPAIR_TIMEOUT'
                        );
                        const repairRaw = getCompletionText(repairCompletion.choices[0].message || {});
                        scenePlan = parseJsonResponse(repairRaw);
                        const repairedValidation = validateScenePlan(scenePlan);
                        if (repairedValidation.warnings.length > 0) {
                            console.warn('Scene plan warnings (repair):', repairedValidation.warnings);
                        }
                        scenePlanText = JSON.stringify(scenePlan, null, 2);
                        console.log('✅ Scene plan repaired:', scenePlan.title || scenePlan.sceneType);
                    } catch (planRepairErr) {
                        console.warn('⚠️  Scene planner repair failed, using deterministic ScenePlan fallback:', planRepairErr.message);
                        if (isSceneLikePrompt(prompt)) {
                            scenePlan = buildDeterministicScenePlan(prompt);
                            scenePlanText = JSON.stringify(scenePlan, null, 2);
                            console.log('✅ Deterministic ScenePlan fallback injected');
                        } else {
                            scenePlan = null;
                        }
                    }
                }
            } catch (planErr) {
                console.warn('⚠️  Scene planner failed, using deterministic ScenePlan fallback:', planErr.message);
                if (isSceneLikePrompt(prompt)) {
                    scenePlan = buildDeterministicScenePlan(prompt);
                    scenePlanText = JSON.stringify(scenePlan, null, 2);
                    usedDeterministicScenePlan = true;
                    console.log('✅ Deterministic ScenePlan fallback injected');
                } else {
                    scenePlan = null;
                }
            }
            } // end if (!scenePlan)
        }

        // ── Build main AI messages ───────────────────────────
        const systemPrompt = shouldUseFastSystemPrompt(prompt, session)
            ? FAST_SYSTEM_PROMPT
            : SYSTEM_PROMPT;
        const messages = [
            { role: 'system', content: systemPrompt },
        ];

        // Inject scene plan context if available
        if (scenePlan) {
            messages.push({ role: 'system', content: buildScenePlanContext(scenePlan) });
        }

        // Inject image context for single-pass mode
        if (imageContext && !scenePlan) {
            messages.push({ role: 'system', content: imageContext });
        }

        if (performanceSystemMessage) {
            messages.push({ role: 'system', content: performanceSystemMessage });
        }
        if (phaseExecutionSystemMessage) {
            messages.push({ role: 'system', content: phaseExecutionSystemMessage });
        }

        messages.push(...session.messages);

        let rawText = '';
        let parsed = null;

        if (usedDeterministicScenePlan && isSceneLikePrompt(prompt)) {
            const forcedPhase = Math.max(1, Math.min(3, inferRequestedPhase(prompt, session)));
            parsed = {
                explanation: forcedPhase === 1
                    ? "Created the core map shell for phase 1. Reply 'continue' for phase 2."
                    : (forcedPhase === 2
                        ? "Expanded gameplay structures and details for phase 2. Reply 'continue' for phase 3."
                        : 'Finalized world composition and boundaries for phase 3.'),
                complexity: 'complex',
                phases: [
                    'Phase 1: Build core structure and base layout',
                    'Phase 2: Add gameplay structures and interior/exterior details',
                    'Phase 3: Add exterior environment, boundaries, and polish',
                ],
                currentPhase: forcedPhase,
                totalPhases: 3,
                instances: [],
                terrain: [],
                scripts: [],
            };
            console.log(`[${requestId}] skipped long builder call and used deterministic phase scaffold (phase ${forcedPhase})`);
        }

        if (!parsed && shouldUseDeterministicLayoutPreview(prompt)) {
            parsed = buildMapLayoutFallback(prompt);
            console.warn('Used deterministic layout preview shortcut.');
        } else if (!parsed && shouldUseDeterministicTerrainPreview(prompt)) {
            parsed = buildTerrainFallback(prompt);
            console.warn('Used deterministic terrain preview shortcut.');
        } else if (!parsed) {
            let completion;
            try {
                completion = await withTimeout(
                    retryWithBackoff(() =>
                        generationTarget.client.chat.completions.create(buildCompletionRequest(messages, generationTarget, {
                            maxTokens: estimateMaxTokens(prompt, session, generationMode),
                        }))
                    ),
                    50_000  // Raised from 25s to 50s for two-pass pipeline
                );
            } catch (err) {
                if (err.code === 'AI_TIMEOUT') {
                    const fallback = buildDeterministicFallback(prompt);
                    if (fallback) {
                        parsed = fallback;
                        console.warn('Recovered AI timeout with deterministic fallback.');
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            if (!parsed) {
                const responseMessage = completion.choices[0].message || {};
                rawText = getCompletionText(responseMessage);
                try {
                    parsed = parseJsonResponse(rawText);
                } catch (parseError) {
                    try {
                        parsed = await repairStructuredResponse({
                            prompt,
                            rawText,
                            performanceSystemMessage,
                            target: generationTarget,
                        });
                        console.warn('Recovered invalid JSON response with repair pass.');
                    } catch (_) {
                        const fallback = buildDeterministicFallback(prompt);
                        if (fallback) {
                            parsed = fallback;
                            console.warn('Recovered invalid JSON response with deterministic fallback.');
                        } else {
                            session.messages = session.messages.slice(0, historyLengthBeforeTurn);
                            console.error(
                                `AI returned unparseable JSON (length ${rawText.length}):\n`,
                                rawText.slice(0, 1500)
                            );
                            return res.status(502).json({
                                error: 'AI Response Parse Error',
                                details: { message: 'The AI returned text that is not valid JSON.' },
                                suggestion: 'Try rephrasing your prompt more specifically.',
                            });
                        }
                    }
                }
            }
        }

        parsed = normalizeParsedResponseShape(parsed);

        // [B1] JSON structure validation
        let validation = validateResponseStructure(parsed);
        if (!validation.valid) {
            try {
                parsed = await repairStructuredResponse({
                    prompt,
                    rawText,
                    performanceSystemMessage,
                    validationErrors: validation.errors,
                    target: generationTarget,
                });
                parsed = normalizeParsedResponseShape(parsed);
                validation = validateResponseStructure(parsed);
                if (validation.valid) {
                    console.warn('Recovered invalid response structure with repair pass.');
                }
            } catch (_) {
                // Fall through to the normal validation error below.
            }
        }

        if (!validation.valid) {
            const fallback = buildDeterministicFallback(prompt);
            if (fallback) {
                parsed = fallback;
                parsed = normalizeParsedResponseShape(parsed);
                validation = validateResponseStructure(parsed);
                console.warn('Recovered invalid response structure with deterministic fallback.');
            }
        }

        if (!validation.valid) {
            session.messages = session.messages.slice(0, historyLengthBeforeTurn);
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
                        const safeValue = sanitizePropertyValue(k, v);
                        if (safeValue !== undefined) {
                            props[k] = safeValue;
                        }
                    }
                    const safeInst = {
                        className: i.className.slice(0, 64),
                        properties: props,
                    };
                    if (typeof i.parent === 'string' && i.parent.trim() !== '') {
                        safeInst.parent = i.parent.trim().slice(0, 128);
                    }
                    return safeInst;
                });
        }

        if (Array.isArray(parsed.terrain)) {
            safe.terrain = parsed.terrain
                .map(sanitizeTerrainOperation)
                .filter(Boolean);
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

        // ── Merge template-resolved objects (Detailed mode) ─
        if (scenePlan) {
            // Classroom from room-layout engine: AI Part spam duplicates the shell and stacks desks.
            if (detectedRoomType === 'classroom' && roomLayout && Array.isArray(safe.instances) && safe.instances.length > 0) {
                console.log(`🏫 Classroom preset: discarding ${safe.instances.length} AI instance(s); using layout shell + templates only`);
                safe.instances = [];
            }
            try {
                const templateResult = resolveScenePlanTemplates(scenePlan);
                if (templateResult.instances.length > 0 || templateResult.terrain.length > 0) {
                    safe.instances = [...(safe.instances || []), ...templateResult.instances];
                    safe.terrain = [...(safe.terrain || []), ...templateResult.terrain];
                    console.log(`📦 Merged ${templateResult.instances.length} template instances, ${templateResult.terrain.length} terrain ops`);
                }
            } catch (tmplErr) {
                console.warn('⚠️  Template resolution failed:', tmplErr.message);
            }
        }

        // ── Architectural shell from room layout engine ──────
        if (roomLayout && scenePlan) {
            try {
                const shellResult = generateArchitecturalShell(roomLayout, scenePlan);
                if (shellResult.instances.length > 0) {
                    // Prepend shell (floor/walls/ceiling) before furniture so hierarchy is clean
                    safe.instances = [...shellResult.instances, ...(safe.instances || [])];
                    console.log(`🏠 Generated architectural shell: ${shellResult.instances.length} parts (${detectedRoomType})`);
                }

                // Render fully-specified custom objects (whiteboard, teacher desk, etc.)
                // — these were being silently dropped by the template resolver.
                const customObjResult = generateCustomObjectInstances(scenePlan, 'MainBuilding');
                if (customObjResult.instances.length > 0) {
                    safe.instances = [...(safe.instances || []), ...customObjResult.instances];
                    console.log(`🪧 Rendered ${customObjResult.instances.length} custom interior objects (whiteboard, teacher desk, etc.)`);
                }
            } catch (shellErr) {
                console.warn('⚠️  Architectural shell generation failed:', shellErr.message);
            }
        }
        // ── Dense prop auto-population ─────────────────────────
        // Scans all generated surfaces and scatters small-object clutter
        if (detectedRoomType && safe.instances && safe.instances.length > 0) {
            try {
                const surfaceProps = autoPopulateSurfaces(safe.instances, detectedRoomType);
                if (surfaceProps.instances.length > 0) {
                    safe.instances = [...(safe.instances || []), ...surfaceProps.instances];
                    console.log(`🍽️  Dense props: added ${surfaceProps.instances.length} surface clutter parts (${detectedRoomType})`);
                }
            } catch (propErr) {
                console.warn('⚠️  Dense prop generation failed:', propErr.message);
            }
        }

        // ── Formal office special props ─────────────────────────
        // Columns, fireplace, drapes, rug, portraits, busts
        if (detectedRoomType === 'formal_office' && roomLayout) {
            try {
                const { width: fw, depth: fd, height: fh } = roomLayout.defaultDims;
                const officeProps = generateFormalOfficeProps(fw, fd, fh, roomLayout.specialFlags);
                if (officeProps.instances.length > 0) {
                    safe.instances = [...(safe.instances || []), ...officeProps.instances];
                    console.log(`🏛️  Formal office props: ${officeProps.instances.length} parts (columns, fireplace, drapes, rug)`);
                }
            } catch (fErr) {
                console.warn('⚠️  Formal office props failed:', fErr.message);
            }
        }

        // ── Corridor special props ─────────────────────────────
        // Wall panels, ceiling grid, hedge planters, column supports
        if (detectedRoomType === 'corridor' && roomLayout) {
            try {
                const { width: cw, depth: cd, height: ch } = roomLayout.defaultDims;
                const corridorProps = generateCorridorProps(cw, cd, ch);
                if (corridorProps.instances.length > 0) {
                    safe.instances = [...(safe.instances || []), ...corridorProps.instances];
                    console.log(`🚀 Corridor props: ${corridorProps.instances.length} parts (panels, grid, planters)`);
                }
            } catch (cErr) {
                console.warn('⚠️  Corridor props failed:', cErr.message);
            }
        }

        // ── Society / Town exterior world generation ─────────────
        // Always generates a FULL SOCIETY (police, school, hospital, fire station,
        // park, commercial strip, residential houses) for any exterior prompt.
        const _isTownType = detectedRoomType === 'town_exterior' && roomLayout?.specialFlags?.isExteriorWorld;
        const _isExteriorScene = !detectedRoomType && isExteriorPrompt(prompt);
        const promptLower = String(prompt || '').toLowerCase();
        const isSchoolFocusedPrompt = /\b(school|classroom|class\b|academy|campus)\b/.test(promptLower);
        if ((_isTownType || _isExteriorScene) && !isSchoolFocusedPrompt) {
            try {
                const society = generateSociety({
                    size: 300,
                    groundLevel: scenePlan?.groundLevel || 0,
                    detailLevel: 'medium',
                });
                // Society completely replaces any AI-generated instances
                safe.instances = society.instances;
                safe.terrain = [...(safe.terrain || []), ...society.terrain];
                console.log(`🏙️  Full society generated: ${society.instances.length} instances, ${society.terrain.length} terrain ops`);
                console.log('   Zones: Police Station, School, Hospital, Fire Station, Park, Commercial, Residential (×3)');
            } catch (tErr) {
                console.warn('⚠️  Society generation failed:', tErr.message, tErr.stack);
            }
        }

        // ── Enhanced background buildings ────────────────────
        // Replace simple block buildings with detailed multi-story facades
        const sceneWantsBackgroundStructures = Array.isArray(scenePlan?.environment?.surroundingElements)
            && scenePlan.environment.surroundingElements.some(el => el === 'background_structures' || el === 'buildings');
        const sceneRequestsExpandedWorld = scenePlan?.environment?.expandedWorld === true
            || ['town', 'outdoor_park', 'floating_island', 'arena'].includes(scenePlan?.sceneType);
        const sceneIsSchoolCampus = scenePlan?.environment?.schoolCampusExterior === true
            || scenePlan?.sceneType === 'classroom';
        if (scenePlan && generateEnv !== false && sceneWantsBackgroundStructures && sceneRequestsExpandedWorld && !sceneIsSchoolCampus) {
            try {
                const dims = scenePlan.dimensions || { width: 50, depth: 40 };
                const halfW = dims.width / 2;
                const halfD = dims.depth / 2;
                const gl = scenePlan.groundLevel || 0;
                const buildingPositions = [
                    { x: halfW * 1.6, z: 0, floors: 3 + Math.floor(Math.random() * 4) },
                    { x: -halfW * 1.6, z: 0, floors: 2 + Math.floor(Math.random() * 5) },
                    { x: 0, z: -halfD * 1.6, floors: 2 + Math.floor(Math.random() * 3) },
                ];
                let bgCount = 0;
                for (const bp of buildingPositions) {
                    if (bgCount > 150) break; // Cap total background building parts
                    const bldg = generateBuilding({
                        x: bp.x,
                        z: bp.z,
                        groundLevel: gl,
                        floors: bp.floors,
                        width: 14 + Math.random() * 10,
                        depth: 10 + Math.random() * 6,
                        detailLevel: 'medium',
                        groundFloorShop: true,
                    });
                    safe.instances = [...(safe.instances || []), ...bldg.instances];
                    bgCount += bldg.instances.length;
                }
                if (bgCount > 0) {
                    console.log(`🏢 Enhanced buildings: added ${bgCount} detailed background building parts`);
                }
            } catch (bldgErr) {
                console.warn('⚠️  Building generation failed:', bldgErr.message);
            }
        }

        // ── Environment generation ───────────────────────────
        if (generateEnv !== false && scenePlan) {
            try {
                const envResult = generateEnvironment(scenePlan);
                const requestedPhase = Math.max(1, Math.min(3, inferRequestedPhase(prompt, session)));
                if (usedDeterministicScenePlan && requestedPhase === 1) {
                    // Keep phase-1 focused on core layout; defer dense surroundings to later phases.
                    envResult.instances = envResult.instances.slice(0, 14);
                    envResult.terrain = envResult.terrain.slice(0, 4);
                }
                if (envResult.instances.length > 0 || envResult.terrain.length > 0) {
                    safe.instances = [...(safe.instances || []), ...envResult.instances];
                    safe.terrain = [...(safe.terrain || []), ...envResult.terrain];
                    console.log(`🌍 Added ${envResult.instances.length} environment instances, ${envResult.terrain.length} terrain ops`);
                }

                if (usedDeterministicScenePlan && requestedPhase === 1) {
                    const boundaryNames = new Set(
                        (safe.instances || [])
                            .map(inst => String(inst?.properties?.Name || ''))
                            .filter(Boolean)
                    );
                    const hasBoundary = [...boundaryNames].some(name => /boundary|waterbound/i.test(name));
                    if (!hasBoundary) {
                        const boundaryFallback = buildDeterministicBoundaryInstances(scenePlan);
                        safe.instances = [...(safe.instances || []), ...boundaryFallback];
                        safe.warnings = [...(safe.warnings || []), 'Inserted deterministic map boundaries for phase-1 world completeness.'];
                        console.log(`[${requestId}] injected deterministic boundary instances`);
                    }
                }
            } catch (envErr) {
                console.warn('⚠️  Environment generation failed:', envErr.message);
            }
        }

        // Interior classroom / lobby: strip ALL terrain ops (AI + env merge).
        // Also strip when preset matches classroom/lobby without campus keywords,
        // even if scenePlan is null (quick mode) or AI omitted environment.interiorOnly.
        const roomPresetForStrip = identifyRoomType(prompt);
        const stripInteriorTerrain = scenePlan?.environment?.interiorOnly
            || scenePlan?.environment?.skipTerrainOperations
            || (scenePlan?.sceneType === 'classroom' && !scenePlan?.environment?.expandedWorld)
            || (scenePlan?.sceneType === 'classroom' && promptRequestsInteriorOnly(prompt))
            || ((roomPresetForStrip?.key === 'classroom' || roomPresetForStrip?.key === 'lobby')
                && !promptRequestsExpandedSurroundings(prompt));
        if (stripInteriorTerrain && Array.isArray(safe.terrain) && safe.terrain.length > 0) {
            const n = safe.terrain.length;
            safe.terrain = [];
            safe.warnings = [...(safe.warnings || []),
                `Removed ${n} Workspace.Terrain fill(s) for this school/interior shell (Part floors + Part-based exterior). Clear Terrain in Studio once if old grass remains.`];
            console.log(`[${requestId}] stripped ${n} terrain op(s) — no Terrain fills for this layout`);
        }

        // ── Phase-1 composition guard (generic scene quality) ─
        // Ensures the first phase of scene/map requests includes a usable core structure,
        // preventing "terrain-only" or overly sparse architectural output.
        if (
            isSceneLikePrompt(prompt)
            && safe.currentPhase === 1
            && safe.totalPhases > 1
        ) {
            const structuralCount = countStructuralInstances(safe.instances || []);
            if ((structuralCount < 4 || !hasClosedShell(safe.instances || [])) && !hasExistingLayoutShell(safe.instances || [])) {
                const fallbackStructure = buildCoreStructureFallback(scenePlan);
                safe.instances = [...(safe.instances || []), ...fallbackStructure];
                safe.warnings = [
                    ...(safe.warnings || []),
                    'Phase 1 had weak architecture; backend injected a core structure shell for coherence.',
                ];
                console.log(`[${requestId}] injected core structure fallback for phase-1 coherence`);
            }
        }

        // ── Scene validation ─────────────────────────────────
        const sceneValidation = validateSceneOutput(safe, {
            scenePlan,
            expectEnvironment: !!(scenePlan && generateEnv !== false && scenePlan.environment?.generateSurroundings),
        });

        // [G3] Cross-reference check
        const crossRefWarnings = checkCrossReferences(safe);
        const allWarnings = [...crossRefWarnings, ...(sceneValidation.warnings || [])];
        if (shouldForceDetailed) {
            allWarnings.push(
                'Quick mode was auto-upgraded to Detailed for this request to preserve scene planning and reference-image quality.'
            );
        }
        if (imageWarnings.length > 0) {
            allWarnings.push(...imageWarnings);
        }
        if (allWarnings.length > 0) {
            safe.warnings = allWarnings;
            console.warn('Validation warnings:', allWarnings);
        }

        // Critical errors — signal plugin to block apply
        if (sceneValidation.errors && sceneValidation.errors.length > 0) {
            safe.validationErrors = sceneValidation.errors;
            console.error('Validation ERRORS (should block apply):', sceneValidation.errors);
        }

        // ── Coherence validation gate (critical checks) ─────
        if (isSceneLikePrompt(prompt)) {
            const critical = [];
            const structureCount = countStructuralInstances(safe.instances || []);
            const hasShell = hasClosedShell(safe.instances || []);
            const envScore = countEnvironmentSignals(safe.instances || [], safe.terrain || []);
            const expectsWorldLayer = !!(scenePlan && generateEnv !== false && scenePlan.environment?.generateSurroundings);

            if (safe.currentPhase === 1 && safe.totalPhases > 1 && (!hasShell || structureCount < 4)) {
                critical.push('Phase 1 failed coherence check: missing core structure shell (floor/roof/walls).');
            }

            if (expectsWorldLayer && envScore < 8 && !scenePlan?.environment?.interiorOnly && !scenePlan?.environment?.skipTerrainOperations) {
                critical.push('World composition check failed: surrounding environment is too sparse for a playable map.');
            }

            if (critical.length > 0) {
                safe.validationErrors = [...(safe.validationErrors || []), ...critical];
                safe.warnings = [...(safe.warnings || []), 'Output failed coherence checks and should be regenerated.'];
                console.error(`[${requestId}] coherence gate blocked apply:`, critical);
            }
        }

        // ── Attach scene plan to response for plugin preview ─
        if (scenePlanText) {
            safe.scenePlan = scenePlanText;
        }
        safe.generationMode = generationMode;

        // ── Atmospheric lighting configuration ───────────────
        // Configure Roblox Lighting service for room mood/atmosphere
        if (roomLayout && roomLayout.lighting) {
            const rl = roomLayout.lighting;
            const ambColor = rl.ambientColor || [55, 50, 45];
            // Use image-derived lighting if available
            const lightOverride = imageLayoutOverrides?.lightOverride;
            const isWarm = lightOverride
                ? (lightOverride.mood === 'warm')
                : rl.type === 'warm_pendants';
            const isDark = roomLayout.ceilingColor && roomLayout.ceilingColor[0] < 100;
            const isClassInterior = roomLayout.sceneType === 'classroom' || roomLayout.sceneType === 'lobby';
            const defaultBrightness = lightOverride?.brightness
                ?? (isDark ? 0.8 : (isClassInterior ? 1.15 : 1.5));
            safe.lightingConfig = {
                Ambient:                  lightOverride?.ambientColor || ambColor,
                OutdoorAmbient:           [80, 80, 90],
                Brightness:               defaultBrightness,
                ClockTime:                isWarm ? 18 : 14,
                GeographicLatitude:       35,
                FogEnd:                   400,
                FogColor:                 isDark ? [30, 28, 25] : [192, 190, 188],
                ColorShift_Top:           isWarm ? [255, 240, 210] : [240, 240, 245],
                ColorShift_Bottom:        isWarm ? [40, 30, 20]  : [30, 30, 35],
                EnvironmentDiffuseScale:  0.5,
                EnvironmentSpecularScale: 0.3,
                ExposureCompensation:     isDark ? 0.5 : (isClassInterior ? -0.15 : 0.0),
                GlobalShadows:            isClassInterior,
            };
            console.log(`💡 Atmospheric lighting: ${isWarm ? 'warm evening' : 'neutral daylight'} mood configured`);
        }

        // ── Image analysis summary card (for plugin UI) ──────
        // Attach summary card so plugin can display what was extracted
        if (imageAnalysisSummaryCard) {
            safe.imageAnalysisSummaryCard = imageAnalysisSummaryCard;
            console.log(`🃏 Image analysis summary card attached (room=${imageAnalysisSummaryCard.roomType} confidence=${imageAnalysisSummaryCard.confidenceLabel})`);
        }

        // ── Quality evaluation (multi-criteria scoring) ──────
        if (isSceneLikePrompt(prompt)) {
            try {
                const qualityResult = evaluateSceneQuality(safe, {
                    scenePlan,
                    roomLayout: roomLayout || null,
                    prompt,
                    expectEnvironment: !!(scenePlan && generateEnv !== false && scenePlan.environment?.generateSurroundings),
                });
                safe.quality = qualityResult;
                console.log(
                    `[${requestId}] quality: ${qualityResult.grade} (${qualityResult.overall}) — ` +
                    Object.entries(qualityResult.scores).map(([k, v]) => `${k}=${v}`).join(' ')
                );

                // If grade is poor, add a clear warning
                if (qualityResult.grade === 'poor') {
                    safe.warnings = [
                        ...(safe.warnings || []),
                        `Quality grade: POOR (${qualityResult.overall}). The output is far below production quality.`,
                        ...qualityResult.feedback.filter(f => f.includes('Missing') || f.includes('0%') || f.includes('empty')),
                    ];
                } else if (qualityResult.grade === 'weak') {
                    safe.warnings = [
                        ...(safe.warnings || []),
                        `Quality grade: WEAK (${qualityResult.overall}). Output needs significant improvement.`,
                    ];
                }
            } catch (qualErr) {
                console.warn('⚠️  Quality evaluation failed:', qualErr.message);
            }
        }

        // Store assistant reply in history
        session.messages.push({
            role: 'assistant',
            content: buildAssistantHistoryEntry(safe),
        });
        session.lastResponse = buildLastResponseState(safe);
        conversations.set(conversationId, session);

        console.log(
            `[${requestId}] done in ${Date.now() - startedAt}ms instances=${(safe.instances || []).length} scripts=${(safe.scripts || []).length} terrain=${(safe.terrain || []).length} warnings=${(safe.warnings || []).length}`
        );
        return res.json(safe);

    } catch (err) {
        session.messages = session.messages.slice(0, historyLengthBeforeTurn);

        // [B2] Structured, actionable error messages
        console.error(`[${requestId}] ${AI_PROVIDER} error after retries:`, err);

        const providerName = ACTIVE_PROVIDER.displayName;
        const keyName      = ACTIVE_PROVIDER.keyName;

        const resp = {
            error:      'AI Generation Failed',
            details:    {},
            suggestion: '',
        };

        if (err.code === 'AI_TIMEOUT' || err.code === 'AI_REPAIR_TIMEOUT') {
            resp.details  = { type: 'AI Timeout', message: `${providerName} took too long to respond.` };
            resp.suggestion = 'Try a simpler prompt, or retry in a moment.';
        } else if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
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
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'Roblox AI backend is running. Use POST /generate or GET /health.',
        provider: AI_PROVIDER,
        model: AI_MODEL,
        timestamp: new Date().toISOString(),
    });
});

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
