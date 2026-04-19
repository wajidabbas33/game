// ============================================================
//  Roblox AI Plugin – Quality Evaluation Module
//
//  Multi-criteria quality scoring system that replaces the
//  superficial object-count validation. Evaluates:
//    • Structural completeness (enclosed room)
//    • Zone coverage (planned zones vs. populated zones)
//    • Object density per zone
//    • Material consistency
//    • Lighting presence
//    • Prompt fulfillment (key nouns from prompt)
//    • Environment completeness
//
//  Returns a grade (good/acceptable/weak/poor) with detailed
//  feedback for each criterion.
// ============================================================

'use strict';

// ── Prompt noun extraction ───────────────────────────────────
// Extracts architecturally meaningful nouns from the user prompt.

const KEYWORD_CATEGORIES = {
    furniture: [
        'desk', 'chair', 'table', 'sofa', 'couch', 'bench', 'stool', 'shelf',
        'shelving', 'bookshelf', 'cabinet', 'counter', 'register', 'reception',
        'bed', 'wardrobe', 'dresser', 'nightstand', 'rack', 'stand',
    ],
    architecture: [
        'wall', 'floor', 'ceiling', 'roof', 'door', 'window', 'glass partition',
        'partition', 'pillar', 'column', 'beam', 'staircase', 'stairs',
        'elevator', 'balcony', 'corridor', 'hallway',
    ],
    zones: [
        'kitchen', 'bathroom', 'bedroom', 'living room', 'dining', 'lobby',
        'entrance', 'reception', 'meeting room', 'conference', 'break room',
        'storage', 'office', 'classroom', 'seating', 'counter area',
        'serving area', 'bar', 'stage', 'lounge',
    ],
    equipment: [
        'espresso machine', 'coffee machine', 'refrigerator', 'fridge',
        'oven', 'stove', 'microwave', 'dishwasher', 'sink', 'faucet',
        'monitor', 'computer', 'printer', 'projector', 'whiteboard',
        'blackboard', 'tv', 'television', 'speaker',
    ],
    lighting: [
        'light', 'lamp', 'chandelier', 'pendant', 'spotlight', 'sconce',
        'neon', 'warm lighting', 'cool lighting', 'ambient',
    ],
    exterior: [
        'road', 'sidewalk', 'parking', 'garden', 'yard', 'patio',
        'terrace', 'fence', 'gate', 'driveway', 'mailbox', 'hydrant',
        'bus stop', 'tree', 'bush', 'flower', 'planter',
    ],
    materials: [
        'wood', 'wooden', 'brick', 'glass', 'marble', 'granite',
        'concrete', 'metal', 'steel', 'tile', 'carpet', 'fabric',
        'leather', 'stone',
    ],
    style: [
        'modern', 'rustic', 'industrial', 'minimalist', 'cozy', 'warm',
        'cool', 'bright', 'dark', 'elegant', 'premium', 'luxury',
        'vintage', 'retro', 'futuristic',
    ],
};

function extractPromptNouns(prompt) {
    const text = String(prompt || '').toLowerCase();
    const found = {
        furniture: [],
        architecture: [],
        zones: [],
        equipment: [],
        lighting: [],
        exterior: [],
        materials: [],
        style: [],
    };

    for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                found[category].push(keyword);
            }
        }
    }

    return found;
}

// ── Structural completeness ──────────────────────────────────
// Checks: floor, walls (≥2), ceiling/roof, at least one door/entrance

function evaluateStructuralCompleteness(instances) {
    if (!Array.isArray(instances) || instances.length === 0) {
        return { score: 0, feedback: 'No instances generated — completely empty scene.' };
    }

    const names = instances
        .map(inst => String(inst?.properties?.Name || '').toLowerCase())
        .filter(Boolean);

    const hasFloor = names.some(n => /floor|base|ground/.test(n));
    const hasCeiling = names.some(n => /ceiling|roof/.test(n));
    const wallCount = names.filter(n => /wall/.test(n)).length;
    const hasDoor = names.some(n => /door|entrance|entry/.test(n));
    const hasWindows = names.filter(n => /window|glass/.test(n)).length;
    const hasEnclosure = hasFloor && hasCeiling && wallCount >= 3;

    let score = 0;
    const feedbackParts = [];

    if (hasFloor) { score += 0.2; } else { feedbackParts.push('Missing: floor/base'); }
    if (hasCeiling) { score += 0.15; } else { feedbackParts.push('Missing: ceiling/roof'); }
    if (wallCount >= 3) { score += 0.25; }
    else if (wallCount >= 2) { score += 0.15; feedbackParts.push('Weak: only 2 wall segments (need ≥3 for enclosure)'); }
    else if (wallCount >= 1) { score += 0.05; feedbackParts.push('Weak: only 1 wall segment'); }
    else { feedbackParts.push('Missing: walls'); }

    if (hasDoor) { score += 0.15; } else { feedbackParts.push('Missing: door/entrance'); }
    if (hasWindows > 0) { score += 0.1; } else { feedbackParts.push('Missing: windows'); }
    if (hasEnclosure) { score += 0.15; }

    const feedback = feedbackParts.length > 0
        ? `Structural: ${feedbackParts.join('; ')}`
        : 'Structural: complete enclosed room (floor, walls, ceiling, door, windows)';

    return { score: Math.min(1, score), feedback };
}

