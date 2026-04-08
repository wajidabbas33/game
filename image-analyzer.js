// ============================================================
//  Roblox AI Plugin – Image Analyzer Module  v2.0
//
//  Processes reference images via a vision-capable AI model.
//  Extracts: style, color palette, proportions, layout, furniture.
//  Falls back gracefully when VISION_MODEL env var is not set.
//
//  v2.0 improvements:
//  - Better style extraction with architectural descriptors
//  - Proportional guidance for consistent object sizing
//  - Multi-image support with weighted analysis
//  - Scene type detection enhanced for Roblox context
//  - Layout density and spacing recommendations
//
//  Uses OpenAI-compatible API with image_url content parts.
// ============================================================

'use strict';

const https = require('https');
const OpenAI = require('openai');

const IMAGE_ANALYSIS_PROMPT = `You are analyzing a reference image for a Roblox Studio scene generator.
Extract EVERY visual detail you can see. Be specific and precise — the builder depends on this analysis to recreate the scene.

Return ONLY a JSON object with these fields (skip any you cannot confidently determine):

{
  "sceneType": "classroom | park | town | arena | lobby | island | forest | street | cafe | office | house | dungeon | custom",

  "style": "describe in 2-4 words, e.g. 'modern minimalist', 'rustic cozy', 'sci-fi industrial', 'colorful cartoon'",

  "colors": {
    "primary":   [R, G, B],
    "secondary": [R, G, B],
    "accent":    [R, G, B],
    "floor":     [R, G, B],
    "walls":     [R, G, B],
    "ceiling":   [R, G, B]
  },

  "objects": [
    "exact object name as seen, e.g. wooden desk, metal locker, stone pillar, hanging lamp"
  ],

  "layout": "grid | rows | scattered | circular | symmetrical | organic | L-shape | perimeter",

  "density": "sparse | moderate | dense",

  "proportions": {
    "scale": "small | medium | large | very_large",
    "ceilingHeight": "low | normal | tall | outdoor",
    "roomWidth": "narrow | medium | wide | very_wide",
    "objectSpacing": "tight | normal | spacious"
  },

  "materials": [
    "exact Roblox material name from: Wood, SmoothPlastic, Metal, Brick, Concrete, Cobblestone, Glass, Neon, Marble, Granite, Grass, Ground, Sand, Rock, Ice, Fabric, Slate, WoodPlanks"
  ],

  "lighting": "bright | dim | warm | cool | golden_hour | night | neon",

  "atmosphere": "indoor | outdoor | underground | elevated",

  "floorPattern": "flat | checkered | tiled | wooden_planks | carpet | stone | dirt | grass",

  "wallPattern": "plain | painted | brick | paneled | glass | stone | tiled",

  "landmarks": ["most visually distinctive feature in the scene, e.g. large central fountain, tall clock tower"],

  "notes": "One sentence capturing the most important visual detail not covered above"
}

Return ONLY the JSON. No prose, no markdown, no code fences. Be as specific as possible — vague answers are not useful.`;

/**
 * Create a vision-capable AI client.
 * Uses VISION_MODEL and VISION_API_KEY env vars.
 * Falls back to the primary API key if VISION_API_KEY is not set.
 */
function createVisionClient() {
    const visionModel = process.env.VISION_MODEL
        || (process.env.QWEN_API_KEY ? 'qwen-vl-plus' : null)
        || (process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : null);
    if (!visionModel) {
        return null;
    }

    const apiKey = process.env.VISION_API_KEY || process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return null;
    }

    const baseURL = process.env.VISION_BASE_URL
        || process.env.QWEN_BASE_URL
        || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

    return {
        client: new OpenAI({ apiKey, baseURL }),
        model: visionModel,
    };
}

