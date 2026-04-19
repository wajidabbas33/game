// ============================================================
//  Roblox AI Plugin – House Generator
//
//  Procedural residential house generator for town/neighborhood
//  exterior scenes. Produces cottage, log cabin, modern house
//  and commercial storefront styles with sloped WedgePart roofs,
//  glowing windows, chimneys, porches, and gardens.
//
//  Usage:
//    const { generateCottage, generateTownPlot } = require('./house-generator');
//    const result = generateCottage({ x:0, z:0, groundLevel:0 });
// ============================================================

'use strict';

let _hid = Math.floor(Math.random() * 10000);
function hid() { return ++_hid; }

// ── Helper: Part instance ────────────────────────────────────
function part(parent, name, size, pos, color, mat, extras) {
    return {
        className: 'Part',
        parent,
        properties: {
            Name: name,
            Size: size,
            Position: pos,
            Color: color,
            Anchored: true,
            Material: mat || 'SmoothPlastic',
            ...extras,
        },
    };
}
function wedge(parent, name, size, pos, color, mat, extras) {
    return {
        className: 'WedgePart',
        parent,
        properties: {
            Name: name,
            Size: size,
            Position: pos,
            Color: color,
            Anchored: true,
            Material: mat || 'SmoothPlastic',
            ...extras,
        },
    };
}
function model(parent, name) {
    return { className: 'Model', parent, properties: { Name: name } };
}

// ── Roof styles ───────────────────────────────────────────────
const ROOF_COLORS = {
    red:    [160, 45, 35],
    blue:   [45, 100, 170],
    brown:  [95, 60, 30],
    green:  [40, 100, 50],
    grey:   [100, 98, 95],
    orange: [200, 100, 35],
    dark:   [45, 42, 40],
};

const WALL_COLORS = {
    white:   [240, 238, 234],
    cream:   [230, 218, 195],
    log:     [140, 90, 50],
    brick:   [165, 90, 55],
    grey:    [190, 188, 185],
    blue:    [160, 180, 200],
    yellow:  [220, 200, 140],
};

/**
 * Generate a sloped gable roof (two WedgeParts mirrored).
 * @param {string} mName - parent model name
 * @param {number} cx, cz - center x/z
 * @param {number} roofY - Y of roof base (top of walls)
 * @param {number} width - building width
 * @param {number} depth - building depth
 * @param {number} ridgeH - height of roof ridge
 * @param {number[]} color - RGB color
 * @param {string} mat - material
 * @returns {object[]} instances
 */
function gableRoof(mName, cx, cz, roofY, width, depth, ridgeH, color, mat) {
    const instances = [];
    const hw = width / 2;
    // Left slope
    instances.push(wedge(mName, 'Roof_L',
        [hw + 0.6, ridgeH, depth + 0.6],
        [cx - hw / 2, roofY + ridgeH / 2, cz],
        color, mat || 'SmoothPlastic',
        { CFrame: { position: [cx - hw / 2, roofY + ridgeH / 2, cz], rotation: [0, 0, -90] } }
    ));
    // Right slope (mirror)
    instances.push(wedge(mName, 'Roof_R',
        [hw + 0.6, ridgeH, depth + 0.6],
        [cx + hw / 2, roofY + ridgeH / 2, cz],
        color, mat || 'SmoothPlastic',
        { CFrame: { position: [cx + hw / 2, roofY + ridgeH / 2, cz], rotation: [0, 0, 90] } }
    ));
    // Ridge cap
    instances.push(part(mName, 'RidgeCap',
        [0.4, 0.3, depth + 0.8],
        [cx, roofY + ridgeH - 0.15, cz],
        [color[0] - 20, color[1] - 10, color[2] - 5], mat || 'SmoothPlastic'));
    return instances;
}

/**
 * Generate a glowing window (wall opening + neon glow inside).
 */
function houseWindow(mName, cx, cy, cz, w, h, facing, wallColor) {
    const inst = [];
    const depth = 0.4;
    const frame = [wallColor[0] - 20, wallColor[1] - 20, wallColor[2] - 20];
    // Frame
    const isZ = (facing === 'front' || facing === 'back');
    const frameSize = isZ ? [w + 0.3, h + 0.3, depth] : [depth, h + 0.3, w + 0.3];
    inst.push(part(mName, 'WinFrame',
        frameSize,
        [cx, cy, cz],
        frame, 'Wood'));
    // Glass pane
    const glassSize = isZ ? [w, h, depth * 0.4] : [depth * 0.4, h, w];
    inst.push(part(mName, 'WinGlass',
        glassSize,
        [cx, cy, cz],
        [200, 220, 255], 'Glass',
        { Transparency: 0.3 }));
    // Interior glow (neon yellow light inside)
    const glowSize = isZ ? [w * 0.8, h * 0.8, 0.1] : [0.1, h * 0.8, w * 0.8];
    inst.push(part(mName, 'WinGlow',
        glowSize,
        [cx, cy, cz],
        [255, 230, 120], 'Neon',
        { Transparency: 0.1 }));
    return inst;
}

