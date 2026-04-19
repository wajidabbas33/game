// ============================================================
//  Roblox AI Plugin – Interior & Exterior Template Extensions
//
//  Adds 35+ new templates for café, office, kitchen, interior,
//  and exterior environments. Follows the same pattern as
//  templates.js: each function returns { instances: [], terrain: [] }.
//
//  These are merged into the main TEMPLATE_REGISTRY at startup.
// ============================================================

'use strict';

// ── Helper: offset position ──────────────────────────────────
function offsetPosition(base, dx, dy, dz) {
    return [
        (base[0] || 0) + (dx || 0),
        (base[1] || 0) + (dy || 0),
        (base[2] || 0) + (dz || 0),
    ];
}

// ──────────────────────────────────────────────────────────────
// CAFÉ / RESTAURANT TEMPLATES
// ──────────────────────────────────────────────────────────────

function caféTableRound(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'CafeTableRound_' + Math.floor(Math.random() * 9999) },
            },
            {
                // Pedestal base
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'PedestalBase',
                    Size: [1.8, 0.3, 1.8],
                    Position: offsetPosition(pos, 0, 0.15, 0),
                    Color: [55, 52, 48],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                // Pedestal column
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'PedestalColumn',
                    Size: [0.4, 2.8, 0.4],
                    Position: offsetPosition(pos, 0, 1.7, 0),
                    Color: [55, 52, 48],
                    Anchored: true,
                    Material: 'Metal',
                },
            },
            {
                // Tabletop
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Tabletop',
                    Size: [3.5, 0.25, 3.5],
                    Position: offsetPosition(pos, 0, 3.22, 0),
                    Color: [180, 150, 110],
                    Anchored: true,
                    Material: 'WoodPlanks',
                    CFrame: { position: offsetPosition(pos, 0, 3.22, 0), rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function caféTableSquare(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'CafeTableSquare_' + Math.floor(Math.random() * 9999) },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg1', Size: [0.3, 2.9, 0.3],
                    Position: offsetPosition(pos, -1.3, 1.45, -1.3),
                    Color: [55, 52, 48], Anchored: true, Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg2', Size: [0.3, 2.9, 0.3],
                    Position: offsetPosition(pos, 1.3, 1.45, -1.3),
                    Color: [55, 52, 48], Anchored: true, Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg3', Size: [0.3, 2.9, 0.3],
                    Position: offsetPosition(pos, -1.3, 1.45, 1.3),
                    Color: [55, 52, 48], Anchored: true, Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Leg4', Size: [0.3, 2.9, 0.3],
                    Position: offsetPosition(pos, 1.3, 1.45, 1.3),
                    Color: [55, 52, 48], Anchored: true, Material: 'Metal',
                },
            },
            {
                className: 'Part',
                parent: '__LAST_MODEL__',
                properties: {
                    Name: 'Tabletop', Size: [3.4, 0.25, 3.4],
                    Position: offsetPosition(pos, 0, 3.02, 0),
                    Color: [165, 130, 85], Anchored: true, Material: 'WoodPlanks',
                    CFrame: { position: offsetPosition(pos, 0, 3.02, 0), rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function caféChair(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'CafeChair_' + Math.floor(Math.random() * 9999) },
            },
            // 4 legs
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Leg1', Size: [0.2, 1.8, 0.2], Position: offsetPosition(pos, -0.55, 0.9, -0.55),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Leg2', Size: [0.2, 1.8, 0.2], Position: offsetPosition(pos, 0.55, 0.9, -0.55),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Leg3', Size: [0.2, 1.8, 0.2], Position: offsetPosition(pos, -0.55, 0.9, 0.55),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Leg4', Size: [0.2, 1.8, 0.2], Position: offsetPosition(pos, 0.55, 0.9, 0.55),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            // Seat
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Seat', Size: [1.6, 0.2, 1.6], Position: offsetPosition(pos, 0, 1.9, 0),
                Color: [180, 145, 95], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 1.9, 0), rotation: [0, rot, 0] } } },
            // Backrest
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Backrest', Size: [1.6, 1.8, 0.2], Position: offsetPosition(pos, 0, 2.9, -0.65),
                Color: [180, 145, 95], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 2.9, -0.65), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

