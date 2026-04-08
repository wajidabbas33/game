// ============================================================
//  Roblox AI Plugin – Enhanced Scene Planner Module  v2.0
//
//  Improvements over v1:
//  1. Hierarchical planning: prompt → structure → layout → placement
//  2. Proportional scaling based on real-world reference sizes
//  3. Better environment generation with proper world composition
//  4. Stronger validation with visual preview data
//  5. Reference image context integration
//  6. Template-based coherence for core structures
//
//  Two-stage generation pipeline:
//    Stage 1: Analyze prompt + refs → structured ScenePlan
//    Stage 2: Resolve plan → Roblox JSON output
// ============================================================

'use strict';

const {
    getTemplateCatalogText,
    getTemplatePlacementMetadata,
    resolveTemplatePlacements,
    getTemplateCatalog,
} = require('./templates');

// ── Constants ────────────────────────────────────────────────
const MAP_DIMENSIONS = {
    COMPACT: { width: 64, depth: 64, height: 32 },
    MEDIUM: { width: 96, depth: 96, height: 40 },
    LARGE: { width: 128, depth: 128, height: 48 },
    XLARGE: { width: 192, depth: 192, height: 64 },
};

const SCALE_REFERENCE = `
1 stud ≈ 0.28 meters (roughly 1 foot = 3.5 studs)

Common real-world sizes in studs:
  • Human character height: ~5.5 studs (standing Roblox character)
  • Standard door: 4 wide × 7 tall
  • Room ceiling height: 12–16 studs
  • Interior wall thickness: 1 stud
  • Exterior wall thickness: 1.5–2 studs
  • Single desk: 5 wide × 3 deep × 3.4 tall
  • Chair seat height: 2.2 studs
  • Window: 4 wide × 5 tall, placed 4 studs above floor
  • Small tree: 12 studs tall
  • Medium tree: 19 studs tall
  • Street lamp: 15 studs tall
  • Road width: 12 studs (one lane) to 24 studs (two lanes)
  • Sidewalk: 4–6 studs wide
  • Fence height: 4 studs
  • Residential building: 14–18 studs per floor
  • Commercial building: 16–20 studs per floor

Object spacing:
  • Desks in classroom: 6–8 studs apart (center to center)
  • Trees in forest: 15–30 studs apart
  • Trees along path: 12–18 studs apart
  • Street lamps along road: 30–40 studs apart
  • Flowers: 2–4 studs apart in clusters
  • Buildings on street: 20–40 studs apart
  • Park benches: 15–25 studs apart
  • Minimum walkable path width: 8 studs (2 characters)
`;

// ── Scene Planner System Prompt ──────────────────────────────

const SCENE_PLANNER_PROMPT = `You are a Roblox scene architect AI. Your job is to read a user's prompt, understand their intent, and return a structured scene plan in JSON.

## PLANNING PIPELINE (follow these 5 steps in order)

### Step 1: Parse the Intent
- What type of scene? (classroom, park, town, island, arena, etc.)
- Interior, exterior, or mixed?
- What specific objects or features did the user mention?
- What mood or style? (cozy, modern, fantasy, competitive, etc.)
- If reference images were analyzed, use their style/colors/objects as guidance.

### Step 2: Plan the Room / Area Layout
- Decide overall map dimensions based on scene complexity.
- Design the main structural footprint FIRST — this is the core build, centered at [0, 0, 0].
- For interiors: define floor, walls, ceiling, doors, windows.
- For exteriors: define ground plane, paths, terrain features.
- Keep proportions realistic using the scale reference below.

### Step 3: Plan Object Placement
- List every object that should appear in the scene.
- Use templates when they match (saves tokens and gives correct proportions).
- For custom objects, describe what they are and where they go.
- Assign each object to a zone so placement stays organized.
- Define spacing: grid, scattered, rows, along_path, or line.

### Step 4: Plan Environment
- Add surroundings: trees, rocks, roads, background buildings, boundary.
- The area around the main build should never be empty.
- Choose a boundary type that fits the scene.
- Keep environment objects outside the core play area.

### Step 5: Apply Visual Style
- Pick a color palette that matches the mood.
- Set lighting (time of day, ambience).
- If reference images provided colors/style, use them here.

════════════════════════════════════════════════════════════
OUTPUT FORMAT — ScenePlan JSON
════════════════════════════════════════════════════════════
Return ONLY a single valid JSON object:

{
  "sceneType": "floating_island | classroom | arena | lobby | outdoor_park | town | custom",
  "title": "Short descriptive title",
  "dimensions": { "width": 128, "depth": 128, "height": 40 },
  "groundLevel": 0,

  "coreStructure": {
    "type": "building | open_area | mixed",
    "width": 32,
    "depth": 32,
    "height": 16,
    "position": [0, 0, 0],
    "description": "Main structure description"
  },

  "zones": [
    {
      "name": "central_meadow",
      "purpose": "Main grassy area with scattered trees and flowers",
      "bounds": { "minX": -40, "maxX": 40, "minZ": -40, "maxZ": 40 },
      "elevation": 0,
      "terrainMaterial": "Grass"
    }
  ],

  "objects": [
    {
      "template": "deciduous_tree_medium",
      "count": 3,
      "zone": "central_meadow",
      "spacing": "scattered",
      "notes": "Place near edges of meadow"
    },
    {
      "type": "custom",
      "name": "Fountain",
      "className": "Model",
      "description": "A circular stone fountain with water in the center",
      "position": [0, 0, 0],
      "size": [8, 4, 8],
      "material": "Slate",
      "color": [140, 135, 125]
    }
  ],

  "lighting": {
    "timeOfDay": "golden_hour",
    "ambience": "warm",
    "fogDensity": "none | light | medium",
    "pointLightCount": 4,
    "pointLightColor": [255, 220, 140]
  },

  "environment": {
    "generateSurroundings": true,
    "boundaryType": "invisible_walls | floating_edge | terrain_fade | water_border",
    "surroundingTerrain": "Grass",
    "surroundingElements": ["trees_sparse", "rocks_scattered", "flowers_random", "roads", "background_structures"],
    "mapBoundarySize": { "width": 200, "depth": 200 }
  },

  "colorPalette": {
    "primary": [67, 140, 49],
    "secondary": [148, 148, 140],
    "accent": [255, 220, 140],
    "background": [60, 100, 40],
    "style": "colorful_whimsical | realistic_natural | modern_clean | rustic_warm | sci_fi | fantasy"
  },

  "validation": {
    "checklist": [
      "Core structure centered and proportional",
      "All zones have valid bounds",
      "Object counts reasonable for map size",
      "Environment elements placed outside core",
      "Boundary defined"
    ],
    "warnings": []
  }
}

════════════════════════════════════════════════════════════
AVAILABLE TEMPLATES
════════════════════════════════════════════════════════════
${getTemplateCatalogText()}

When an object matches one of these templates, use the template name in the "template" field.
For objects that don't match any template, use "type": "custom" and describe the object.

════════════════════════════════════════════════════════════
SCALE REFERENCE (Roblox studs)
════════════════════════════════════════════════════════════
${SCALE_REFERENCE}

════════════════════════════════════════════════════════════
ENVIRONMENT ELEMENTS (use in surroundingElements)
════════════════════════════════════════════════════════════
  • "trees_sparse" — scattered trees in ring around main build (6-8 trees)
  • "trees" / "trees_dense" — denser tree placement (8-10 trees)
  • "rocks_scattered" / "rocks" — rock formations at edges (3-5 rocks)
  • "flowers_random" / "flowers" — flower clusters (2-4 clusters)
  • "lamps" / "street_lamps" — street lights (3-5 lamps)
  • "benches" — park benches along paths (2-3 benches)
  • "roads" — roads connecting to map edges (N/S/E/W)
  • "sidewalks" — sidewalks along roads
  • "background_structures" — simple building shells on perimeter (2-4 buildings)
  • "hills" — terrain hills for visual interest
  • "water_features" — ponds, streams
  • "fences" — boundary fences

════════════════════════════════════════════════════════════
BOUNDARY TYPES
════════════════════════════════════════════════════════════
  • "invisible_walls" — invisible collision walls at map edges
  • "floating_edge" — rocky cliff edges with visible rock material (for islands/floating maps)
  • "terrain_fade" — terrain gradually fades to dirt/rock at edges with invisible walls behind
  • "water_border" — water terrain surrounding the map as a natural barrier

════════════════════════════════════════════════════════════
PLANNING RULES
════════════════════════════════════════════════════════════
1. ALWAYS design the core structure FIRST, then surrounding environment
2. The core structure must be centered (position [0, 0, 0]) and fully usable
3. All object positions must be relative to groundLevel, not absolute Y coordinates
4. Use templates when possible — they have correct proportions built in
5. Keep total object count reasonable: 10-25 for core, 15-30 for environment
6. Environment elements should be placed OUTSIDE the core play area
7. Use the colorPalette for visual consistency across all objects
8. Map dimensions should match the scene complexity:
   - 64×64 for simple/small scenes
   - 96×96 for medium scenes
   - 128×128 for complex/large scenes
   - 192×192 for very large open-world scenes
9. Set environment.generateSurroundings to true ONLY for outdoor maps, islands, towns, parks, arenas, and open-world scenes. Set it to false for pure interior scenes (office, corridor, classroom, lobby) — no outdoor grass or trees around an interior-only build.
10. For interior-only prompts, do NOT add roads, trees, or exterior terrain in the environment block; the build is enclosed.
11. Roads should connect to map edges and extend beyond the boundary
12. Background structures should be at least 20 studs away from core area
13. Return ONLY the JSON. No prose, no markdown, no explanation outside the JSON.`;