// ── Cottage ───────────────────────────────────────────────────
function generateCottage(options) {
    const {
        x = 0, z = 0,
        groundLevel = 0,
        width = 18 + Math.random() * 6,
        depth = 14 + Math.random() * 4,
        wallHeight = 8 + Math.random() * 1,
        roofColor = ROOF_COLORS[Object.keys(ROOF_COLORS)[Math.floor(Math.random() * Object.keys(ROOF_COLORS).length)]],
        wallColor = WALL_COLORS[Object.keys(WALL_COLORS)[Math.floor(Math.random() * Object.keys(WALL_COLORS).length)]],
        storeName,
    } = options || {};

    const id = hid();
    const mName = `Cottage_${id}`;
    const instances = [model('Workspace', mName)];
    const roofH = width * 0.38;
    const topWall = groundLevel + wallHeight;

    // Foundation
    instances.push(part(mName, 'Foundation',
        [width + 0.8, 0.6, depth + 0.8],
        [x, groundLevel + 0.3, z],
        [180, 175, 168], 'Concrete'));

    // Walls (4 sides)
    // Front wall
    instances.push(part(mName, 'Wall_Front',
        [width, wallHeight, 0.6],
        [x, groundLevel + wallHeight / 2, z + depth / 2],
        wallColor, 'Brick'));
    // Back wall
    instances.push(part(mName, 'Wall_Back',
        [width, wallHeight, 0.6],
        [x, groundLevel + wallHeight / 2, z - depth / 2],
        wallColor, 'Brick'));
    // Left wall
    instances.push(part(mName, 'Wall_Left',
        [0.6, wallHeight, depth],
        [x - width / 2, groundLevel + wallHeight / 2, z],
        wallColor, 'Brick'));
    // Right wall
    instances.push(part(mName, 'Wall_Right',
        [0.6, wallHeight, depth],
        [x + width / 2, groundLevel + wallHeight / 2, z],
        wallColor, 'Brick'));
    // Floor
    instances.push(part(mName, 'Floor',
        [width, 0.4, depth],
        [x, groundLevel + 0.2, z],
        [200, 190, 175], 'WoodPlanks'));

    // Roof
    instances.push(...gableRoof(mName, x, z, topWall, width, depth, roofH, roofColor, 'SmoothPlastic'));

    // Gable ends (triangular fill — approximate with wedge)
    instances.push(wedge(mName, 'Gable_Front',
        [width + 0.4, roofH, 0.6],
        [x, topWall + roofH / 2, z + depth / 2],
        wallColor, 'Brick'));
    instances.push(wedge(mName, 'Gable_Back',
        [width + 0.4, roofH, 0.6],
        [x, topWall + roofH / 2, z - depth / 2],
        wallColor, 'Brick',
        { CFrame: { position: [x, topWall + roofH / 2, z - depth / 2], rotation: [0, 180, 0] } }));

    // Chimney
    instances.push(part(mName, 'Chimney',
        [2, roofH * 1.2, 2],
        [x + width * 0.25, topWall + roofH * 0.7, z - depth * 0.2],
        [170, 90, 55], 'Brick'));
    instances.push(part(mName, 'Chimney_Cap',
        [2.5, 0.4, 2.5],
        [x + width * 0.25, topWall + roofH * 1.25, z - depth * 0.2],
        [100, 95, 90], 'Concrete'));

    // Door
    instances.push(part(mName, 'Door',
        [3.5, 5.5, 0.5],
        [x, groundLevel + 2.75, z + depth / 2 + 0.1],
        [120, 70, 30], 'Wood'));
    // Door frame
    instances.push(part(mName, 'DoorFrame',
        [4.2, 0.4, 0.6],
        [x, groundLevel + 5.6, z + depth / 2 + 0.1],
        [200, 190, 180], 'SmoothPlastic'));

    // Front porch/stoop
    instances.push(part(mName, 'Stoop',
        [6, 0.4, 3],
        [x, groundLevel + 0.2, z + depth / 2 + 1.5],
        [190, 185, 175], 'Concrete'));

    // Windows (front ×2, sides ×1 each)
    instances.push(...houseWindow(mName, x - width * 0.28, groundLevel + wallHeight * 0.55, z + depth / 2, 3.5, 3.5, 'front', wallColor));
    instances.push(...houseWindow(mName, x + width * 0.28, groundLevel + wallHeight * 0.55, z + depth / 2, 3.5, 3.5, 'front', wallColor));
    instances.push(...houseWindow(mName, x - width / 2, groundLevel + wallHeight * 0.55, z, 3, 3, 'left', wallColor));
    instances.push(...houseWindow(mName, x + width / 2, groundLevel + wallHeight * 0.55, z, 3, 3, 'right', wallColor));

    return { instances };
}

