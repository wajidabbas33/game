// ============================================================
//  Roblox AI Plugin – Scene Planner Module
//
//  Two-stage generation pipeline:
//    Stage 1: Analyze prompt → structured ScenePlan
//    Stage 2: Resolve plan → Roblox JSON output
//
//  The planner separates WHAT to build from HOW to build it,
//  producing more coherent, proportional, spatially-aware output.
// ============================================================

'use strict';

const {
    getTemplateCatalogText,
    getTemplatePlacementMetadata,
    resolveTemplatePlacements,
} = require('./templates');

// ── Scene Planner System Prompt ──────────────────────────────

const SCENE_PLANNER_PROMPT = `You are a Roblox scene architect. Your job is to analyze a user's natural language description and produce a structured scene plan in JSON.

DO NOT generate Roblox instances, scripts, or terrain operations. Instead, output a ScenePlan that describes WHAT should be built, WHERE, and in WHAT style.

════════════════════════════════════════════════════════════
OUTPUT FORMAT — ScenePlan JSON
════════════════════════════════════════════════════════════
Return ONLY a single valid JSON object:

{
  "sceneType": "floating_island | classroom | arena | lobby | outdoor_park | town | custom",
  "title": "Short descriptive title",
  "dimensions": { "width": 128, "depth": 128, "height": 40 },
  "groundLevel": 0,

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
    "style": "colorful_whimsical | realistic_natural | modern_clean | rustic_warm | sci_fi | fantasy"
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

════════════════════════════════════════════════════════════
ENVIRONMENT ELEMENTS (use in surroundingElements)
════════════════════════════════════════════════════════════
  • "trees_sparse" — scattered trees in ring around main build
  • "trees" / "trees_dense" — denser tree placement
  • "rocks_scattered" / "rocks" — rock formations at edges
  • "flowers_random" / "flowers" — flower clusters
  • "lamps" / "street_lamps" — street lights
  • "benches" — park benches along paths
  • "roads" — roads connecting to map edges (N/S/E/W)
  • "background_structures" — simple building shells on perimeter

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
1. Think about the FULL scene composition, not just the primary structure.
2. When the user asks for a "map" or "island", plan the entire playable area including boundaries.
3. Assign every object to a zone so placement is spatially organized.
4. Use templates when possible — they have correct proportions built in.
5. Keep total object count reasonable (10–35 per phase for complex scenes).
6. For environment, plan a ring of terrain and props around the main build.
7. Use the colorPalette to maintain visual consistency across all objects.
8. Position objects relative to groundLevel, not absolute Y coordinates.
9. Return ONLY the JSON. No prose, no markdown, no explanation outside the JSON.
10. ALWAYS set environment.generateSurroundings to true for maps, islands, towns, and outdoor scenes.
11. When the main build is an interior such as a classroom, lobby, or room and environment generation is enabled, still plan the outside world layer around it: terrain, walkways, props, and clear map boundaries.
12. Use "roads" in surroundingElements for town/outdoor scenes and when interior scenes connect to a wider playable map.
13. Use "background_structures" for urban or town scenes, and for larger indoor scenes that should sit inside a believable surrounding campus/block.
14. Choose the boundary type that fits the scene: water_border for islands, floating_edge for floating maps, terrain_fade for outdoor, invisible_walls for arenas.`;

// ── Scene Builder System Prompt Addon ────────────────────────
// This is injected into the normal SYSTEM_PROMPT when a ScenePlan is available.