// ── Scene Builder System Prompt Addon ────────────────────────
function buildScenePlanContext(scenePlan) {
    const zones = (scenePlan.zones || []).map(z =>
        `  • ${z.name}: ${z.purpose} (X: ${z.bounds?.minX ?? '?'} to ${z.bounds?.maxX ?? '?'}, Z: ${z.bounds?.minZ ?? '?'} to ${z.bounds?.maxZ ?? '?'}, elevation: ${z.elevation ?? 0}, terrain: ${z.terrainMaterial || 'Grass'})`
    ).join('\n');

    const objects = (scenePlan.objects || []).map(o => {
        if (o.template) {
            return `  • TEMPLATE "${o.template}" × ${o.count || 1} in zone "${o.zone || 'main'}" (${o.spacing || 'placed'}) — ${o.notes || ''}`;
        }
        return `  • CUSTOM "${o.name || o.type}": ${o.description || ''} at [${o.position?.join(',') || '?'}] size [${o.size?.join(',') || '?'}]`;
    }).join('\n');

    const palette = scenePlan.colorPalette || {};
    const env = scenePlan.environment || {};
    const lighting = scenePlan.lighting || {};

    return `════════════════════════════════════════════════════════════
SCENE PLAN CONTEXT (follow this plan precisely)
════════════════════════════════════════════════════════════
Scene: ${scenePlan.title || scenePlan.sceneType || 'Custom'}
Type: ${scenePlan.sceneType}
Dimensions: ${scenePlan.dimensions?.width || 128}W × ${scenePlan.dimensions?.depth || 128}D × ${scenePlan.dimensions?.height || 40}H studs
Ground level: Y = ${scenePlan.groundLevel || 0}

Core Structure:
  Type: ${scenePlan.coreStructure?.type || 'building'}
  Size: ${scenePlan.coreStructure?.width || 32}W × ${scenePlan.coreStructure?.depth || 32}D × ${scenePlan.coreStructure?.height || 16}H
  Description: ${scenePlan.coreStructure?.description || 'Main structure'}

Zones:
${zones || '  (none defined)'}

Objects to generate (${scenePlan.objects?.length || 0} total):
${objects || '  (none defined)'}

Color palette:
  Primary: RGB(${palette.primary?.join(',') || '67,140,49'})
  Secondary: RGB(${palette.secondary?.join(',') || '148,148,140'})
  Accent: RGB(${palette.accent?.join(',') || '255,220,140'})
  Background: RGB(${palette.background?.join(',') || '60,100,40'})
  Style: ${palette.style || 'natural'}

Lighting:
  Time: ${lighting.timeOfDay || 'default'}
  Ambience: ${lighting.ambience || 'neutral'}
  Point lights: ${lighting.pointLightCount || 0}

Environment:
  Generate surroundings: ${env.generateSurroundings ? 'YES' : 'NO'}
  Boundary type: ${env.boundaryType || 'invisible_walls'}
  Map size: ${env.mapBoundarySize?.width || 200}W × ${env.mapBoundarySize?.depth || 200}D
  Elements: ${(env.surroundingElements || []).join(', ') || 'none'}

IMPORTANT RULES FOR GENERATION:
1. Template objects are resolved automatically by the backend — do NOT regenerate them as instances.
2. For custom objects, generate full Roblox instances with correct properties, sizes, and positions.
3. Objects in a zone must stay within that zone's bounds.
4. Build the core structure first: floor, walls, roof/ceiling, doors — fully formed and centered.
5. Environment elements (trees, roads, rocks) go OUTSIDE the core play area.
6. Roads should extend beyond map boundaries to the edges.
7. Use the color palette for visual consistency across all custom objects.
8. Include terrain operations for ground, hills, and natural features.
9. Every Part needs: Name, Size, Position, Color, Anchored, Material at minimum.
10. Group related parts under a Model with a descriptive Name.`;
}

