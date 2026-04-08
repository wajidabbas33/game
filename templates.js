// ============================================================
//  Roblox AI Plugin – Object Template Library  v2.0
//
//  Pre-built object recipes with correct proportions.
//  Each template is a function that accepts placement parameters
//  and returns { instances: [], terrain: [] } arrays that pass
//  directly through the existing sanitize pipeline.
//
//  v2.0 additions:
//  - School/Classroom templates (desks, chairs, blackboards, lockers)
//  - More building types (houses, shops, towers)
//  - Vehicles (cars, bikes)
//  - More environment props (signs, trash cans, mailboxes)
//  - Enhanced proportions with real-world reference data
//
//  Templates are referenced by the scene planner and can be
//  merged into the final output without AI re-invention.
// ============================================================

'use strict';

// ── Utility helpers ──────────────────────────────────────────

function offsetPosition(base, dx, dy, dz) {
    return [
        (base[0] || 0) + (dx || 0),
        (base[1] || 0) + (dy || 0),
        (base[2] || 0) + (dz || 0),
    ];
}

function scaleSize(base, factor) {
    const f = factor || 1;
    return [base[0] * f, base[1] * f, base[2] * f];
}

function blendColor(color, variance) {
    const v = variance || 0;
    return color.map(c => Math.min(255, Math.max(0, c + Math.floor((Math.random() - 0.5) * v * 2))));
}

// ── TREE TEMPLATES ───────────────────────────────────────────

function deciduousTreeSmall(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'SmallTree_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Trunk
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Trunk',
                    Size: [1.5, 8, 1.5],
                    Position: offsetPosition(pos, 0, 4, 0),
                    Color: [101, 67, 33],
                    Anchored: true,
                    Material: 'Wood',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 4, 0), rotation: [0, rot, 90] },
                },
            },
            {
                // Lower canopy
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Canopy1',
                    Size: [7, 5, 7],
                    Position: offsetPosition(pos, 0, 9.5, 0),
                    Color: blendColor([67, 140, 49], 20),
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
            {
                // Upper canopy
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Canopy2',
                    Size: [5, 4, 5],
                    Position: offsetPosition(pos, 0, 12, 0),
                    Color: blendColor([82, 158, 58], 15),
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
        ],
        terrain: [],
    };
}

function deciduousTreeMedium(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'MediumTree_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Trunk',
                    Size: [2, 12, 2],
                    Position: offsetPosition(pos, 0, 6, 0),
                    Color: [89, 58, 27],
                    Anchored: true,
                    Material: 'Wood',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 6, 0), rotation: [0, rot, 90] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Canopy1',
                    Size: [10, 7, 10],
                    Position: offsetPosition(pos, 0, 14, 0),
                    Color: blendColor([52, 128, 40], 20),
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Canopy2',
                    Size: [8, 6, 8],
                    Position: offsetPosition(pos, 1, 17, -1),
                    Color: blendColor([62, 145, 48], 15),
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Canopy3',
                    Size: [6, 5, 6],
                    Position: offsetPosition(pos, -1, 19, 1),
                    Color: blendColor([72, 155, 55], 15),
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
        ],
        terrain: [],
    };
}

function pineTree(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'PineTree_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Trunk',
                    Size: [1.8, 14, 1.8],
                    Position: offsetPosition(pos, 0, 7, 0),
                    Color: [78, 50, 22],
                    Anchored: true,
                    Material: 'Wood',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 7, 0), rotation: [0, rot, 90] },
                },
            },
            {
                // Bottom cone layer
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Foliage1',
                    Size: [9, 5, 9],
                    Position: offsetPosition(pos, 0, 11, 0),
                    Color: [34, 100, 34],
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
            {
                // Middle cone layer
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Foliage2',
                    Size: [7, 5, 7],
                    Position: offsetPosition(pos, 0, 15, 0),
                    Color: [30, 90, 30],
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
            {
                // Top cone layer
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Foliage3',
                    Size: [4, 4, 4],
                    Position: offsetPosition(pos, 0, 19, 0),
                    Color: [25, 82, 25],
                    Anchored: true,
                    Material: 'Grass',
                    Shape: 'Ball',
                },
            },
        ],
        terrain: [],
    };
}

// ── PATH / ROAD TEMPLATES ────────────────────────────────────

function stonePathSegment(position, rotation, length) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 20;
    return {
        instances: [
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'StonePath_' + Math.floor(Math.random() * 9999),
                    Size: [4, 0.4, len],
                    Position: offsetPosition(pos, 0, 0.2, 0),
                    Color: [148, 148, 140],
                    Anchored: true,
                    Material: 'Slate',
                    CFrame: { position: offsetPosition(pos, 0, 0.2, 0), rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function roadSegment(position, rotation, length, width) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 40;
    const w = width || 12;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Road_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'RoadSurface',
                    Size: [w, 0.3, len],
                    Position: offsetPosition(pos, 0, 0.15, 0),
                    Color: [68, 68, 72],
                    Anchored: true,
                    Material: 'Concrete',
                    CFrame: { position: offsetPosition(pos, 0, 0.15, 0), rotation: [0, rot, 0] },
                },
            },
            {
                // Center line
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'CenterLine',
                    Size: [0.4, 0.05, len - 2],
                    Position: offsetPosition(pos, 0, 0.35, 0),
                    Color: [230, 210, 80],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                    CFrame: { position: offsetPosition(pos, 0, 0.35, 0), rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

// ── FURNITURE TEMPLATES ──────────────────────────────────────

function desk(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Desk_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Desktop surface
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Desktop',
                    Size: [5, 0.4, 3],
                    Position: offsetPosition(pos, 0, 3.2, 0),
                    Color: [156, 114, 68],
                    Anchored: true,
                    Material: 'Wood',
                    CFrame: { position: offsetPosition(pos, 0, 3.2, 0), rotation: [0, rot, 0] },
                },
            },
            {
                // Front-left leg
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg1',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, -2.1, 1.5, -1.1),
                    Color: [120, 88, 52],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                // Front-right leg
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg2',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, 2.1, 1.5, -1.1),
                    Color: [120, 88, 52],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                // Back-left leg
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg3',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, -2.1, 1.5, 1.1),
                    Color: [120, 88, 52],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                // Back-right leg
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg4',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, 2.1, 1.5, 1.1),
                    Color: [120, 88, 52],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
        ],
        terrain: [],
    };
}

