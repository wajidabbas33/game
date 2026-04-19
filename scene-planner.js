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

/** Workspace map-edge Parts used to stay in-bounds. Transparency 1 = invisible mesh; Studio only shows a selection box — looks like "missing" walls. */
const FAINT_MAP_BOUNDARY = {
    Transparency: 0.86,
    Color: [202, 205, 212],
    Material: 'SmoothPlastic',
    CastShadow: false,
};

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
    "schoolCampusExterior": false,
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
14. Choose the boundary type that fits the scene: water_border for islands, floating_edge for floating maps, terrain_fade for outdoor, invisible_walls for arenas.
15. For interior-first scenes (classrooms, offices, shops): put most detail inside the room (layout, furniture, lighting, materials). Still plan a believable exterior ring when generateSurroundings is true: paths/roads, a few trees or lamps, and simple background building shells — unless the user explicitly asks for "interior only" or "no outside".
16. SCHOOL / CLASSROOM / CAMPUS: When the user asks for a school, classroom, or academic campus, set environment.schoolCampusExterior to true. Surrounding elements should be campus-appropriate only: roads or campus drives, trees, lamps, and simple institutional building shells (school wings, gym, admin). Do NOT plan or name zones for retail, nightlife, hospitals, airports, industry, zoos, or generic downtown.
17. NEVER add to the ScenePlan objects or zones: vehicles, buses, traffic, parking lots as the focus, shops, malls, restaurants, bars, clubs, casinos, airports, hospitals, factories, farms, jungles, wildlife, NPC crowds, or human/animal characters. The generator only places static Parts — plan accordingly.
18. For school prompts, interior detail must match a real classroom (teaching wall, student seating, institutional finishes). Exterior is a quiet campus, not a busy city.

════════════════════════════════════════════════════════════
INTERIOR ARCHITECTURE METHODOLOGY
════════════════════════════════════════════════════════════
When the prompt requests an interior space (café, office, classroom, shop, apartment, restaurant, lobby, etc.), follow this design methodology:

STEP 1 — ROOM INTENT
Identify the room type from the prompt. Consider what activities happen in this space and who uses it.

STEP 2 — ZONE DIVISION
Divide the room into functional zones. Every room has zones:
  • Entry/circulation zone (6-12% area)
  • Primary activity zone (30-50% area) — seating, desks, display
  • Service/utility zone (15-25% area) — counter, kitchen, storage
  • Secondary zones (accent areas, break nooks, waiting)
Each zone gets its own bounds within the room dimensions.

STEP 3 — FURNITURE ASSIGNMENT
Assign furniture templates to each zone. Use the expanded template library:
  • café_table_round, café_table_square, café_chair, bar_stool — for dining/café zones
  • office_desk, office_chair, bookshelf, filing_cabinet — for work zones
  • sofa_modern, coffee_table — for lounge/waiting zones
  • kitchen_counter, sink_unit, refrigerator, shelving_unit — for kitchen/utility zones
  • glass_partition — for dividing meeting rooms from open plans
  • reception_desk — for front-facing service areas
  • planter_indoor, wall_art, coat_rack, trash_bin — for accents

STEP 4 — WALL TREATMENT
Plan each wall separately. Consider:
  • Front wall: often glass storefront for shops/cafés, or has main entrance
  • Side walls: brick accent, painted drywall, wood paneling
  • Back wall: service area, storage, utility
  • Interior separators: half-walls or glass partitions for zone division

STEP 5 — LIGHTING
Interior scenes MUST have lighting:
  • warm_pendants for cafés/restaurants (color [255, 210, 140])
  • overhead_panels for offices/classrooms (color [240, 240, 245])
  • recessed_ceiling for lobbies (color [245, 240, 235])
  Always specify pointLightCount ≥ 4 for interiors.