// ── ScenePlan validation ─────────────────────────────────────

function validateScenePlan(plan) {
    const warnings = [];
    const errors = [];

    if (!plan || typeof plan !== 'object') {
        return { valid: false, errors: ['ScenePlan is not an object'], warnings: [] };
    }

    if (!plan.sceneType || typeof plan.sceneType !== 'string') {
        warnings.push('Missing sceneType — defaulting to "custom"');
        plan.sceneType = 'custom';
    }

    if (!plan.title || typeof plan.title !== 'string') {
        warnings.push('Missing title — scene may lack description');
    }

    if (!plan.dimensions || typeof plan.dimensions !== 'object') {
        warnings.push('Missing dimensions — using defaults 128×128×40');
        plan.dimensions = { width: 128, depth: 128, height: 40 };
    }

    const { width = 128, depth = 128, height = 40 } = plan.dimensions;
    if (width > 512 || depth > 512) {
        warnings.push(`Scene dimensions ${width}×${depth} exceed 512 studs — output may be sparse`);
    }
    if (width < 16 || depth < 16) {
        warnings.push(`Scene dimensions ${width}×${depth} are very small — consider at least 32×32`);
    }

    // Validate core structure
    if (plan.coreStructure) {
        if (!plan.coreStructure.width || !plan.coreStructure.depth) {
            warnings.push('Core structure missing width or depth');
        }
        if (plan.coreStructure.width > width * 0.9) {
            warnings.push('Core structure is very large relative to map width');
        }
    }

    // Validate zones
    if (!Array.isArray(plan.zones) || plan.zones.length === 0) {
        warnings.push('No zones defined — object placement may lack spatial organization');
    } else {
        plan.zones.forEach((zone, i) => {
            if (!zone.name) warnings.push(`Zone ${i} has no name`);
            if (!zone.bounds) {
                warnings.push(`Zone "${zone.name || i}" has no bounds`);
            } else {
                const b = zone.bounds;
                if (b.maxX <= b.minX || b.maxZ <= b.minZ) {
                    warnings.push(`Zone "${zone.name || i}" has invalid bounds`);
                }
            }
        });
    }

    // Validate objects
    if (Array.isArray(plan.objects)) {
        let totalParts = 0;
        plan.objects.forEach((obj, i) => {
            const count = obj.count || 1;
            if (obj.template) {
                totalParts += count * 5;
            } else if (obj.type === 'custom') {
                if (!obj.name && !obj.description) {
                    warnings.push(`Custom object ${i} has no name or description`);
                }
                totalParts += count * 3;
            }
        });
        if (totalParts > 200) {
            warnings.push(`Estimated ${totalParts} parts — may be too many. Consider reducing counts.`);
        }
    }

    // Validate environment
    if (plan.environment) {
        if (plan.environment.generateSurroundings) {
            const elements = plan.environment.surroundingElements || [];
            if (elements.length === 0) {
                warnings.push('Environment generation enabled but no elements specified');
            }
            if (!plan.environment.boundaryType) {
                warnings.push('No boundary type specified');
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ── Template placement resolver ──────────────────────────────

function buildPlacementEntry(position, metadata) {
    return {
        position,
        radius: metadata.footprintRadius || 4,
        tags: Array.isArray(metadata.placementTags) ? metadata.placementTags : [],
    };
}

function isPlacementTooClose(pos, candidateRadius, existing, extraPadding = 0) {
    for (const other of existing) {
        const otherPos = Array.isArray(other) ? other : other.position;
        if (!Array.isArray(otherPos)) continue;

        const otherRadius = typeof other?.radius === 'number' ? other.radius : 0;
        const dx = pos[0] - otherPos[0];
        const dz = pos[2] - otherPos[2];
        const dist2d = Math.sqrt(dx * dx + dz * dz);
        const minDist = candidateRadius + otherRadius + extraPadding;
        if (dist2d < minDist) return true;
    }
    return false;
}

function isInsideCorePlayArea(pos, dims, paddingFactor = 0.32) {
    const width = dims?.width || 128;
    const depth = dims?.depth || 128;
    return Math.abs(pos[0]) < width * paddingFactor && Math.abs(pos[2]) < depth * paddingFactor;
}

function sampleRingPosition(bounds, groundLevel, elevation, bias = 'perimeter') {
    const { minX = -40, maxX = 40, minZ = -40, maxZ = 40 } = bounds || {};
    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;
    const insetX = rangeX * 0.18;
    const insetZ = rangeZ * 0.18;

    if (bias === 'interior') {
        return [
            minX + insetX + Math.random() * Math.max(rangeX - insetX * 2, 4),
            elevation + groundLevel,
            minZ + insetZ + Math.random() * Math.max(rangeZ - insetZ * 2, 4),
        ];
    }

    const side = Math.floor(Math.random() * 4);
    if (side === 0) {
        return [minX + Math.random() * rangeX, elevation + groundLevel, minZ + Math.random() * Math.max(insetZ, 4)];
    }
    if (side === 1) {
        return [minX + Math.random() * rangeX, elevation + groundLevel, maxZ - Math.random() * Math.max(insetZ, 4)];
    }
    if (side === 2) {
        return [minX + Math.random() * Math.max(insetX, 4), elevation + groundLevel, minZ + Math.random() * rangeZ];
    }
    return [maxX - Math.random() * Math.max(insetX, 4), elevation + groundLevel, minZ + Math.random() * rangeZ];
}

function resolveScenePlanTemplates(scenePlan) {
    const placements = [];
    const zoneMap = {};

    if (Array.isArray(scenePlan.zones)) {
        for (const zone of scenePlan.zones) {
            zoneMap[zone.name] = zone;
        }
    }

    if (!Array.isArray(scenePlan.objects)) {
        return { instances: [], terrain: [] };
    }

    const placedPositions = [];

    for (const obj of scenePlan.objects) {
        if (!obj.template) continue;

        const count = obj.count || 1;
        const zone = zoneMap[obj.zone] || null;
        const spacing = obj.spacing || 'grid';
        const metadata = getTemplatePlacementMetadata(obj.template);
        const preferredSpacing = Math.max(
            typeof obj.minSpacing === 'number' ? obj.minSpacing : 0,
            metadata.preferredSpacing || 8
        );
        const placementBias = metadata.placementTags.includes('perimeter') ? 'perimeter' : 'interior';

        for (let i = 0; i < count; i++) {
            let pos;
            if (zone && zone.bounds) {
                const { minX = -40, maxX = 40, minZ = -40, maxZ = 40 } = zone.bounds;
                const elevation = zone.elevation || 0;
                const rangeX = maxX - minX;
                const rangeZ = maxZ - minZ;

                if (spacing === 'scattered' || spacing === 'random') {
                    let bestPos = null;
                    for (let attempt = 0; attempt < 8; attempt++) {
                        const candidatePos = sampleRingPosition(
                            zone.bounds,
                            scenePlan.groundLevel || 0,
                            elevation,
                            placementBias
                        );
                        if (!isPlacementTooClose(candidatePos, metadata.footprintRadius, placedPositions, preferredSpacing * 0.25)) {
                            bestPos = candidatePos;
                            break;
                        }
                        bestPos = candidatePos;
                    }
                    pos = bestPos;
                } else if (spacing === 'along_path' || spacing === 'line') {
                    const frac = count === 1 ? 0.5 : i / (count - 1);
                    pos = [
                        minX + frac * rangeX,
                        elevation + (scenePlan.groundLevel || 0),
                        (minZ + maxZ) / 2,
                    ];
                } else {
                    const cols = Math.ceil(Math.sqrt(count));
                    const rows = Math.ceil(count / cols);
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    const spacingX = rangeX / (cols + 1);
                    const spacingZ = rangeZ / (rows + 1);
                    pos = [
                        minX + (col + 1) * spacingX,
                        elevation + (scenePlan.groundLevel || 0),
                        minZ + (row + 1) * spacingZ,
                    ];

                    if (isPlacementTooClose(pos, metadata.footprintRadius, placedPositions, preferredSpacing * 0.2)) {
                        pos = sampleRingPosition(
                            zone.bounds,
                            scenePlan.groundLevel || 0,
                            elevation,
                            placementBias
                        );
                    }
                }
            } else if (obj.position) {
                pos = [...obj.position];
                if (i > 0) {
                    pos[0] += i * preferredSpacing;
                }
            } else {
                pos = [i * preferredSpacing, scenePlan.groundLevel || 0, 0];
            }

            placedPositions.push(buildPlacementEntry(pos, metadata));
            placements.push({
                template: obj.template,
                position: pos,
                rotation: obj.rotation || Math.random() * 360,
                options: obj.options || {},
            });
        }
    }

    return resolveTemplatePlacements(placements);
}

// ── Environment generator v2.0 ──────────────────────────────

function generateEnvironment(scenePlan) {
    const env = scenePlan.environment;
    if (!env || !env.generateSurroundings) {
        return { instances: [], terrain: [] };
    }

    const instances = [];
    const terrain = [];
    const dims = scenePlan.dimensions || { width: 128, depth: 128 };
    const groundLevel = scenePlan.groundLevel || 0;
    const boundaryWidth = env.mapBoundarySize?.width || dims.width * 1.6;
    const boundaryDepth = env.mapBoundarySize?.depth || dims.depth * 1.6;
    const halfW = dims.width / 2;
    const halfD = dims.depth / 2;
    const boundHalfW = boundaryWidth / 2;
    const boundHalfD = boundaryDepth / 2;
    const environmentCorePadding = scenePlan.sceneType === 'classroom' || scenePlan.sceneType === 'lobby'
        ? 0.28
        : 0.34;

    // ── Base terrain ────────────────────────────────────────────
    const terrainMaterial = env.surroundingTerrain || 'Grass';
    terrain.push({
        shape: 'Block',
        material: terrainMaterial,
        position: [0, groundLevel - 2, 0],
        size: [boundaryWidth, 4, boundaryDepth],
        rotation: [0, 0, 0],
    });

    // ── Scene-type specific terrain ────────────────────────────
    if (scenePlan.sceneType === 'floating_island') {
        // Underside rock
        const undersideRadius = Math.min(halfW, halfD) * 0.8;
        terrain.push({
            shape: 'Ball',
            material: 'Rock',
            position: [0, groundLevel - undersideRadius - 4, 0],
            radius: undersideRadius,
        });
        // Edge dirt/rock layer
        terrain.push({
            shape: 'Block',
            material: 'Ground',
            position: [0, groundLevel - 2.5, 0],
            size: [dims.width * 1.1, 3, dims.depth * 1.1],
            rotation: [0, 0, 0],
        });
        // Surrounding water
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [0, groundLevel - 30, 0],
            size: [boundaryWidth * 2, 2, boundaryDepth * 2],
            rotation: [0, 0, 0],
        });
    }

    // ── Environment elements ──────────────────────────────────
    const normalizedElements = Array.isArray(env.surroundingElements)
        ? [...env.surroundingElements]
        : ['trees_sparse'];

    // Ensure minimum environment elements
    const hasInteriorSignals = scenePlan.sceneType === 'classroom'
        || scenePlan.sceneType === 'lobby'
        || (scenePlan.title && /class|school|interior|room/i.test(scenePlan.title));
    const isOutdoorWorld = ['town', 'outdoor_park', 'floating_island', 'arena'].includes(scenePlan.sceneType);

    if (hasInteriorSignals && !normalizedElements.includes('roads')) {
        normalizedElements.push('roads');
    }
    if ((hasInteriorSignals || isOutdoorWorld) && !normalizedElements.includes('background_structures')) {
        normalizedElements.push('background_structures');
    }
    if (!normalizedElements.some(el => /trees|rocks|flowers/.test(el))) {
        normalizedElements.push('trees_sparse');
        normalizedElements.push('rocks_scattered');
    }

    const maxEnvInstances = hasInteriorSignals ? 24 : 40;
    let envInstanceCount = 0;
    const envPlacements = [];
    const envPlacedPositions = [];

    for (const element of normalizedElements) {
        if (envInstanceCount >= maxEnvInstances) break;

        // Trees
        if (/trees/.test(element)) {
            const treeCount = element === 'trees_dense'
                ? Math.min(10, Math.floor((maxEnvInstances - envInstanceCount) / 5))
                : Math.min(8, Math.floor((maxEnvInstances - envInstanceCount) / 5));

            for (let i = 0; i < treeCount; i++) {
                const angle = (i / treeCount) * Math.PI * 2 + Math.random() * 0.5;
                const dist = halfW * 0.8 + Math.random() * (boundHalfW - halfW) * 0.6;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                const treeMeta = getTemplatePlacementMetadata('deciduous_tree_medium');

                if (!isInsideCorePlayArea(pos, dims, environmentCorePadding)
                    && !isPlacementTooClose(pos, treeMeta.footprintRadius, envPlacedPositions, treeMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, treeMeta));
                    envPlacements.push({
                        template: Math.random() > 0.4 ? 'deciduous_tree_medium' : 'pine_tree',
                        position: pos,
                        rotation: Math.random() * 360,
                    });
                    envInstanceCount += 5;
                }
            }
        }

        // Rocks
        if (/rocks/.test(element)) {
            const rockCount = Math.min(5, Math.floor((maxEnvInstances - envInstanceCount) / 3));
            for (let i = 0; i < rockCount; i++) {
                const angle = (i / rockCount) * Math.PI * 2 + Math.random();
                const dist = halfW * 0.6 + Math.random() * halfW * 0.4;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                const rockMeta = getTemplatePlacementMetadata('rock_formation');

                if (!isPlacementTooClose(pos, rockMeta.footprintRadius, envPlacedPositions, rockMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, rockMeta));
                    envPlacements.push({ template: 'rock_formation', position: pos });
                    envInstanceCount += 3;
                }
            }
        }

        // Flowers
        if (/flowers/.test(element)) {
            const flowerCount = Math.min(4, Math.floor((maxEnvInstances - envInstanceCount) / 10));
            for (let i = 0; i < flowerCount; i++) {
                const pos = sampleRingPosition(
                    { minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD },
                    groundLevel, 0, 'perimeter'
                );
                const flowerMeta = getTemplatePlacementMetadata('flower_cluster');

                if (!isPlacementTooClose(pos, flowerMeta.footprintRadius, envPlacedPositions, flowerMeta.preferredSpacing * 0.15)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, flowerMeta));
                    envPlacements.push({ template: 'flower_cluster', position: pos });
                    envInstanceCount += 10;
                }
            }
        }

        // Street lamps
        if (/lamp/.test(element)) {
            const lampCount = Math.min(5, Math.floor((maxEnvInstances - envInstanceCount) / 4));
            for (let i = 0; i < lampCount; i++) {
                const angle = (i / lampCount) * Math.PI * 2;
                const dist = halfW * 0.5;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                const lampMeta = getTemplatePlacementMetadata('street_lamp');

                if (!isPlacementTooClose(pos, lampMeta.footprintRadius, envPlacedPositions, lampMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, lampMeta));
                    envPlacements.push({ template: 'street_lamp', position: pos });
                    envInstanceCount += 4;
                }
            }
        }

        // Benches
        if (/bench/.test(element)) {
            const benchCount = Math.min(4, Math.floor((maxEnvInstances - envInstanceCount) / 5));
            for (let i = 0; i < benchCount; i++) {
                const angle = (i / benchCount) * Math.PI * 2 + Math.PI / 6;
                const dist = halfW * 0.4;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                const benchMeta = getTemplatePlacementMetadata('bench');

                if (!isInsideCorePlayArea(pos, dims, environmentCorePadding * 0.9)
                    && !isPlacementTooClose(pos, benchMeta.footprintRadius, envPlacedPositions, benchMeta.preferredSpacing * 0.15)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, benchMeta));
                    envPlacements.push({
                        template: 'bench',
                        position: pos,
                        rotation: (angle * 180 / Math.PI) + 90,
                    });
                    envInstanceCount += 5;
                }
            }
        }

        // Roads
        if (/roads|road/.test(element)) {
            const roadBudget = Math.floor((maxEnvInstances - envInstanceCount) / 3);
            if (roadBudget >= 2) {
                // North-South road
                const nsLength = boundaryDepth * 0.9;
                instances.push({
                    className: 'Model',
                    parent: 'Workspace',
                    properties: { Name: 'Road_NS' },
                });
                instances.push({
                    className: 'Part',
                    parent: 'Road_NS',
                    properties: {
                        Name: 'RoadSurface_NS',
                        Size: [12, 0.3, nsLength],
                        Position: [halfW * 0.6, groundLevel + 0.15, 0],
                        Color: [68, 68, 72],
                        Anchored: true,
                        Material: 'Concrete',
                    },
                });
                instances.push({
                    className: 'Part',
                    parent: 'Road_NS',
                    properties: {
                        Name: 'CenterLine_NS',
                        Size: [0.4, 0.05, nsLength - 4],
                        Position: [halfW * 0.6, groundLevel + 0.35, 0],
                        Color: [230, 210, 80],
                        Anchored: true,
                        Material: 'SmoothPlastic',
                    },
                });

                // Sidewalk North
                instances.push({
                    className: 'Part',
                    parent: 'Road_NS',
                    properties: {
                        Name: 'Sidewalk_NS_East',
                        Size: [5, 0.2, nsLength],
                        Position: [halfW * 0.6 + 8.5, groundLevel + 0.1, 0],
                        Color: [170, 170, 165],
                        Anchored: true,
                        Material: 'Slate',
                    },
                });
                instances.push({
                    className: 'Part',
                    parent: 'Road_NS',
                    properties: {
                        Name: 'Sidewalk_NS_West',
                        Size: [5, 0.2, nsLength],
                        Position: [halfW * 0.6 - 8.5, groundLevel + 0.1, 0],
                        Color: [170, 170, 165],
                        Anchored: true,
                        Material: 'Slate',
                    },
                });
                envInstanceCount += 5;

                // East-West road
                if (envInstanceCount + 5 <= maxEnvInstances) {
                    const ewLength = boundaryWidth * 0.9;
                    instances.push({
                        className: 'Model',
                        parent: 'Workspace',
                        properties: { Name: 'Road_EW' },
                    });
                    instances.push({
                        className: 'Part',
                        parent: 'Road_EW',
                        properties: {
                            Name: 'RoadSurface_EW',
                            Size: [ewLength, 0.3, 12],
                            Position: [0, groundLevel + 0.15, halfD * 0.6],
                            Color: [68, 68, 72],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: 'Road_EW',
                        properties: {
                            Name: 'CenterLine_EW',
                            Size: [ewLength - 4, 0.05, 0.4],
                            Position: [0, groundLevel + 0.35, halfD * 0.6],
                            Color: [230, 210, 80],
                            Anchored: true,
                            Material: 'SmoothPlastic',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: 'Road_EW',
                        properties: {
                            Name: 'Sidewalk_EW_North',
                            Size: [ewLength, 0.2, 5],
                            Position: [0, groundLevel + 0.1, halfD * 0.6 + 8.5],
                            Color: [170, 170, 165],
                            Anchored: true,
                            Material: 'Slate',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: 'Road_EW',
                        properties: {
                            Name: 'Sidewalk_EW_South',
                            Size: [ewLength, 0.2, 5],
                            Position: [0, groundLevel + 0.1, halfD * 0.6 - 8.5],
                            Color: [170, 170, 165],
                            Anchored: true,
                            Material: 'Slate',
                        },
                    });
                    envInstanceCount += 5;
                }
            }
        }

        // Background structures
        if (/building|structure/i.test(element)) {
            const buildingCount = Math.min(4, Math.floor((maxEnvInstances - envInstanceCount) / 4));
            for (let i = 0; i < buildingCount; i++) {
                const angle = (i / buildingCount) * Math.PI * 2 + Math.PI / 4;
                const dist = boundHalfW * 0.7;
                const bx = Math.cos(angle) * dist;
                const bz = Math.sin(angle) * dist;
                const bWidth = 18 + Math.random() * 14;
                const bHeight = 16 + Math.random() * 20;
                const bDepth = 14 + Math.random() * 10;
                const modelName = 'BgBuilding_' + (i + 1);

                instances.push({
                    className: 'Model',
                    parent: 'Workspace',
                    properties: { Name: modelName },
                });
                // Main building body
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: 'Body',
                        Size: [bWidth, bHeight, bDepth],
                        Position: [bx, groundLevel + bHeight / 2, bz],
                        Color: [180 + Math.floor(Math.random() * 30), 175 + Math.floor(Math.random() * 25), 165 + Math.floor(Math.random() * 20)],
                        Anchored: true,
                        Material: 'Concrete',
                    },
                });
                // Roof
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: 'Roof',
                        Size: [bWidth + 2, 1.2, bDepth + 2],
                        Position: [bx, groundLevel + bHeight + 0.6, bz],
                        Color: [90, 85, 80],
                        Anchored: true,
                        Material: 'Slate',
                    },
                });
                // Windows (2 on each visible face)
                for (let w = 0; w < 2; w++) {
                    const winX = -bWidth / 4 + w * bWidth / 2;
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: 'Window_' + (w + 1),
                            Size: [3, 4, 0.2],
                            Position: [bx + winX, groundLevel + bHeight * 0.6, bz + bDepth / 2 + 0.1],
                            Color: [140, 180, 210],
                            Anchored: true,
                            Material: 'Glass',
                            Transparency: 0.5,
                        },
                    });
                }
                // Door
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: 'Door',
                        Size: [4, 7, 0.5],
                        Position: [bx, groundLevel + 3.5, bz + bDepth / 2 + 0.2],
                        Color: [100, 70, 40],
                        Anchored: true,
                        Material: 'Wood',
                    },
                });
                envInstanceCount += 4;
            }
        }
    }

    // Resolve template placements
    const resolved = resolveTemplatePlacements(envPlacements);
    instances.push(...resolved.instances);
    terrain.push(...resolved.terrain);

    // ── Boundary handling ───────────────────────────────────────
    const boundaryType = env.boundaryType || 'invisible_walls';

    if (boundaryType === 'invisible_walls' || boundaryType === 'terrain_fade') {
        const wallHeight = 24;
        const wallPositions = [
            { name: 'BoundaryNorth', size: [boundaryWidth, wallHeight, 2], pos: [0, wallHeight / 2, -boundHalfD] },
            { name: 'BoundarySouth', size: [boundaryWidth, wallHeight, 2], pos: [0, wallHeight / 2, boundHalfD] },
            { name: 'BoundaryWest', size: [2, wallHeight, boundaryDepth], pos: [-boundHalfW, wallHeight / 2, 0] },
            { name: 'BoundaryEast', size: [2, wallHeight, boundaryDepth], pos: [boundHalfW, wallHeight / 2, 0] },
        ];
        for (const wall of wallPositions) {
            instances.push({
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: wall.name,
                    Size: wall.size,
                    Position: wall.pos,
                    Anchored: true,
                    Transparency: 1,
                    CanCollide: true,
                },
            });
        }

        if (boundaryType === 'terrain_fade') {
            terrain.push({
                shape: 'Block',
                material: 'Ground',
                position: [0, groundLevel - 2.5, -boundHalfD + 8],
                size: [boundaryWidth, 3, 16],
                rotation: [0, 0, 0],
            });
            terrain.push({
                shape: 'Block',
                material: 'Ground',
                position: [0, groundLevel - 2.5, boundHalfD - 8],
                size: [boundaryWidth, 3, 16],
                rotation: [0, 0, 0],
            });
            terrain.push({
                shape: 'Block',
                material: 'Rock',
                position: [-boundHalfW + 8, groundLevel - 3, 0],
                size: [16, 4, boundaryDepth],
                rotation: [0, 0, 0],
            });
            terrain.push({
                shape: 'Block',
                material: 'Rock',
                position: [boundHalfW - 8, groundLevel - 3, 0],
                size: [16, 4, boundaryDepth],
                rotation: [0, 0, 0],
            });
        }
    }

    if (boundaryType === 'floating_edge') {
        const edgeThickness = 6;
        const edgeHeight = 8;
        const edgePositions = [
            { pos: [0, groundLevel - edgeHeight / 2, -halfD], size: [dims.width + 4, edgeHeight, edgeThickness] },
            { pos: [0, groundLevel - edgeHeight / 2, halfD], size: [dims.width + 4, edgeHeight, edgeThickness] },
            { pos: [-halfW, groundLevel - edgeHeight / 2, 0], size: [edgeThickness, edgeHeight, dims.depth + 4] },
            { pos: [halfW, groundLevel - edgeHeight / 2, 0], size: [edgeThickness, edgeHeight, dims.depth + 4] },
        ];
        for (const edge of edgePositions) {
            terrain.push({
                shape: 'Block',
                material: 'Rock',
                position: edge.pos,
                size: edge.size,
                rotation: [0, 0, 0],
            });
        }
        terrain.push({
            shape: 'Ball',
            material: 'Rock',
            position: [0, groundLevel - 12, 0],
            radius: Math.min(halfW, halfD) * 0.7,
        });
    }

    if (boundaryType === 'water_border') {
        const waterRingWidth = 24;
        [
            [0, groundLevel - 1, -halfD - waterRingWidth / 2, [boundaryWidth, 2, waterRingWidth]],
            [0, groundLevel - 1, halfD + waterRingWidth / 2, [boundaryWidth, 2, waterRingWidth]],
            [-halfW - waterRingWidth / 2, groundLevel - 1, 0, [waterRingWidth, 2, boundaryDepth + waterRingWidth * 2]],
            [halfW + waterRingWidth / 2, groundLevel - 1, 0, [waterRingWidth, 2, boundaryDepth + waterRingWidth * 2]],
        ].forEach(([x, y, z, size]) => {
            terrain.push({
                shape: 'Block',
                material: 'Water',
                position: [x, y, z],
                size,
                rotation: [0, 0, 0],
            });
        });

        const wallHeight = 20;
        const waterWallDist = halfW + waterRingWidth;
        const waterWallDepthDist = halfD + waterRingWidth;
        for (const wall of [
            { name: 'WaterBoundN', size: [boundaryWidth + waterRingWidth * 2, wallHeight, 2], pos: [0, wallHeight / 2, -waterWallDepthDist] },
            { name: 'WaterBoundS', size: [boundaryWidth + waterRingWidth * 2, wallHeight, 2], pos: [0, wallHeight / 2, waterWallDepthDist] },
            { name: 'WaterBoundW', size: [2, wallHeight, boundaryDepth + waterRingWidth * 2], pos: [-waterWallDist, wallHeight / 2, 0] },
            { name: 'WaterBoundE', size: [2, wallHeight, boundaryDepth + waterRingWidth * 2], pos: [waterWallDist, wallHeight / 2, 0] },
        ]) {
            instances.push({
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: wall.name,
                    Size: wall.size,
                    Position: wall.pos,
                    Anchored: true,
                    Transparency: 1,
                    CanCollide: true,
                },
            });
        }
    }

    // Cap outputs
    if (terrain.length > 12) terrain.length = 12;
    if (instances.length > 50) instances.length = 50;

    return { instances, terrain };
}

