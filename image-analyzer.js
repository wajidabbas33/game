// ============================================================
//  Roblox AI Plugin – Image Analyzer Module  (v2 — Deep Extraction)
//
//  Processes reference images via qwen-vl-max (highest vision model).
//  Deep-extracts Roblox-buildable data:
//    • Room type + dimensions in studs
//    • Per-wall materials + colors (RGB)
//    • Floor material + pattern
//    • Structural elements (columns, arches, fireplaces)
//    • Prop inventory (name, size, position zone, material, count)
//    • Lighting rig (type, color, intensity, shadows)
//    • Exterior zone layout (roads, buildings, trees, civic)
//    • Art style + color palette (primary/secondary/accent)
//
//  ALWAYS uses:  VISION_MODEL=qwen-vl-max  (overrideable by env)
//                image_url.detail = "high"  (non-negotiable)
//                max_tokens = 2000
//
//  Usage:
//    const { analyzeReferenceImages } = require('./image-analyzer');
//    const analysis = await analyzeReferenceImages(referenceImages, prompt);
// ============================================================

'use strict';

const https = require('https');
const OpenAI = require('openai');

// ── Deep-extraction vision prompt ─────────────────────────────
// This prompt instructs qwen-vl-max to extract EVERY piece of
// Roblox-buildable data from the image, not just descriptive text.
const DEEP_EXTRACTION_PROMPT = `You are an expert Roblox Studio scene architect analyzing a reference image.
Your job is to extract EVERY piece of information needed to recreate this scene in Roblox using Part primitives.
Be extremely precise. Estimate all dimensions in Roblox studs (1 stud ≈ 0.28 meters).

Return ONLY a JSON object with this EXACT structure. Do not add any explanation or markdown.

{
  "sceneCategory": "interior | exterior | mixed",
  "roomType": "one of: formal_office | café | restaurant | bar | office | lobby | corridor | living_room | classroom | hospital | gym | town_exterior | residential | commercial | park | unknown",
  "confidence": 0.0,

  "dimensions": {
    "widthStuds": 0,
    "depthStuds": 0,
    "heightStuds": 0,
    "aspectRatio": "square | portrait | landscape | tunnel (4:1+)"
  },

  "architecture": {
    "shape": "rectangular | oval | L-shaped | open | corridor | irregular",
    "hasColumns": false,
    "columnCount": 0,
    "columnStyle": "doric | ionic | modern | industrial | none",
    "hasArches": false,
    "hasFireplace": false,
    "hasStaircase": false,
    "hasMezzanine": false,
    "ceilingType": "flat | vaulted | coffered | grid | open | none"
  },

  "walls": {
    "front":  { "material": "Brick | SmoothPlastic | Glass | Wood | Concrete | Marble | Metal | Fabric", "color": [R,G,B], "hasWindows": false, "windowCount": 0, "windowStyle": "none | standard | floor-to-ceiling | arched | porthole", "treatment": "none | paneling | wainscoting | wallpaper | tile | curtains | shelving" },
    "back":   { "material": "...", "color": [R,G,B], "hasWindows": false, "windowCount": 0, "windowStyle": "none", "treatment": "none" },
    "left":   { "material": "...", "color": [R,G,B], "hasWindows": false, "windowCount": 0, "windowStyle": "none", "treatment": "none" },
    "right":  { "material": "...", "color": [R,G,B], "hasWindows": false, "windowCount": 0, "windowStyle": "none", "treatment": "none" }
  },

  "floor": {
    "material": "WoodPlanks | Concrete | Marble | Grass | Asphalt | Tile | SmoothPlastic | Carpet",
    "color": [R,G,B],
    "pattern": "none | herringbone | checkerboard | plank | hexagon | stripe",
    "hasRug": false,
    "rugColor": [R,G,B]
  },

  "ceiling": {
    "material": "SmoothPlastic | Concrete | WoodPlanks | Metal | Glass | none",
    "color": [R,G,B],
    "hasBeams": false,
    "hasSkylight": false,
    "height": 0
  },

  "lighting": {
    "type": "chandelier | pendant | recessed | tube | neon | natural | torches | mixed",
    "color": [R,G,B],
    "intensity": "dim | moderate | bright | very_bright",
    "mood": "warm | cool | neutral | dramatic | neon",
    "hasShadows": false,
    "timeOfDay": "dawn | morning | noon | afternoon | golden_hour | dusk | night | indoor",
    "ambientColor": [R,G,B]
  },

  "props": [
    {
      "name": "exact prop name",
      "category": "seating | table | storage | decor | plant | lighting | appliance | counter | structural | vehicle | signage",
      "sizeClass": "tiny | small | medium | large | xlarge",
      "estimatedSizeStuds": [width, height, depth],
      "material": "Wood | Metal | SmoothPlastic | Glass | Fabric | Marble | Concrete",
      "color": [R,G,B],
      "zone": "front-left | front-center | front-right | center-left | center | center-right | back-left | back-center | back-right | perimeter | ceiling",
      "count": 1,
      "isRequired": true
    }
  ],

  "specialElements": {
    "hasIlluminatedPanels": false,
    "panelColor": [R,G,B],
    "hasDrapes": false,
    "drapeColor": [R,G,B],
    "hasHedgePlanters": false,
    "hasFountain": false,
    "hasPlayground": false,
    "hasParkedVehicles": false,
    "hasStreetFurniture": false,
    "hasRoadMarkings": false,
    "hasCrosswalk": false,
    "hasTreeLine": false
  },

  "exterior": {
    "isExterior": false,
    "roadType": "none | asphalt | dirt | cobblestone",
    "roadLayout": "none | straight | grid | curved | loop",
    "buildingStyles": [],
    "hasResidential": false,
    "hasCivic": false,
    "hasCommercial": false,
    "hasPark": false,
    "vegetationType": "none | pine_trees | deciduous | mixed | tropical | hedges",
    "treeCount": "none | few | moderate | many"
  },

  "colorPalette": {
    "primary": [R,G,B],
    "secondary": [R,G,B],
    "accent": [R,G,B],
    "background": [R,G,B],
    "artStyle": "low_poly | realistic | cartoon | stylized | minimalist | rustic | futuristic | classic | formal"
  },

  "overrides": {
    "forceRoomType": "leave empty or specify room type key to lock the generation to this type",
    "forceDimensions": false,
    "forceColorPalette": false,
    "forceWallMaterials": false,
    "forceLighting": false
  },

  "generationNotes": "Brief summary of the 3 most important things to recreate this scene accurately in Roblox"
}`;