function barStool(position, rotation) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'BarStool_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Base', Size: [1.4, 0.3, 1.4], Position: offsetPosition(pos, 0, 0.15, 0),
                Color: [60, 58, 55], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Pole', Size: [0.3, 3.5, 0.3], Position: offsetPosition(pos, 0, 1.9, 0),
                Color: [60, 58, 55], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Seat', Size: [1.5, 0.3, 1.5], Position: offsetPosition(pos, 0, 3.8, 0),
                Color: [45, 42, 38], Anchored: true, Material: 'Leather' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'FootRing', Size: [1.2, 0.15, 1.2], Position: offsetPosition(pos, 0, 1.2, 0),
                Color: [60, 58, 55], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function counterLong(position, rotation, length) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 10;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Counter_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'CounterBody', Size: [len, 3.6, 2.4], Position: offsetPosition(pos, 0, 1.8, 0),
                Color: [170, 140, 95], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 1.8, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'CounterTop', Size: [len + 0.4, 0.2, 2.8], Position: offsetPosition(pos, 0, 3.7, 0),
                Color: [210, 205, 198], Anchored: true, Material: 'Marble',
                CFrame: { position: offsetPosition(pos, 0, 3.7, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'CounterFront', Size: [len, 3.4, 0.15], Position: offsetPosition(pos, 0, 1.8, -1.1),
                Color: [155, 125, 80], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 1.8, -1.1), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

function espressoMachine(position, rotation) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'EspressoMachine_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Body', Size: [1.8, 2.2, 1.4], Position: offsetPosition(pos, 0, 4.8, 0),
                Color: [55, 55, 58], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Portafilter', Size: [0.5, 0.3, 0.8], Position: offsetPosition(pos, 0, 3.9, -0.5),
                Color: [80, 78, 75], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function menuBoard(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'MenuBoard_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Board', Size: [6, 4, 0.3], Position: offsetPosition(pos, 0, 9, 0),
                Color: [35, 32, 28], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 9, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Frame', Size: [6.4, 4.4, 0.15], Position: offsetPosition(pos, 0, 9, -0.1),
                Color: [100, 75, 42], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 9, -0.1), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

function pendantLight(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'PendantLight_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Cord', Size: [0.08, 2.5, 0.08], Position: offsetPosition(pos, 0, -1.25, 0),
                Color: [50, 48, 45], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Shade', Size: [2.2, 1.0, 2.2], Position: offsetPosition(pos, 0, -2.7, 0),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Bulb', Size: [1.0, 0.4, 1.0], Position: offsetPosition(pos, 0, -3.0, 0),
                Color: [255, 220, 150], Anchored: true, Material: 'Neon', Transparency: 0.15 } },
        ],
        terrain: [],
    };
}

// ──────────────────────────────────────────────────────────────
// OFFICE TEMPLATES
// ──────────────────────────────────────────────────────────────

function officeDesk(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'OfficeDesk_' + Math.floor(Math.random() * 9999) },
            },
            // Desktop
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Desktop', Size: [5, 0.2, 2.8], Position: offsetPosition(pos, 0, 3.3, 0),
                Color: [175, 142, 98], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 3.3, 0), rotation: [0, rot, 0] } } },
            // Left panel
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'PanelLeft', Size: [0.15, 3.1, 2.6], Position: offsetPosition(pos, -2.35, 1.55, 0),
                Color: [165, 132, 88], Anchored: true, Material: 'WoodPlanks' } },
            // Right panel (with drawer)
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'DrawerUnit', Size: [1.4, 3.1, 2.6], Position: offsetPosition(pos, 1.65, 1.55, 0),
                Color: [165, 132, 88], Anchored: true, Material: 'WoodPlanks' } },
            // Back panel
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'BackPanel', Size: [5, 1.4, 0.15], Position: offsetPosition(pos, 0, 1.0, 1.25),
                Color: [158, 125, 82], Anchored: true, Material: 'WoodPlanks' } },
            // Monitor
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Monitor', Size: [2.2, 1.6, 0.12], Position: offsetPosition(pos, 0, 4.5, 0.4),
                Color: [30, 30, 32], Anchored: true, Material: 'SmoothPlastic' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'MonitorStand', Size: [0.3, 0.8, 0.3], Position: offsetPosition(pos, 0, 3.8, 0.4),
                Color: [45, 45, 48], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function officeChair(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'OfficeChair_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Base', Size: [1.6, 0.2, 1.6], Position: offsetPosition(pos, 0, 0.3, 0),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Shaft', Size: [0.3, 1.6, 0.3], Position: offsetPosition(pos, 0, 1.2, 0),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Seat', Size: [1.8, 0.3, 1.8], Position: offsetPosition(pos, 0, 2.15, 0),
                Color: [40, 40, 42], Anchored: true, Material: 'Fabric',
                CFrame: { position: offsetPosition(pos, 0, 2.15, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Backrest', Size: [1.8, 2.2, 0.25], Position: offsetPosition(pos, 0, 3.4, -0.75),
                Color: [40, 40, 42], Anchored: true, Material: 'Fabric',
                CFrame: { position: offsetPosition(pos, 0, 3.4, -0.75), rotation: [0, rot, 0] } } },
            // Armrests
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'ArmrestL', Size: [0.2, 0.2, 1.2], Position: offsetPosition(pos, -0.85, 2.8, -0.2),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'ArmrestR', Size: [0.2, 0.2, 1.2], Position: offsetPosition(pos, 0.85, 2.8, -0.2),
                Color: [55, 52, 48], Anchored: true, Material: 'Metal' } },
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
            // Frame
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Frame', Size: [3.6, 8, 1.4], Position: offsetPosition(pos, 0, 4, 0),
                Color: [135, 100, 58], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 4, 0), rotation: [0, rot, 0] } } },
            // Shelves (4 levels)
            ...Array.from({ length: 4 }, (_, i) => ({
                className: 'Part', parent: '__LAST_MODEL__', properties: {
                    Name: `Shelf${i + 1}`, Size: [3.4, 0.15, 1.2],
                    Position: offsetPosition(pos, 0, 1.5 + i * 1.8, 0),
                    Color: [145, 108, 65], Anchored: true, Material: 'WoodPlanks' },
            })),
            // Book blocks
            ...Array.from({ length: 3 }, (_, i) => ({
                className: 'Part', parent: '__LAST_MODEL__', properties: {
                    Name: `Books${i + 1}`, Size: [2.8, 1.2, 0.8],
                    Position: offsetPosition(pos, 0, 2.3 + i * 1.8, 0),
                    Color: [
                        [140, 60, 45], [55, 90, 130], [180, 155, 50]
                    ][i],
                    Anchored: true, Material: 'SmoothPlastic' },
            })),
        ],
        terrain: [],
    };
}