// ── Scene validation ─────────────────────────────────────────

function validateSceneOutput(data, options = {}) {
    const warnings = [];
    const errors = [];
    const expectEnvironment = !!options.expectEnvironment;
    const scenePlan = options.scenePlan || null;
    let boundaryCount = 0;
    let environmentDetailCount = 0;

    if (Array.isArray(data.instances)) {
        const positionMap = new Map();
        for (const inst of data.instances) {
            const props = inst.properties || {};
            const name = String(props.Name || inst.className || '');

            if (!inst.className || typeof inst.className !== 'string') {
                errors.push(`Instance "${props.Name || '?'}" has no className — will fail to create`);
                continue;
            }

            if (/boundary|waterbound/i.test(name)) boundaryCount += 1;
            if (/tree|rock|flower|bench|lamp|road|bgbuilding|boundary|waterbound/i.test(name)) {
                environmentDetailCount += 1;
            }

            if (Array.isArray(props.Position)) {
                const key = props.Position.map(n => Math.round(n * 10) / 10).join(',');
                const existing = positionMap.get(key);
                const n = String(props.Name || '').toLowerCase();
                const ex = String(existing || '').toLowerCase();
                const layeredPair = /(glass|pane|frame|mullion|partition|divider)/.test(n)
                    && /(glass|pane|frame|mullion|partition|divider)/.test(ex);
                if (existing && existing !== (props.Name || inst.className)
                    && inst.className !== 'Model' && inst.className !== 'PointLight'
                    && !layeredPair) {
                    warnings.push(`"${props.Name || inst.className}" and "${existing}" share position [${key}]`);
                }
                positionMap.set(key, props.Name || inst.className);
            }

            if (Array.isArray(props.Size)) {
                for (let i = 0; i < props.Size.length; i++) {
                    if (typeof props.Size[i] === 'number' && props.Size[i] > 500) {
                        warnings.push(`"${props.Name || inst.className}" Size axis ${i} = ${props.Size[i]} (exceeds 500)`);
                    }
                    if (typeof props.Size[i] === 'number' && props.Size[i] <= 0) {
                        errors.push(`"${props.Name || inst.className}" Size axis ${i} = ${props.Size[i]} (must be positive)`);
                    }
                }
            }

            if (Array.isArray(props.Size) && props.Size.length === 3
                && inst.className !== 'Model' && !inst.className.includes('Light')) {
                const maxDim = Math.max(...props.Size);
                const minDim = Math.min(...props.Size.filter(s => s > 0));
                const isRoadMarking = /centerline|lane|divider|crosswalk|roadmark|stonepath|path|walkway|pathway|pavement|sidewalk|glasspartition|partition|roadsurface|centralopen|openarea|ceiling|panel|slab/i.test(name);
                if (maxDim > 0 && minDim > 0 && maxDim / minDim > 200 && !isRoadMarking) {
                    warnings.push(`"${props.Name || inst.className}" has extreme aspect ratio (${maxDim}:${minDim})`);
                }
            }
        }
    }

    const terrainMaterials = [];
    if (Array.isArray(data.terrain)) {
        for (const op of data.terrain) {
            terrainMaterials.push(op.material);
            if (op.shape === 'Block' && Array.isArray(op.size)) {
                for (let i = 0; i < op.size.length; i++) {
                    if (op.size[i] > 512) {
                        warnings.push(`Terrain ${op.material} Block has size axis ${i} = ${op.size[i]}`);
                    }
                }
            }
            if (op.shape === 'Ball' && op.radius > 256) {
                warnings.push(`Terrain ${op.material} Ball has radius ${op.radius}`);
            }
        }
    }

    if (expectEnvironment) {
        const terrainCount = Array.isArray(data.terrain) ? data.terrain.length : 0;
        const hasWaterTerrain = terrainMaterials.includes('Water');
        const hasRockTerrain = terrainMaterials.includes('Rock');
        const boundaryType = scenePlan?.environment?.boundaryType || null;
        const mapArea = (scenePlan?.dimensions?.width || 128) * (scenePlan?.dimensions?.depth || 128);
        const minimumDetailScore = mapArea > 30000 ? 10 : 6;
        const detailScore = environmentDetailCount + terrainCount;

        if (terrainCount === 0) {
            warnings.push('Environment requested but no surrounding terrain operations produced.');
        }
        if (boundaryType === 'water_border' && !hasWaterTerrain) {
            warnings.push('Water-border map requested but no water terrain produced.');
        }
        if (boundaryType === 'floating_edge' && !hasRockTerrain) {
            warnings.push('Floating-edge boundary requested but no rocky edge terrain produced.');
        }
        if ((boundaryType === 'invisible_walls' || boundaryType === 'terrain_fade' || !boundaryType) && boundaryCount === 0) {
            warnings.push('Environment requested but no map boundary instances produced.');
        }
        if (detailScore < minimumDetailScore) {
            warnings.push(`Environment output sparse for map size (${detailScore} details, expected ${minimumDetailScore}).`);
        }
        if ((scenePlan?.sceneType === 'classroom' || scenePlan?.sceneType === 'lobby') && environmentDetailCount < 5) {
            warnings.push('Interior scene requested wider world but environment layer is still thin.');
        }
    }

    return { warnings, errors };
}