// ── Vision client (always qwen-vl-max) ───────────────────────

/**
 * Creates a vision client that ALWAYS uses high-detail image analysis.
 * Model preference: VISION_MODEL env → qwen-vl-max → gpt-4o
 * Detail: always "high" (reads VISION_DETAIL env but defaults to "high")
 */
function createVisionClient() {
    // Always prefer qwen-vl-max; fall back only if no Qwen key present
    const visionModel = process.env.VISION_MODEL
        || (process.env.QWEN_API_KEY  ? 'qwen-vl-max'  : null)
        || (process.env.OPENAI_API_KEY ? 'gpt-4o'       : null);

    if (!visionModel) return null;

    const apiKey = process.env.VISION_API_KEY
        || process.env.QWEN_API_KEY
        || process.env.OPENAI_API_KEY;

    if (!apiKey) return null;

    const baseURL = process.env.VISION_BASE_URL
        || process.env.QWEN_BASE_URL
        || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

    // detail level: always "high"; allow override via env for testing
    const detail = (process.env.VISION_DETAIL || 'high').toLowerCase();

    return {
        client: new OpenAI({ apiKey, baseURL }),
        model: visionModel,
        detail, // passed to every image_url content part
    };
}

// ── Image URL utilities ───────────────────────────────────────

function isHttpUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const parsed = new URL(value.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) { return false; }
}

function isDataImageUrl(value) {
    if (typeof value !== 'string') return false;
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value.trim());
}

function parseRobloxAssetId(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(Math.floor(value));
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const patterns = [
        /^rbxassetid:\/\/(\d+)$/i,
        /[?&]id=(\d+)/i,
        /\/(?:library|catalog|assets)\/(\d+)/i,
        /^(\d+)$/,
    ];
    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

function normalizeReferenceImages(referenceImages, legacyImageUrls) {
    const images = [], warnings = [];
    const push = (entry, src) => {
        if (typeof entry === 'string') {
            const t = entry.trim();
            if (!t) return;
            if (isHttpUrl(t))       { images.push({ type: 'url', value: t }); return; }
            if (isDataImageUrl(t))  { images.push({ type: 'inline', value: t }); return; }
            const id = parseRobloxAssetId(t);
            if (id)                 { images.push({ type: 'asset', value: id }); return; }
            warnings.push(`${src} "${t}" is not a valid image URL or asset ID.`);
            return;
        }
        if (!entry || typeof entry !== 'object') return;
        const rawValue = String(entry.value ?? '').trim();
        const rawType  = String(entry.type  ?? '').trim().toLowerCase();
        const label    = typeof entry.label === 'string' ? entry.label.trim().slice(0, 80) : undefined;
        if (!rawValue) return;
        if (rawType === 'url')    { isHttpUrl(rawValue)      ? images.push({ type: 'url',    value: rawValue, label }) : warnings.push(`${src}: "${rawValue}" not a valid URL.`); return; }
        if (rawType === 'inline') { isDataImageUrl(rawValue) ? images.push({ type: 'inline', value: rawValue, label }) : warnings.push(`${src}: not a valid inline image.`); return; }
        if (rawType === 'asset')  {
            const assetId = parseRobloxAssetId(rawValue);
            assetId ? images.push({ type: 'asset', value: assetId, label }) : warnings.push(`${src}: "${rawValue}" not a valid asset ID.`);
            return;
        }
        push(rawValue, src);
    };
    for (const e of (Array.isArray(referenceImages) ? referenceImages : [])) push(e, 'Reference image');
    if (Array.isArray(legacyImageUrls)) for (const e of legacyImageUrls) push(e, 'Legacy image URL');
    return { images, warnings };
}

// ── Roblox asset resolution ────────────────────────────────────

function requestJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let body = '';
            res.on('data', c => { body += c.toString(); });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
                try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function resolveRobloxAssetImage(assetId) {
    const directUrl = `https://assetgame.roblox.com/asset/?id=${assetId}`;
    const endpoint  = `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(assetId)}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`;
    try {
        const payload = await requestJson(endpoint);
        const entry   = Array.isArray(payload?.data) ? payload.data[0] : null;
        if (entry?.imageUrl && isHttpUrl(entry.imageUrl)) return { url: entry.imageUrl, warning: null };
        return { url: directUrl, warning: `Asset ${assetId} thumbnail pending; using direct URL.` };
    } catch (err) {
        return { url: directUrl, warning: `Asset ${assetId} resolve failed (${err.message}); using direct URL.` };
    }
}

async function resolveReferenceImages(referenceImages) {
    const warnings = [], resolved = [];
    const input = Array.isArray(referenceImages) ? referenceImages : [];
    if (input.length > 3) warnings.push('Only the first 3 reference images are used per request.');
    for (const entry of input.slice(0, 3)) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.type === 'url') {
            isHttpUrl(entry.value) ? resolved.push({ ...entry, url: entry.value }) : warnings.push(`URL "${entry.value}" is invalid.`);
        } else if (entry.type === 'inline') {
            isDataImageUrl(entry.value) ? resolved.push({ ...entry, url: entry.value }) : warnings.push('Inline image payload invalid.');
        } else if (entry.type === 'asset') {
            const id = parseRobloxAssetId(entry.value);
            if (!id) { warnings.push(`Asset "${entry.value}" invalid.`); continue; }
            const r = await resolveRobloxAssetImage(id);
            resolved.push({ type: 'asset', value: id, label: entry.label || `Asset ${id}`, url: r.url });
            if (r.warning) warnings.push(r.warning);
        }
    }
    return { images: resolved, warnings };
}