STEP 6 — PROPORTIONS
Use realistic stud dimensions:
  • Café: 40-55W × 30-40D × 12-15H
  • Classroom: 45-55W × 32-40D × 12-15H
  • Office: 50-60W × 35-45D × 12-16H
  • Shop: 38-48W × 30-38D × 12-15H
  • Restaurant: 50-60W × 38-45D × 12-16H
  • Lobby: 48-56W × 38-45D × 14-18H
  • Living room: 36-45W × 30-38D × 11-14H`;


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

Environment: ${scenePlan.environment?.generateSurroundings ? 'Generate surroundings' : 'Main build only'}, boundary: ${scenePlan.environment?.boundaryType || 'none'}${scenePlan.environment?.skipTerrainOperations ? ', NO Terrain voxels (Part exterior ring only)' : ''}${scenePlan.environment?.schoolCampusExterior ? ', SCHOOL CAMPUS EXTERIOR (quiet institutional grounds — not a city or commercial district)' : ''}

IMPORTANT:
- Template objects will be resolved automatically by the backend. For template objects, just include a placeholder instance with the template name.
- For custom objects, generate full Roblox instances with correct properties.
- Follow the zone bounds for object placement. Objects in a zone must be within its min/max coordinates.
- Use the color palette for visual consistency.
- Prioritize interior architecture (walls, floor, ceiling, furniture, lighting) over exterior; still include coherent exterior cues when the plan lists surrounding elements (roads, trees, shells) as Parts.
${scenePlan.environment?.skipTerrainOperations
        ? '- Do not rely on terrain[] in your JSON — backend strips Terrain fills; put detail in instances[] for both room and outer ring.'
        : '- Include terrain operations for ground, hills, and natural features as described in the zones.'}
${scenePlan.environment?.schoolCampusExterior || scenePlan.sceneType === 'classroom' || scenePlan.sceneType === 'lobby' ? `
SCHOOL / CLASSROOM MODE (mandatory):
- Interior: realistic classroom or school interior — desks in rows, teaching wall with board, institutional lighting, windows, doors. No café/shop/restaurant layouts unless the user explicitly asked for those.
- Exterior (if you add any): quiet school campus only — roads or paths, sidewalks, lawn, trees, lampposts, simple school-building shells. Empty roads are OK — do NOT add cars, buses, trucks, motorcycles, or vehicle spawners.
- Do NOT generate: shops, stores, malls, restaurants, cafés, bars, clubs, casinos, hotels, airports, hospitals, factories, industrial plants, farms, jungles, zoos, stadiums as a city venue, crowds, NPCs, human figures, animals, or wildlife.
- Do not describe or imply a full city, downtown strip, or mixed commercial neighborhood around the school.` : ''}`;
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

function isInsideBounds2D(pos, bounds, padding = 0) {
    if (!Array.isArray(pos) || !bounds) {
        return false;
    }

    return pos[0] >= bounds.minX - padding
        && pos[0] <= bounds.maxX + padding
        && pos[2] >= bounds.minZ - padding
        && pos[2] <= bounds.maxZ + padding;
}

function addTerrainRect(terrain, material, minX, maxX, minZ, maxZ, centerY, height) {
    const width = maxX - minX;
    const depth = maxZ - minZ;

    if (width <= 1 || depth <= 1) {
        return;
    }

    terrain.push({
        shape: 'Block',
        material,
        position: [(minX + maxX) / 2, centerY, (minZ + maxZ) / 2],
        size: [width, height, depth],
        rotation: [0, 0, 0],
    });
}

function hasInteriorSignalsInPlan(scenePlan) {
    if (!scenePlan) return false;
    const sceneType = scenePlan.sceneType || '';
    if (sceneType === 'classroom' || sceneType === 'lobby') return true;

    const title = String(scenePlan.title || '').toLowerCase();
    if (/\b(class|classroom|school|academy|lecture|cafe|café|coffee|restaurant|shop|store|retail|office|meeting|conference|lobby|foyer|reception|apartment|bedroom|living room|kitchen|bathroom|hallway|corridor|interior|indoor|inside|room)\b/.test(title)) {
        return true;
    }

    if (Array.isArray(scenePlan.objects)) {
        const interiorProps = /desk|chair|whiteboard|teacher|counter|bookshelf|sofa|café|cafe|coffee_table|kitchen|reception|bed|toilet|sink|urinal/i;
        const interiorTemplateCount = scenePlan.objects.filter(o => {
            const tpl = String(o?.template || '').toLowerCase();
            const name = String(o?.name || '').toLowerCase();
            return interiorProps.test(tpl) || interiorProps.test(name);
        }).length;
        if (interiorTemplateCount >= 2) return true;
    }

    return false;
}