function chair(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Chair_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Seat
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Seat',
                    Size: [2.4, 0.4, 2.4],
                    Position: offsetPosition(pos, 0, 2.2, 0),
                    Color: [140, 100, 58],
                    Anchored: true,
                    Material: 'Wood',
                    CFrame: { position: offsetPosition(pos, 0, 2.2, 0), rotation: [0, rot, 0] },
                },
            },
            {
                // Backrest
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Backrest',
                    Size: [2.4, 2.5, 0.3],
                    Position: offsetPosition(pos, 0, 3.65, -1.05),
                    Color: [140, 100, 58],
                    Anchored: true,
                    Material: 'Wood',
                    CFrame: { position: offsetPosition(pos, 0, 3.65, -1.05), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg1',
                    Size: [0.3, 2, 0.3],
                    Position: offsetPosition(pos, -0.9, 1, -0.9),
                    Color: [110, 78, 44],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg2',
                    Size: [0.3, 2, 0.3],
                    Position: offsetPosition(pos, 0.9, 1, -0.9),
                    Color: [110, 78, 44],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg3',
                    Size: [0.3, 2, 0.3],
                    Position: offsetPosition(pos, -0.9, 1, 0.9),
                    Color: [110, 78, 44],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg4',
                    Size: [0.3, 2, 0.3],
                    Position: offsetPosition(pos, 0.9, 1, 0.9),
                    Color: [110, 78, 44],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
        ],
        terrain: [],
    };
}

function bench(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Bench_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Seat',
                    Size: [6, 0.5, 2],
                    Position: offsetPosition(pos, 0, 2.25, 0),
                    Color: [130, 90, 48],
                    Anchored: true,
                    Material: 'WoodPlanks',
                    CFrame: { position: offsetPosition(pos, 0, 2.25, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Backrest',
                    Size: [6, 2, 0.4],
                    Position: offsetPosition(pos, 0, 3.5, -0.8),
                    Color: [130, 90, 48],
                    Anchored: true,
                    Material: 'WoodPlanks',
                    CFrame: { position: offsetPosition(pos, 0, 3.5, -0.8), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LegL',
                    Size: [0.5, 2, 2],
                    Position: offsetPosition(pos, -2.5, 1, 0),
                    Color: [80, 80, 85],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LegR',
                    Size: [0.5, 2, 2],
                    Position: offsetPosition(pos, 2.5, 1, 0),
                    Color: [80, 80, 85],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
        ],
        terrain: [],
    };
}

// ── LIGHTING TEMPLATES ───────────────────────────────────────

function streetLamp(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'StreetLamp_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Pole
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Pole',
                    Size: [0.6, 14, 0.6],
                    Position: offsetPosition(pos, 0, 7, 0),
                    Color: [55, 55, 60],
                    Anchored: true,
                    Material: 'Metal',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 7, 0), rotation: [0, rot, 90] },
                },
            },
            {
                // Lamp housing
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LampHousing',
                    Size: [2.5, 1.2, 2.5],
                    Position: offsetPosition(pos, 0, 14.6, 0),
                    Color: [55, 55, 60],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                // Light bulb (glowing)
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LightBulb',
                    Size: [1.5, 0.6, 1.5],
                    Position: offsetPosition(pos, 0, 13.9, 0),
                    Color: [255, 230, 150],
                    Anchored: true,
                    Material: 'Neon',
                    Transparency: 0.2,
                },
            },
            {
                // PointLight child — the plugin will create and parent this
                className: 'PointLight',
                parent: 'LightBulb',
                properties: {
                    Name: 'Light',
                    Brightness: 1.5,
                    Range: 32,
                    Color: [255, 220, 140],
                },
            },
        ],
        terrain: [],
    };
}

// ── NATURE TEMPLATES ─────────────────────────────────────────

function smallPond(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Pond_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Pond rim
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'PondRim',
                    Size: [14, 0.8, 14],
                    Position: offsetPosition(pos, 0, -0.1, 0),
                    Color: [110, 100, 85],
                    Anchored: true,
                    Material: 'Slate',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, -0.1, 0), rotation: [90, 0, 0] },
                },
            },
            {
                // Water surface
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WaterSurface',
                    Size: [12, 0.3, 12],
                    Position: offsetPosition(pos, 0, -0.4, 0),
                    Color: [68, 140, 190],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.35,
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, -0.4, 0), rotation: [90, 0, 0] },
                },
            },
        ],
        terrain: [
            {
                shape: 'Ball',
                material: 'Water',
                position: offsetPosition(pos, 0, -2, 0),
                radius: 6,
            },
        ],
    };
}