// ── Preview data generator ───────────────────────────────────

function generatePreviewData(scenePlan, outputData) {
    const zones = scenePlan.zones || [];
    const objects = scenePlan.objects || [];
    const env = scenePlan.environment || {};

    const preview = {
        summary: {
            title: scenePlan.title || 'Unnamed Scene',
            sceneType: scenePlan.sceneType,
            dimensions: scenePlan.dimensions,
            totalInstances: (outputData.instances?.length || 0) + (outputData.terrain?.length || 0),
            zoneCount: zones.length,
            objectCount: objects.length,
        },
        coreStructure: scenePlan.coreStructure,
        zones: zones.map(z => ({
            name: z.name,
            bounds: z.bounds,
            terrain: z.terrainMaterial,
        })),
        environment: {
            enabled: env.generateSurroundings,
            boundaryType: env.boundaryType,
            elements: env.surroundingElements || [],
            mapSize: env.mapBoundarySize,
        },
        colorPalette: scenePlan.colorPalette,
        validationHints: [],
    };

    // Add validation hints
    if (zones.length === 0) preview.validationHints.push('Consider defining zones for better object organization');
    if (objects.length > 30) preview.validationHints.push('High object count may result in sparse placement');
    if (!env.boundaryType) preview.validationHints.push('No boundary type specified');
    if (env.generateSurroundings && (!env.surroundingElements || env.surroundingElements.length === 0)) {
        preview.validationHints.push('Environment enabled but no elements specified');
    }

    return preview;
}