function filingCabinet(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'FilingCabinet_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Body', Size: [1.8, 4.5, 2.2], Position: offsetPosition(pos, 0, 2.25, 0),
                Color: [170, 168, 165], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 0, 2.25, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'DrawerHandle1', Size: [1.0, 0.1, 0.1], Position: offsetPosition(pos, 0, 1.5, -1.15),
                Color: [120, 118, 115], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'DrawerHandle2', Size: [1.0, 0.1, 0.1], Position: offsetPosition(pos, 0, 3.5, -1.15),
                Color: [120, 118, 115], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function glassPartition(position, rotation, length, height) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 8;
    const h = height || 12;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'GlassPartition_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'GlassPanel', Size: [len, h, 0.15], Position: offsetPosition(pos, 0, h / 2, 0),
                Color: [185, 215, 230], Anchored: true, Material: 'Glass', Transparency: 0.4,
                CFrame: { position: offsetPosition(pos, 0, h / 2, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'FrameTop', Size: [len + 0.2, 0.15, 0.4], Position: offsetPosition(pos, 0, h + 0.07, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 0, h + 0.07, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'FrameBottom', Size: [len + 0.2, 0.15, 0.4], Position: offsetPosition(pos, 0, 0.07, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 0, 0.07, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'FrameLeft', Size: [0.15, h, 0.4], Position: offsetPosition(pos, -len / 2, h / 2, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'FrameRight', Size: [0.15, h, 0.4], Position: offsetPosition(pos, len / 2, h / 2, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function receptionDesk(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'ReceptionDesk_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'DeskBody', Size: [8, 3.8, 3], Position: offsetPosition(pos, 0, 1.9, 0),
                Color: [180, 152, 108], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 1.9, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'DeskTop', Size: [8.4, 0.2, 3.4], Position: offsetPosition(pos, 0, 3.9, 0),
                Color: [205, 200, 192], Anchored: true, Material: 'Marble',
                CFrame: { position: offsetPosition(pos, 0, 3.9, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'FrontPanel', Size: [8, 4.2, 0.15], Position: offsetPosition(pos, 0, 2.1, -1.45),
                Color: [170, 140, 95], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 2.1, -1.45), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

function overheadLightPanel(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'OverheadLight_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Panel', Size: [4, 0.2, 2], Position: offsetPosition(pos, 0, 0, 0),
                Color: [245, 245, 248], Anchored: true, Material: 'Neon', Transparency: 0.1 } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Housing', Size: [4.2, 0.3, 2.2], Position: offsetPosition(pos, 0, 0.15, 0),
                Color: [200, 200, 205], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

// ──────────────────────────────────────────────────────────────
// KITCHEN / UTILITY TEMPLATES
// ──────────────────────────────────────────────────────────────

function kitchenCounter(position, rotation, length) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 6;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'KitchenCounter_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Cabinet', Size: [len, 3.4, 2.2], Position: offsetPosition(pos, 0, 1.7, 0),
                Color: [225, 220, 215], Anchored: true, Material: 'SmoothPlastic',
                CFrame: { position: offsetPosition(pos, 0, 1.7, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Countertop', Size: [len + 0.3, 0.18, 2.5], Position: offsetPosition(pos, 0, 3.49, 0),
                Color: [195, 190, 185], Anchored: true, Material: 'Granite',
                CFrame: { position: offsetPosition(pos, 0, 3.49, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Backsplash', Size: [len, 2, 0.2], Position: offsetPosition(pos, 0, 4.6, 1.0),
                Color: [235, 232, 228], Anchored: true, Material: 'SmoothPlastic',
                CFrame: { position: offsetPosition(pos, 0, 4.6, 1.0), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

function sinkUnit(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'SinkUnit_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Cabinet', Size: [3, 3.2, 2.2], Position: offsetPosition(pos, 0, 1.6, 0),
                Color: [225, 220, 215], Anchored: true, Material: 'SmoothPlastic',
                CFrame: { position: offsetPosition(pos, 0, 1.6, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'SinkBowl', Size: [1.8, 0.8, 1.4], Position: offsetPosition(pos, 0, 3.0, 0),
                Color: [240, 240, 242], Anchored: true, Material: 'SmoothPlastic',
                CFrame: { position: offsetPosition(pos, 0, 3.0, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Faucet', Size: [0.2, 1.0, 0.6], Position: offsetPosition(pos, 0, 4.0, -0.5),
                Color: [165, 162, 158], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function shelvingUnit(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'ShelvingUnit_' + Math.floor(Math.random() * 9999) },
            },
            // 2 vertical supports
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'UpL', Size: [0.2, 7, 1.4], Position: offsetPosition(pos, -1.4, 3.5, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'UpR', Size: [0.2, 7, 1.4], Position: offsetPosition(pos, 1.4, 3.5, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal' } },
            // 4 shelves
            ...Array.from({ length: 4 }, (_, i) => ({
                className: 'Part', parent: '__LAST_MODEL__', properties: {
                    Name: `Shelf${i + 1}`, Size: [3.0, 0.12, 1.4],
                    Position: offsetPosition(pos, 0, 0.8 + i * 1.7, 0),
                    Color: [160, 158, 155], Anchored: true, Material: 'Metal',
                    CFrame: { position: offsetPosition(pos, 0, 0.8 + i * 1.7, 0), rotation: [0, rot, 0] } },
            })),
        ],
        terrain: [],
    };
}

function refrigerator(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Refrigerator_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Body', Size: [2.8, 7.5, 2.4], Position: offsetPosition(pos, 0, 3.75, 0),
                Color: [220, 218, 215], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 0, 3.75, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Handle', Size: [0.15, 3, 0.15], Position: offsetPosition(pos, 1.15, 4.5, -1.25),
                Color: [175, 172, 168], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Divider', Size: [2.6, 0.12, 2.2], Position: offsetPosition(pos, 0, 5.2, 0),
                Color: [200, 198, 195], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

// ──────────────────────────────────────────────────────────────
// COMMON INTERIOR TEMPLATES
// ──────────────────────────────────────────────────────────────

function sofaModern(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Sofa_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Base', Size: [6, 1.6, 3], Position: offsetPosition(pos, 0, 0.8, 0),
                Color: [72, 70, 68], Anchored: true, Material: 'Fabric',
                CFrame: { position: offsetPosition(pos, 0, 0.8, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'SeatCushion', Size: [5.6, 0.6, 2.4], Position: offsetPosition(pos, 0, 1.9, -0.1),
                Color: [82, 80, 78], Anchored: true, Material: 'Fabric',
                CFrame: { position: offsetPosition(pos, 0, 1.9, -0.1), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Backrest', Size: [5.6, 2.2, 0.8], Position: offsetPosition(pos, 0, 2.7, 1.1),
                Color: [72, 70, 68], Anchored: true, Material: 'Fabric',
                CFrame: { position: offsetPosition(pos, 0, 2.7, 1.1), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'ArmL', Size: [0.5, 1.8, 2.8], Position: offsetPosition(pos, -2.75, 1.5, 0),
                Color: [72, 70, 68], Anchored: true, Material: 'Fabric' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'ArmR', Size: [0.5, 1.8, 2.8], Position: offsetPosition(pos, 2.75, 1.5, 0),
                Color: [72, 70, 68], Anchored: true, Material: 'Fabric' } },
        ],
        terrain: [],
    };
}

function coffeeTable(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'CoffeeTable_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Top', Size: [4, 0.2, 2.2], Position: offsetPosition(pos, 0, 1.6, 0),
                Color: [140, 105, 60], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 1.6, 0), rotation: [0, rot, 0] } } },
            ...Array.from({ length: 4 }, (_, i) => {
                const lx = i < 2 ? -1.6 : 1.6;
                const lz = i % 2 === 0 ? -0.8 : 0.8;
                return {
                    className: 'Part', parent: '__LAST_MODEL__', properties: {
                        Name: `Leg${i + 1}`, Size: [0.25, 1.4, 0.25],
                        Position: offsetPosition(pos, lx, 0.7, lz),
                        Color: [55, 52, 48], Anchored: true, Material: 'Metal' },
                };
            }),
        ],
        terrain: [],
    };
}

function planterIndoor(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Planter_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Pot', Size: [1.8, 2, 1.8], Position: offsetPosition(pos, 0, 1, 0),
                Color: [165, 140, 110], Anchored: true, Material: 'SmoothPlastic' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Soil', Size: [1.5, 0.4, 1.5], Position: offsetPosition(pos, 0, 2.2, 0),
                Color: [75, 55, 35], Anchored: true, Material: 'Ground' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Foliage', Size: [2.5, 3, 2.5], Position: offsetPosition(pos, 0, 3.9, 0),
                Color: [60, 140, 55], Anchored: true, Material: 'Grass' } },
        ],
        terrain: [],
    };
}

function coatRack(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'CoatRack_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Base', Size: [1.2, 0.2, 1.2], Position: offsetPosition(pos, 0, 0.1, 0),
                Color: [110, 80, 45], Anchored: true, Material: 'WoodPlanks' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Pole', Size: [0.25, 6.5, 0.25], Position: offsetPosition(pos, 0, 3.35, 0),
                Color: [110, 80, 45], Anchored: true, Material: 'WoodPlanks' } },
            // Hooks
            ...Array.from({ length: 4 }, (_, i) => ({
                className: 'Part', parent: '__LAST_MODEL__', properties: {
                    Name: `Hook${i + 1}`, Size: [0.6, 0.1, 0.1],
                    Position: offsetPosition(pos, Math.cos(i * Math.PI / 2) * 0.4, 6.2, Math.sin(i * Math.PI / 2) * 0.4),
                    Color: [85, 60, 35], Anchored: true, Material: 'WoodPlanks' },
            })),
        ],
        terrain: [],
    };
}

function trashBin(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'TrashBin_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Bin', Size: [1.2, 2.2, 1.2], Position: offsetPosition(pos, 0, 1.1, 0),
                Color: [85, 85, 88], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Rim', Size: [1.3, 0.1, 1.3], Position: offsetPosition(pos, 0, 2.25, 0),
                Color: [100, 100, 105], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function wallArt(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'WallArt_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Frame', Size: [3.2, 2.4, 0.2], Position: offsetPosition(pos, 0, 7, 0),
                Color: [80, 60, 35], Anchored: true, Material: 'WoodPlanks',
                CFrame: { position: offsetPosition(pos, 0, 7, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Canvas', Size: [2.8, 2.0, 0.05], Position: offsetPosition(pos, 0, 7, 0.08),
                Color: [
                    [200, 165, 120], [120, 160, 195], [180, 140, 170]
                ][Math.floor(Math.random() * 3)],
                Anchored: true, Material: 'SmoothPlastic',
                CFrame: { position: offsetPosition(pos, 0, 7, 0.08), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

// ──────────────────────────────────────────────────────────────
// EXTERIOR TEMPLATES
// ──────────────────────────────────────────────────────────────

function sidewalkSegment(position, rotation, length) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 12;
    return {
        instances: [
            {
                className: 'Part',
                parent: 'Workspace',
                properties: {
                    Name: 'Sidewalk_' + Math.floor(Math.random() * 9999),
                    Size: [len, 0.4, 5],
                    Position: offsetPosition(pos, 0, 0.2, 0),
                    Color: [195, 192, 188],
                    Anchored: true,
                    Material: 'Concrete',
                    CFrame: { position: offsetPosition(pos, 0, 0.2, 0), rotation: [0, rot, 0] },
                },
            },
        ],
        terrain: [],
    };
}

function crosswalk(position, rotation, length) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    const len = length || 8;
    const stripeCount = 5;
    const instances = [];
    for (let s = 0; s < stripeCount; s++) {
        const offset = (s - (stripeCount - 1) / 2) * 1.6;
        instances.push({
            className: 'Part',
            parent: 'Workspace',
            properties: {
                Name: `Crosswalk_stripe_${s}_${Math.floor(Math.random() * 9999)}`,
                Size: [1, 0.05, len],
                Position: offsetPosition(pos, offset, 0.16, 0),
                Color: [255, 255, 255],
                Anchored: true,
                Material: 'SmoothPlastic',
                CFrame: { position: offsetPosition(pos, offset, 0.16, 0), rotation: [0, rot, 0] },
            },
        });
    }
    return { instances, terrain: [] };
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
            // Left post
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'PostL', Size: [0.3, 10, 0.3], Position: offsetPosition(pos, -3, 5, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal' } },
            // Right post
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'PostR', Size: [0.3, 10, 0.3], Position: offsetPosition(pos, 3, 5, 0),
                Color: [140, 138, 135], Anchored: true, Material: 'Metal' } },
            // Roof
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Roof', Size: [7, 0.3, 4], Position: offsetPosition(pos, 0, 10.15, 0),
                Color: [100, 145, 180], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 0, 10.15, 0), rotation: [0, rot, 0] } } },
            // Back panel
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'BackPanel', Size: [7, 5, 0.2], Position: offsetPosition(pos, 0, 7.5, 1.9),
                Color: [175, 210, 230], Anchored: true, Material: 'Glass', Transparency: 0.3,
                CFrame: { position: offsetPosition(pos, 0, 7.5, 1.9), rotation: [0, rot, 0] } } },
            // Bench
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Bench', Size: [5, 0.3, 1.4], Position: offsetPosition(pos, 0, 2.2, 1.0),
                Color: [165, 162, 158], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function fireHydrant(position) {
    const pos = position || [0, 0, 0];
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'FireHydrant_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Body', Size: [0.9, 2.2, 0.9], Position: offsetPosition(pos, 0, 1.1, 0),
                Color: [200, 45, 35], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Cap', Size: [0.7, 0.5, 0.7], Position: offsetPosition(pos, 0, 2.45, 0),
                Color: [200, 45, 35], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Arm', Size: [0.6, 0.3, 0.3], Position: offsetPosition(pos, 0.6, 1.5, 0),
                Color: [200, 45, 35], Anchored: true, Material: 'Metal' } },
        ],
        terrain: [],
    };
}