function rockFormation(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Rock1_' + Math.floor(Math.random() * 9999),
                    Size: [5, 3.5, 4],
                    Position: offsetPosition(pos, 0, 1.75, 0),
                    Color: blendColor([120, 115, 105], 15),
                    Anchored: true,
                    Material: 'Slate',
                },
            },
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Rock2_' + Math.floor(Math.random() * 9999),
                    Size: [3, 2.5, 3.5],
                    Position: offsetPosition(pos, 2.5, 1.25, 1.5),
                    Color: blendColor([115, 110, 100], 15),
                    Anchored: true,
                    Material: 'Slate',
                },
            },
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Rock3_' + Math.floor(Math.random() * 9999),
                    Size: [2, 1.5, 2],
                    Position: offsetPosition(pos, -2, 0.75, 2),
                    Color: blendColor([125, 118, 108], 10),
                    Anchored: true,
                    Material: 'Slate',
                },
            },
        ],
        terrain: [],
    };
}

function flowerCluster(position) {
    const pos = position || [0, 0, 0];
    const flowerColors = [
        [235, 100, 120],  // pink
        [255, 200, 80],   // yellow
        [180, 100, 220],  // purple
        [255, 140, 80],   // orange
        [120, 180, 255],  // blue
    ];
    const instances = [];
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const dist = 1.2 + Math.random() * 0.8;
        const dx = Math.cos(angle) * dist;
        const dz = Math.sin(angle) * dist;
        instances.push({
            className: 'Part',
            parent: 'Workspace',
            properties: {
                Name: 'Flower_' + Math.floor(Math.random() * 9999),
                Size: [0.8, 0.8, 0.8],
                Position: offsetPosition(pos, dx, 0.4, dz),
                Color: flowerColors[i % flowerColors.length],
                Anchored: true,
                Material: 'Grass',
                Shape: 'Ball',
            },
        });
    }
    // Stems
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const dist = 1.2 + Math.random() * 0.4;
        const dx = Math.cos(angle) * dist;
        const dz = Math.sin(angle) * dist;
        instances.push({
            className: 'Part',
            parent: 'Workspace',
            properties: {
                Name: 'Stem_' + Math.floor(Math.random() * 9999),
                Size: [0.15, 0.6, 0.15],
                Position: offsetPosition(pos, dx, 0.1, dz),
                Color: [60, 120, 40],
                Anchored: true,
                Material: 'Grass',
            },
        });
    }
    return { instances, terrain: [] };
}

// ── ARCHITECTURE TEMPLATES ───────────────────────────────────

function wallSegment(position, rotation, length, height) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 16;
    const h = height || 14;
    return {
        instances: [
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Wall_' + Math.floor(Math.random() * 9999),
                    Size: [len, h, 1],
                    Position: offsetPosition(pos, 0, h / 2, 0),
                    Color: [200, 195, 185],
                    Anchored: true,
                    Material: 'Concrete',
                    CFrame: { position: offsetPosition(pos, 0, h / 2, 0), rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function windowSegment(position, rotation, width, height) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const w = width || 4;
    const h = height || 5;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Window_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Frame
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Frame',
                    Size: [w + 0.6, h + 0.6, 0.4],
                    Position: offsetPosition(pos, 0, 0, 0),
                    Color: [180, 175, 165],
                    Anchored: true,
                    Material: 'Metal',
                    CFrame: { position: pos, rotation: [0, rot, 0] },
                },
            },
            {
                // Glass pane
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Glass',
                    Size: [w, h, 0.15],
                    Position: offsetPosition(pos, 0, 0, 0),
                    Color: [160, 200, 220],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.5,
                    CFrame: { position: pos, rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function woodenFence(position, rotation, length) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 12;
    const postCount = Math.max(2, Math.floor(len / 4) + 1);
    const instances = [
        {
            className: 'Model',
            parent: 'Workspace',
            properties: { Name: 'Fence_' + Math.floor(Math.random() * 9999) },
        },
        {
            // Rail top
            className: 'Part',
            parent: '__LAST_MODEL__',
            properties: {
                Name: 'RailTop',
                Size: [len, 0.3, 0.3],
                Position: offsetPosition(pos, 0, 3.5, 0),
                Color: [120, 85, 45],
                Anchored: true,
                Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 3.5, 0), rotation: [0, rot, 0] },
            },
        },
        {
            // Rail bottom
            className: 'Part',
            parent: '__LAST_MODEL__',
            properties: {
                Name: 'RailBottom',
                Size: [len, 0.3, 0.3],
                Position: offsetPosition(pos, 0, 1.5, 0),
                Color: [120, 85, 45],
                Anchored: true,
                Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 1.5, 0), rotation: [0, rot, 0] },
            },
        },
    ];
    // Posts
    for (let i = 0; i < postCount; i++) {
        const frac = postCount === 1 ? 0 : i / (postCount - 1);
        const xOff = (frac - 0.5) * len;
        instances.push({
            className: 'Part',
            parent: '__LAST_MODEL__',
            properties: {
                Name: 'Post' + (i + 1),
                Size: [0.5, 4, 0.5],
                Position: offsetPosition(pos, xOff, 2, 0),
                Color: [105, 75, 38],
                Anchored: true,
                Material: 'WoodPlanks',
            },
        });
    }
    return { instances, terrain: [] };
}

// ── Classrooms / School Templates ────────────────────────────