function scoreSceneCoherence(scenePlan, outputData) {
    let score = 0;
    const maxScore = 10;
    const reasons = [];

    if (scenePlan.coreStructure) { score += 1; reasons.push('core structure defined'); }
    if (Array.isArray(scenePlan.zones) && scenePlan.zones.length > 0) { score += 1; reasons.push(`${scenePlan.zones.length} zones`); }
    if (Array.isArray(scenePlan.objects) && scenePlan.objects.length >= 3) { score += 1; reasons.push(`${scenePlan.objects.length} planned objects`); }
    if (scenePlan.colorPalette?.primary) { score += 1; reasons.push('color palette set'); }
    if (scenePlan.lighting?.timeOfDay) { score += 1; reasons.push('lighting defined'); }
    if (scenePlan.environment?.generateSurroundings) { score += 1; reasons.push('environment enabled'); }
    if (scenePlan.environment?.boundaryType) { score += 1; reasons.push('boundary type set'); }

    const instanceCount = outputData.instances?.length || 0;
    const terrainCount = outputData.terrain?.length || 0;
    if (instanceCount >= 10) { score += 1; reasons.push(`${instanceCount} instances`); }
    if (terrainCount >= 2) { score += 1; reasons.push(`${terrainCount} terrain ops`); }
    if (instanceCount + terrainCount >= 20) { score += 1; reasons.push('rich output'); }

    return {
        score: Math.min(score, maxScore),
        maxScore,
        percentage: Math.round((Math.min(score, maxScore) / maxScore) * 100),
        reasons,
        grade: score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'fair' : 'sparse',
    };
}