function getProtectedFootprint(scenePlan, dims) {
    if (scenePlan && scenePlan._protectedFootprint) {
        return scenePlan._protectedFootprint;
    }

    if (!hasInteriorSignalsInPlan(scenePlan)) {
        return null;
    }

    // Never protect a huge footprint — if dims are town/island sized, it's not an interior.
    const fW = dims?.width || 0;
    const fD = dims?.depth || 0;
    if (fW > 120 || fD > 120 || fW <= 0 || fD <= 0) {
        return null;
    }

    const sceneType = scenePlan?.sceneType;
    const margin = sceneType === 'lobby' ? 8 : 6;
    return {
        minX: -(fW / 2) - margin,
        maxX:  (fW / 2) + margin,
        minZ: -(fD / 2) - margin,
        maxZ:  (fD / 2) + margin,
    };
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
            const gl = scenePlan.groundLevel || 0;
            // MainBuilding floor Part is 1 stud thick with center at gl+0.5 → top surface at gl+1
            const floorTopY = gl + 1;

            if (zone && zone.bounds) {
                const { minX = -40, maxX = 40, minZ = -40, maxZ = 40 } = zone.bounds;
                const elevation = zone.elevation || 0;
                const rangeX = maxX - minX;
                const rangeZ = maxZ - minZ;

                // Room layout engine emits explicit [x,y,z] for row/column desks — must not fall through to grid.
                if (Array.isArray(obj.position) && obj.position.length >= 3) {
                    const baseY = obj.position[1] === 0 ? floorTopY : obj.position[1];
                    pos = [
                        obj.position[0],
                        baseY + elevation,
                        obj.position[2],
                    ];
                } else if (spacing === 'scattered' || spacing === 'random') {
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
                        elevation + floorTopY,
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
                        elevation + floorTopY,
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
                if (pos[1] === 0) {
                    pos[1] = floorTopY;
                }
                if (i > 0) {
                    // Offset subsequent copies
                    pos[0] += i * preferredSpacing;
                }
            } else {
                pos = [i * preferredSpacing, floorTopY, 0];
            }

            placedPositions.push(buildPlacementEntry(pos, metadata));
            placements.push({
                template: obj.template,
                position: pos,
                // Respect explicit 0 rotation (e.g. desks aligned to face front).
                rotation: typeof obj.rotation === 'number' ? obj.rotation : Math.random() * 360,
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

    // Strict room-only: user asked for interior only — boundaries, no Part props outside.
    if (env.interiorOnly) {
        const wallHeight = 24;
        const wallPositions = [
            { name: 'BoundaryNorth', size: [boundaryWidth, wallHeight, 2], pos: [0, wallHeight / 2, -boundHalfD] },
            { name: 'BoundarySouth', size: [boundaryWidth, wallHeight, 2], pos: [0, wallHeight / 2, boundHalfD] },
            { name: 'BoundaryWest',  size: [2, wallHeight, boundaryDepth], pos: [-boundHalfW, wallHeight / 2, 0] },
            { name: 'BoundaryEast',  size: [2, wallHeight, boundaryDepth], pos: [boundHalfW, wallHeight / 2, 0] },
        ];
        const interiorInstances = [];
        for (const wall of wallPositions) {
            interiorInstances.push({
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: wall.name,
                    Size: wall.size,
                    Position: wall.pos,
                    Anchored: true,
                    CanCollide: true,
                    ...FAINT_MAP_BOUNDARY,
                },
            });
        }
        return { instances: interiorInstances, terrain: [] };
    }

    const protectedFootprint = getProtectedFootprint(scenePlan, dims);
    const shouldProtectFootprint = !!protectedFootprint;
    const environmentCorePadding = scenePlan.sceneType === 'classroom' || scenePlan.sceneType === 'lobby'
        ? 0.28
        : 0.34;
    const isReservedArea = (pos, extraPadding = 0) => shouldProtectFootprint
        ? isInsideBounds2D(pos, protectedFootprint, extraPadding)
        : isInsideCorePlayArea(pos, dims, environmentCorePadding);

    // ── Base terrain under the map ───────────────────────────
    // For interior rooms we AGGRESSIVELY lower the surrounding terrain
    // and pad the protected footprint with a non-Grass buffer ring.
    // This is because Roblox's Grass material renders decorative grass
    // blades (~3 studs tall) that will poke upward through the room
    // floor if the terrain top is at or just below floor level.
    const requestedTerrainMaterial = env.surroundingTerrain || 'Grass';
    const grassBladeMargin = requestedTerrainMaterial === 'Grass' ? 4 : 2;

    if (shouldProtectFootprint) {
        // Drop the surrounding terrain top well below the floor bottom
        // so visible grass blades cannot poke through inside the room.
        const terrainTopY = groundLevel - 1 - grassBladeMargin; // top face of terrain
        const terrainHeight = 4;
        const centerY = terrainTopY - terrainHeight / 2;

        // Buffer ring immediately around the footprint that is NEVER Grass
        // — stops grass blades from growing right up against the wall.
        const buffer = 6;
        const bufferMaterial = 'Ground';
        const bufferMinX = protectedFootprint.minX - buffer;
        const bufferMaxX = protectedFootprint.maxX + buffer;
        const bufferMinZ = protectedFootprint.minZ - buffer;
        const bufferMaxZ = protectedFootprint.maxZ + buffer;

        // 1) Non-grass buffer ring (4 rects around the footprint)
        addTerrainRect(terrain, bufferMaterial,
            bufferMinX, bufferMaxX, bufferMinZ, protectedFootprint.minZ,
            centerY, terrainHeight);
        addTerrainRect(terrain, bufferMaterial,
            bufferMinX, bufferMaxX, protectedFootprint.maxZ, bufferMaxZ,
            centerY, terrainHeight);
        addTerrainRect(terrain, bufferMaterial,
            bufferMinX, protectedFootprint.minX, protectedFootprint.minZ, protectedFootprint.maxZ,
            centerY, terrainHeight);
        addTerrainRect(terrain, bufferMaterial,
            protectedFootprint.maxX, bufferMaxX, protectedFootprint.minZ, protectedFootprint.maxZ,
            centerY, terrainHeight);

        // 2) Outer ring using the requested material (Grass / Ground / etc.)
        //    We skip the center area (footprint + buffer) by splitting it
        //    into four outer bands — same way as before, but outside buffer.
        if (bufferMinX > -boundHalfW || bufferMaxX < boundHalfW
            || bufferMinZ > -boundHalfD || bufferMaxZ < boundHalfD) {
            addTerrainRect(terrain, requestedTerrainMaterial,
                -boundHalfW, boundHalfW, -boundHalfD, bufferMinZ,
                centerY, terrainHeight);
            addTerrainRect(terrain, requestedTerrainMaterial,
                -boundHalfW, boundHalfW, bufferMaxZ, boundHalfD,
                centerY, terrainHeight);
            addTerrainRect(terrain, requestedTerrainMaterial,
                -boundHalfW, bufferMinX, bufferMinZ, bufferMaxZ,
                centerY, terrainHeight);
            addTerrainRect(terrain, requestedTerrainMaterial,
                bufferMaxX, boundHalfW, bufferMinZ, bufferMaxZ,
                centerY, terrainHeight);
        }
    } else {
        terrain.push({
            shape: 'Block',
            material: requestedTerrainMaterial,
            position: [0, groundLevel - 2, 0],
            size: [boundaryWidth, 4, boundaryDepth],
            rotation: [0, 0, 0],
        });
    }

    // ── Floating island specifics ────────────────────────────
    if (scenePlan.sceneType === 'floating_island') {
        // Underside rock (keep fully below playable surface; avoid center "rock dome")
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
    const normalizedElements = Array.isArray(env.surroundingElements)
        ? [...env.surroundingElements]
        : ['trees_sparse'];
    const isInteriorOrCampus = scenePlan.sceneType === 'classroom'
        || scenePlan.sceneType === 'lobby'
        || (scenePlan.title && /class|school|campus|interior|academy/i.test(scenePlan.title));
    const isOutdoorWorld = scenePlan.sceneType === 'town'
        || scenePlan.sceneType === 'outdoor_park'
        || scenePlan.sceneType === 'floating_island'
        || scenePlan.sceneType === 'arena';
    const wantsExpandedWorld = !!env.expandedWorld;

    // Force a minimum world layer around core builds.
    if (isInteriorOrCampus && wantsExpandedWorld && !normalizedElements.includes('roads')) {
        normalizedElements.push('roads');
    }
    if (((isInteriorOrCampus && wantsExpandedWorld) || isOutdoorWorld) && !normalizedElements.includes('background_structures')) {
        normalizedElements.push('background_structures');
    }
    if (!normalizedElements.some(el => /trees|rocks|flowers/.test(el))) {
        normalizedElements.push('trees_sparse');
        normalizedElements.push('rocks_scattered');
    }

    const elements = normalizedElements;
    const hasInteriorSignals = scenePlan.sceneType === 'classroom'
        || scenePlan.sceneType === 'lobby'
        || (scenePlan.title && /class|school|interior|room|café|office|shop|restaurant|lobby/i.test(scenePlan.title))
        || (Array.isArray(scenePlan.objects) && scenePlan.objects.some(obj => {
            const templateName = String(obj?.template || '').toLowerCase();
            const objName = String(obj?.name || '').toLowerCase();
            return /desk|chair|window|wall|door|class|café|counter|kitchen/.test(templateName)
                || /desk|chair|class|whiteboard|teacher|counter|register/.test(objName);
        }));
    const interiorFocusExterior = !!env.skipTerrainOperations && !env.interiorOnly
        && (scenePlan.sceneType === 'classroom' || scenePlan.sceneType === 'lobby');
    /** K–12 campus ring: empty drives + institutional shells; no hydrants/mailboxes/shop fronts. */
    const schoolCampusExterior = env.schoolCampusExterior === true
        || (scenePlan.sceneType === 'classroom' && !env.interiorOnly && env.generateSurroundings);
    const maxEnvInstances = hasInteriorSignals
        ? (wantsExpandedWorld ? 40 : interiorFocusExterior ? 36 : 24)
        : 55;
    let envInstanceCount = 0;

    const envPlacements = [];
    const envPlacedPositions = [];

    // Reorder elements: structural first (roads, buildings, lamps), then nature fill
    const structuralOrder = ['roads', 'background_structures', 'buildings', 'lamps', 'street_lamps', 'benches'];
    const natureOrder = ['trees_sparse', 'trees', 'trees_dense', 'rocks_scattered', 'rocks', 'flowers_random', 'flowers'];
    const orderedElements = [
        ...elements.filter(e => structuralOrder.includes(e)),
        ...elements.filter(e => !structuralOrder.includes(e) && !natureOrder.includes(e)),
        ...elements.filter(e => natureOrder.includes(e)),
    ];

    for (const element of orderedElements) {
        if (envInstanceCount >= maxEnvInstances) break;

        if (element === 'trees_sparse' || element === 'trees' || element === 'trees_dense') {
            const treeMeta = getTemplatePlacementMetadata('deciduous_tree_medium');
            const treeCount = Math.min(
                schoolCampusExterior ? (element === 'trees_dense' ? 10 : 8) : (element === 'trees_dense' ? 8 : 6),
                Math.floor((maxEnvInstances - envInstanceCount) / 5)
            );
            for (let i = 0; i < treeCount; i++) {
                const angle = (i / treeCount) * Math.PI * 2 + Math.random() * 0.5;
                const dist = schoolCampusExterior
                    ? (Math.max(halfW, halfD) * 0.92 + Math.random() * Math.max((boundHalfW - halfW) * 0.8, 10))
                    : (halfW * 0.8 + Math.random() * (boundHalfW - halfW) * 0.6);
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;
                const pos = [x, groundLevel, z];
                if (!isReservedArea(pos, 3)
                    && !isPlacementTooClose(pos, treeMeta.footprintRadius, envPlacedPositions, treeMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, treeMeta));
                    envPlacements.push({
                        template: schoolCampusExterior
                            ? (Math.random() > 0.35 ? 'deciduous_tree_medium' : 'pine_tree')
                            : (Math.random() > 0.5 ? 'deciduous_tree_medium' : 'pine_tree'),
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
                if (!isReservedArea(pos, 3)
                    && !isPlacementTooClose(pos, rockMeta.footprintRadius, envPlacedPositions, rockMeta.preferredSpacing * 0.2)) {
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
                if (!isReservedArea(pos, 2)
                    && !isPlacementTooClose(pos, flowerMeta.footprintRadius, envPlacedPositions, flowerMeta.preferredSpacing * 0.15)) {
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
            const lampCount = Math.min(
                schoolCampusExterior ? 8 : 4,
                Math.floor((maxEnvInstances - envInstanceCount) / 4)
            );
            for (let i = 0; i < lampCount; i++) {
                const angle = (i / lampCount) * Math.PI * 2;
                const dist = schoolCampusExterior
                    ? Math.max(halfW, halfD) * 0.82
                    : halfW * 0.5;
                const pos = [Math.cos(angle) * dist, groundLevel, Math.sin(angle) * dist];
                if (!isReservedArea(pos, 2)
                    && !isPlacementTooClose(pos, lampMeta.footprintRadius, envPlacedPositions, lampMeta.preferredSpacing * 0.2)) {
                    envPlacedPositions.push(buildPlacementEntry(pos, lampMeta));
                    envPlacements.push({
                        template: 'street_lamp',
                        position: pos,
                    });
                    envInstanceCount += 4;
                }
            }

            // Campus realism: add two entrance lamps framing the forecourt.
            if (schoolCampusExterior && envInstanceCount + 8 <= maxEnvInstances) {
                const entranceLamps = [
                    [-halfW * 0.45, groundLevel, halfD - 3.8],
                    [halfW * 0.45, groundLevel, halfD - 3.8],
                ];
                for (const p of entranceLamps) {
                    if (!isReservedArea(p, 2)) {
                        envPlacements.push({
                            template: 'street_lamp',
                            position: p,
                            rotation: 0,
                        });
                        envInstanceCount += 4;
                    }
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
                if (!isReservedArea(pos, 2)
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

        // ── Roads with sidewalks, crosswalks, and street furniture ─
        if (element === 'roads') {
            const roadBudget = Math.floor((maxEnvInstances - envInstanceCount) / 3);
            if (roadBudget >= 2) {
                // North-south road
                const nsLength = boundaryDepth * 0.8;
                const roadX = shouldProtectFootprint
                    ? Math.min(boundHalfW - 10, protectedFootprint.maxX + 14)
                    : halfW * 0.7;
                const roadNsName = schoolCampusExterior ? 'CampusDrive_NS' : 'Road_NS';
                instances.push({
                    className: 'Model',
                    parent: 'Workspace',
                    properties: { Name: roadNsName },
                });
                instances.push({
                    className: 'Part',
                    parent: roadNsName,
                    properties: {
                        Name: 'RoadSurface_NS',
                        Size: [12, 0.3, nsLength],
                        Position: [roadX, groundLevel + 0.15, 0],
                        Color: [68, 68, 72],
                        Anchored: true,
                        Material: 'Concrete',
                    },
                });
                instances.push({
                    className: 'Part',
                    parent: roadNsName,
                    properties: {
                        Name: 'CenterLine_NS',
                        Size: [0.4, 0.05, nsLength - 4],
                        Position: [roadX, groundLevel + 0.35, 0],
                        Color: [230, 210, 80],
                        Anchored: true,
                        Material: 'SmoothPlastic',
                    },
                });
                envInstanceCount += 3;

                // Sidewalks alongside NS road
                if (envInstanceCount + 2 <= maxEnvInstances) {
                    instances.push({
                        className: 'Part',
                        parent: roadNsName,
                        properties: {
                            Name: 'Sidewalk_NS_W',
                            Size: [5, 0.35, nsLength],
                            Position: [roadX - 8.5, groundLevel + 0.17, 0],
                            Color: [195, 192, 188],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: roadNsName,
                        properties: {
                            Name: 'Sidewalk_NS_E',
                            Size: [5, 0.35, nsLength],
                            Position: [roadX + 8.5, groundLevel + 0.17, 0],
                            Color: [195, 192, 188],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    envInstanceCount += 2;
                }

                // Curb planters along NS road (omit on school campus — reads as street retail)
                if (!schoolCampusExterior && envInstanceCount + 2 <= maxEnvInstances) {
                    envPlacements.push({
                        template: 'curb_planter',
                        position: [roadX - 8.5, groundLevel, nsLength * 0.2],
                    });
                    envPlacements.push({
                        template: 'curb_planter',
                        position: [roadX - 8.5, groundLevel, -nsLength * 0.2],
                    });
                    envInstanceCount += 2;
                }

                // East-west road (if budget allows)
                if (envInstanceCount + 5 <= maxEnvInstances) {
                    const ewLength = boundaryWidth * 0.8;
                    const roadZ = shouldProtectFootprint
                        ? Math.min(boundHalfD - 10, protectedFootprint.maxZ + 14)
                        : halfD * 0.7;
                    const roadEwName = schoolCampusExterior ? 'CampusDrive_EW' : 'Road_EW';
                    instances.push({
                        className: 'Model',
                        parent: 'Workspace',
                        properties: { Name: roadEwName },
                    });
                    instances.push({
                        className: 'Part',
                        parent: roadEwName,
                        properties: {
                            Name: 'RoadSurface_EW',
                            Size: [ewLength, 0.3, 12],
                            Position: [0, groundLevel + 0.15, roadZ],
                            Color: [68, 68, 72],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: roadEwName,
                        properties: {
                            Name: 'CenterLine_EW',
                            Size: [ewLength - 4, 0.05, 0.4],
                            Position: [0, groundLevel + 0.35, roadZ],
                            Color: [230, 210, 80],
                            Anchored: true,
                            Material: 'SmoothPlastic',
                        },
                    });
                    // Sidewalks alongside EW road
                    instances.push({
                        className: 'Part',
                        parent: roadEwName,
                        properties: {
                            Name: 'Sidewalk_EW_N',
                            Size: [ewLength, 0.35, 5],
                            Position: [0, groundLevel + 0.17, roadZ - 8.5],
                            Color: [195, 192, 188],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: roadEwName,
                        properties: {
                            Name: 'Sidewalk_EW_S',
                            Size: [ewLength, 0.35, 5],
                            Position: [0, groundLevel + 0.17, roadZ + 8.5],
                            Color: [195, 192, 188],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    envInstanceCount += 5;

                    // Classroom/lobby campus: add a forecourt walkway to the main building.
                    if (schoolCampusExterior && envInstanceCount + 1 <= maxEnvInstances) {
                        instances.push({
                            className: 'Part',
                            parent: roadEwName,
                            properties: {
                                Name: 'CampusForecourtWalk',
                                Size: [14, 0.22, Math.max(8, halfD - 4)],
                                Position: [0, groundLevel + 0.12, halfD - (Math.max(8, halfD - 4) / 2)],
                                Color: [198, 195, 190],
                                Anchored: true,
                                Material: 'Concrete',
                            },
                        });
                        envInstanceCount += 1;
                    }

                    // Crosswalk at intersection
                    if (envInstanceCount + 5 <= maxEnvInstances) {
                        const cwX = roadX;
                        const cwZ = roadZ;
                        for (let s = 0; s < 5; s++) {
                            const offset = (s - 2) * 1.6;
                            instances.push({
                                className: 'Part',
                                parent: roadEwName,
                                properties: {
                                    Name: `Crosswalk_stripe_${s}`,
                                    Size: [1, 0.05, 8],
                                    Position: [cwX + offset, groundLevel + 0.36, cwZ],
                                    Color: [255, 255, 255],
                                    Anchored: true,
                                    Material: 'SmoothPlastic',
                                },
                            });
                        }
                        envInstanceCount += 5;
                    }
                }

                // Street furniture (omit on school campus — no residential/city props)
                if (!schoolCampusExterior && envInstanceCount + 2 <= maxEnvInstances) {
                    envPlacements.push({
                        template: 'fire_hydrant',
                        position: [roadX + 9, groundLevel, -halfD * 0.3],
                    });
                    envInstanceCount += 1;
                }
                if (!schoolCampusExterior && envInstanceCount + 2 <= maxEnvInstances) {
                    envPlacements.push({
                        template: 'mailbox',
                        position: [roadX + 9, groundLevel, halfD * 0.3],
                    });
                    envInstanceCount += 1;
                }
            }
        }


        // ── Background structures (simple building shells) ───
        if (element === 'background_structures' || element === 'buildings') {
            const buildingCount = Math.min(3, Math.floor((maxEnvInstances - envInstanceCount) / 4));
            for (let i = 0; i < buildingCount; i++) {
                const angle = (i / buildingCount) * Math.PI * 2 + Math.PI / 4;
                const dist = shouldProtectFootprint
                    ? Math.max(Math.abs(protectedFootprint.maxX), Math.abs(protectedFootprint.maxZ)) + 18
                    : boundHalfW * 0.7;
                const bx = Math.cos(angle) * dist;
                const bz = Math.sin(angle) * dist;
                const bWidth = schoolCampusExterior ? 18 + Math.random() * 10 : 16 + Math.random() * 12;
                const bHeight = schoolCampusExterior ? 15 + Math.random() * 14 : 14 + Math.random() * 18;
                const bDepth = schoolCampusExterior ? 13 + Math.random() * 7 : 12 + Math.random() * 8;
                const modelName = schoolCampusExterior ? `SchoolWing_${i + 1}` : `BgBuilding_${i + 1}`;

                if (isReservedArea([bx, groundLevel, bz], Math.max(bWidth, bDepth) * 0.55)) {
                    continue;
                }

                const brickPalette = [[172, 92, 78], [188, 108, 88], [165, 178, 192]];
                const bodyColor = schoolCampusExterior
                    ? brickPalette[i % brickPalette.length]
                    : [
                        180 + Math.floor(Math.random() * 30),
                        175 + Math.floor(Math.random() * 25),
                        165 + Math.floor(Math.random() * 20),
                    ];
                const bodyMaterial = schoolCampusExterior ? 'Brick' : 'Concrete';

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
                        Color: bodyColor,
                        Anchored: true,
                        Material: bodyMaterial,
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
                        Color: schoolCampusExterior ? [72, 78, 88] : [90, 85, 80],
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
                let buildingParts = 4;
                if (schoolCampusExterior) {
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: 'WindowBand',
                            Size: [bWidth * 0.78, 2.2, 0.22],
                            Position: [bx, groundLevel + bHeight * 0.52, bz + bDepth / 2 + 0.14],
                            Color: [210, 220, 232],
                            Anchored: true,
                            Material: 'Glass',
                            Transparency: 0.42,
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: 'EntranceCanopy',
                            Size: [6.2, 0.25, 2.2],
                            Position: [bx, groundLevel + 8.2, bz + bDepth / 2 + 1.15],
                            Color: [84, 90, 98],
                            Anchored: true,
                            Material: 'Metal',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: 'BasePlinth',
                            Size: [bWidth + 1.2, 1.2, bDepth + 1.2],
                            Position: [bx, groundLevel + 0.6, bz],
                            Color: [122, 126, 132],
                            Anchored: true,
                            Material: 'Concrete',
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: 'WindowBand_Left',
                            Size: [0.22, 2.1, bDepth * 0.58],
                            Position: [bx - bWidth / 2 - 0.14, groundLevel + bHeight * 0.56, bz],
                            Color: [205, 216, 230],
                            Anchored: true,
                            Material: 'Glass',
                            Transparency: 0.46,
                        },
                    });
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: 'WindowBand_Right',
                            Size: [0.22, 2.1, bDepth * 0.58],
                            Position: [bx + bWidth / 2 + 0.14, groundLevel + bHeight * 0.56, bz],
                            Color: [205, 216, 230],
                            Anchored: true,
                            Material: 'Glass',
                            Transparency: 0.46,
                        },
                    });
                    buildingParts += 5;
                }
                envInstanceCount += buildingParts;
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
                    CanCollide: true,
                    ...FAINT_MAP_BOUNDARY,
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
                    CanCollide: true,
                    ...FAINT_MAP_BOUNDARY,
                },
            });
        }
    }

    // Cap terrain ops at 10
    if (terrain.length > 10) {
        terrain.length = 10;
    }

    // Classroom/lobby: never send Terrain FillBlock — exterior is Parts only (roads, trees, shells).
    if (env.skipTerrainOperations) {
        terrain.length = 0;
    }

    const instanceCap = interiorFocusExterior ? 56 : 40;
    if (instances.length > instanceCap) {
        instances.length = instanceCap;
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
            if (/tree|rock|flower|bench|lamp|road|campusdrive|bgbuilding|schoolwing|boundary|waterbound/i.test(name)) {
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
                const instanceName = String(props.Name || inst.className || '');
                const isRoadMarking = /centerline|lane|divider|crosswalk|roadmark/i.test(instanceName);
                if (maxDim > 0 && minDim > 0 && maxDim / minDim > 200 && !isRoadMarking) {
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
        const interiorOnly = !!scenePlan?.environment?.interiorOnly;
        const skipTerrainOps = !!scenePlan?.environment?.skipTerrainOperations;
        const mapArea = (scenePlan?.dimensions?.width || 128) * (scenePlan?.dimensions?.depth || 128);
        const minimumDetailScore = mapArea > 30_000 ? 8 : 5;
        const detailScore = environmentDetailCount + terrainCount;

        if (terrainCount === 0 && !interiorOnly && !skipTerrainOps) {
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

        // Skip sparse-environment warnings for interior-only or Part-only exterior (no Terrain fills).
        if (!interiorOnly && !skipTerrainOps) {
            if (detailScore < minimumDetailScore) {
                warnings.push(
                    `Environment output looks sparse for this map size (${detailScore} environment detail units, expected at least ${minimumDetailScore}).`
                );
            }

            if ((scenePlan?.sceneType === 'classroom' || scenePlan?.sceneType === 'lobby') && environmentDetailCount < 4) {
                warnings.push('Interior scene requested a wider surrounding world, but the generated environment layer is still thin.');
            }
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