function classroomDesk(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'ClassroomDesk_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Desktop',
                    Size: [4, 0.4, 2.5],
                    Position: offsetPosition(pos, 0, 3.2, 0),
                    Color: [200, 195, 185],
                    Anchored: true,
                    Material: 'Wood',
                    CFrame: { position: offsetPosition(pos, 0, 3.2, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg1',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, -1.6, 1.5, -0.95),
                    Color: [80, 80, 85],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg2',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, 1.6, 1.5, -0.95),
                    Color: [80, 80, 85],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg3',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, -1.6, 1.5, 0.95),
                    Color: [80, 80, 85],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg4',
                    Size: [0.4, 3, 0.4],
                    Position: offsetPosition(pos, 1.6, 1.5, 0.95),
                    Color: [80, 80, 85],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'SidePanel',
                    Size: [4, 1.5, 0.2],
                    Position: offsetPosition(pos, 0, 2.45, -1.15),
                    Color: [200, 195, 185],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
        ],
        terrain: [],
    };
}

function classroomChair(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'ClassroomChair_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Seat',
                    Size: [2, 0.4, 2],
                    Position: offsetPosition(pos, 0, 2.2, 0),
                    Color: [60, 60, 65],
                    Anchored: true,
                    Material: 'Plastic',
                    CFrame: { position: offsetPosition(pos, 0, 2.2, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Backrest',
                    Size: [2, 2, 0.2],
                    Position: offsetPosition(pos, 0, 3.4, -0.9),
                    Color: [60, 60, 65],
                    Anchored: true,
                    Material: 'Plastic',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Post',
                    Size: [0.3, 2, 0.3],
                    Position: offsetPosition(pos, 0, 1.1, 0),
                    Color: [70, 70, 75],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Base',
                    Size: [1.5, 0.15, 1.5],
                    Position: offsetPosition(pos, 0, 0.08, 0),
                    Color: [60, 60, 65],
                    Anchored: true,
                    Material: 'Metal',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 0.08, 0), rotation: [90, 0, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function blackboard(position, rotation, width) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const w = width || 10;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Blackboard_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Frame',
                    Size: [w + 1, 6.5, 0.4],
                    Position: offsetPosition(pos, 0, 5.5, 0),
                    Color: [60, 50, 40],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Board',
                    Size: [w, 6, 0.2],
                    Position: offsetPosition(pos, 0, 5.5, 0.1),
                    Color: [30, 60, 40],
                    Anchored: true,
                    Material: 'Slate',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Tray',
                    Size: [w + 0.5, 0.3, 0.4],
                    Position: offsetPosition(pos, 0, 2.3, 0.2),
                    Color: [55, 45, 35],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
        ],
        terrain: [],
    };
}

function locker(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Locker_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Body',
                    Size: [2, 7, 1.5],
                    Position: offsetPosition(pos, 0, 3.5, 0),
                    Color: [100, 110, 120],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Door',
                    Size: [1.8, 6.5, 0.15],
                    Position: offsetPosition(pos, 0.1, 3.5, 0.75),
                    Color: [110, 120, 130],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Handle',
                    Size: [0.15, 0.8, 0.15],
                    Position: offsetPosition(pos, 0.3, 4.2, 0.85),
                    Color: [140, 140, 145],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
        ],
        terrain: [],
    };
}

// ── Building Templates ──────────────────────────────────────

function smallHouse(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'SmallHouse_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Floor',
                    Size: [14, 1, 12],
                    Position: offsetPosition(pos, 0, 0.5, 0),
                    Color: [150, 140, 120],
                    Anchored: true,
                    Material: 'WoodPlanks',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WallBack',
                    Size: [14, 10, 1],
                    Position: offsetPosition(pos, 0, 5.5, -5.5),
                    Color: [220, 210, 190],
                    Anchored: true,
                    Material: 'Brick',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WallFront',
                    Size: [14, 10, 1],
                    Position: offsetPosition(pos, 0, 5.5, 5.5),
                    Color: [220, 210, 190],
                    Anchored: true,
                    Material: 'Brick',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WallLeft',
                    Size: [1, 10, 12],
                    Position: offsetPosition(pos, -6.5, 5.5, 0),
                    Color: [220, 210, 190],
                    Anchored: true,
                    Material: 'Brick',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WallRight',
                    Size: [1, 10, 12],
                    Position: offsetPosition(pos, 6.5, 5.5, 0),
                    Color: [220, 210, 190],
                    Anchored: true,
                    Material: 'Brick',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Roof',
                    Size: [15, 1, 13],
                    Position: offsetPosition(pos, 0, 11.5, 0),
                    Color: [120, 60, 60],
                    Anchored: true,
                    Material: 'Slate',
                    CFrame: { position: offsetPosition(pos, 0, 11.5, 0), rotation: [0, rot, 30] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Door',
                    Size: [3.5, 7, 0.5],
                    Position: offsetPosition(pos, 0, 3.5, 5.75),
                    Color: [100, 70, 40],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Window1',
                    Size: [3, 4, 0.3],
                    Position: offsetPosition(pos, -3, 6, 5.75),
                    Color: [140, 180, 210],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.5,
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Window2',
                    Size: [3, 4, 0.3],
                    Position: offsetPosition(pos, 3, 6, 5.75),
                    Color: [140, 180, 210],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.5,
                },
            },
        ],
        terrain: [],
    };
}