function mailbox(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'Mailbox_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Post', Size: [0.4, 4, 0.4], Position: offsetPosition(pos, 0, 2, 0),
                Color: [60, 75, 120], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Box', Size: [1.6, 1.4, 1.0], Position: offsetPosition(pos, 0, 4.7, 0),
                Color: [55, 70, 115], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 0, 4.7, 0), rotation: [0, rot, 0] } } },
        ],
        terrain: [],
    };
}

function trafficLight(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'TrafficLight_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Pole', Size: [0.5, 14, 0.5], Position: offsetPosition(pos, 0, 7, 0),
                Color: [80, 80, 82], Anchored: true, Material: 'Metal' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Arm', Size: [5, 0.3, 0.3], Position: offsetPosition(pos, 2.5, 14, 0),
                Color: [80, 80, 82], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 2.5, 14, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Housing', Size: [1.2, 3.6, 1.0], Position: offsetPosition(pos, 5, 13, 0),
                Color: [40, 40, 42], Anchored: true, Material: 'Metal',
                CFrame: { position: offsetPosition(pos, 5, 13, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'RedLight', Size: [0.7, 0.7, 0.15], Position: offsetPosition(pos, 5, 14, -0.55),
                Color: [220, 40, 30], Anchored: true, Material: 'Neon' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'YellowLight', Size: [0.7, 0.7, 0.15], Position: offsetPosition(pos, 5, 13, -0.55),
                Color: [240, 200, 40], Anchored: true, Material: 'Neon' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'GreenLight', Size: [0.7, 0.7, 0.15], Position: offsetPosition(pos, 5, 12, -0.55),
                Color: [40, 200, 60], Anchored: true, Material: 'Neon' } },
        ],
        terrain: [],
    };
}