// ── Layout helper — deterministic position calculator ────────
// Computes exact [x, y, z] positions for common placement patterns.
// Call from server-side post-processing to fix AI-generated positions
// on instances that carry a `layoutHint` property.
//
// layoutHint format: { pattern, count, center, spacing, elevation, facing }
// pattern: "grid" | "row" | "ring" | "perimeter" | "diagonal"

function computeLayoutPositions(hint) {
    const {
        pattern = 'grid',
        count = 1,
        center = [0, 0, 0],
        spacing = 6,
        elevation,
        facing = 0,
    } = hint;

    const [cx, , cz] = center;
    const cy = elevation !== undefined ? elevation : center[1] ?? 0;
    const positions = [];

    if (pattern === 'row') {
        const totalWidth = (count - 1) * spacing;
        const startX = cx - totalWidth / 2;
        for (let i = 0; i < count; i++) {
            positions.push([startX + i * spacing, cy, cz]);
        }

    } else if (pattern === 'grid') {
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const startX = cx - ((cols - 1) * spacing) / 2;
        const startZ = cz - ((rows - 1) * spacing) / 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (positions.length >= count) break;
                positions.push([startX + c * spacing, cy, startZ + r * spacing]);
            }
        }

    } else if (pattern === 'ring') {
        const radius = (count * spacing) / (2 * Math.PI);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * 2 * Math.PI + (facing * Math.PI / 180);
            positions.push([
                cx + radius * Math.cos(angle),
                cy,
                cz + radius * Math.sin(angle),
            ]);
        }

    } else if (pattern === 'perimeter') {
        // Evenly distribute along the 4 sides of a rectangle
        const side = Math.ceil(count / 4);
        const half = (side * spacing) / 2;
        for (let i = 0; i < count; i++) {
            const edge = Math.floor(i / Math.ceil(count / 4));
            const t = (i % Math.ceil(count / 4)) / Math.max(1, Math.ceil(count / 4) - 1);
            let pos;
            if (edge === 0)      pos = [cx - half + t * half * 2, cy, cz - half];
            else if (edge === 1) pos = [cx + half, cy, cz - half + t * half * 2];
            else if (edge === 2) pos = [cx + half - t * half * 2, cy, cz + half];
            else                 pos = [cx - half, cy, cz + half - t * half * 2];
            positions.push(pos);
        }

    } else if (pattern === 'diagonal') {
        for (let i = 0; i < count; i++) {
            positions.push([cx + i * spacing, cy, cz + i * spacing]);
        }
    }

    return positions;
}