function shopFront(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Shop_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Floor',
                    Size: [20, 1, 15],
                    Position: offsetPosition(pos, 0, 0.5, 0),
                    Color: [140, 140, 135],
                    Anchored: true,
                    Material: 'Concrete',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'BackWall',
                    Size: [20, 12, 1],
                    Position: offsetPosition(pos, 0, 6.5, -7),
                    Color: [200, 195, 185],
                    Anchored: true,
                    Material: 'Concrete',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'SideWallLeft',
                    Size: [1, 12, 15],
                    Position: offsetPosition(pos, -9.5, 6.5, 0),
                    Color: [200, 195, 185],
                    Anchored: true,
                    Material: 'Concrete',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'SideWallRight',
                    Size: [1, 12, 15],
                    Position: offsetPosition(pos, 9.5, 6.5, 0),
                    Color: [200, 195, 185],
                    Anchored: true,
                    Material: 'Concrete',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Awning',
                    Size: [22, 0.5, 6],
                    Position: offsetPosition(pos, 0, 8.5, 5),
                    Color: [180, 80, 80],
                    Anchored: true,
                    Material: 'Fabric',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LargeWindow',
                    Size: [16, 6, 0.3],
                    Position: offsetPosition(pos, 0, 4, 7.35),
                    Color: [140, 180, 210],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.4,
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'StorefrontDoor',
                    Size: [4, 8, 0.5],
                    Position: offsetPosition(pos, 0, 4.5, 7.4),
                    Color: [200, 180, 160],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.3,
                },
            },
        ],
        terrain: [],
    };
}

// ── Vehicle Templates ──────────────────────────────────────

function parkedCar(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Car_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Body',
                    Size: [6, 2.5, 12],
                    Position: offsetPosition(pos, 0, 1.5, 0),
                    Color: [180, 50, 50],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                    CFrame: { position: offsetPosition(pos, 0, 1.5, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Roof',
                    Size: [5.5, 2, 6],
                    Position: offsetPosition(pos, 0, 3, -1),
                    Color: [180, 50, 50],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WheelFL',
                    Size: [1.2, 1.2, 1.2],
                    Position: offsetPosition(pos, 3, 0.6, 4),
                    Color: [30, 30, 30],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 3, 0.6, 4), rotation: [0, 0, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WheelFR',
                    Size: [1.2, 1.2, 1.2],
                    Position: offsetPosition(pos, -3, 0.6, 4),
                    Color: [30, 30, 30],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                    Shape: 'Cylinder',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WheelRL',
                    Size: [1.2, 1.2, 1.2],
                    Position: offsetPosition(pos, 3, 0.6, -4),
                    Color: [30, 30, 30],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                    Shape: 'Cylinder',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WheelRR',
                    Size: [1.2, 1.2, 1.2],
                    Position: offsetPosition(pos, -3, 0.6, -4),
                    Color: [30, 30, 30],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                    Shape: 'Cylinder',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'WindowFront',
                    Size: [4.5, 1.5, 0.2],
                    Position: offsetPosition(pos, 0, 3.2, 2),
                    Color: [140, 180, 210],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.5,
                },
            },
        ],
        terrain: [],
    };
}

// ── Environment Props ──────────────────────────────────────

function trashCan(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'TrashCan_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Body',
                    Size: [2, 3, 2],
                    Position: offsetPosition(pos, 0, 1.5, 0),
                    Color: [80, 80, 80],
                    Anchored: true,
                    Material: 'Metal',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 1.5, 0), rotation: [90, 0, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Lid',
                    Size: [2.3, 0.3, 2.3],
                    Position: offsetPosition(pos, 0, 3.1, 0),
                    Color: [70, 70, 70],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
        ],
        terrain: [],
    };
}

function streetSign(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'StreetSign_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Pole',
                    Size: [0.4, 8, 0.4],
                    Position: offsetPosition(pos, 0, 4, 0),
                    Color: [200, 200, 200],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Sign',
                    Size: [5, 2, 0.3],
                    Position: offsetPosition(pos, 0, 7.5, 0),
                    Color: [255, 255, 200],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
        ],
        terrain: [],
    };
}

function busStop(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'BusStop_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Pole1',
                    Size: [0.3, 9, 0.3],
                    Position: offsetPosition(pos, -1.5, 4.5, 0),
                    Color: [180, 180, 185],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Pole2',
                    Size: [0.3, 9, 0.3],
                    Position: offsetPosition(pos, 1.5, 4.5, 0),
                    Color: [180, 180, 185],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Roof',
                    Size: [4, 0.3, 2.5],
                    Position: offsetPosition(pos, 0, 8.5, 0),
                    Color: [180, 180, 185],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Bench',
                    Size: [3.5, 0.3, 1.5],
                    Position: offsetPosition(pos, 0, 2, 0.3),
                    Color: [140, 100, 60],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Sign',
                    Size: [2, 2.5, 0.2],
                    Position: offsetPosition(pos, 0, 7.5, 0),
                    Color: [240, 240, 230],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
        ],
        terrain: [],
    };
}

// ── Nature / Terrain Templates ──────────────────────────────

function hillSmall(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [],
        terrain: [
            {
                shape: 'Ball',
                material: 'Grass',
                position: offsetPosition(pos, 0, 2, 0),
                radius: 14,
            },
        ],
    };
}

function hillMedium(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [],
        terrain: [
            {
                shape: 'Ball',
                material: 'Grass',
                position: offsetPosition(pos, 0, 4, 0),
                radius: 22,
            },
            {
                shape: 'Ball',
                material: 'Ground',
                position: offsetPosition(pos, 0, 0, 0),
                radius: 18,
            },
        ],
    };
}

// ── Additional Common Object Templates ───────────────────────

function roundTable(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'RoundTable_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Top',
                    Size: [5, 0.4, 5],
                    Position: offsetPosition(pos, 0, 3.2, 0),
                    Color: [156, 114, 68],
                    Anchored: true,
                    Material: 'Wood',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 3.2, 0), rotation: [90, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Pedestal',
                    Size: [1.2, 3, 1.2],
                    Position: offsetPosition(pos, 0, 1.5, 0),
                    Color: [120, 88, 52],
                    Anchored: true,
                    Material: 'Wood',
                },
            },
        ],
        terrain: [],
    };
}