// ── Core analysis function ─────────────────────────────────────

/**
 * Analyze reference images using qwen-vl-max with high detail.
 * Returns deep-extracted Roblox-buildable JSON.
 *
 * @param {Array} referenceImages  — Normalized image entries
 * @param {string} promptContext   — User's text prompt
 * @returns {Promise<object|null>}
 */
async function analyzeReferenceImages(referenceImages, promptContext) {
    if (!referenceImages || referenceImages.length === 0) return null;

    const vision = createVisionClient();
    if (!vision) {
        console.log('ℹ️  No vision model configured — skipping image analysis');
        console.log('   Set VISION_MODEL=qwen-vl-max and VISION_API_KEY in .env');
        return null;
    }

    console.log(`🔍 Image analysis: model=${vision.model} detail=${vision.detail} images=${Math.min(referenceImages.length, 3)}`);

    // Build content array
    const content = [];

    // Reference labels summary
    const refSummary = referenceImages.slice(0, 3)
        .map((e, i) => {
            if (!e || typeof e !== 'object') return null;
            const label = e.label || (e.type === 'asset' ? `Roblox asset ${e.value}` : `Image ${i + 1}`);
            return `Image ${i + 1}: ${label}`;
        })
        .filter(Boolean)
        .join('\n');

    // System instruction text
    content.push({
        type: 'text',
        text: DEEP_EXTRACTION_PROMPT
            + (promptContext ? `\n\nUser's scene request: "${promptContext}"` : '')
            + (refSummary   ? `\n\nReference images provided:\n${refSummary}` : ''),
    });

    // Add images with ALWAYS high detail
    for (const entry of referenceImages.slice(0, 3)) {
        const url = typeof entry === 'string'
            ? entry.trim()
            : (entry?.url || entry?.value || '');

        if (!url) continue;

        content.push({
            type: 'image_url',
            image_url: {
                url,
                detail: vision.detail, // always "high"
            },
        });
    }

    if (content.length <= 1) {
        console.log('ℹ️  No valid image content — skipping analysis');
        return null;
    }

    try {
        const completion = await vision.client.chat.completions.create({
            model: vision.model,
            messages: [{ role: 'user', content }],
            max_tokens: 2500,   // more tokens for full deep extraction
            temperature: 0.1,   // near-deterministic for consistent JSON
        });

        const responseText = completion.choices?.[0]?.message?.content || '';
        console.log(`✅ Vision response received (${responseText.length} chars) from ${vision.model}`);

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const analysis = JSON.parse(jsonMatch[0]);
                console.log(`✅ Deep extraction complete — roomType: ${analysis.roomType}, confidence: ${analysis.confidence}`);
                return analysis;
            } catch (parseErr) {
                console.warn('⚠️  JSON parse failed:', parseErr.message);
                return { notes: responseText.slice(0, 800), raw: true };
            }
        }

        return { notes: responseText.slice(0, 800), raw: true };

    } catch (err) {
        console.warn('⚠️  Image analysis failed:', err.message);
        if (err.message?.includes('model')) {
            console.warn('   Check VISION_MODEL and VISION_API_KEY in .env');
        }
        return null;
    }
}

// ── Context converter (for AI planner prompt injection) ────────

/**
 * Convert deep-extracted analysis to rich text context for the planner.
 * @param {object|null} analysis
 * @returns {string}
 */