function isHttpUrl(value) {
    if (typeof value !== 'string') {
        return false;
    }

    try {
        const parsed = new URL(value.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isDataImageUrl(value) {
    if (typeof value !== 'string') {
        return false;
    }

    const trimmed = value.trim();
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

function parseRobloxAssetId(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return String(Math.floor(value));
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed === '') {
        return null;
    }

    const patterns = [
        /^rbxassetid:\/\/(\d+)$/i,
        /[?&]id=(\d+)/i,
        /\/(?:library|catalog|assets)\/(\d+)/i,
        /^(\d+)$/,
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

function normalizeReferenceImages(referenceImages, legacyImageUrls) {
    const images = [];
    const warnings = [];

    const pushEntry = (entry, sourceLabel) => {
        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (!trimmed) {
                return;
            }

            if (isHttpUrl(trimmed)) {
                images.push({ type: 'url', value: trimmed });
                return;
            }

            if (isDataImageUrl(trimmed)) {
                images.push({ type: 'inline', value: trimmed });
                return;
            }

            const assetId = parseRobloxAssetId(trimmed);
            if (assetId) {
                images.push({ type: 'asset', value: assetId });
                return;
            }

            warnings.push(`${sourceLabel} "${trimmed}" is not a valid image URL, inline image payload, or Roblox asset reference.`);
            return;
        }

        if (!entry || typeof entry !== 'object') {
            return;
        }

        const rawValue = typeof entry.value === 'string' || typeof entry.value === 'number'
            ? String(entry.value).trim()
            : '';
        const rawType = typeof entry.type === 'string'
            ? entry.type.trim().toLowerCase()
            : '';
        const label = typeof entry.label === 'string' && entry.label.trim()
            ? entry.label.trim().slice(0, 80)
            : undefined;

        if (!rawValue) {
            return;
        }

        if (rawType === 'url') {
            if (isHttpUrl(rawValue)) {
                images.push({ type: 'url', value: rawValue, label });
            } else {
                warnings.push(`${sourceLabel} "${rawValue}" is not a valid HTTP(S) image URL.`);
            }
            return;
        }

        if (rawType === 'inline') {
            if (isDataImageUrl(rawValue)) {
                images.push({ type: 'inline', value: rawValue, label });
            } else {
                warnings.push(`${sourceLabel} is not a valid data:image/...;base64 payload.`);
            }
            return;
        }

        if (rawType === 'asset') {
            const assetId = parseRobloxAssetId(rawValue);
            if (assetId) {
                images.push({ type: 'asset', value: assetId, label });
            } else {
                warnings.push(`${sourceLabel} "${rawValue}" is not a valid Roblox asset ID.`);
            }
            return;
        }

        pushEntry(rawValue, sourceLabel);
    };

    for (const entry of Array.isArray(referenceImages) ? referenceImages : []) {
        pushEntry(entry, 'Reference image');
    }

    if (Array.isArray(legacyImageUrls)) {
        for (const entry of legacyImageUrls) {
            pushEntry(entry, 'Legacy image URL');
        }
    }

    return { images, warnings };
}

function requestJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let body = '';

            res.on('data', chunk => {
                body += chunk.toString();
            });

            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(new Error(`Invalid JSON response: ${err.message}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function resolveRobloxAssetImage(assetId) {
    const directUrl = `https://assetgame.roblox.com/asset/?id=${assetId}`;
    const endpoint =
        `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(assetId)}`
        + '&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false';

    try {
        const payload = await requestJson(endpoint);
        const entry = Array.isArray(payload?.data) ? payload.data[0] : null;

        if (entry && typeof entry.imageUrl === 'string' && isHttpUrl(entry.imageUrl)) {
            return { url: entry.imageUrl, warning: null };
        }

        if (entry && entry.state && entry.state !== 'Completed') {
            return {
                url: directUrl,
                warning: `Roblox asset ${assetId} thumbnail is still ${entry.state}; using direct asset URL fallback.`,
            };
        }

        return {
            url: directUrl,
            warning: `Could not resolve a public thumbnail URL for Roblox asset ${assetId}; using direct asset URL fallback.`,
        };
    } catch (err) {
        return {
            url: directUrl,
            warning: `Could not resolve Roblox asset ${assetId} thumbnail (${err.message}); using direct asset URL fallback.`,
        };
    }
}

async function resolveReferenceImages(referenceImages) {
    const warnings = [];
    const resolved = [];
    const input = Array.isArray(referenceImages) ? referenceImages : [];

    if (input.length > 3) {
        warnings.push('Only the first 3 reference images are used per request.');
    }

    for (const entry of input.slice(0, 3)) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }

        if (entry.type === 'url') {
            if (isHttpUrl(entry.value)) {
                resolved.push({
                    type: 'url',
                    value: entry.value,
                    label: entry.label,
                    url: entry.value,
                });
            } else {
                warnings.push(`Reference image URL "${entry.value}" is invalid and was skipped.`);
            }
            continue;
        }

        if (entry.type === 'inline') {
            if (isDataImageUrl(entry.value)) {
                resolved.push({
                    type: 'inline',
                    value: entry.value,
                    label: entry.label || 'Pasted image',
                    url: entry.value,
                });
            } else {
                warnings.push('Inline reference image payload is invalid and was skipped.');
            }
            continue;
        }

        if (entry.type === 'asset') {
            const assetId = parseRobloxAssetId(entry.value);
            if (!assetId) {
                warnings.push(`Reference asset "${entry.value}" is invalid and was skipped.`);
                continue;
            }

            const result = await resolveRobloxAssetImage(assetId);
            resolved.push({
                type: 'asset',
                value: assetId,
                label: entry.label || `Asset ${assetId}`,
                url: result.url,
            });
            if (result.warning) {
                warnings.push(result.warning);
            }
        }
    }

    return { images: resolved, warnings };
}

/**
 * Analyze reference images and return structured analysis.
 * @param {Array<string|{url:string,label?:string,type?:string,value?:string}>} referenceImages
 * @param {string} promptContext — The user's text prompt for additional context
 * @returns {Promise<object|null>} — Parsed image analysis or null if no vision model
 */
async function analyzeReferenceImages(referenceImages, promptContext) {
    if (!referenceImages || referenceImages.length === 0) {
        return null;
    }

    const vision = createVisionClient();
    if (!vision) {
        console.log('ℹ️  No vision model/client available — skipping image analysis');
        return null;
    }

    // Build content array with images and text
    const content = [];

    // Add the analysis instruction
    const referenceSummary = referenceImages
        .slice(0, 3)
        .map((entry, index) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }
            const label = entry.label || (entry.type === 'asset' ? `Roblox asset ${entry.value}` : `Reference ${index + 1}`);
            return `Reference ${index + 1}: ${label}`;
        })
        .filter(Boolean)
        .join('\n');

    content.push({
        type: 'text',
        text:
            IMAGE_ANALYSIS_PROMPT
            + (promptContext ? `\n\nUser's scene request: "${promptContext}"` : '')
            + (referenceSummary ? `\n\nReference list:\n${referenceSummary}` : ''),
    });

    // Add images (max 3)
    const urls = referenceImages.slice(0, 3);
    for (const entry of urls) {
        const url = typeof entry === 'string'
            ? entry
            : (entry && typeof entry.url === 'string' ? entry.url : '');
        if (url && url.trim()) {
            content.push({
                type: 'image_url',
                image_url: { url: url.trim() },
            });
        }
    }

    if (content.length <= 1) {
        return null; // No valid images
    }

    try {
        const completion = await vision.client.chat.completions.create({
            model: vision.model,
            messages: [
                { role: 'user', content },
            ],
            max_tokens: 1800,
            temperature: 0.1,
        });

        const responseText = completion.choices?.[0]?.message?.content || '';

        // Try to parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const analysis = JSON.parse(jsonMatch[0]);
                console.log('✅ Image analysis completed successfully');
                return analysis;
            } catch (parseErr) {
                console.warn('⚠️  Image analysis returned invalid JSON:', parseErr.message);
                return { notes: responseText.slice(0, 500), raw: true };
            }
        }

        return { notes: responseText.slice(0, 500), raw: true };

    } catch (err) {
        console.warn('⚠️  Image analysis failed:', err.message);
        return null;
    }
}