function bookshelf(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Bookshelf_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Frame',
                    Size: [6, 8, 1.5],
                    Position: offsetPosition(pos, 0, 4, 0),
                    Color: [110, 78, 44],
                    Anchored: true,
                    Material: 'Wood',
                    CFrame: { position: offsetPosition(pos, 0, 4, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Books1',
                    Size: [5.4, 1.2, 1],
                    Position: offsetPosition(pos, 0, 2, 0),
                    Color: [180, 60, 60],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Books2',
                    Size: [5.4, 1.2, 1],
                    Position: offsetPosition(pos, 0, 4.5, 0),
                    Color: [60, 90, 160],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Books3',
                    Size: [5.4, 1.2, 1],
                    Position: offsetPosition(pos, 0, 6.8, 0),
                    Color: [60, 130, 70],
                    Anchored: true,
                    Material: 'SmoothPlastic',
                },
            },
        ],
        terrain: [],
    };
}

function vendingMachine(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'VendingMachine_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Body',
                    Size: [4, 8, 3],
                    Position: offsetPosition(pos, 0, 4, 0),
                    Color: [200, 50, 50],
                    Anchored: true,
                    Material: 'Metal',
                    CFrame: { position: offsetPosition(pos, 0, 4, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Display',
                    Size: [3, 4, 0.2],
                    Position: offsetPosition(pos, 0, 5, 1.4),
                    Color: [180, 220, 240],
                    Anchored: true,
                    Material: 'Glass',
                    Transparency: 0.3,
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Slot',
                    Size: [1, 0.8, 0.3],
                    Position: offsetPosition(pos, 0, 1.5, 1.4),
                    Color: [40, 40, 40],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
        ],
        terrain: [],
    };
}

function picnicTable(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'PicnicTable_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Top',
                    Size: [8, 0.4, 3],
                    Position: offsetPosition(pos, 0, 3, 0),
                    Color: [130, 90, 48],
                    Anchored: true,
                    Material: 'WoodPlanks',
                    CFrame: { position: offsetPosition(pos, 0, 3, 0), rotation: [0, rot, 0] },
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'SeatL',
                    Size: [8, 0.4, 1.5],
                    Position: offsetPosition(pos, 0, 2, -2),
                    Color: [130, 90, 48],
                    Anchored: true,
                    Material: 'WoodPlanks',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'SeatR',
                    Size: [8, 0.4, 1.5],
                    Position: offsetPosition(pos, 0, 2, 2),
                    Color: [130, 90, 48],
                    Anchored: true,
                    Material: 'WoodPlanks',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LegL',
                    Size: [0.5, 3, 5],
                    Position: offsetPosition(pos, -3, 1.5, 0),
                    Color: [110, 75, 38],
                    Anchored: true,
                    Material: 'WoodPlanks',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'LegR',
                    Size: [0.5, 3, 5],
                    Position: offsetPosition(pos, 3, 1.5, 0),
                    Color: [110, 75, 38],
                    Anchored: true,
                    Material: 'WoodPlanks',
                },
            },
        ],
        terrain: [],
    };
}

function crate(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Crate_' + Math.floor(Math.random() * 9999),
                    Size: [3, 3, 3],
                    Position: offsetPosition(pos, 0, 1.5, 0),
                    Color: [160, 120, 70],
                    Anchored: true,
                    Material: 'WoodPlanks',
                },
            },
        ],
        terrain: [],
    };
}

function barrel(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Barrel_' + Math.floor(Math.random() * 9999),
                    Size: [2.5, 4, 2.5],
                    Position: offsetPosition(pos, 0, 2, 0),
                    Color: [140, 95, 50],
                    Anchored: true,
                    Material: 'WoodPlanks',
                    Shape: 'Cylinder',
                    CFrame: { position: offsetPosition(pos, 0, 2, 0), rotation: [0, 0, 90] },
                },
            },
        ],
        terrain: [],
    };
}

// ── TEMPLATE REGISTRY ────────────────────────────────────────