function buildScenePlanContext(scenePlan) {
    return `════════════════════════════════════════════════════════════
SCENE PLAN CONTEXT (follow this plan precisely)
════════════════════════════════════════════════════════════
The scene planner has analyzed the user's request and produced this plan.
You MUST follow it for layout, dimensions, zones, and object placement.

Scene: ${scenePlan.title || scenePlan.sceneType || 'Custom'}
Dimensions: ${scenePlan.dimensions?.width || 128}W × ${scenePlan.dimensions?.depth || 128}D × ${scenePlan.dimensions?.height || 40}H studs
Ground level: Y = ${scenePlan.groundLevel || 0}

Zones:
${(scenePlan.zones || []).map(z =>
    `  • ${z.name}: ${z.purpose} (X: ${z.bounds?.minX ?? '?'} to ${z.bounds?.maxX ?? '?'}, Z: ${z.bounds?.minZ ?? '?'} to ${z.bounds?.maxZ ?? '?'}, elevation: ${z.elevation ?? 0}, terrain: ${z.terrainMaterial || 'Grass'})`
).join('\n')}

Objects to generate:
${(scenePlan.objects || []).map(o => {
    if (o.template) {
        return `  • TEMPLATE "${o.template}" × ${o.count || 1} in zone "${o.zone || 'main'}" (${o.spacing || 'placed'}) — ${o.notes || ''}`;
    }
    return `  • CUSTOM "${o.name || o.type}": ${o.description || ''} at [${o.position?.join(',') || '?'}] size [${o.size?.join(',') || '?'}]`;
}).join('\n')}

Color palette: primary ${JSON.stringify(scenePlan.colorPalette?.primary || [100,150,100])}, secondary ${JSON.stringify(scenePlan.colorPalette?.secondary || [150,150,150])}, accent ${JSON.stringify(scenePlan.colorPalette?.accent || [255,220,140])}, style: ${scenePlan.colorPalette?.style || 'natural'}

Lighting: ${scenePlan.lighting?.timeOfDay || 'default'}, ambience: ${scenePlan.lighting?.ambience || 'neutral'}, ${scenePlan.lighting?.pointLightCount || 0} point lights

Environment: ${scenePlan.environment?.generateSurroundings ? 'Generate surroundings' : 'Main build only'}, boundary: ${scenePlan.environment?.boundaryType || 'none'}

IMPORTANT:
- Template objects will be resolved automatically by the backend. For template objects, just include a placeholder instance with the template name.
- For custom objects, generate full Roblox instances with correct properties.
- Follow the zone bounds for object placement. Objects in a zone must be within its min/max coordinates.
- Use the color palette for visual consistency.
- Include terrain operations for ground, hills, and natural features as described in the zones.`;
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

    if (!plan.dimensions || typeof plan.dimensions !== 'object') {
        warnings.push('Missing dimensions — using defaults 128×128×40');
        plan.dimensions = { width: 128, depth: 128, height: 40 };
    }

    // Validate dimensions are reasonable
    const { width = 128, depth = 128, height = 40 } = plan.dimensions;
    if (width > 512 || depth > 512) {
        warnings.push(`Scene dimensions ${width}×${depth} exceed 512 studs — output may be sparse`);
    }
    if (width < 16 || depth < 16) {
        warnings.push(`Scene dimensions ${width}×${depth} are very small — consider at least 32×32`);
    }

    // Validate zones
    if (Array.isArray(plan.zones)) {
        plan.zones.forEach((zone, i) => {
            if (!zone.name) warnings.push(`Zone ${i} has no name`);
            if (!zone.bounds) warnings.push(`Zone "${zone.name || i}" has no bounds`);
        });
    }

    // Validate objects
    if (Array.isArray(plan.objects)) {
        let totalParts = 0;
        plan.objects.forEach((obj, i) => {
            const count = obj.count || 1;
            if (obj.template) {
                // Will be resolved from template registry
                totalParts += count * 5; // estimate
            } else if (obj.type === 'custom') {
                if (!obj.name && !obj.description) {
                    warnings.push(`Custom object ${i} has no name or description`);
                }
                totalParts += count * 3; // estimate
            }
        });
        if (totalParts > 150) {
            warnings.push(`Estimated ${totalParts} parts — may be too many for one phase. Consider splitting.`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ── Template placement resolver ──────────────────────────────
// Takes a ScenePlan and resolves template references into concrete
// instances with positions calculated from zone bounds.

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
        if (!Array.isArray(otherPos)) {
            continue;
        }

        const otherRadius = typeof other?.radius === 'number' ? other.radius : 0;
        const dx = pos[0] - otherPos[0];
        const dz = pos[2] - otherPos[2];
        const dist2d = Math.sqrt(dx * dx + dz * dz);
        const minDist = candidateRadius + otherRadius + extraPadding;
        if (dist2d < minDist) {
            return true;
        }
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

    // Build zone lookup
    if (Array.isArray(scenePlan.zones)) {
        for (const zone of scenePlan.zones) {
            zoneMap[zone.name] = zone;
        }
    }

    if (!Array.isArray(scenePlan.objects)) {
        return { instances: [], terrain: [] };
    }

    // Track placed positions to avoid overlap
    const placedPositions = [];

    for (const obj of scenePlan.objects) {
        if (!obj.template) continue; // custom objects handled by AI

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
                    // Try multiple times to bias nature/perimeter objects toward edges and avoid overlap.
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
                    // Grid placement (BUG FIX: was using maxZ - minX, now maxZ - minZ)
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
                        const fallback = sampleRingPosition(
                            zone.bounds,
                            scenePlan.groundLevel || 0,
                            elevation,
                            placementBias
                        );
                        pos = fallback;
                    }
                }
            } else if (obj.position) {
                pos = [...obj.position];
                if (i > 0) {
                    // Offset subsequent copies
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

// ── Environment generator ────────────────────────────────────
// Generates surrounding terrain, props, and boundaries around
// the main build. Capped at 40 instances + 10 terrain ops.

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

    // ── Base terrain under the entire map ────────────────────
    const terrainMaterial = env.surroundingTerrain || 'Grass';
    terrain.push({
        shape: 'Block',
        material: terrainMaterial,
        position: [0, groundLevel - 2, 0],
        size: [boundaryWidth, 4, boundaryDepth],
        rotation: [0, 0, 0],
    });

    // ── Floating island specifics ────────────────────────────
    if (scenePlan.sceneType === 'floating_island') {
        // Underside rock
        terrain.push({
            shape: 'Ball',
            material: 'Rock',
            position: [0, groundLevel - 10, 0],
            radius: Math.min(halfW, halfD) * 0.8,
        });
        // Edge dirt/rock layer
        terrain.push({
            shape: 'Block',
            material: 'Ground',
            position: [0, groundLevel - 4, 0],
            size: [dims.width * 1.1, 3, dims.depth * 1.1],
            rotation: [0, 0, 0],
        });
        // Surrounding water below island
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [0, groundLevel - 30, 0],
            size: [boundaryWidth * 2, 2, boundaryDepth * 2],
            rotation: [0, 0, 0],
        });
    }

    // ── Scattered environment elements ───────────────────────
    const elements = env.surroundingElements || ['trees_sparse'];
    const maxEnvInstances = 30; // cap remaining budget
    let envInstanceCount = 0;

    const envPlacements = [];
    const envPlacedPositions = [];

    for (const element of elements) {
        if (envInstanceCount >= maxEnvInstances) break;

        if (element === 'trees_sparse' || element === 'trees' || element === 'trees_dense') {
            const treeMeta = getTemplatePlacementMetadata('deciduous_tree_medium');
            const treeCount = Math.min(
                element === 'trees_dense' ? 8 : 6,
                Math.floor((maxEnvInstances - envInstanceCount) / 5)
            );
            for (let i = 0; i < treeCount; i++) {
                const angle = (i / treeCount) * Math.PI * 2 + Math.random() * 0.5;
                const dist = halfW * 0.8 + Math.random() * (boundHalfW - halfW) * 0.6;
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;
                const pos = [x, groundLevel, z];
                if (!isInsideCorePlayArea(pos, dims, environmentCorePadding)
                    && !isPlacementTooClose(pos, treeMeta.footprintRadius, envPlacedPositions, treeMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, treeMeta));
                    envPlacements.push({
                        template: Math.random() > 0.5 ? 'deciduous_tree_medium' : 'pine_tree',
                        position: pos,
                        rotation: Math.random() * 360,
                    });
                    envInstanceCount += 5;
                }
            }
        }

        if (element === 'rocks_scattered' || element === 'rocks') {
            const rockMeta = getTemplatePlacementMetadata('rock_formation');
            const rockCount = Math.min(4, Math.floor((maxEnvInstances - envInstanceCount) / 3));
            for (let i = 0; i < rockCount; i++) {
                const angle = (i / rockCount) * Math.PI * 2 + Math.random();
                const dist = halfW * 0.6 + Math.random() * halfW * 0.4;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                if (!isPlacementTooClose(pos, rockMeta.footprintRadius, envPlacedPositions, rockMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, rockMeta));
                    envPlacements.push({
                        template: 'rock_formation',
                        position: pos,
                    });
                    envInstanceCount += 3;
                }
            }
        }

        if (element === 'flowers_random' || element === 'flowers') {
            const flowerMeta = getTemplatePlacementMetadata('flower_cluster');
            const flowerCount = Math.min(3, Math.floor((maxEnvInstances - envInstanceCount) / 10));
            for (let i = 0; i < flowerCount; i++) {
                const pos = sampleRingPosition(
                    { minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD },
                    groundLevel,
                    0,
                    'perimeter'
                );
                if (!isPlacementTooClose(pos, flowerMeta.footprintRadius, envPlacedPositions, flowerMeta.preferredSpacing * 0.15)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, flowerMeta));
                    envPlacements.push({
                        template: 'flower_cluster',
                        position: pos,
                    });
                    envInstanceCount += 10;
                }
            }
        }

        if (element === 'lamps' || element === 'street_lamps') {
            const lampMeta = getTemplatePlacementMetadata('street_lamp');
            const lampCount = Math.min(4, Math.floor((maxEnvInstances - envInstanceCount) / 4));
            for (let i = 0; i < lampCount; i++) {
                const angle = (i / lampCount) * Math.PI * 2;
                const dist = halfW * 0.5;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                if (!isPlacementTooClose(pos, lampMeta.footprintRadius, envPlacedPositions, lampMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, lampMeta));
                    envPlacements.push({
                        template: 'street_lamp',
                        position: pos,
                    });
                    envInstanceCount += 4;
                }
            }
        }

        if (element === 'benches') {
            const benchMeta = getTemplatePlacementMetadata('bench');
            const benchCount = Math.min(3, Math.floor((maxEnvInstances - envInstanceCount) / 5));
            for (let i = 0; i < benchCount; i++) {
                const angle = (i / benchCount) * Math.PI * 2 + Math.PI / 6;
                const dist = halfW * 0.4;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
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

        // ── Roads connecting to map edges ────────────────────
        if (element === 'roads') {
            const roadBudget = Math.floor((maxEnvInstances - envInstanceCount) / 3);
            if (roadBudget >= 2) {
                // North-south road
                const nsLength = boundaryDepth * 0.8;
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
                        Position: [halfW * 0.7, groundLevel + 0.15, 0],
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
                        Position: [halfW * 0.7, groundLevel + 0.35, 0],
                        Color: [230, 210, 80],
                        Anchored: true,
                        Material: 'SmoothPlastic',
                    },
                });
                envInstanceCount += 3;

                // East-west road (if budget allows)
                if (envInstanceCount + 3 <= maxEnvInstances) {
                    const ewLength = boundaryWidth * 0.8;
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
                            Position: [0, groundLevel + 0.15, halfD * 0.7],
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
                            Position: [0, groundLevel + 0.35, halfD * 0.7],
                            Color: [230, 210, 80],
                            Anchored: true,
                            Material: 'SmoothPlastic',
                        },
                    });
                    envInstanceCount += 3;
                }
            }
        }

        // ── Background structures (simple building shells) ───
        if (element === 'background_structures' || element === 'buildings') {
            const buildingCount = Math.min(3, Math.floor((maxEnvInstances - envInstanceCount) / 4));
            for (let i = 0; i < buildingCount; i++) {
                const angle = (i / buildingCount) * Math.PI * 2 + Math.PI / 4;
                const dist = boundHalfW * 0.7;
                const bx = Math.cos(angle) * dist;
                const bz = Math.sin(angle) * dist;
                const bWidth = 16 + Math.random() * 12;
                const bHeight = 14 + Math.random() * 18;
                const bDepth = 12 + Math.random() * 8;
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
                        Size: [bWidth + 2, 1, bDepth + 2],
                        Position: [bx, groundLevel + bHeight + 0.5, bz],
                        Color: [90, 85, 80],
                        Anchored: true,
                        Material: 'Slate',
                    },
                });
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

    // Resolve template placements for environment
    const resolved = resolveTemplatePlacements(envPlacements);
    instances.push(...resolved.instances);
    terrain.push(...resolved.terrain);

    // ── Boundary handling (all types) ─────────────────────────
    const boundaryType = env.boundaryType || 'invisible_walls';

    if (boundaryType === 'invisible_walls' || boundaryType === 'terrain_fade') {
        const wallHeight = 24;
        const wallPositions = [
            { name: 'BoundaryNorth', size: [boundaryWidth, wallHeight, 2], pos: [0, wallHeight / 2, -boundHalfD] },
            { name: 'BoundarySouth', size: [boundaryWidth, wallHeight, 2], pos: [0, wallHeight / 2, boundHalfD] },
            { name: 'BoundaryWest',  size: [2, wallHeight, boundaryDepth], pos: [-boundHalfW, wallHeight / 2, 0] },
            { name: 'BoundaryEast',  size: [2, wallHeight, boundaryDepth], pos: [boundHalfW, wallHeight / 2, 0] },
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
        // terrain_fade: add fading terrain ring at edges
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
        // Rocky cliff edges around the map perimeter
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
        // Rounded rock underneath edges
        terrain.push({
            shape: 'Ball',
            material: 'Rock',
            position: [0, groundLevel - 12, 0],
            radius: Math.min(halfW, halfD) * 0.7,
        });
    }

    if (boundaryType === 'water_border') {
        // Water terrain surrounding the map
        const waterRingWidth = 24;
        // North water strip
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [0, groundLevel - 1, -halfD - waterRingWidth / 2],
            size: [boundaryWidth, 2, waterRingWidth],
            rotation: [0, 0, 0],
        });
        // South water strip
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [0, groundLevel - 1, halfD + waterRingWidth / 2],
            size: [boundaryWidth, 2, waterRingWidth],
            rotation: [0, 0, 0],
        });
        // West water strip
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [-halfW - waterRingWidth / 2, groundLevel - 1, 0],
            size: [waterRingWidth, 2, boundaryDepth + waterRingWidth * 2],
            rotation: [0, 0, 0],
        });
        // East water strip
        terrain.push({
            shape: 'Block',
            material: 'Water',
            position: [halfW + waterRingWidth / 2, groundLevel - 1, 0],
            size: [waterRingWidth, 2, boundaryDepth + waterRingWidth * 2],
            rotation: [0, 0, 0],
        });
        // Invisible walls behind water
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

    // Cap terrain ops at 10
    if (terrain.length > 10) {
        terrain.length = 10;
    }

    // Cap instances at 40
    if (instances.length > 40) {
        instances.length = 40;
    }

    return { instances, terrain };
}