/**
 * Convert image analysis result into authoritative generation directives.
 * These are written as MUST/REQUIRED instructions so the model cannot ignore them.
 * @param {object|null} analysis — Result from analyzeReferenceImages
 * @returns {string} — System-level directive block to inject into the AI prompt
 */
function imageAnalysisToContext(analysis) {
    if (!analysis) {
        return '';
    }

    // Raw fallback: the vision model returned prose instead of JSON
    if (analysis.raw) {
        return [
            '════════════════════════════════════════════════════════',
            'REFERENCE IMAGE — STYLE ONLY',
            '════════════════════════════════════════════════════════',
            'A reference image was analyzed. Use these notes for colors, materials, and style.',
            'The user\'s TEXT PROMPT defines scene type and layout; do not override it with the image.',
            analysis.notes || '',
            '════════════════════════════════════════════════════════',
        ].join('\n');
    }

    const lines = [
        '════════════════════════════════════════════════════════',
        'REFERENCE IMAGE — STYLE AND MATERIALS (not scene-type override)',
        '════════════════════════════════════════════════════════',
        'The user attached a reference image. Use it for colors, materials, lighting, proportions, and spatial layout hints.',
        'CRITICAL: If the user\'s TEXT PROMPT describes a different kind of place than the image (e.g. prompt says office interior, image shows a park), you MUST follow the USER PROMPT for structure and layout. Use the image ONLY for palette, materials, and detail — never replace the prompt\'s scene type.',
        '',
    ];

    if (analysis.sceneType && analysis.sceneType !== 'custom') {
        lines.push(`REFERENCE SCENE TYPE (hint only): The image resembles "${analysis.sceneType}". Use this only if it matches the user prompt; otherwise ignore it and follow the prompt.`);
    }

    // Style — drives material choices, color palette, and object type selection
    if (analysis.style) {
        lines.push(`VISUAL STYLE: The scene must feel "${analysis.style}". All materials, colors, and props must reflect this.`);
    }

    // Colors — these are REQUIRED, not suggestions
    if (analysis.colors) {
        const c = analysis.colors;
        const colorParts = [];
        if (Array.isArray(c.primary) && c.primary.length === 3)     colorParts.push(`primary [${c.primary.join(',')}]`);
        if (Array.isArray(c.secondary) && c.secondary.length === 3) colorParts.push(`secondary [${c.secondary.join(',')}]`);
        if (Array.isArray(c.accent) && c.accent.length === 3)       colorParts.push(`accent [${c.accent.join(',')}]`);
        if (colorParts.length > 0) {
            lines.push(`COLOR PALETTE (REQUIRED): Use these exact RGB colors — ${colorParts.join(', ')}. Apply them consistently to all instances. Do NOT substitute with generic colors.`);
        }
        const surfaceParts = [];
        if (Array.isArray(c.floor) && c.floor.length === 3)   surfaceParts.push(`floor [${c.floor.join(',')}]`);
        if (Array.isArray(c.walls) && c.walls.length === 3)   surfaceParts.push(`walls [${c.walls.join(',')}]`);
        if (Array.isArray(c.ceiling) && c.ceiling.length === 3) surfaceParts.push(`ceiling [${c.ceiling.join(',')}]`);
        if (surfaceParts.length > 0) {
            lines.push(`SURFACE COLORS (REQUIRED): Match these surface colors exactly — ${surfaceParts.join(', ')}.`);
        }
    }

    // Objects — must be included in the scene
    if (Array.isArray(analysis.objects) && analysis.objects.length > 0) {
        const names = analysis.objects.map(o => typeof o === 'string' ? o : (o.name || String(o)));
        lines.push(`OBJECTS FROM IMAGE (include only those compatible with the user prompt): ${names.join(', ')}. Skip objects that do not fit the prompt\'s scene type.`);
    }

    // Layout — spatial arrangement instruction
    if (analysis.layout) {
        const layoutStr = typeof analysis.layout === 'string'
            ? analysis.layout
            : (analysis.layout.arrangement || JSON.stringify(analysis.layout));
        lines.push(`SPATIAL LAYOUT: Arrange objects using a "${layoutStr}" pattern as seen in the reference. Use layoutHint for repeated objects.`);
    }

    // Density — how full/sparse the scene should be
    if (analysis.density) {
        const densityMap = {
            sparse:   'Leave open space between objects. Do not overcrowd.',
            moderate: 'Fill the scene at a natural density — not empty, not cluttered.',
            dense:    'Pack the scene with objects. Every zone should feel fully populated.',
        };
        lines.push(`OBJECT DENSITY: ${densityMap[analysis.density] || analysis.density}`);
    }

    // Proportions
    if (analysis.proportions) {
        const p = analysis.proportions;
        if (p.scale) {
            const scaleMap = {
                small:      'Objects are compact and close to human scale (~3–5 stud width).',
                medium:     'Objects are standard Roblox scale (~5–10 stud width).',
                large:      'Objects are oversized — bold and architectural (~10–20 stud width).',
                very_large: 'Objects are massive — monumental scale (20+ studs).',
            };
            lines.push(`OBJECT SCALE: ${scaleMap[p.scale] || p.scale}`);
        }
        if (p.ceilingHeight) {
            const ceilMap = {
                low:     'Ceiling height 8–10 studs.',
                normal:  'Ceiling height 12–16 studs.',
                tall:    'Ceiling height 20–28 studs.',
                outdoor: 'No ceiling — outdoor open scene.',
            };
            lines.push(`CEILING/HEIGHT: ${ceilMap[p.ceilingHeight] || p.ceilingHeight}`);
        }
    }

    // Materials — drive the material properties
    if (Array.isArray(analysis.materials) && analysis.materials.length > 0) {
        lines.push(`MATERIALS (REQUIRED): Use these Roblox materials from the reference: ${analysis.materials.join(', ')}. Apply them to the appropriate structural and decorative elements.`);
    }

    // Lighting
    if (analysis.lighting) {
        const lightStr = typeof analysis.lighting === 'string'
            ? analysis.lighting
            : (analysis.lighting.direction || analysis.lighting.intensity || JSON.stringify(analysis.lighting));
        const lightMap = {
            bright:       'Use bright ambient lighting. PointLights/SpotLights with Brightness 2+.',
            dim:          'Keep lighting dim and moody. Low brightness, shadows visible.',
            warm:         'Use warm yellow-orange lighting: Color [255, 200, 120], Brightness 1.5.',
            cool:         'Use cool blue-white lighting: Color [180, 200, 255], Brightness 1.2.',
            golden_hour:  'Golden hour warmth: Color [255, 180, 80], long shadows, sunset feel.',
            night:        'Dark ambient, glowing light sources only. Neon or lantern lights.',
        };
        lines.push(`LIGHTING: ${lightMap[lightStr] || `Set lighting to "${lightStr}" to match the reference.`}`);
    }

    // Atmosphere — indoor/outdoor/underground
    if (analysis.atmosphere) {
        lines.push(`ATMOSPHERE (from image): "${analysis.atmosphere}". Apply only if consistent with the user prompt (e.g. do not force outdoor sky if the prompt is an interior office).`);
    }

    // Floor and wall surface patterns
    if (analysis.floorPattern) {
        lines.push(`FLOOR PATTERN: Use "${analysis.floorPattern}" floor material/texture to match the reference.`);
    }
    if (analysis.wallPattern) {
        lines.push(`WALL PATTERN: Use "${analysis.wallPattern}" wall material to match the reference.`);
    }

    // Proportions — room width
    if (analysis.proportions?.roomWidth) {
        const widthMap = {
            narrow:    'Room/area is narrow — width 20–30 studs.',
            medium:    'Room/area is medium width — 40–60 studs.',
            wide:      'Room/area is wide — 70–100 studs.',
            very_wide: 'Scene is very wide or open — 100+ studs.',
        };
        lines.push(`ROOM WIDTH: ${widthMap[analysis.proportions.roomWidth] || analysis.proportions.roomWidth}`);
    }
    if (analysis.proportions?.objectSpacing) {
        const spacingMap = {
            tight:    'Objects are closely packed with minimal space between them.',
            normal:   'Standard spacing between objects.',
            spacious: 'Objects are spread apart with plenty of breathing room.',
        };
        lines.push(`OBJECT SPACING: ${spacingMap[analysis.proportions.objectSpacing] || analysis.proportions.objectSpacing}`);
    }

    // Landmarks — most distinctive features
    if (Array.isArray(analysis.landmarks) && analysis.landmarks.length > 0) {
        lines.push(`KEY LANDMARKS (MUST INCLUDE): ${analysis.landmarks.join(', ')}. These are the most visually distinctive elements — they must be prominent in the scene.`);
    }

    // Extra notes from the vision model
    if (analysis.notes) {
        lines.push(`ADDITIONAL DETAIL: ${analysis.notes}`);
    }

    lines.push('');
    lines.push('These directives OVERRIDE default generation behavior. The output must visually resemble the reference image.');
    lines.push('════════════════════════════════════════════════════════');

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
};