// ── Zone coverage ────────────────────────────────────────────
// Checks what % of planned zones have objects placed in them.

function evaluateZoneCoverage(instances, scenePlan) {
    if (!scenePlan || !Array.isArray(scenePlan.zones) || scenePlan.zones.length === 0) {
        return { score: 0.5, feedback: 'No zone plan to evaluate against.' };
    }

    if (!Array.isArray(instances) || instances.length === 0) {
        return { score: 0, feedback: 'Zone coverage: 0% — no instances match any zones.' };
    }

    const dims = scenePlan.dimensions || { width: 50, depth: 40, height: 14 };
    const halfW = dims.width / 2;
    const halfD = dims.depth / 2;
    const zonesPopulated = new Set();

    for (const inst of instances) {
        const pos = inst?.properties?.Position || inst?.properties?.CFrame?.position;
        if (!Array.isArray(pos) || pos.length < 3) continue;

        for (const zone of scenePlan.zones) {
            if (!zone.bounds) continue;
            const b = zone.bounds;
            if (pos[0] >= b.minX && pos[0] <= b.maxX && pos[2] >= b.minZ && pos[2] <= b.maxZ) {
                zonesPopulated.add(zone.name);
            }
        }
    }

    const coverage = zonesPopulated.size / scenePlan.zones.length;
    const missingZones = scenePlan.zones
        .filter(z => !zonesPopulated.has(z.name))
        .map(z => z.name);

    const feedback = missingZones.length > 0
        ? `Zone coverage: ${Math.round(coverage * 100)}% — empty zones: ${missingZones.join(', ')}`
        : `Zone coverage: 100% — all ${scenePlan.zones.length} zones have objects.`;

    return { score: coverage, feedback };
}

// ── Object density ───────────────────────────────────────────
// Evaluates if there's meaningful furniture density vs. wall-only output.

function evaluateObjectDensity(instances) {
    if (!Array.isArray(instances) || instances.length === 0) {
        return { score: 0, feedback: 'Object density: 0 objects.' };
    }

    const total = instances.length;
    const furniturePattern = /(desk|chair|table|sofa|couch|bench|stool|shelf|cabinet|counter|planter|lamp|light|monitor|machine|fridge|refrigerator|sink|rack|bin|art|bottle|plate|cup|box|cash|register|napkin|candle|barrel|pizza|blender|condiment|ketchup|mustard|salt|pepper|keyboard|mouse|pot|book|menu|tray|sign)/i;
    const architecturePattern = /(wall|floor|ceiling|roof|door|window|separator|partition|frame|transom|pillar|boundary|awning|balcony|railing|parapet|storefront|cornice)/i;
    // Model-level prop containers created by dense-props.js
    const propModelPattern = /(BottleSet|PlateStack|CupSet|BoxStack|CashRegister|NapkinDisp|Candle|Barrel|WineRack|Pizza|Blender|Monitor|PotPlant|Condiments|TubeLight|NeonStrip|Books|MenuBoard|StoreSign|StreetSign)/i;

    let furnitureCount = 0;
    let architectureCount = 0;

    for (const inst of instances) {
        const name = String(inst?.properties?.Name || '');
        if (furniturePattern.test(name)) {
            furnitureCount++;
        } else if (propModelPattern.test(name)) {
            // Count dense-prop Model containers as 3 furniture items each (they contain multiple parts)
            furnitureCount += 3;
        } else if (architecturePattern.test(name)) {
            architectureCount++;
        }
    }

    const furnitureRatio = total > 0 ? furnitureCount / total : 0;
    let score;
    let feedback;

    if (furnitureCount === 0) {
        score = 0.1;
        feedback = `Object density: ${total} total objects but 0 furniture items — architecture-only output.`;
    } else if (furnitureCount < 8) {
        score = 0.3;
        feedback = `Object density: only ${furnitureCount} furniture items out of ${total} total — very sparse.`;
    } else if (furnitureCount < 20) {
        score = 0.5;
        feedback = `Object density: ${furnitureCount} furniture items out of ${total} total — moderate.`;
    } else if (furnitureCount < 40) {
        score = 0.7;
        feedback = `Object density: ${furnitureCount} furniture items — good density.`;
    } else {
        score = Math.min(1, 0.8 + furnitureCount * 0.005);
        feedback = `Object density: ${furnitureCount} furniture/prop items, ${architectureCount} architecture — excellent density.`;
    }

    return { score, feedback };
}

