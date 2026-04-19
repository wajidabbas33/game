// ============================================================
//  Roblox AI Plugin – Image-to-Layout Converter
//
//  Converts deep-extracted image analysis (from image-analyzer.js)
//  into DETERMINISTIC OVERRIDES for the scene generator.
//
//  These overrides:
//    • Lock the room type (e.g. formal_office, corridor)
//    • Override default dimensions with image-derived stud counts
//    • Set wall materials and colors from per-wall analysis
//    • Override floor material and pattern
//    • Configure lighting from image lighting rig
//    • Enable special flags (columns, fireplace, drapes, panels)
//    • For exteriors: trigger full society generator with image params
//
//  Usage:
//    const { analysisToOverrides } = require('./image-to-layout');
//    const overrides = analysisToOverrides(analysis);
//    // Then pass overrides into the scene pipeline
// ============================================================

'use strict';

// ── Material name normalizer ──────────────────────────────────
// Maps common English names to Roblox material enum strings
const MATERIAL_MAP = {
    'wood':         'WoodPlanks',
    'wood planks':  'WoodPlanks',
    'plank':        'WoodPlanks',
    'hardwood':     'WoodPlanks',
    'brick':        'Brick',
    'concrete':     'Concrete',
    'cement':       'Concrete',
    'marble':       'Marble',
    'stone':        'SmoothPlastic',
    'glass':        'Glass',
    'metal':        'Metal',
    'steel':        'Metal',
    'iron':         'Metal',
    'fabric':       'Fabric',
    'carpet':       'Fabric',
    'grass':        'Grass',
    'dirt':         'Ground',
    'asphalt':      'Asphalt',
    'tile':         'SmoothPlastic',
    'smooth':       'SmoothPlastic',
    'plastic':      'SmoothPlastic',
    'neon':         'Neon',
    'foam':         'SmoothPlastic',
    'slate':        'Slate',
    'cobblestone':  'Cobblestone',
    'sand':         'Sand',
    'snow':         'Snow',
    'ice':          'Ice',
    'granite':      'Granite',
    'sandstone':    'Sandstone',
    'woodplanks':   'WoodPlanks',
    'smoothplastic':'SmoothPlastic',
    'default':      'SmoothPlastic',
};

function normMaterial(str) {
    if (!str) return 'SmoothPlastic';
    const key = String(str).toLowerCase().replace(/[-_]/g, ' ').trim();
    return MATERIAL_MAP[key] || str;
}

// ── Color validator ───────────────────────────────────────────
function isValidColor(c) {
    return Array.isArray(c) && c.length === 3 &&
        c.every(v => typeof v === 'number' && v >= 0 && v <= 255);
}

function safeColor(c, fallback) {
    return isValidColor(c) ? c : (fallback || [200, 200, 200]);
}

const OUTDOOR_SURFACE_MATERIALS = new Set([
    'Grass',
    'Ground',
    'Asphalt',
    'Sand',
    'Snow',
    'Ice',
    'Water',
    'Mud',
]);

// ── Room type mapping ──────────────────────────────────────────
// Maps image analysis roomType values to room-layouts.js keys
const ROOM_TYPE_MAP = {
    'formal_office':    'formal_office',
    'oval office':      'formal_office',
    'presidential':     'formal_office',
    'café':             'café',
    'cafe':             'café',
    'coffee shop':      'café',
    'restaurant':       'restaurant',
    'bar':              'bar',
    'wine bar':         'bar',
    'office':           'office',
    'lobby':            'lobby',
    'hotel lobby':      'lobby',
    'corridor':         'corridor',
    'hallway':          'corridor',
    'sci-fi corridor':  'corridor',
    'living_room':      'living_room',
    'living room':      'living_room',
    'apartment':        'living_room',
    'classroom':        'classroom',
    'gym':              'gym',
    'fitness':          'gym',
    'town_exterior':    'town_exterior',
    'town':             'town_exterior',
    'exterior':         'town_exterior',
    'residential':      'town_exterior',
    'commercial':       'town_exterior',
    'park':             'town_exterior',
    'outdoor':          'town_exterior',
    'unknown':          null,
};