function curbPlanter(position, rotation) {
    const pos = position || [0, 0, 0];
    const rot = rotation || 0;
    return {
        instances: [
            {
                className: 'Model',
                parent: 'Workspace',
                properties: { Name: 'CurbPlanter_' + Math.floor(Math.random() * 9999) },
            },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Box', Size: [4, 1.6, 2.4], Position: offsetPosition(pos, 0, 0.8, 0),
                Color: [155, 150, 145], Anchored: true, Material: 'Concrete',
                CFrame: { position: offsetPosition(pos, 0, 0.8, 0), rotation: [0, rot, 0] } } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Soil', Size: [3.6, 0.5, 2.0], Position: offsetPosition(pos, 0, 1.85, 0),
                Color: [80, 60, 38], Anchored: true, Material: 'Ground' } },
            { className: 'Part', parent: '__LAST_MODEL__', properties: {
                Name: 'Shrubs', Size: [3.2, 1.8, 1.8], Position: offsetPosition(pos, 0, 3.0, 0),
                Color: [55, 120, 48], Anchored: true, Material: 'Grass' } },
        ],
        terrain: [],
    };
}

// ── EXTENDED TEMPLATE REGISTRY ───────────────────────────────
const EXTENDED_TEMPLATE_REGISTRY = {
    // Café / Restaurant
    'café_table_round':   { fn: caféTableRound,   category: 'furniture', partCount: 3, description: 'Small round café table, pedestal base', footprintRadius: 2, preferredSpacing: 5, placementTags: ['furniture', 'interior', 'grid'] },
    'café_table_square':  { fn: caféTableSquare,  category: 'furniture', partCount: 5, description: 'Square café table with 4 legs', footprintRadius: 2, preferredSpacing: 5, placementTags: ['furniture', 'interior', 'grid'] },
    'café_chair':         { fn: caféChair,         category: 'furniture', partCount: 6, description: 'Light café chair with wood seat', footprintRadius: 1, preferredSpacing: 3, placementTags: ['furniture', 'interior', 'paired'] },
    bar_stool:            { fn: barStool,          category: 'furniture', partCount: 4, description: 'Tall bar stool with leather seat', footprintRadius: 1, preferredSpacing: 2.5, placementTags: ['furniture', 'interior', 'counter'] },
    counter_long:         { fn: counterLong,       category: 'furniture', partCount: 3, description: 'Long service counter with marble top', footprintRadius: 5, preferredSpacing: 12, placementTags: ['furniture', 'interior', 'wall-flush'] },
    espresso_machine:     { fn: espressoMachine,   category: 'furniture', partCount: 2, description: 'Counter-top espresso machine', footprintRadius: 1, preferredSpacing: 3, placementTags: ['furniture', 'interior', 'counter-top'] },
    menu_board:           { fn: menuBoard,         category: 'furniture', partCount: 2, description: 'Wall-mounted menu board', footprintRadius: 3, preferredSpacing: 6, placementTags: ['furniture', 'interior', 'wall-mount'] },
    pendant_light:        { fn: pendantLight,      category: 'lighting',  partCount: 3, description: 'Hanging pendant light with warm glow', footprintRadius: 1, preferredSpacing: 5, placementTags: ['lighting', 'interior', 'ceiling'] },

    // Office
    office_desk:          { fn: officeDesk,        category: 'furniture', partCount: 7, description: 'Office desk with drawer unit and monitor', footprintRadius: 3, preferredSpacing: 6, placementTags: ['furniture', 'interior', 'grid'] },
    office_chair:         { fn: officeChair,       category: 'furniture', partCount: 7, description: 'Swivel office chair with armrests', footprintRadius: 1.5, preferredSpacing: 3, placementTags: ['furniture', 'interior', 'paired'] },
    bookshelf:            { fn: bookshelf,         category: 'furniture', partCount: 8, description: 'Tall bookshelf with 4 shelves and books', footprintRadius: 2, preferredSpacing: 4, placementTags: ['furniture', 'interior', 'wall-flush'] },
    filing_cabinet:       { fn: filingCabinet,     category: 'furniture', partCount: 3, description: 'Metal 2-drawer filing cabinet', footprintRadius: 1, preferredSpacing: 2.5, placementTags: ['furniture', 'interior', 'wall-flush'] },
    glass_partition:      { fn: glassPartition,    category: 'architecture', partCount: 5, description: 'Floor-to-ceiling glass partition with metal frame', footprintRadius: 4, preferredSpacing: 8, placementTags: ['architecture', 'interior', 'divider'] },
    reception_desk:       { fn: receptionDesk,     category: 'furniture', partCount: 3, description: 'Large reception desk with marble top', footprintRadius: 4, preferredSpacing: 10, placementTags: ['furniture', 'interior', 'grid'] },
    overhead_light_panel: { fn: overheadLightPanel, category: 'lighting', partCount: 2, description: 'Flat ceiling light panel', footprintRadius: 2, preferredSpacing: 6, placementTags: ['lighting', 'interior', 'ceiling'] },

    // Kitchen / Utility
    kitchen_counter:      { fn: kitchenCounter,    category: 'furniture', partCount: 3, description: 'Kitchen counter with backsplash', footprintRadius: 3, preferredSpacing: 6, placementTags: ['furniture', 'interior', 'wall-flush'] },
    sink_unit:            { fn: sinkUnit,          category: 'furniture', partCount: 3, description: 'Sink unit with faucet', footprintRadius: 2, preferredSpacing: 4, placementTags: ['furniture', 'interior', 'wall-flush'] },
    shelving_unit:        { fn: shelvingUnit,      category: 'furniture', partCount: 6, description: 'Open metal shelving unit with 4 shelves', footprintRadius: 2, preferredSpacing: 4, placementTags: ['furniture', 'interior', 'wall-flush'] },
    refrigerator:         { fn: refrigerator,      category: 'furniture', partCount: 3, description: 'Tall stainless steel refrigerator', footprintRadius: 2, preferredSpacing: 4, placementTags: ['furniture', 'interior', 'wall-flush'] },

    // Common Interior
    sofa_modern:          { fn: sofaModern,        category: 'furniture', partCount: 5, description: 'Modern 3-seat sofa with fabric upholstery', footprintRadius: 3, preferredSpacing: 7, placementTags: ['furniture', 'interior', 'grid'] },
    coffee_table:         { fn: coffeeTable,       category: 'furniture', partCount: 5, description: 'Low coffee table with metal legs', footprintRadius: 2, preferredSpacing: 3, placementTags: ['furniture', 'interior', 'paired'] },
    planter_indoor:       { fn: planterIndoor,     category: 'nature',    partCount: 3, description: 'Decorative indoor plant in pot', footprintRadius: 1, preferredSpacing: 4, placementTags: ['nature', 'interior', 'accent'] },
    coat_rack:            { fn: coatRack,          category: 'furniture', partCount: 6, description: 'Standing wooden coat rack', footprintRadius: 1, preferredSpacing: 3, placementTags: ['furniture', 'interior', 'accent'] },
    trash_bin:            { fn: trashBin,          category: 'furniture', partCount: 2, description: 'Small metal trash bin', footprintRadius: 1, preferredSpacing: 5, placementTags: ['furniture', 'interior', 'accent'] },
    wall_art:             { fn: wallArt,           category: 'furniture', partCount: 2, description: 'Framed wall art', footprintRadius: 2, preferredSpacing: 5, placementTags: ['furniture', 'interior', 'wall-mount'] },

    // Exterior
    sidewalk_segment:     { fn: sidewalkSegment,   category: 'path',     partCount: 1, description: 'Concrete sidewalk strip', footprintRadius: 3, preferredSpacing: 4, placementTags: ['path', 'exterior', 'linear'] },
    crosswalk:            { fn: crosswalk,         category: 'path',     partCount: 5, description: 'Road crossing with white stripes', footprintRadius: 4, preferredSpacing: 12, placementTags: ['path', 'exterior', 'road'] },
    bus_stop:             { fn: busStop,           category: 'architecture', partCount: 5, description: 'Bus stop shelter with bench', footprintRadius: 4, preferredSpacing: 20, placementTags: ['architecture', 'exterior', 'pathside'] },
    fire_hydrant:         { fn: fireHydrant,       category: 'nature',   partCount: 3, description: 'Red fire hydrant', footprintRadius: 1, preferredSpacing: 10, placementTags: ['nature', 'exterior', 'pathside'] },
    mailbox:              { fn: mailbox,           category: 'architecture', partCount: 2, description: 'Standing blue mailbox', footprintRadius: 1, preferredSpacing: 12, placementTags: ['architecture', 'exterior', 'pathside'] },
    traffic_light:        { fn: trafficLight,      category: 'architecture', partCount: 7, description: 'Traffic light with pole and arm', footprintRadius: 2, preferredSpacing: 20, placementTags: ['architecture', 'exterior', 'road'] },
    curb_planter:         { fn: curbPlanter,       category: 'nature',   partCount: 3, description: 'Sidewalk planter box with shrubs', footprintRadius: 2, preferredSpacing: 8, placementTags: ['nature', 'exterior', 'pathside'] },
};

module.exports = {
    EXTENDED_TEMPLATE_REGISTRY,
    // Individual exports for direct use
    caféTableRound, caféTableSquare, caféChair, barStool, counterLong,
    espressoMachine, menuBoard, pendantLight,
    officeDesk, officeChair, bookshelf, filingCabinet, glassPartition,
    receptionDesk, overheadLightPanel,
    kitchenCounter, sinkUnit, shelvingUnit, refrigerator,
    sofaModern, coffeeTable, planterIndoor, coatRack, trashBin, wallArt,
    sidewalkSegment, crosswalk, busStop, fireHydrant, mailbox, trafficLight, curbPlanter,
};