// ── Material consistency ─────────────────────────────────────
// Checks if materials are diverse and intentional.

function evaluateMaterialConsistency(instances, roomLayout) {
    if (!Array.isArray(instances) || instances.length === 0) {
        return { score: 0, feedback: 'Material consistency: no instances.' };
    }

    const materials = new Set();
    let defaultCount = 0;
    let totalWithMaterial = 0;

    for (const inst of instances) {
        const mat = inst?.properties?.Material;
        if (typeof mat === 'string' && mat) {
            materials.add(mat);
            totalWithMaterial++;
            if (mat === 'Plastic' || mat === 'SmoothPlastic') {
                defaultCount++;
            }
        }
    }

    const diversity = materials.size;
    const defaultRatio = totalWithMaterial > 0 ? defaultCount / totalWithMaterial : 1;

    let score;
    let feedback;

    if (diversity <= 1) {
        score = 0.1;
        feedback = 'Material consistency: only 1 material used — monotone, not realistic.';
    } else if (defaultRatio > 0.7) {
        score = 0.3;
        feedback = `Material consistency: ${Math.round(defaultRatio * 100)}% default plastic — needs more material variety.`;
    } else if (diversity >= 5) {
        score = 0.9;
        feedback = `Material consistency: ${diversity} distinct materials — excellent variety.`;
    } else {
        score = 0.5 + diversity * 0.08;
        feedback = `Material consistency: ${diversity} materials used — acceptable.`;
    }

    // Bonus if floor/wall/ceiling materials match the room layout spec
    if (roomLayout) {
        const expectedFloor = roomLayout.floorMaterial;
        const expectedCeiling = roomLayout.ceilingMaterial;
        const instanceMats = instances.map(i => i?.properties?.Material).filter(Boolean);
        if (expectedFloor && instanceMats.includes(expectedFloor)) score = Math.min(1, score + 0.05);
        if (expectedCeiling && instanceMats.includes(expectedCeiling)) score = Math.min(1, score + 0.05);
    }

    return { score: Math.min(1, score), feedback };
}

// ── Lighting presence ────────────────────────────────────────

function evaluateLightingPresence(instances) {
    if (!Array.isArray(instances) || instances.length === 0) {
        return { score: 0, feedback: 'Lighting: no instances.' };
    }

    const lightPattern = /(light|lamp|glow|bulb|neon|pendant|sconce|chandelier)/i;
    const neonParts = instances.filter(i => i?.properties?.Material === 'Neon').length;
    const namedLights = instances.filter(i => lightPattern.test(String(i?.properties?.Name || ''))).length;
    const pointLights = instances.filter(i => i?.className === 'PointLight' || i?.className === 'SpotLight' || i?.className === 'SurfaceLight').length;

    const totalLightSignals = neonParts + namedLights + pointLights;

    if (totalLightSignals === 0) {
        return { score: 0, feedback: 'Lighting: no light sources found — dark scene.' };
    }

    if (totalLightSignals < 3) {
        return { score: 0.4, feedback: `Lighting: only ${totalLightSignals} light signals — minimal.` };
    }

    if (pointLights > 0) {
        return { score: Math.min(1, 0.7 + pointLights * 0.05), feedback: `Lighting: ${pointLights} PointLight(s), ${neonParts} Neon parts — good.` };
    }

    return { score: 0.6, feedback: `Lighting: ${totalLightSignals} light signals but no PointLights — decorative only.` };
}

// ── Prompt fulfillment ───────────────────────────────────────
// Checks whether key nouns from the prompt appear in the output.