function resolveRoomType(analysis) {
    // If the model explicitly set forceRoomType
    if (analysis.overrides?.forceRoomType) {
        return analysis.overrides.forceRoomType;
    }
    // Map from analysis roomType
    const raw = String(analysis.roomType || '').toLowerCase().trim();
    if (ROOM_TYPE_MAP[raw] !== undefined) return ROOM_TYPE_MAP[raw];
    // Fuzzy: check if any known key appears anywhere
    for (const [pattern, key] of Object.entries(ROOM_TYPE_MAP)) {
        if (raw.includes(pattern)) return key;
    }
    return null;
}

// ── Dimension overrides ───────────────────────────────────────
function extractDimensionOverrides(analysis) {
    const d = analysis.dimensions;
    if (!d) return null;
    const out = {};
    if (typeof d.widthStuds  === 'number' && d.widthStuds  > 0) out.width  = Math.round(d.widthStuds);
    if (typeof d.depthStuds  === 'number' && d.depthStuds  > 0) out.depth  = Math.round(d.depthStuds);
    if (typeof d.heightStuds === 'number' && d.heightStuds > 0) out.height = Math.round(d.heightStuds);
    // Clamp to reasonable Roblox scene sizes
    if (out.width)  out.width  = Math.max(12, Math.min(out.width,  500));
    if (out.depth)  out.depth  = Math.max(12, Math.min(out.depth,  500));
    if (out.height) out.height = Math.max(8,  Math.min(out.height,  80));
    return Object.keys(out).length > 0 ? out : null;
}

// ── Wall treatment overrides ───────────────────────────────────
function extractWallOverrides(analysis) {
    const walls = analysis.walls;
    if (!walls) return null;
    const out = {};
    for (const side of ['front', 'back', 'left', 'right']) {
        const wall = walls[side];
        if (!wall) continue;
        out[side] = {
            material: normMaterial(wall.material),
            color: safeColor(wall.color, [220, 218, 215]),
            transparency: wall.material === 'Glass' ? 0.4 : 0,
            hasWindows: !!wall.hasWindows,
            windowCount: typeof wall.windowCount === 'number' ? wall.windowCount : 0,
            windowStyle: wall.windowStyle || 'standard',
            treatment: wall.treatment || 'none',
        };
    }
    return Object.keys(out).length > 0 ? out : null;
}

// ── Floor overrides ───────────────────────────────────────────
function extractFloorOverrides(analysis) {
    const f = analysis.floor;
    if (!f) return null;
    return {
        material: normMaterial(f.material),
        color: safeColor(f.color, [180, 175, 165]),
        pattern: f.pattern || 'none',
        hasRug: !!f.hasRug,
        rugColor: safeColor(f.rugColor, [160, 40, 35]),
    };
}

// ── Ceiling overrides ─────────────────────────────────────────
function extractCeilingOverrides(analysis) {
    const c = analysis.ceiling;
    if (!c) return null;
    return {
        material: normMaterial(c.material || 'SmoothPlastic'),
        color: safeColor(c.color, [240, 238, 235]),
        hasBeams: !!c.hasBeams,
        hasSkylight: !!c.hasSkylight,
    };
}

// ── Lighting overrides ────────────────────────────────────────
function extractLightingOverrides(analysis) {
    const l = analysis.lighting;
    if (!l) return null;
    return {
        type: l.type || 'ambient',
        color: safeColor(l.color, [255, 235, 190]),
        ambientColor: safeColor(l.ambientColor, [55, 50, 45]),
        intensity: l.intensity || 'moderate',
        mood: l.mood || 'warm',
        hasShadows: !!l.hasShadows,
        timeOfDay: l.timeOfDay || 'indoor',
        // Map to Lighting service brightness
        brightness: l.intensity === 'very_bright' ? 3.0 :
                    l.intensity === 'bright'       ? 2.0 :
                    l.intensity === 'moderate'     ? 1.2 :
                    l.intensity === 'dim'          ? 0.5 : 1.0,
    };
}