const TEMPLATE_REGISTRY = {
    // Nature
    deciduous_tree_small:  { fn: deciduousTreeSmall,  category: 'nature',       partCount: 4,  description: 'Small leafy tree, ~12 studs tall',                    footprintRadius: 4,  preferredSpacing: 12, placementTags: ['nature', 'tree', 'perimeter'] },
    deciduous_tree_medium: { fn: deciduousTreeMedium, category: 'nature',       partCount: 5,  description: 'Medium leafy tree, ~19 studs tall',                   footprintRadius: 5,  preferredSpacing: 16, placementTags: ['nature', 'tree', 'perimeter'] },
    pine_tree:             { fn: pineTree,            category: 'nature',       partCount: 5,  description: 'Conical pine tree, ~19 studs tall',                  footprintRadius: 5,  preferredSpacing: 16, placementTags: ['nature', 'tree', 'perimeter'] },
    rock_formation:        { fn: rockFormation,       category: 'nature',       partCount: 3,  description: 'Cluster of 3 rocks',                                 footprintRadius: 4,  preferredSpacing: 10, placementTags: ['nature', 'rock', 'perimeter'] },
    flower_cluster:        { fn: flowerCluster,       category: 'nature',       partCount: 10, description: 'Circle of 5 colorful flowers with stems',           footprintRadius: 3,  preferredSpacing: 6,  placementTags: ['nature', 'accent', 'soft-edge'] },
    small_pond:            { fn: smallPond,           category: 'nature',       partCount: 2,  description: 'Small pond with rim and water, ~12 stud diameter',  footprintRadius: 7,  preferredSpacing: 18, placementTags: ['nature', 'water', 'perimeter'] },

    // Terrain
    hill_small:            { fn: hillSmall,           category: 'terrain',      partCount: 0,  description: 'Small grass hill, terrain-based, radius 14',         footprintRadius: 14, preferredSpacing: 18, placementTags: ['terrain', 'landform'] },
    hill_medium:           { fn: hillMedium,          category: 'terrain',      partCount: 0,  description: 'Medium grass/ground hill, terrain-based, radius 22', footprintRadius: 22, preferredSpacing: 24, placementTags: ['terrain', 'landform'] },

    // Paths & Roads
    stone_path:            { fn: stonePathSegment,    category: 'path',         partCount: 1,  description: 'Flat stone path segment',                             footprintRadius: 2,  preferredSpacing: 4,  placementTags: ['path', 'linear'] },
    road_segment:          { fn: roadSegment,         category: 'path',         partCount: 3,  description: 'Road with center line',                              footprintRadius: 8,  preferredSpacing: 16, placementTags: ['path', 'road', 'perimeter'] },

    // Furniture
    desk:                  { fn: desk,                category: 'furniture',    partCount: 6,  description: 'Wooden desk, ~3.4 studs tall',                      footprintRadius: 3,  preferredSpacing: 7,  placementTags: ['furniture', 'interior', 'grid'] },
    chair:                 { fn: chair,               category: 'furniture',    partCount: 7,  description: 'Wooden chair, ~4.9 studs tall',                     footprintRadius: 2,  preferredSpacing: 5,  placementTags: ['furniture', 'interior', 'grid'] },
    bench:                 { fn: bench,               category: 'furniture',    partCount: 5,  description: 'Park bench with metal legs',                        footprintRadius: 4,  preferredSpacing: 12, placementTags: ['furniture', 'pathside', 'perimeter'] },

    // Lighting
    street_lamp:           { fn: streetLamp,          category: 'lighting',     partCount: 4,  description: 'Street lamp with PointLight, ~15 studs tall',       footprintRadius: 2,  preferredSpacing: 14, placementTags: ['lighting', 'pathside', 'perimeter'] },

    // Architecture
    wall_segment:          { fn: wallSegment,         category: 'architecture', partCount: 1,  description: 'Concrete wall segment',                              footprintRadius: 4,  preferredSpacing: 4,  placementTags: ['architecture', 'boundary'] },
    window_segment:        { fn: windowSegment,       category: 'architecture', partCount: 2,  description: 'Window with frame and glass pane',                  footprintRadius: 3,  preferredSpacing: 4,  placementTags: ['architecture', 'façade'] },
    wooden_fence:          { fn: woodenFence,         category: 'architecture', partCount: 5,  description: 'Wooden fence with posts and rails',                  footprintRadius: 4,  preferredSpacing: 6,  placementTags: ['architecture', 'boundary'] },

    // School / Classroom (v2.0)
    classroom_desk:         { fn: classroomDesk,        category: 'school',       partCount: 6,  description: 'School desk with metal legs, 4×2.5×3.2 studs',         footprintRadius: 3,  preferredSpacing: 7,  placementTags: ['furniture', 'school', 'grid'] },
    classroom_chair:        { fn: classroomChair,       category: 'school',       partCount: 5,  description: 'School chair with swivel base',                       footprintRadius: 2,  preferredSpacing: 5,  placementTags: ['furniture', 'school', 'grid'] },
    blackboard:            { fn: blackboard,          category: 'school',       partCount: 3,  description: 'Green chalkboard on wood frame',                      footprintRadius: 5,  preferredSpacing: 6,  placementTags: ['furniture', 'school', 'wall'] },
    locker:                { fn: locker,              category: 'school',       partCount: 4,  description: 'School locker cabinet',                             footprintRadius: 1.5, preferredSpacing: 3,  placementTags: ['furniture', 'school', 'wall'] },

    // Buildings (v2.0)
    small_house:           { fn: smallHouse,          category: 'building',     partCount: 10, description: 'Small house with roof, 14×12 studs',               footprintRadius: 8,  preferredSpacing: 20, placementTags: ['building', 'residential', 'perimeter'] },
    shop_front:            { fn: shopFront,           category: 'building',     partCount: 8,  description: 'Shop storefront with awning, 20×15 studs',             footprintRadius: 10, preferredSpacing: 25, placementTags: ['building', 'commercial', 'perimeter'] },

    // Vehicles (v2.0)
    parked_car:            { fn: parkedCar,           category: 'vehicle',      partCount: 8,  description: 'Parked car, 6×12 studs',                            footprintRadius: 7,  preferredSpacing: 10, placementTags: ['vehicle', 'roadside', 'parking'] },

    // Environment Props (v2.0)
    trash_can:             { fn: trashCan,            category: 'prop',         partCount: 2,  description: 'Metal trash can with lid',                          footprintRadius: 1.5, preferredSpacing: 4,  placementTags: ['prop', 'urban', 'sidewalk'] },
    street_sign:          { fn: streetSign,          category: 'prop',         partCount: 2,  description: 'Street sign on metal pole',                         footprintRadius: 2,  preferredSpacing: 6,  placementTags: ['prop', 'urban', 'roadside'] },
    bus_stop:             { fn: busStop,            category: 'prop',         partCount: 6,  description: 'Bus stop shelter with bench',                        footprintRadius: 3,  preferredSpacing: 8,  placementTags: ['prop', 'urban', 'roadside'] },

    // Common objects (v2.1)
    round_table:           { fn: roundTable,          category: 'furniture',    partCount: 2,  description: 'Round wooden table, 5 stud diameter',              footprintRadius: 3,  preferredSpacing: 8,  placementTags: ['furniture', 'interior', 'café'] },
    bookshelf:             { fn: bookshelf,           category: 'furniture',    partCount: 5,  description: 'Bookshelf with 3 shelves of books',                footprintRadius: 3,  preferredSpacing: 4,  placementTags: ['furniture', 'interior', 'wall', 'school'] },
    vending_machine:       { fn: vendingMachine,      category: 'prop',         partCount: 4,  description: 'Red vending machine with display',                 footprintRadius: 2,  preferredSpacing: 6,  placementTags: ['prop', 'urban', 'interior', 'wall'] },
    picnic_table:          { fn: picnicTable,         category: 'furniture',    partCount: 5,  description: 'Wooden picnic table with 2 bench seats',           footprintRadius: 5,  preferredSpacing: 12, placementTags: ['furniture', 'outdoor', 'park'] },
    crate:                 { fn: crate,               category: 'prop',         partCount: 1,  description: 'Wooden storage crate, 3×3×3 studs',               footprintRadius: 2,  preferredSpacing: 4,  placementTags: ['prop', 'warehouse', 'cover'] },
    barrel:                { fn: barrel,              category: 'prop',         partCount: 1,  description: 'Wooden barrel, 2.5 diameter × 4 tall',             footprintRadius: 1.5, preferredSpacing: 4,  placementTags: ['prop', 'warehouse', 'dock'] },
};