function evaluatePromptFulfillment(instances, prompt) {
    const nouns = extractPromptNouns(prompt);
    const allKeywords = [
        ...nouns.furniture,
        ...nouns.equipment,
        ...nouns.lighting,
        ...nouns.zones,
    ];

    if (allKeywords.length === 0) {
        return { score: 0.7, feedback: 'Prompt fulfillment: no specific items requested — using general evaluation.' };
    }

    const instanceNames = (instances || [])
        .map(i => String(i?.properties?.Name || '').toLowerCase())
        .join(' ');
    const instanceMaterials = (instances || [])
        .map(i => String(i?.properties?.Material || '').toLowerCase())
        .join(' ');
    const combined = instanceNames + ' ' + instanceMaterials;

    let matched = 0;
    const missing = [];

    for (const keyword of allKeywords) {
        // Flexible matching: check if keyword or related term exists
        const variants = [keyword, keyword.replace(/\s+/g, '')];
        const found = variants.some(v => combined.includes(v));
        if (found) {
            matched++;
        } else {
            missing.push(keyword);
        }
    }

    const ratio = matched / allKeywords.length;
    const feedback = missing.length > 0
        ? `Prompt fulfillment: ${matched}/${allKeywords.length} matched — missing: ${missing.slice(0, 5).join(', ')}`
        : `Prompt fulfillment: all ${allKeywords.length} requested items found.`;

    return { score: ratio, feedback };
}

// ── Environment completeness ─────────────────────────────────

function evaluateEnvironmentCompleteness(instances, terrain, expectEnvironment) {
    if (!expectEnvironment) {
        return { score: 0.7, feedback: 'Environment: not expected for this build type.' };
    }

    let envSignals = 0;
    const envTypes = new Set();

    if (Array.isArray(instances)) {
        for (const inst of instances) {
            const name = String(inst?.properties?.Name || '').toLowerCase();
            if (/(road|sidewalk|path|tree|rock|flower|bench|lamp|boundary|waterbound|bgbuilding|building_|planter|hydrant|mailbox|traffic|busstop|crosswalk|curb|dash|storename|awning|gf_)/.test(name)) {
                envSignals++;
                if (/road|sidewalk|crosswalk|curb|dash/.test(name)) envTypes.add('paths');
                if (/tree|flower|planter|rock/.test(name)) envTypes.add('vegetation');
                if (/lamp|light/.test(name)) envTypes.add('lighting');
                if (/boundary|waterbound/.test(name)) envTypes.add('boundaries');
                if (/bgbuilding|building_|storename|awning|gf_/.test(name)) envTypes.add('background');
            }
        }
    }

    if (Array.isArray(terrain)) {
        envSignals += terrain.length;
        envTypes.add('terrain');
    }

    if (envSignals === 0) {
        return { score: 0, feedback: 'Environment: completely empty — no surrounding world.' };
    }

    const typeCount = envTypes.size;
    const score = Math.min(1, envSignals * 0.03 + typeCount * 0.12);
    const feedback = `Environment: ${envSignals} elements across ${typeCount} types (${[...envTypes].join(', ')}).`;

    return { score, feedback };
}

// ── Master quality evaluator ─────────────────────────────────

const WEIGHTS = {
    structuralCompleteness: 0.22,
    zoneCoverage: 0.18,
    objectDensity: 0.18,
    materialConsistency: 0.10,
    lightingPresence: 0.10,
    promptFulfillment: 0.15,
    environmentCompleteness: 0.07,
};

function evaluateSceneQuality(safe, options) {
    const { scenePlan, roomLayout, prompt, expectEnvironment } = options || {};
    const instances = safe?.instances || [];
    const terrain = safe?.terrain || [];

    const scores = {
        structuralCompleteness: evaluateStructuralCompleteness(instances),
        zoneCoverage: evaluateZoneCoverage(instances, scenePlan),
        objectDensity: evaluateObjectDensity(instances),
        materialConsistency: evaluateMaterialConsistency(instances, roomLayout),
        lightingPresence: evaluateLightingPresence(instances),
        promptFulfillment: evaluatePromptFulfillment(instances, prompt),
        environmentCompleteness: evaluateEnvironmentCompleteness(instances, terrain, expectEnvironment),
    };

    let weightedSum = 0;
    let totalWeight = 0;
    const feedback = [];

    for (const [key, weight] of Object.entries(WEIGHTS)) {
        const result = scores[key];
        weightedSum += result.score * weight;
        totalWeight += weight;
        feedback.push(result.feedback);
    }

    const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

    let grade;
    if (overall >= 0.75) grade = 'good';
    else if (overall >= 0.55) grade = 'acceptable';
    else if (overall >= 0.35) grade = 'weak';
    else grade = 'poor';

    return {
        grade,
        overall: Math.round(overall * 100) / 100,
        scores: Object.fromEntries(
            Object.entries(scores).map(([k, v]) => [k, Math.round(v.score * 100) / 100])
        ),
        feedback,
    };
}

module.exports = {
    evaluateSceneQuality,
    extractPromptNouns,
    evaluateStructuralCompleteness,
    evaluateZoneCoverage,
    evaluateObjectDensity,
    evaluateMaterialConsistency,
    evaluateLightingPresence,
    evaluatePromptFulfillment,
    evaluateEnvironmentCompleteness,
};