// ── Special flags overrides ────────────────────────────────────
function extractSpecialOverrides(analysis) {
    const se     = analysis.specialElements || {};
    const arch   = analysis.architecture   || {};
    const cp     = analysis.colorPalette   || {};

    return {
        // Architectural
        hasColumns:         arch.hasColumns     || false,
        columnCount:        arch.columnCount    || 0,
        columnStyle:        arch.columnStyle    || 'doric',
        hasFireplace:       arch.hasFireplace   || false,
        hasArches:          arch.hasArches      || false,
        hasStaircase:       arch.hasStaircase   || false,
        hasMezzanine:       arch.hasMezzanine   || false,
        ceilingType:        arch.ceilingType    || 'flat',

        // Decor / props
        hasDrapes:              se.hasDrapes             || false,
        drapeColor:             safeColor(se.drapeColor, [200, 165, 55]),
        hasHedgePlanters:       se.hasHedgePlanters      || false,
        hasIlluminatedPanels:   se.hasIlluminatedPanels  || false,
        panelColor:             safeColor(se.panelColor, [220, 235, 255]),
        hasFountain:            se.hasFountain            || false,
        hasPlayground:          se.hasPlayground          || false,
        hasParkedVehicles:      se.hasParkedVehicles      || false,
        hasStreetFurniture:     se.hasStreetFurniture     || false,
        hasRoadMarkings:        se.hasRoadMarkings        || false,
        hasCrosswalk:           se.hasCrosswalk           || false,
        hasTreeLine:            se.hasTreeLine            || false,

        // Art style
        artStyle:    cp.artStyle  || 'stylized',
    };
}

// ── Exterior overrides ────────────────────────────────────────
function extractExteriorOverrides(analysis) {
    const ex = analysis.exterior;
    if (!ex?.isExterior) return null;
    return {
        isExterior:        true,
        roadType:          ex.roadType   || 'asphalt',
        roadLayout:        ex.roadLayout || 'grid',
        hasResidential:    !!ex.hasResidential,
        hasCivic:          !!ex.hasCivic,
        hasCommercial:     !!ex.hasCommercial,
        hasPark:           !!ex.hasPark,
        vegetationType:    ex.vegetationType || 'pine_trees',
        treeCount:         ex.treeCount     || 'moderate',
        buildingStyles:    Array.isArray(ex.buildingStyles) ? ex.buildingStyles : [],
    };
}

// ── Prop overrides ────────────────────────────────────────────
function extractPropOverrides(analysis) {
    if (!Array.isArray(analysis.props)) return [];
    return analysis.props.slice(0, 30).map(prop => ({
        name:     prop.name     || 'unknown',
        category: prop.category || 'decor',
        size:     prop.sizeClass || 'medium',
        sizeStuds: Array.isArray(prop.estimatedSizeStuds) ? prop.estimatedSizeStuds : [2, 2, 2],
        material: normMaterial(prop.material),
        color:    safeColor(prop.color, [180, 150, 100]),
        zone:     prop.zone  || 'center',
        count:    typeof prop.count === 'number' ? prop.count : 1,
        required: !!prop.isRequired,
    }));
}

// ── Color palette overrides ────────────────────────────────────
function extractColorPaletteOverrides(analysis) {
    const cp = analysis.colorPalette;
    if (!cp) return null;
    return {
        primary:   safeColor(cp.primary,    [180, 145, 90]),
        secondary: safeColor(cp.secondary,  [240, 238, 235]),
        accent:    safeColor(cp.accent,     [200, 165, 55]),
        background: safeColor(cp.background, [245, 243, 240]),
        artStyle:  cp.artStyle || 'stylized',
    };
}

// ═══════════════════════════════════════════════════════════
// MAIN CONVERTER
// ═══════════════════════════════════════════════════════════

/**
 * Convert image-analyzer deep extraction result into a complete
 * set of generation overrides to be injected into the scene pipeline.
 *
 * Returns an `overrides` object that the server pipeline merges onto
 * the deterministic room layout before calling generators.
 *
 * @param {object} analysis    — Output from analyzeReferenceImages()
 * @param {string} userPrompt  — Original user prompt
 * @returns {object}           — Override bundle
 */