function imageAnalysisToContext(analysis) {
    if (!analysis) return '';
    if (analysis.raw) return `\nReference image analysis:\n${analysis.notes}`;

    const lines = ['\n=== REFERENCE IMAGE ANALYSIS (qwen-vl-max deep extraction) ==='];

    if (analysis.sceneCategory)   lines.push(`Scene category : ${analysis.sceneCategory}`);
    if (analysis.roomType)        lines.push(`Room type      : ${analysis.roomType} (confidence: ${analysis.confidence})`);

    if (analysis.dimensions) {
        const d = analysis.dimensions;
        lines.push(`Dimensions     : ${d.widthStuds}w × ${d.depthStuds}d × ${d.heightStuds}h studs (${d.aspectRatio})`);
    }

    if (analysis.architecture) {
        const a = analysis.architecture;
        const parts = [`shape=${a.shape}`, `ceiling=${a.ceilingType}`];
        if (a.hasColumns)   parts.push(`${a.columnCount} ${a.columnStyle} columns`);
        if (a.hasFireplace) parts.push('fireplace');
        if (a.hasArches)    parts.push('arches');
        if (a.hasStaircase) parts.push('staircase');
        lines.push(`Architecture   : ${parts.join(', ')}`);
    }

    if (analysis.walls) {
        for (const [side, wall] of Object.entries(analysis.walls)) {
            if (!wall?.material) continue;
            const wins = wall.hasWindows ? ` ${wall.windowCount}×${wall.windowStyle} windows` : '';
            const treat = wall.treatment && wall.treatment !== 'none' ? ` [${wall.treatment}]` : '';
            lines.push(`Wall ${side.padEnd(5)}    : ${wall.material} rgb(${wall.color})${wins}${treat}`);
        }
    }

    if (analysis.floor) {
        const f = analysis.floor;
        lines.push(`Floor          : ${f.material} rgb(${f.color}) pattern=${f.pattern}${f.hasRug ? ' +RUG' : ''}`);
    }

    if (analysis.lighting) {
        const l = analysis.lighting;
        lines.push(`Lighting       : ${l.type} | ${l.mood} | ${l.intensity} | ${l.timeOfDay}`);
        lines.push(`Light color    : rgb(${l.color}) ambient rgb(${l.ambientColor})`);
    }

    if (Array.isArray(analysis.props) && analysis.props.length > 0) {
        lines.push(`Props (${analysis.props.length}):`);
        for (const prop of analysis.props.slice(0, 20)) {
            const req = prop.isRequired ? ' [REQUIRED]' : '';
            lines.push(`  • ${prop.name} ×${prop.count} — ${prop.zone} — ${prop.material} rgb(${prop.color})${req}`);
        }
    }

    if (analysis.specialElements) {
        const se = analysis.specialElements;
        const flags = Object.entries(se)
            .filter(([k, v]) => v === true)
            .map(([k]) => k.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase());
        if (flags.length > 0) lines.push(`Special        : ${flags.join(', ')}`);
    }

    if (analysis.exterior?.isExterior) {
        const ex = analysis.exterior;
        lines.push(`Exterior       : roads=${ex.roadLayout} trees=${ex.vegetationType} residential=${ex.hasResidential} civic=${ex.hasCivic}`);
    }

    if (analysis.colorPalette) {
        const cp = analysis.colorPalette;
        lines.push(`Art style      : ${cp.artStyle}`);
        lines.push(`Colors         : primary rgb(${cp.primary}) | secondary rgb(${cp.secondary}) | accent rgb(${cp.accent})`);
    }

    if (analysis.overrides?.forceRoomType) {
        lines.push(`⚠️  OVERRIDE     : Force room type → ${analysis.overrides.forceRoomType}`);
    }

    if (analysis.generationNotes) {
        lines.push(`Key notes      : ${analysis.generationNotes}`);
    }

    lines.push('=================================================================');
    return lines.join('\n');
}

module.exports = {
    analyzeReferenceImages,
    imageAnalysisToContext,
    createVisionClient,
    normalizeReferenceImages,
    resolveReferenceImages,
    parseRobloxAssetId,
    isHttpUrl,
    isDataImageUrl,
    DEEP_EXTRACTION_PROMPT,
};