// ── Log Cabin ─────────────────────────────────────────────────
function generateLogCabin(options) {
    const {
        x = 0, z = 0,
        groundLevel = 0,
        width = 20 + Math.random() * 4,
        depth = 16 + Math.random() * 4,
        wallHeight = 9,
        roofColor = ROOF_COLORS.brown,
    } = options || {};

    const id = hid();
    const mName = `LogCabin_${id}`;
    const instances = [model('Workspace', mName)];
    const roofH = width * 0.35;
    const topWall = groundLevel + wallHeight;
    const logColor = [140, 90, 50];
    const darkLog = [110, 70, 38];

    // Log layers (each wall is stacked 0.8-stud log strips)
    const logCount = Math.floor(wallHeight / 1.1);
    for (let i = 0; i < logCount; i++) {
        const ly = groundLevel + 0.55 + i * 1.1;
        const col = i % 2 === 0 ? logColor : darkLog;
        instances.push(part(mName, `LogFront_${i}`, [width + 1, 1, 0.8], [x, ly, z + depth / 2], col, 'Wood'));
        instances.push(part(mName, `LogBack_${i}`, [width + 1, 1, 0.8], [x, ly, z - depth / 2], col, 'Wood'));
        instances.push(part(mName, `LogLeft_${i}`, [0.8, 1, depth - 0.8], [x - width / 2, ly, z], col, 'Wood'));
        instances.push(part(mName, `LogRight_${i}`, [0.8, 1, depth - 0.8], [x + width / 2, ly, z], col, 'Wood'));
    }
    // Floor
    instances.push(part(mName, 'Floor', [width, 0.4, depth], [x, groundLevel + 0.2, z], [160, 110, 60], 'WoodPlanks'));

    // Roof
    instances.push(...gableRoof(mName, x, z, topWall, width, depth, roofH, roofColor, 'SmoothPlastic'));

    // Wide porch on front
    instances.push(part(mName, 'Porch_Floor',
        [width + 2, 0.4, 5],
        [x, groundLevel + 0.2, z + depth / 2 + 2.5],
        logColor, 'Wood'));
    // Porch posts
    for (let p = 0; p < 3; p++) {
        const px = x - width / 2 + p * (width / 2 + 0.5);
        instances.push(part(mName, `PorchPost_${p}`,
            [0.6, wallHeight * 0.6, 0.6],
            [px, groundLevel + wallHeight * 0.3, z + depth / 2 + 4.5],
            darkLog, 'Wood'));
    }
    // Porch roof
    instances.push(part(mName, 'PorchRoof',
        [width + 2.4, 0.3, 5.5],
        [x, groundLevel + wallHeight * 0.62, z + depth / 2 + 2.5],
        roofColor, 'SmoothPlastic'));

    // Door
    instances.push(part(mName, 'Door', [3.5, 6, 0.5],
        [x, groundLevel + 3, z + depth / 2 + 0.2],
        [90, 55, 25], 'Wood'));

    // Windows
    instances.push(...houseWindow(mName, x - width * 0.28, groundLevel + wallHeight * 0.55, z + depth / 2, 3, 3, 'front', logColor));
    instances.push(...houseWindow(mName, x + width * 0.28, groundLevel + wallHeight * 0.55, z + depth / 2, 3, 3, 'front', logColor));
    instances.push(...houseWindow(mName, x, groundLevel + wallHeight * 0.55, z - depth / 2, 3.5, 3, 'back', logColor));

    // Chimney
    instances.push(part(mName, 'Chimney', [2.2, roofH * 1.3, 2.2],
        [x - width * 0.3, topWall + roofH * 0.65, z],
        [160, 90, 50], 'Brick'));

    return { instances };
}