function analysisToOverrides(analysis, userPrompt) {
    if (!analysis || typeof analysis !== 'object') {
        return { hasImageOverrides: false };
    }

    const roomType   = resolveRoomType(analysis);
    const confidence = typeof analysis.confidence === 'number' ? analysis.confidence : 0.5;

    // Only apply dimension overrides if confidence is good enough
    const applyDims    = analysis.overrides?.forceDimensions    ?? (confidence >= 0.55);
    const applyColors  = analysis.overrides?.forceColorPalette  ?? (confidence >= 0.45);
    const applyWalls   = analysis.overrides?.forceWallMaterials ?? (confidence >= 0.55);
    const applyLights  = analysis.overrides?.forceLighting      ?? (confidence >= 0.45);

    const overrides = {
        hasImageOverrides: true,
        confidence,
        detectedRoomType:  roomType,
        sceneCategory: typeof analysis.sceneCategory === 'string'
            ? analysis.sceneCategory.toLowerCase()
            : null,
        generationNotes:   analysis.generationNotes || '',

        // Dimensions (applied only if confidence threshold met)
        dimensions:    applyDims   ? extractDimensionOverrides(analysis) : null,

        // Visual overrides
        wallOverrides: applyWalls  ? extractWallOverrides(analysis)   : null,
        floorOverride: applyWalls  ? extractFloorOverrides(analysis)  : null,
        ceilOverride:  applyWalls  ? extractCeilingOverrides(analysis): null,
        lightOverride: applyLights ? extractLightingOverrides(analysis): null,
        colorPalette:  applyColors ? extractColorPaletteOverrides(analysis) : null,

        // Always apply — structural flags are non-dimensional
        specialFlags:  extractSpecialOverrides(analysis),
        props:         extractPropOverrides(analysis),
        exterior:      extractExteriorOverrides(analysis),
    };

    console.log(`📐 Image-to-layout overrides generated:`);
    console.log(`   roomType=${roomType} confidence=${confidence}`);
    if (overrides.dimensions) {
        const d = overrides.dimensions;
        console.log(`   dimensions=${d.width}×${d.depth}×${d.height} studs`);
    }
    if (overrides.specialFlags?.hasColumns) {
        console.log(`   columns=${overrides.specialFlags.columnCount} (${overrides.specialFlags.columnStyle})`);
    }
    if (overrides.specialFlags?.hasFireplace)  console.log('   fireplace=true');
    if (overrides.specialFlags?.hasDrapes)     console.log('   drapes=true');
    if (overrides.exterior?.isExterior)        console.log(`   exterior=true roads=${overrides.exterior.roadLayout}`);

    return overrides;
}

function isExteriorLayout(layout) {
    return !!(
        layout?.specialFlags?.isExteriorWorld
        || layout?.sceneType === 'exterior_world'
    );
}

function shouldPreserveInteriorSurfaces(layout, overrides) {
    if (!layout || isExteriorLayout(layout)) {
        return false;
    }

    if (overrides?.sceneCategory === 'exterior' || overrides?.exterior?.isExterior) {
        return true;
    }

    const floorMaterial = String(overrides?.floorOverride?.material || '');
    if (OUTDOOR_SURFACE_MATERIALS.has(floorMaterial)) {
        return true;
    }

    const wallEntries = Object.values(overrides?.wallOverrides || {});
    return wallEntries.some(wall => OUTDOOR_SURFACE_MATERIALS.has(String(wall?.material || '')));
}

/**
 * Merge image overrides into an existing room layout object.
 * The layout is taken from room-layouts.js and the overrides are applied on top.
 *
 * @param {object} layout    — Room layout from ROOM_LAYOUTS
 * @param {object} overrides — From analysisToOverrides()
 * @returns {object}         — Merged layout ready for the generators
 */