// ── Public API ───────────────────────────────────────────────

/**
 * Returns the catalog of available templates for AI prompt injection.
 */
function getTemplateCatalog() {
    const catalog = {};
    for (const [name, entry] of Object.entries(TEMPLATE_REGISTRY)) {
        catalog[name] = {
            category: entry.category,
            partCount: entry.partCount,
            description: entry.description,
            footprintRadius: entry.footprintRadius,
            preferredSpacing: entry.preferredSpacing,
            placementTags: entry.placementTags || [],
        };
    }
    return catalog;
}

/**
 * Returns a formatted string describing all available templates
 * for injection into the scene planner system prompt.
 */
function getTemplateCatalogText() {
    const lines = ['Available object templates (use these names in the scene plan):'];
    for (const [name, entry] of Object.entries(TEMPLATE_REGISTRY)) {
        lines.push(
            `  • ${name} — ${entry.description}`
            + ` (${entry.partCount} parts, category: ${entry.category}, footprint ~${entry.footprintRadius} studs, spacing ~${entry.preferredSpacing})`
        );
    }
    return lines.join('\n');
}

function getTemplatePlacementMetadata(templateName) {
    const entry = TEMPLATE_REGISTRY[templateName];
    if (!entry) {
        return {
            footprintRadius: 4,
            preferredSpacing: 8,
            placementTags: [],
        };
    }

    return {
        footprintRadius: typeof entry.footprintRadius === 'number' ? entry.footprintRadius : 4,
        preferredSpacing: typeof entry.preferredSpacing === 'number' ? entry.preferredSpacing : 8,
        placementTags: Array.isArray(entry.placementTags) ? entry.placementTags.slice(0, 8) : [],
    };
}

/**
 * Instantiate a template by name at the given position.
 * @param {string} templateName — key from TEMPLATE_REGISTRY
 * @param {number[]} position — [x, y, z]
 * @param {number} [rotation] — Y rotation in degrees
 * @param {object} [options] — additional options (length, width, height)
 * @returns {{ instances: object[], terrain: object[] } | null}
 */
function resolveTemplate(templateName, position, rotation, options) {
    const entry = TEMPLATE_REGISTRY[templateName];
    if (!entry) {
        return null;
    }
    const opts = options || {};
    return entry.fn(position, rotation, opts.length, opts.width, opts.height);
}

/**
 * Resolve a list of template placements and merge into flat arrays.
 * @param {Array<{ template: string, position: number[], rotation?: number, options?: object }>} placements
 * @returns {{ instances: object[], terrain: object[] }}
 */
function resolveTemplatePlacements(placements) {
    const allInstances = [];
    const allTerrain = [];

    for (const placement of placements) {
        const result = resolveTemplate(
            placement.template,
            placement.position,
            placement.rotation,
            placement.options
        );
        if (result) {
            // Resolve __LAST_MODEL__ references
            let lastModelName = null;
            for (const inst of result.instances) {
                if (inst.className === 'Model' && inst.properties?.Name) {
                    lastModelName = inst.properties.Name;
                }
                if (inst.parent === '__LAST_MODEL__' && lastModelName) {
                    inst.parent = lastModelName;
                }
                allInstances.push(inst);
            }
            allTerrain.push(...result.terrain);
        }
    }

    return { instances: allInstances, terrain: allTerrain };
}

module.exports = {
    TEMPLATE_REGISTRY,
    getTemplateCatalog,
    getTemplateCatalogText,
    getTemplatePlacementMetadata,
    resolveTemplate,
    resolveTemplatePlacements,
    // Individual template functions for direct use
    deciduousTreeSmall,
    deciduousTreeMedium,
    pineTree,
    stonePathSegment,
    roadSegment,
    desk,
    chair,
    bench,
    streetLamp,
    smallPond,
    rockFormation,
    flowerCluster,
    wallSegment,
    windowSegment,
    woodenFence,
    hillSmall,
    hillMedium,
    // v2.0 templates
    classroomDesk,
    classroomChair,
    blackboard,
    locker,
    smallHouse,
    shopFront,
    parkedCar,
    trashCan,
    streetSign,
    busStop,
    // v2.1 templates
    roundTable,
    bookshelf,
    vendingMachine,
    picnicTable,
    crate,
    barrel,
};
