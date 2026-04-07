// ============================================================
//  Roblox AI Plugin – Image Analyzer Module
//
//  Processes reference images via a vision-capable AI model.
//  Extracts: style, color palette, proportions, layout, furniture.
//  Falls back gracefully when VISION_MODEL env var is not set.
//
//  Uses OpenAI-compatible API with image_url content parts.
// ============================================================

'use strict';

const https = require('https');
const OpenAI = require('openai');

const IMAGE_ANALYSIS_PROMPT = `Analyze this reference image for a Roblox Studio scene builder plugin.
Extract the following information and return it as a JSON object:

{
  "sceneType": "type of scene shown (e.g. classroom, park, island, arena, interior, exterior)",
  "style": "visual style (e.g. colorful, modern, rustic, fantasy, minimal, realistic)",
  "colorPalette": {
    "primary": [R, G, B],
    "secondary": [R, G, B],
    "accent": [R, G, B],
    "background": [R, G, B]
  },
  "objects": [
    { "name": "object name", "estimatedSize": "small/medium/large", "material": "likely material", "count": 1 }
  ],
  "layout": {
    "arrangement": "grid/circular/scattered/rows/symmetrical/organic",
    "density": "sparse/moderate/dense",
    "openSpace": "percentage of open floor/ground visible"
  },
  "architecture": {
    "wallStyle": "description if walls visible",
    "floorMaterial": "floor/ground material",
    "ceilingVisible": true/false,
    "windowCount": 0,
    "doorCount": 0
  },
  "lighting": {
    "direction": "overhead/side/ambient/warm/cool",
    "intensity": "dim/moderate/bright",
    "timeOfDay": "if outdoor: morning/noon/golden_hour/dusk/night"
  },
  "proportions": {
    "roomWidth": "estimated in Roblox studs (1 stud ≈ 0.28m)",
    "roomDepth": "estimated in Roblox studs",
    "ceilingHeight": "estimated in Roblox studs"
  },
  "notes": "Any other relevant details about the scene"
}

Return ONLY the JSON. No prose, no markdown.`;

/**
 * Create a vision-capable AI client.
 * Uses VISION_MODEL and VISION_API_KEY env vars.
 * Falls back to the primary API key if VISION_API_KEY is not set.
 */
function createVisionClient() {
    const visionModel = process.env.VISION_MODEL;
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

            const assetId = parseRobloxAssetId(trimmed);
            if (assetId) {
                images.push({ type: 'asset', value: assetId });
                return;
            }

            warnings.push(`${sourceLabel} "${trimmed}" is not a valid image URL or Roblox asset reference.`);
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
        console.log('ℹ️  No VISION_MODEL configured — skipping image analysis');
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
            max_tokens: 1200,
            temperature: 0.3,
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
 * Convert image analysis result into text context for the scene planner.
 * @param {object|null} analysis — Result from analyzeReferenceImages
 * @returns {string} — Text to inject into the planner prompt
 */
function imageAnalysisToContext(analysis) {
    if (!analysis) {
        return '';
    }

    if (analysis.raw) {
        return `\nReference image analysis:\n${analysis.notes}`;
    }

    const lines = ['\nReference image analysis:'];

    if (analysis.sceneType) {
        lines.push(`  Scene type: ${analysis.sceneType}`);
    }
    if (analysis.style) {
        lines.push(`  Visual style: ${analysis.style}`);
    }
    if (analysis.colorPalette) {
        const cp = analysis.colorPalette;
        lines.push(`  Colors: primary ${JSON.stringify(cp.primary)}, secondary ${JSON.stringify(cp.secondary)}, accent ${JSON.stringify(cp.accent)}`);
    }
    if (Array.isArray(analysis.objects) && analysis.objects.length > 0) {
        lines.push(`  Objects spotted: ${analysis.objects.map(o => `${o.name} (${o.estimatedSize})`).join(', ')}`);
    }
    if (analysis.layout) {
        lines.push(`  Layout: ${analysis.layout.arrangement}, density: ${analysis.layout.density}`);
    }
    if (analysis.architecture) {
        const arch = analysis.architecture;
        lines.push(`  Architecture: floor=${arch.floorMaterial || '?'}, ${arch.windowCount || 0} windows, ${arch.doorCount || 0} doors`);
    }
    if (analysis.proportions) {
        const p = analysis.proportions;
        lines.push(`  Proportions: ~${p.roomWidth}×${p.roomDepth} studs, ceiling ${p.ceilingHeight} studs`);
    }
    if (analysis.lighting) {
        lines.push(`  Lighting: ${analysis.lighting.direction}, ${analysis.lighting.intensity}, ${analysis.lighting.timeOfDay || 'n/a'}`);
    }
    if (analysis.notes) {
        lines.push(`  Notes: ${analysis.notes}`);
    }

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
};