function mergeOverridesIntoLayout(layout, overrides) {
    if (!overrides?.hasImageOverrides || !layout) return layout;

    const merged = { ...layout };
    const preserveInteriorSurfaces = shouldPreserveInteriorSurfaces(layout, overrides);

    // Dimensions
    if (overrides.dimensions) {
        merged.defaultDims = {
            ...merged.defaultDims,
            ...overrides.dimensions,
        };
    }

    // Wall treatments
    if (overrides.wallOverrides && !preserveInteriorSurfaces) {
        merged.wallTreatment = {};
        for (const [side, wall] of Object.entries(overrides.wallOverrides)) {
            merged.wallTreatment[side] = {
                material:     wall.material,
                color:        wall.color,
                transparency: wall.transparency,
            };
        }
    }

    // Floor
    if (overrides.floorOverride && !preserveInteriorSurfaces) {
        merged.floorMaterial = overrides.floorOverride.material;
        merged.floorColor    = overrides.floorOverride.color;
    }

    // Ceiling
    if (
        overrides.ceilOverride
        && !preserveInteriorSurfaces
        && overrides.ceilOverride.material
        && overrides.ceilOverride.material !== 'none'
    ) {
        merged.ceilingMaterial = overrides.ceilOverride.material;
        merged.ceilingColor    = overrides.ceilOverride.color;
    }

    // Lighting
    if (overrides.lightOverride) {
        merged.lighting = {
            ...merged.lighting,
            color:        overrides.lightOverride.color,
            ambientColor: overrides.lightOverride.ambientColor,
            brightness:   overrides.lightOverride.brightness,
            type:         overrides.lightOverride.type,
        };
    }

    // Special flags
    if (overrides.specialFlags) {
        merged.specialFlags = {
            ...(merged.specialFlags || {}),
            ...overrides.specialFlags,
        };
    }

    // Color palette
    if (overrides.colorPalette) {
        merged.colorPalette = {
            ...merged.colorPalette,
            ...overrides.colorPalette,
        };
    }

    if (preserveInteriorSurfaces) {
        console.log('⚠️  Preserved interior shell materials — exterior image cues were not applied to room surfaces.');
    }

    return merged;
}

/**
 * Build a human-readable summary card of what the AI extracted.
 * This is returned to the plugin UI so the user can verify before generation.
 *
 * @param {object} analysis  — Raw analysis from image-analyzer
 * @param {object} overrides — From analysisToOverrides()
 * @returns {object}         — Summary card data
 */
function buildAnalysisSummaryCard(analysis, overrides) {
    if (!analysis) return null;

    const card = {
        model: 'qwen-vl-max',
        detail: 'high',
        timestamp: new Date().toISOString(),
        roomType:     overrides?.detectedRoomType || 'unknown',
        confidence:   overrides?.confidence || 0,
        confidenceLabel: overrides?.confidence >= 0.8 ? 'High'
                       : overrides?.confidence >= 0.6 ? 'Good'
                       : overrides?.confidence >= 0.4 ? 'Moderate'
                       : 'Low',
        dimensions:   overrides?.dimensions || null,
        wallSummary:  {},
        floor:        overrides?.floorOverride || null,
        lighting:     overrides?.lightOverride || null,
        specialFlags: [],
        propCount:    (overrides?.props || []).length,
        requiredProps: (overrides?.props || []).filter(p => p.required).map(p => p.name),
        artStyle:     analysis.colorPalette?.artStyle || 'stylized',
        primaryColor: analysis.colorPalette?.primary || null,
        notes:        analysis.generationNotes || '',
        isExterior:   !!overrides?.exterior?.isExterior,
    };

    // Wall summary
    if (overrides?.wallOverrides) {
        for (const [side, wall] of Object.entries(overrides.wallOverrides)) {
            card.wallSummary[side] = `${wall.material} rgb(${wall.color.join(',')})`;
        }
    }

    // Special flags as string list
    if (overrides?.specialFlags) {
        const sf = overrides.specialFlags;
        if (sf.hasColumns)          card.specialFlags.push(`${sf.columnCount} ${sf.columnStyle} columns`);
        if (sf.hasFireplace)        card.specialFlags.push('Fireplace');
        if (sf.hasDrapes)           card.specialFlags.push('Curtain drapes');
        if (sf.hasHedgePlanters)    card.specialFlags.push('Hedge planters');
        if (sf.hasIlluminatedPanels) card.specialFlags.push('Illuminated wall panels');
        if (sf.hasFountain)         card.specialFlags.push('Fountain');
        if (sf.hasPlayground)       card.specialFlags.push('Playground');
        if (sf.hasRoadMarkings)     card.specialFlags.push('Road markings');
        if (sf.hasTreeLine)         card.specialFlags.push('Tree lines');
        if (sf.hasStreetFurniture)  card.specialFlags.push('Street furniture');
    }

    return card;
}

module.exports = {
    analysisToOverrides,
    mergeOverridesIntoLayout,
    buildAnalysisSummaryCard,
    resolveRoomType,
    normMaterial,
    extractDimensionOverrides,
    extractWallOverrides,
    extractFloorOverrides,
    extractLightingOverrides,
    extractSpecialOverrides,
    MATERIAL_MAP,
    ROOM_TYPE_MAP,
};