// ── Scene validation ─────────────────────────────────────────

function validateSceneOutput(data, options = {}) {
    const warnings = [];
    const errors = [];   // Critical issues that should block apply
    const expectEnvironment = !!options.expectEnvironment;
    const scenePlan = options.scenePlan || null;
    let boundaryCount = 0;
    let environmentDetailCount = 0;

    if (Array.isArray(data.instances)) {
        const positionMap = new Map();
        for (const inst of data.instances) {
            const props = inst.properties || {};
            const name = String(props.Name || inst.className || '');

            // CRITICAL: missing className
            if (!inst.className || typeof inst.className !== 'string') {
                errors.push(`Instance "${props.Name || '?'}" has no className — will fail to create`);
                continue;
            }

            if (/boundary|waterbound/i.test(name)) {
                boundaryCount += 1;
            }
            if (/tree|rock|flower|bench|lamp|road|bgbuilding|boundary|waterbound/i.test(name)) {
                environmentDetailCount += 1;
            }

            // Check for identical positions (warning only — some parent models share position)
            if (Array.isArray(props.Position)) {
                const key = props.Position.map(n => Math.round(n * 10) / 10).join(',');
                const existing = positionMap.get(key);
                if (existing && existing !== (props.Name || inst.className)
                    && inst.className !== 'Model' && inst.className !== 'PointLight') {
                    warnings.push(
                        `"${props.Name || inst.className}" and "${existing}" share the same position [${key}]`
                    );
                }
                positionMap.set(key, props.Name || inst.className);
            }

            // Check Size bounds (max 500 studs per axis)
            if (Array.isArray(props.Size)) {
                for (let i = 0; i < props.Size.length; i++) {
                    if (typeof props.Size[i] === 'number' && props.Size[i] > 500) {
                        warnings.push(
                            `"${props.Name || inst.className}" has Size axis ${i} = ${props.Size[i]} (exceeds 500 stud limit)`
                        );
                    }
                    if (typeof props.Size[i] === 'number' && props.Size[i] <= 0) {
                        errors.push(
                            `"${props.Name || inst.className}" has Size axis ${i} = ${props.Size[i]} (must be positive — will create invisible part)`
                        );
                    }
                }
            }

            // Check for unreasonably small or large objects (skip Models, Lights)
            if (Array.isArray(props.Size) && props.Size.length === 3
                && inst.className !== 'Model' && !inst.className.includes('Light')) {
                const maxDim = Math.max(...props.Size);
                const minDim = Math.min(...props.Size.filter(s => s > 0));
                if (maxDim > 0 && minDim > 0 && maxDim / minDim > 200) {
                    warnings.push(
                        `"${props.Name || inst.className}" has extreme aspect ratio (${maxDim}:${minDim})`
                    );
                }
            }
        }
    }

    // Check terrain operations
    const terrainMaterials = [];
    if (Array.isArray(data.terrain)) {
        for (const op of data.terrain) {
            terrainMaterials.push(op.material);
            if (op.shape === 'Block' && Array.isArray(op.size)) {
                for (let i = 0; i < op.size.length; i++) {
                    if (op.size[i] > 512) {
                        warnings.push(
                            `Terrain ${op.material} Block has size axis ${i} = ${op.size[i]} (very large)`
                        );
                    }
                }
            }
            if (op.shape === 'Ball' && op.radius > 256) {
                warnings.push(`Terrain ${op.material} Ball has radius ${op.radius} (very large)`);
            }
        }
    }

    if (expectEnvironment) {
        const terrainCount = Array.isArray(data.terrain) ? data.terrain.length : 0;
        const hasWaterTerrain = terrainMaterials.includes('Water');
        const hasRockTerrain = terrainMaterials.includes('Rock');
        const boundaryType = scenePlan?.environment?.boundaryType || null;
        const mapArea = (scenePlan?.dimensions?.width || 128) * (scenePlan?.dimensions?.depth || 128);
        const minimumDetailScore = mapArea > 30_000 ? 8 : 5;
        const detailScore = environmentDetailCount + terrainCount;

        if (terrainCount === 0) {
            warnings.push('Environment generation was requested but no surrounding terrain operations were produced.');
        }

        if (boundaryType === 'water_border' && !hasWaterTerrain) {
            warnings.push('Water-border map requested, but no surrounding water terrain was produced.');
        }

        if (boundaryType === 'floating_edge' && !hasRockTerrain) {
            warnings.push('Floating-edge boundary requested, but no rocky edge terrain was produced.');
        }

        if ((boundaryType === 'invisible_walls' || boundaryType === 'terrain_fade' || !boundaryType) && boundaryCount === 0) {
            warnings.push('Environment generation was requested but no explicit map boundary instances were produced.');
        }

        if (detailScore < minimumDetailScore) {
            warnings.push(
                `Environment output looks sparse for this map size (${detailScore} environment detail units, expected at least ${minimumDetailScore}).`
            );
        }

        if ((scenePlan?.sceneType === 'classroom' || scenePlan?.sceneType === 'lobby') && environmentDetailCount < 4) {
            warnings.push('Interior scene requested a wider surrounding world, but the generated environment layer is still thin.');
        }
    }

    return { warnings, errors };
}

module.exports = {
    SCENE_PLANNER_PROMPT,
    buildScenePlanContext,
    validateScenePlan,
    resolveScenePlanTemplates,
    generateEnvironment,
    validateSceneOutput,
};