// ── Modern House ─────────────────────────────────────────────
function generateModernHouse(options) {
    const {
        x = 0, z = 0,
        groundLevel = 0,
        width = 22 + Math.random() * 6,
        depth = 16 + Math.random() * 4,
        wallHeight = 10,
        wallColor = WALL_COLORS.grey,
        roofColor = ROOF_COLORS.dark,
    } = options || {};

    const id = hid();
    const mName = `ModernHouse_${id}`;
    const instances = [model('Workspace', mName)];
    const topWall = groundLevel + wallHeight;

    // Main body
    instances.push(part(mName, 'Wall_Front', [width, wallHeight, 0.5], [x, groundLevel + wallHeight / 2, z + depth / 2], wallColor, 'SmoothPlastic'));
    instances.push(part(mName, 'Wall_Back', [width, wallHeight, 0.5], [x, groundLevel + wallHeight / 2, z - depth / 2], wallColor, 'SmoothPlastic'));
    instances.push(part(mName, 'Wall_Left', [0.5, wallHeight, depth], [x - width / 2, groundLevel + wallHeight / 2, z], wallColor, 'SmoothPlastic'));
    instances.push(part(mName, 'Wall_Right', [0.5, wallHeight, depth], [x + width / 2, groundLevel + wallHeight / 2, z], wallColor, 'SmoothPlastic'));
    instances.push(part(mName, 'Floor', [width, 0.4, depth], [x, groundLevel + 0.2, z], [210, 205, 198], 'Concrete'));

    // Flat roof with slight edge
    instances.push(part(mName, 'Roof', [width + 1, 0.5, depth + 1], [x, topWall + 0.25, z], roofColor, 'Concrete'));
    // Parapet edge strips
    instances.push(part(mName, 'Parapet_F', [width + 1, 1, 0.3], [x, topWall + 0.75, z + depth / 2 + 0.35], roofColor, 'Concrete'));
    instances.push(part(mName, 'Parapet_B', [width + 1, 1, 0.3], [x, topWall + 0.75, z - depth / 2 - 0.35], roofColor, 'Concrete'));

    // Large front window (floor-to-ceiling)
    instances.push(...houseWindow(mName, x - width * 0.2, groundLevel + wallHeight * 0.55, z + depth / 2, 7, wallHeight * 0.75, 'front', wallColor));

    // Garage door
    instances.push(part(mName, 'GarageDoor', [7, 6, 0.3],
        [x + width * 0.25, groundLevel + 3, z + depth / 2 + 0.1],
        [80, 80, 82], 'Metal'));
    // Garage door panels
    for (let p = 0; p < 3; p++) {
        instances.push(part(mName, `GarPanel_${p}`,
            [6.8, 0.1, 0.25],
            [x + width * 0.25, groundLevel + 2 + p * 2, z + depth / 2 + 0.2],
            [90, 90, 92], 'Metal'));
    }

    // Front door
    instances.push(part(mName, 'Door', [2.5, 6, 0.4],
        [x - width * 0.05, groundLevel + 3, z + depth / 2 + 0.1],
        [50, 50, 55], 'SmoothPlastic'));

    // Side windows
    instances.push(...houseWindow(mName, x - width / 2, groundLevel + wallHeight * 0.55, z - depth * 0.2, 3, 3, 'left', wallColor));
    instances.push(...houseWindow(mName, x - width / 2, groundLevel + wallHeight * 0.55, z + depth * 0.2, 3, 3, 'left', wallColor));

    // Entry overhang
    instances.push(part(mName, 'Overhang', [5, 0.3, 3],
        [x - width * 0.05, groundLevel + wallHeight * 0.75, z + depth / 2 + 1.5],
        roofColor, 'Concrete'));

    return { instances };
}

// ── Residential Plot ─────────────────────────────────────────
function generateResidentialPlot(options) {
    const {
        x = 0, z = 0,
        groundLevel = 0,
        houseType = null, // null = random
        plotSize = 32,
    } = options || {};

    const types = ['cottage', 'log_cabin', 'modern'];
    const chosen = houseType || types[Math.floor(Math.random() * types.length)];
    let house;
    if (chosen === 'cottage') house = generateCottage({ x, z, groundLevel });
    else if (chosen === 'log_cabin') house = generateLogCabin({ x, z, groundLevel });
    else house = generateModernHouse({ x, z, groundLevel });

    return { instances: house.instances, houseType: chosen };
}

// ── Town layout helper ────────────────────────────────────────
/**
 * Generate a set of residential plots arranged around a road loop.
 * @param {object} options
 */
function generateHouseBlock(options) {
    const {
        centerX = 0,
        centerZ = 0,
        groundLevel = 0,
        count = 6,
        radius = 45,
    } = options || {};

    const instances = [];
    const houseTypes = ['cottage', 'log_cabin', 'modern', 'cottage', 'cottage', 'log_cabin'];

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const hx = centerX + Math.cos(angle) * radius;
        const hz = centerZ + Math.sin(angle) * radius;
        const plot = generateResidentialPlot({
            x: hx, z: hz, groundLevel,
            houseType: houseTypes[i % houseTypes.length],
            plotSize: 32,
        });
        instances.push(...plot.instances);
    }
    return { instances };
}

module.exports = {
    generateCottage,
    generateLogCabin,
    generateModernHouse,
    generateResidentialPlot,
    generateHouseBlock,
    gableRoof,
    houseWindow,
    ROOF_COLORS,
    WALL_COLORS,
};