// Scan generated instances for `layoutHint` tags and apply computed positions.
// This runs as a post-processing step over AI output so the AI only needs to
// specify intent (e.g. "grid of 12 desks") and the server computes exact coords.
function applyLayoutHints(instances) {
    if (!Array.isArray(instances)) return instances;
    const result = [];

    let i = 0;
    while (i < instances.length) {
        const inst = instances[i];
        const hint = inst?.properties?.layoutHint;

        if (hint && typeof hint === 'object') {
            const count = hint.count || 1;
            const positions = computeLayoutPositions(hint);
            const template = { ...inst, properties: { ...inst.properties } };
            delete template.properties.layoutHint;
            const baseName = template.properties.Name || 'Object';

            for (let j = 0; j < count; j++) {
                const pos = positions[j] || positions[positions.length - 1];
                result.push({
                    ...template,
                    properties: {
                        ...template.properties,
                        Name: `${baseName}${count > 1 ? `_${j + 1}` : ''}`,
                        Position: pos,
                    },
                });
            }

            // Skip the next (count - 1) instances if the AI duplicated them
            // (it sometimes emits one entry per object when given a count hint)
            i++;
        } else {
            result.push(inst);
            i++;
        }
    }

    return result;
}

module.exports = {
    SCENE_PLANNER_PROMPT,
    MAP_DIMENSIONS,
    SCALE_REFERENCE,
    buildScenePlanContext,
    validateScenePlan,
    resolveScenePlanTemplates,
    generateEnvironment,
    validateSceneOutput,
    generatePreviewData,
    scoreSceneCoherence,
    computeLayoutPositions,
    applyLayoutHints,
};
