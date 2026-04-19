// ============================================================
//  Roblox AI Plugin – World Generator  (v2 — Full Society)
//
//  Always generates a complete society with 5 distinct zones:
//    • Residential zone   — cottages, log cabins, modern homes
//    • Commercial zone    — shops, restaurants, offices
//    • Civic zone         — police station, school, hospital/clinic
//    • Park & recreation  — fountain, playground, trees, benches
//    • Mixed/road infra   — full 3×3 block grid, lamp posts, signs
//
//  Entry point:
//    const { generateSociety } = require('./world-generator');
//    const { instances, terrain } = generateSociety({ size: 280 });
// ============================================================

'use strict';

const { generateCottage, generateLogCabin, generateModernHouse } = require('./house-generator');
const { generateBuilding } = require('./building-generator');

let _w = Math.floor(Math.random() * 10000);
function wid() { return ++_w; }

// ── Primitive helpers ─────────────────────────────────────────
function p(parent, name, size, pos, color, mat, extras) {
    return {
        className: 'Part', parent,
        properties: { Name: name, Size: size, Position: pos, Color: color, Anchored: true, Material: mat || 'SmoothPlastic', ...extras },
    };
}
function wp(parent, name, size, pos, color, mat, extras) {
    return {
        className: 'WedgePart', parent,
        properties: { Name: name, Size: size, Position: pos, Color: color, Anchored: true, Material: mat || 'SmoothPlastic', ...extras },
    };
}
function m(parent, name) { return { className: 'Model', parent, properties: { Name: name } }; }
function surfaceGui(parent, text, textColor, bgColor) {
    return [
        { className: 'SurfaceGui', parent, properties: { Name: 'Gui', Face: 'Front', SizingMode: 'FixedSize', CanvasSize: [600, 120] } },
        { className: 'TextLabel', parent: 'Gui', properties: {
            Name: 'Lbl', Text: text, TextColor3: textColor || [255, 255, 255],
            BackgroundColor3: bgColor || [20, 20, 25], BackgroundTransparency: 0.1,
            Size: { XScale: 1, YScale: 1, XOffset: 0, YOffset: 0 },
            Position: { XScale: 0, YScale: 0, XOffset: 0, YOffset: 0 },
            TextScaled: true, Font: 'GothamBold',
        }},
    ];
}

// ═══════════════════════════════════════════════════════════
// ROAD SYSTEM — 3×3 block grid
// ═══════════════════════════════════════════════════════════

const ROAD_W = 14;       // road width (studs)
const BLOCK_SIZE = 80;   // city block size between roads
const SIDEWALK_W = 5;    // sidewalk width each side

/**
 * One straight road segment with asphalt, sidewalks, curbs, markings.
 */
function roadSegment(x, z, length, axis, gl) {
    const id = wid();
    const mn = `Road_${id}`;
    const inst = [m('Workspace', mn)];
    const roadColor = [42, 42, 46];
    const swColor   = [186, 183, 179];
    const curbColor = [170, 167, 163];
    const rw = ROAD_W, sw = SIDEWALK_W;

    const rs = axis === 'x' ? [length, 0.3, rw] : [rw, 0.3, length];
    inst.push(p(mn, 'Road', rs, [x, gl + 0.15, z], roadColor, 'Asphalt'));

    // Sidewalks
    const swSz  = axis === 'x' ? [length, 0.35, sw] : [sw, 0.35, length];
    const swOff = rw / 2 + sw / 2;
    const swA   = axis === 'x' ? [x, gl + 0.175, z - swOff] : [x - swOff, gl + 0.175, z];
    const swB   = axis === 'x' ? [x, gl + 0.175, z + swOff] : [x + swOff, gl + 0.175, z];
    inst.push(p(mn, 'SW_A', swSz, swA, swColor, 'Concrete'));
    inst.push(p(mn, 'SW_B', swSz, swB, swColor, 'Concrete'));

    // Curbs
    const cSz  = axis === 'x' ? [length, 0.4, 0.3] : [0.3, 0.4, length];
    const cOff = rw / 2 + 0.15;
    inst.push(p(mn, 'Curb_A', cSz, axis === 'x' ? [x, gl + 0.2, z - cOff] : [x - cOff, gl + 0.2, z], curbColor, 'Concrete'));
    inst.push(p(mn, 'Curb_B', cSz, axis === 'x' ? [x, gl + 0.2, z + cOff] : [x + cOff, gl + 0.2, z], curbColor, 'Concrete'));

    // Yellow center double line
    const dashCount = Math.floor(length / 6);
    for (let d = 0; d < dashCount; d++) {
        const off = -length / 2 + d * 6 + 2;
        const dsz = axis === 'x' ? [2.5, 0.05, 0.22] : [0.22, 0.05, 2.5];
        const pA = axis === 'x' ? [x + off, gl + 0.31, z - 0.28] : [x - 0.28, gl + 0.31, z + off];
        const pB = axis === 'x' ? [x + off, gl + 0.31, z + 0.28] : [x + 0.28, gl + 0.31, z + off];
        inst.push(p(mn, `YA_${d}`, dsz, pA, [238, 198, 18], 'SmoothPlastic'));
        inst.push(p(mn, `YB_${d}`, dsz, pB, [238, 198, 18], 'SmoothPlastic'));
    }
    // White edge lines
    const eSz = axis === 'x' ? [length, 0.04, 0.18] : [0.18, 0.04, length];
    const eOff = rw / 2 - 0.8;
    inst.push(p(mn, 'Edge_A', eSz, axis === 'x' ? [x, gl + 0.31, z - eOff] : [x - eOff, gl + 0.31, z], [255, 255, 255], 'SmoothPlastic'));
    inst.push(p(mn, 'Edge_B', eSz, axis === 'x' ? [x, gl + 0.31, z + eOff] : [x + eOff, gl + 0.31, z], [255, 255, 255], 'SmoothPlastic'));

    return inst;
}

/**
 * 4-way intersection with crosswalk stripes.
 */
function intersection(x, z, gl) {
    const id = wid();
    const mn = `Inter_${id}`;
    const inst = [m('Workspace', mn)];
    const s = ROAD_W + 1;
    inst.push(p(mn, 'Base', [s, 0.3, s], [x, gl + 0.15, z], [42, 42, 46], 'Asphalt'));
    // Crosswalks (5 stripes each direction)
    const sw = 1.3, sd = ROAD_W * 0.38;
    for (let i = 0; i < 5; i++) {
        const o = -sd / 2 + i * (sd / 4);
        inst.push(p(mn, `CW_N_${i}`, [sw, 0.04, sd], [x + o * 0.65, gl + 0.32, z - s / 2], [240, 238, 235], 'SmoothPlastic'));
        inst.push(p(mn, `CW_S_${i}`, [sw, 0.04, sd], [x + o * 0.65, gl + 0.32, z + s / 2], [240, 238, 235], 'SmoothPlastic'));
        inst.push(p(mn, `CW_W_${i}`, [sd, 0.04, sw], [x - s / 2, gl + 0.32, z + o * 0.65], [240, 238, 235], 'SmoothPlastic'));
        inst.push(p(mn, `CW_E_${i}`, [sd, 0.04, sw], [x + s / 2, gl + 0.32, z + o * 0.65], [240, 238, 235], 'SmoothPlastic'));
    }
    return inst;
}

/**
 * Generate a 3×3 block city grid (4 columns × 4 rows of roads).
 * Block positions returned for placing buildings/zones.
 */
function generateCityGrid(options) {
    const { centerX = 0, centerZ = 0, gl = 0 } = options || {};
    const inst = [];
    const stride = BLOCK_SIZE + ROAD_W; // center-to-center road spacing
    // Grid lines: 4×4 roads, crossing at 4×4 = 16 intersections
    // Roads along X axis (rows): z = -1.5, -0.5, +0.5, +1.5 × stride
    // Roads along Z axis (cols): x = -1.5, -0.5, +0.5, +1.5 × stride
    const offsets = [-1.5, -0.5, 0.5, 1.5];
    const roadLen = stride * 3 + ROAD_W * 1.2; // spans 3 blocks

    for (const zo of offsets) {
        const rz = centerZ + zo * stride;
        inst.push(...roadSegment(centerX, rz, roadLen, 'x', gl));
    }
    for (const xo of offsets) {
        const rx = centerX + xo * stride;
        inst.push(...roadSegment(rx, centerZ, roadLen, 'z', gl));
    }
    // Intersections at every crossing
    for (const xo of offsets) {
        for (const zo of offsets) {
            inst.push(...intersection(centerX + xo * stride, centerZ + zo * stride, gl));
        }
    }

    // Compute 3×3 block centers (the land plots between roads)
    const blockOffsets = [-1, 0, 1]; // 3 blocks per axis
    const blocks = [];
    for (const bx of blockOffsets) {
        for (const bz of blockOffsets) {
            blocks.push({
                x: centerX + bx * stride,
                z: centerZ + bz * stride,
                size: BLOCK_SIZE,
            });
        }
    }

    return { inst, blocks };
}

// ═══════════════════════════════════════════════════════════
// VEGETATION
// ═══════════════════════════════════════════════════════════

function conePine(parent, x, z, gl, h, color) {
    const id = wid();
    const mn = `Pine_${id}`;
    const col = color || [48, 118, 42];
    const trunk = [98, 62, 28];
    const inst = [m(parent, mn)];
    inst.push(p(mn, 'Trunk', [h * 0.11, h * 0.33, h * 0.11], [x, gl + h * 0.165, z], trunk, 'Wood'));
    const tiers = [
        { r: h * 0.38, h: h * 0.44, y: h * 0.40 },
        { r: h * 0.25, h: h * 0.34, y: h * 0.62 },
        { r: h * 0.14, h: h * 0.25, y: h * 0.82 },
    ];
    for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        for (let q = 0; q < 4; q++) {
            inst.push(wp(mn, `C_${i}_${q}`, [t.r * 2, t.h, t.r * 2], [x, gl + t.y, z], col, 'Grass',
                { CFrame: { position: [x, gl + t.y, z], rotation: [0, q * 90, 0] } }));
        }
    }
    return inst;
}

function treeLine(x, z, length, axis, count, gl) {
    const inst = [];
    for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const tx = axis === 'x' ? x - length / 2 + t * length : x;
        const tz = axis === 'z' ? z - length / 2 + t * length : z;
        const h = 9 + Math.random() * 6;
        inst.push(...conePine('Workspace', tx, tz, gl, h));
    }
    return inst;
}

function treeCluster(x, z, count, radius, gl) {
    const inst = [];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * radius;
        const h = 8 + Math.random() * 8;
        inst.push(...conePine('Workspace', x + Math.cos(a) * d, z + Math.sin(a) * d, gl, h));
    }
    return inst;
}

// ═══════════════════════════════════════════════════════════
// STREET FURNITURE
// ═══════════════════════════════════════════════════════════

function lampPost(x, z, gl) {
    const id = wid();
    const mn = `Lamp_${id}`;
    const inst = [m('Workspace', mn)];
    inst.push(p(mn, 'Pole', [0.45, 14, 0.45], [x, gl + 7, z], [68, 68, 74], 'Metal'));
    inst.push(p(mn, 'Arm', [0.25, 0.25, 2.8], [x, gl + 13.4, z - 1.4], [68, 68, 74], 'Metal'));
    inst.push(p(mn, 'Head', [1.1, 1.6, 1.1], [x, gl + 12.4, z - 2.7], [58, 56, 54], 'Metal'));
    inst.push(p(mn, 'Bulb', [0.7, 0.7, 0.7], [x, gl + 11.9, z - 2.7], [255, 232, 175], 'Neon'));
    inst.push({ className: 'PointLight', parent: 'Bulb', properties: { Name: 'Glow', Brightness: 1.2, Range: 22, Color: [255, 228, 175] } });
    return inst;
}

function bench(x, z, gl) {
    const id = wid();
    const mn = `Bench_${id}`;
    const inst = [m('Workspace', mn)];
    inst.push(p(mn, 'Seat', [4.8, 0.28, 1.1], [x, gl + 1.8, z], [115, 78, 38], 'Wood'));
    inst.push(p(mn, 'Back', [4.8, 0.28, 0.95], [x, gl + 2.75, z - 0.42], [115, 78, 38], 'Wood'));
    inst.push(p(mn, 'LegL', [0.28, 1.8, 1.1], [x - 1.75, gl + 0.9, z], [65, 65, 70], 'Metal'));
    inst.push(p(mn, 'LegR', [0.28, 1.8, 1.1], [x + 1.75, gl + 0.9, z], [65, 65, 70], 'Metal'));
    inst.push(p(mn, 'BPL', [0.28, 2.7, 0.28], [x - 1.75, gl + 1.35, z - 0.42], [65, 65, 70], 'Metal'));
    inst.push(p(mn, 'BPR', [0.28, 2.7, 0.28], [x + 1.75, gl + 1.35, z - 0.42], [65, 65, 70], 'Metal'));
    return inst;
}

function trashCan(x, z, gl) {
    const id = wid();
    const mn = `Bin_${id}`;
    return [m('Workspace', mn),
        p(mn, 'Body', [1.7, 2.4, 1.7], [x, gl + 1.2, z], [68, 73, 68], 'Metal'),
        p(mn, 'Lid',  [1.9, 0.28, 1.9], [x, gl + 2.54, z], [58, 63, 58], 'Metal')];
}

function streetFurnitureRow(startX, startZ, endX, endZ, gl, spacing) {
    const inst = [];
    const len = Math.hypot(endX - startX, endZ - startZ);
    const count = Math.max(2, Math.floor(len / (spacing || 18)));
    for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const fx = startX + (endX - startX) * t;
        const fz = startZ + (endZ - startZ) * t;
        if (i % 2 === 0) inst.push(...lampPost(fx, fz, gl));
        else inst.push(...bench(fx, fz, gl));
        if (i % 3 === 0) inst.push(...trashCan(fx + 1.2, fz + 1.2, gl));
    }
    return inst;
}

// ═══════════════════════════════════════════════════════════
// CIVIC BUILDINGS
// ═══════════════════════════════════════════════════════════

function policeStation(x, z, gl) {
    const id = wid();
    const mn = `PoliceStation_${id}`;
    const inst = [m('Workspace', mn)];
    const w = 28, d = 20, h = 12;
    const blueGray = [45, 75, 120]; const white = [235, 235, 238];
    // Main body
    inst.push(p(mn, 'Body', [w, h, d], [x, gl + h / 2, z], white, 'SmoothPlastic'));
    // Blue stripe band
    inst.push(p(mn, 'Stripe', [w + 0.2, 2.5, d + 0.2], [x, gl + h * 0.55, z], blueGray, 'SmoothPlastic'));
    // Roof
    inst.push(p(mn, 'Roof', [w + 0.5, 0.6, d + 0.5], [x, gl + h + 0.3, z], [80, 82, 88], 'Concrete'));
    // Flag pole
    inst.push(p(mn, 'FlagPole', [0.3, 8, 0.3], [x - w * 0.35, gl + h + 0.6, z - d * 0.4], [200, 200, 205], 'Metal'));
    inst.push(p(mn, 'Flag', [4.5, 2.5, 0.1], [x - w * 0.35 + 2.25, gl + h + 7.5, z - d * 0.4], [35, 55, 140], 'SmoothPlastic'));
    // Police sign
    const signPart = p(mn, 'Sign', [14, 2, 0.25], [x, gl + h * 0.75, z - d / 2 - 0.15], blueGray, 'SmoothPlastic');
    inst.push(signPart);
    inst.push(...surfaceGui('Sign', 'POLICE STATION', [255, 255, 255], [35, 60, 110]));
    // Windows rows
    for (let i = 0; i < 4; i++) {
        const wx = x - w * 0.35 + i * (w * 0.22);
        inst.push(p(mn, `Win_${i}`, [3.5, 3.5, 0.3], [wx, gl + h * 0.35, z - d / 2 - 0.1], [160, 185, 210], 'Glass', { Transparency: 0.25 }));
        inst.push(p(mn, `Win2_${i}`, [3.5, 3.5, 0.3], [wx, gl + h * 0.72, z - d / 2 - 0.1], [160, 185, 210], 'Glass', { Transparency: 0.25 }));
    }
    // Main entrance
    inst.push(p(mn, 'Door', [5.5, 7, 0.35], [x, gl + 3.5, z - d / 2 - 0.15], [55, 80, 130], 'SmoothPlastic'));
    // Parked police car (simple block)
    inst.push(p(mn, 'PoliceCar', [7, 2.8, 3.5], [x + 8, gl + 1.4, z - d / 2 - 5], [235, 235, 238], 'SmoothPlastic'));
    inst.push(p(mn, 'CarTop', [4.5, 1.4, 3.2], [x + 8, gl + 3.5, z - d / 2 - 5], [235, 235, 238], 'SmoothPlastic'));
    inst.push(p(mn, 'LightBar', [4.2, 0.6, 0.8], [x + 8, gl + 4.35, z - d / 2 - 5], [20, 55, 180], 'Neon'));
    return inst;
}

function school(x, z, gl) {
    const id = wid();
    const mn = `School_${id}`;
    const inst = [m('Workspace', mn)];
    const w = 48, d = 24, h = 14;
    const brickRed = [165, 68, 45]; const cream = [235, 228, 210];
    // Main building
    inst.push(p(mn, 'Body', [w, h, d], [x, gl + h / 2, z], brickRed, 'Brick'));
    // Central entrance portico (protruding white section)
    inst.push(p(mn, 'Portico', [14, h + 2, d * 0.25], [x, gl + (h + 2) / 2, z - d / 2 - d * 0.12], cream, 'SmoothPlastic'));
    // Roof
    inst.push(p(mn, 'Roof', [w + 0.6, 0.7, d + 0.6], [x, gl + h + 0.35, z], [80, 50, 38], 'SmoothPlastic'));
    // School sign
    const signPart = p(mn, 'Sign', [12, 2.2, 0.25], [x, gl + h * 0.85, z - d / 2 - d * 0.24 - 0.15], [30, 80, 40], 'SmoothPlastic');
    inst.push(signPart);
    inst.push(...surfaceGui('Sign', 'SCHOOL', [255, 255, 255], [25, 75, 35]));
    // Windows grid (3 floors × 5 windows)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
            const wx = x - w * 0.4 + col * (w * 0.2);
            const wy = gl + 3 + row * 4.2;
            inst.push(p(mn, `Win_${row}_${col}`, [5, 3.5, 0.3], [wx, wy, z - d / 2 - 0.15], [190, 210, 225], 'Glass', { Transparency: 0.2 }));
        }
    }
    // Door
    inst.push(p(mn, 'Door', [6, 8, 0.35], [x, gl + 4, z - d / 2 - d * 0.24 - 0.18], [60, 90, 55], 'SmoothPlastic'));
    // Sports field (behind school)
    inst.push(p(mn, 'Field', [w * 1.3, 0.2, d * 1.2], [x, gl + 0.1, z + d * 0.9], [60, 145, 50], 'Grass'));
    // Field markings
    inst.push(p(mn, 'FieldLine1', [w * 1.25, 0.06, 0.3], [x, gl + 0.22, z + d * 0.9], [255, 255, 255], 'SmoothPlastic'));
    inst.push(p(mn, 'FieldLine2', [0.3, 0.06, d * 1.15], [x + w * 0.3, gl + 0.22, z + d * 0.9], [255, 255, 255], 'SmoothPlastic'));
    inst.push(p(mn, 'FieldLine3', [0.3, 0.06, d * 1.15], [x - w * 0.3, gl + 0.22, z + d * 0.9], [255, 255, 255], 'SmoothPlastic'));
    return inst;
}

function hospital(x, z, gl) {
    const id = wid();
    const mn = `Hospital_${id}`;
    const inst = [m('Workspace', mn)];
    const w = 36, d = 22, h = 16;
    const white = [240, 240, 242]; const redCross = [200, 35, 35];
    // Body (2 sections)
    inst.push(p(mn, 'Body', [w, h, d], [x, gl + h / 2, z], white, 'SmoothPlastic'));
    inst.push(p(mn, 'Wing', [w * 0.45, h * 0.65, d * 0.5], [x + w * 0.6, gl + h * 0.325, z], white, 'SmoothPlastic'));
    // Roof
    inst.push(p(mn, 'Roof', [w + 0.6, 0.6, d + 0.6], [x, gl + h + 0.3, z], [80, 82, 88], 'Concrete'));
    // Red cross sign on roof
    inst.push(p(mn, 'CrossH', [7, 0.5, 2], [x, gl + h + 0.9, z - d * 0.2], redCross, 'SmoothPlastic'));
    inst.push(p(mn, 'CrossV', [2, 0.5, 7], [x, gl + h + 0.9, z - d * 0.2], redCross, 'SmoothPlastic'));
    // Sign
    const signPart = p(mn, 'Sign', [14, 2.2, 0.25], [x, gl + h * 0.82, z - d / 2 - 0.15], [25, 90, 55], 'SmoothPlastic');
    inst.push(signPart);
    inst.push(...surfaceGui('Sign', 'HOSPITAL', [255, 255, 255], [20, 85, 50]));
    // Windows (4 rows × 4 cols)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const wx = x - w * 0.35 + col * (w * 0.22);
            const wy = gl + 2.5 + row * 3.8;
            inst.push(p(mn, `Win_${row}_${col}`, [4.5, 3.2, 0.3], [wx, wy, z - d / 2 - 0.15], [175, 210, 225], 'Glass', { Transparency: 0.2 }));
        }
    }
    // Ambulance bay door
    inst.push(p(mn, 'Bay', [8, 6, 0.4], [x, gl + 3, z - d / 2 - 0.2], [55, 55, 60], 'Metal'));
    inst.push(p(mn, 'Ambulance', [7.5, 3, 4], [x, gl + 1.5, z - d / 2 - 5.5], [240, 240, 242], 'SmoothPlastic'));
    inst.push(p(mn, 'AmbTop', [5, 1.5, 3.8], [x, gl + 4.25, z - d / 2 - 5.5], [240, 240, 242], 'SmoothPlastic'));
    inst.push(p(mn, 'AmbStripe', [7.6, 0.5, 0.3], [x, gl + 2.5, z - d / 2 - 5.5 + 1.85], redCross, 'SmoothPlastic'));
    return inst;
}

function fireStation(x, z, gl) {
    const id = wid();
    const mn = `FireStation_${id}`;
    const inst = [m('Workspace', mn)];
    const w = 30, d = 20, h = 13;
    const redBrick = [180, 50, 35]; const darkRed = [140, 38, 28];
    inst.push(p(mn, 'Body', [w, h, d], [x, gl + h / 2, z], redBrick, 'Brick'));
    inst.push(p(mn, 'Roof', [w + 0.5, 0.6, d + 0.5], [x, gl + h + 0.3, z], [60, 35, 25], 'SmoothPlastic'));
    // Big bay doors
    for (let i = 0; i < 3; i++) {
        const bx = x - w * 0.3 + i * (w * 0.3);
        inst.push(p(mn, `BayDoor_${i}`, [8, 9, 0.4], [bx, gl + 4.5, z - d / 2 - 0.2], [70, 70, 75], 'Metal'));
        // Door panels
        for (let j = 0; j < 3; j++) {
            inst.push(p(mn, `Panel_${i}_${j}`, [7.6, 0.12, 0.35], [bx, gl + 2 + j * 3, z - d / 2 - 0.22], [80, 80, 85], 'Metal'));
        }
    }
    // Sign
    const sg = p(mn, 'Sign', [14, 2, 0.25], [x, gl + h * 0.82, z - d / 2 - 0.15], darkRed, 'SmoothPlastic');
    inst.push(sg);
    inst.push(...surfaceGui('Sign', 'FIRE STATION', [255, 255, 255], [140, 38, 28]));
    // Fire truck (simple block + cab)
    inst.push(p(mn, 'Truck', [10, 2.8, 3.8], [x + 8, gl + 1.4, z + d * 0.3], [205, 42, 28], 'SmoothPlastic'));
    inst.push(p(mn, 'Cab', [3.5, 3.5, 3.5], [x + 8 + 3.5, gl + 3.25, z + d * 0.3], [205, 42, 28], 'SmoothPlastic'));
    inst.push(p(mn, 'Siren', [3.8, 0.55, 0.6], [x + 8, gl + 4.2, z + d * 0.3], [255, 40, 40], 'Neon'));
    return inst;
}

// ═══════════════════════════════════════════════════════════
// PARK
// ═══════════════════════════════════════════════════════════

function fountain(x, z, gl) {
    const id = wid();
    const mn = `Fountain_${id}`;
    const inst = [m('Workspace', mn)];
    const stone = [190, 188, 185]; const water = [80, 160, 220];
    // Basin
    inst.push(p(mn, 'Basin', [12, 0.8, 12], [x, gl + 0.4, z], stone, 'Concrete'));
    inst.push(p(mn, 'BasinWall', [12, 1.5, 0.5], [x, gl + 1.25, z - 5.8], stone, 'Concrete'));
    inst.push(p(mn, 'BasinWallB', [12, 1.5, 0.5], [x, gl + 1.25, z + 5.8], stone, 'Concrete'));
    inst.push(p(mn, 'BasinWallL', [0.5, 1.5, 12], [x - 5.8, gl + 1.25, z], stone, 'Concrete'));
    inst.push(p(mn, 'BasinWallR', [0.5, 1.5, 12], [x + 5.8, gl + 1.25, z], stone, 'Concrete'));
    // Water surface
    inst.push(p(mn, 'Water', [11, 0.25, 11], [x, gl + 1.6, z], water, 'SmoothPlastic', { Transparency: 0.35 }));
    // Center pedestal + spire
    inst.push(p(mn, 'Pedestal', [3, 2, 3], [x, gl + 2.8, z], stone, 'Marble'));
    inst.push(p(mn, 'Spire', [1.2, 5.5, 1.2], [x, gl + 6, z], stone, 'Marble'));
    inst.push(p(mn, 'SpireTop', [2.5, 0.6, 2.5], [x, gl + 8.85, z], stone, 'Marble'));
    // Water jet (Neon blue)
    inst.push(p(mn, 'Jet', [0.35, 4, 0.35], [x, gl + 6.5, z], [120, 180, 240], 'Neon', { Transparency: 0.2 }));
    return inst;
}

function playground(x, z, gl) {
    const id = wid();
    const mn = `Playground_${id}`;
    const inst = [m('Workspace', mn)];
    // Rubber floor
    inst.push(p(mn, 'Floor', [30, 0.3, 30], [x, gl + 0.15, z], [180, 80, 45], 'SmoothPlastic'));
    // Slide
    inst.push(p(mn, 'Tower', [4, 8, 4], [x - 8, gl + 4, z], [50, 120, 200], 'SmoothPlastic'));
    inst.push(wp(mn, 'Slide', [3.5, 5, 10], [x - 4, gl + 2.5, z + 3], [255, 180, 40], 'SmoothPlastic'));
    // Swings beam
    inst.push(p(mn, 'SwingBeam', [12, 0.5, 0.5], [x + 5, gl + 7, z], [120, 80, 40], 'Wood'));
    inst.push(p(mn, 'SwingPost1', [0.5, 7, 0.5], [x - 1, gl + 3.5, z], [120, 80, 40], 'Wood'));
    inst.push(p(mn, 'SwingPost2', [0.5, 7, 0.5], [x + 11, gl + 3.5, z], [120, 80, 40], 'Wood'));
    // Swing seats
    for (let i = 0; i < 3; i++) {
        inst.push(p(mn, `Swing_${i}`, [2, 0.3, 1], [x + 2 + i * 3.5, gl + 3.5, z], [80, 55, 30], 'Wood'));
        inst.push(p(mn, `Chain_L_${i}`, [0.15, 3.5, 0.15], [x + 1.1 + i * 3.5, gl + 5.2, z], [80, 80, 85], 'Metal'));
        inst.push(p(mn, `Chain_R_${i}`, [0.15, 3.5, 0.15], [x + 2.9 + i * 3.5, gl + 5.2, z], [80, 80, 85], 'Metal'));
    }
    // Climbing frame
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            inst.push(p(mn, `Frame_${i}_${j}`, [0.3, 6, 0.3], [x - 6 + i * 2, gl + 3, z + 8 + j * 2], [60, 150, 60], 'Metal'));
        }
    }
    inst.push(p(mn, 'FrameTop', [6, 0.3, 6], [x - 2, gl + 6.1, z + 10], [60, 150, 60], 'Metal'));
    return inst;
}

function generatePark(x, z, gl, blockSize) {
    const inst = [];
    const bs = blockSize || BLOCK_SIZE;
    // Park ground (bright green)
    inst.push(p('Workspace', 'ParkGround', [bs * 0.88, 0.25, bs * 0.88], [x, gl + 0.12, z], [65, 150, 55], 'Grass'));
    // Winding path
    inst.push(p('Workspace', 'ParkPath_1', [bs * 0.8, 0.2, 4], [x, gl + 0.22, z], [200, 196, 190], 'Concrete'));
    inst.push(p('Workspace', 'ParkPath_2', [4, 0.2, bs * 0.8], [x, gl + 0.22, z], [200, 196, 190], 'Concrete'));
    // Fountain at center
    inst.push(...fountain(x, z, gl));
    // Playground quadrant
    inst.push(...playground(x + bs * 0.28, z + bs * 0.28, gl));
    // Tree clusters in all 4 quadrants
    inst.push(...treeCluster(x - bs * 0.28, z - bs * 0.28, 5, 10, gl));
    inst.push(...treeCluster(x + bs * 0.28, z - bs * 0.28, 4, 8, gl));
    inst.push(...treeCluster(x - bs * 0.28, z + bs * 0.28, 4, 8, gl));
    // Benches around fountain
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        inst.push(...bench(x + Math.cos(angle) * 10, z + Math.sin(angle) * 10, gl));
        inst.push(...lampPost(x + Math.cos(angle + Math.PI / 4) * 14, z + Math.sin(angle + Math.PI / 4) * 14, gl));
    }
    return inst;
}

// ═══════════════════════════════════════════════════════════
// PARKING LOT
// ═══════════════════════════════════════════════════════════

function parkingLot(x, z, gl, w, d) {
    const pw = w || 30, pd = d || 20;
    const inst = [];
    const id = wid();
    inst.push(p('Workspace', `ParkLot_${id}`, [pw, 0.25, pd], [x, gl + 0.12, z], [48, 48, 52], 'Asphalt'));
    // Parking lines
    const spaces = Math.floor(pw / 4.5);
    for (let i = 0; i <= spaces; i++) {
        const lx = x - pw / 2 + i * (pw / spaces);
        inst.push(p('Workspace', `PLine_${id}_${i}`, [0.2, 0.05, pd - 2], [lx, gl + 0.26, z], [255, 255, 255], 'SmoothPlastic'));
    }
    return inst;
}

// ═══════════════════════════════════════════════════════════
// RESIDENTIAL HOUSES
// ═══════════════════════════════════════════════════════════

function residentialBlock(x, z, gl, blockSize, density) {
    const inst = [];
    const bs = blockSize || BLOCK_SIZE;
    const count = density === 'high' ? 9 : density === 'medium' ? 6 : 4;
    const types = ['cottage', 'log_cabin', 'modern', 'cottage', 'cottage', 'log_cabin', 'modern', 'cottage', 'modern'];
    const gridSide = Math.ceil(Math.sqrt(count));
    const spacing = bs / gridSide * 0.85;

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / gridSide);
        const col = i % gridSide;
        const hx = x - (bs * 0.38) + col * spacing + (Math.random() - 0.5) * 3;
        const hz = z - (bs * 0.38) + row * spacing + (Math.random() - 0.5) * 3;
        const type = types[i % types.length];
        let house;
        if (type === 'cottage')   house = generateCottage({ x: hx, z: hz, groundLevel: gl });
        else if (type === 'log_cabin') house = generateLogCabin({ x: hx, z: hz, groundLevel: gl });
        else house = generateModernHouse({ x: hx, z: hz, groundLevel: gl });
        inst.push(...house.instances);
        // Garden patch
        inst.push(p('Workspace', `Garden_${wid()}`, [10, 0.15, 10], [hx, gl + 0.08, hz + 10], [75, 155, 58], 'Grass'));
    }
    // Street trees along block edge
    inst.push(...treeLine(x, z - bs * 0.47, bs * 0.8, 'x', 4, gl));
    inst.push(...treeLine(x, z + bs * 0.47, bs * 0.8, 'x', 4, gl));
    return inst;
}

// ═══════════════════════════════════════════════════════════
// COMMERCIAL BLOCK
// ═══════════════════════════════════════════════════════════

function commercialBlock(x, z, gl, blockSize) {
    const inst = [];
    const bs = blockSize || BLOCK_SIZE;
    const buildingCount = 3 + Math.floor(Math.random() * 3);
    const spacing = bs / buildingCount;

    for (let i = 0; i < buildingCount; i++) {
        const bx = x - bs * 0.4 + i * spacing + spacing * 0.5;
        const floors = 3 + Math.floor(Math.random() * 5);
        const bldg = generateBuilding({
            x: bx, z,
            groundLevel: gl,
            floors,
            width: 14 + Math.random() * 8,
            depth: 12 + Math.random() * 6,
            detailLevel: 'medium',
            groundFloorShop: true,
        });
        inst.push(...bldg.instances);
    }
    // Parking lot in front of commercial strip
    inst.push(...parkingLot(x, z + bs * 0.38, gl, bs * 0.8, 16));
    return inst;
}

// ═══════════════════════════════════════════════════════════
// MAIN SOCIETY GENERATOR
// ═══════════════════════════════════════════════════════════

/**
 * Generate a complete society: residential, commercial, civic, park zones.
 * Always called for any exterior/outdoor scene.
 * Zone layout (3×3 block grid, center = 0,0):
 *
 *   [school]       [residential]  [residential]
 *   [hospital]     [PARK]         [commercial]
 *   [fireStation]  [residential]  [policeStation]
 *
 * @param {object} options
 * @returns {{ instances: object[], terrain: object[] }}
 */
function generateSociety(options) {
    const {
        size = 300,
        groundLevel = 0,
        detailLevel = 'medium',
    } = options || {};

    const inst = [];
    const terrain = [];
    const gl = groundLevel;

    // ── 1. TERRAIN BASE ────────────────────────────────────
    // Large grass base
    terrain.push({ shape: 'Block', position: [0, gl - 2, 0], size: [size * 2.2, 4, size * 2.2], material: 'Grass' });

    // ── 2. CITY GRID ROADS ─────────────────────────────────
    const { inst: roadInst, blocks } = generateCityGrid({ centerX: 0, centerZ: 0, gl });
    inst.push(...roadInst);

    // blocks is a 3×3 array [row0col0, row0col1 ... row2col2]
    // Positions: blocks[0]=(-1,-1), [1]=(-1,0), [2]=(-1,+1)
    //                    [3]=(0,-1), [4]=(0,0),  [5]=(0,+1)
    //                    [6]=(+1,-1),[7]=(+1,0), [8]=(+1,+1)
    const [b00, b01, b02, b10, b11, b12, b20, b21, b22] = blocks;

    // ── 3. ZONE ASSIGNMENT ─────────────────────────────────
    const zoneMap = [
        { block: b00, zone: 'school' },
        { block: b01, zone: 'residential' },
        { block: b02, zone: 'residential' },
        { block: b10, zone: 'hospital' },
        { block: b11, zone: 'park' },
        { block: b12, zone: 'commercial' },
        { block: b20, zone: 'fire_station' },
        { block: b21, zone: 'residential' },
        { block: b22, zone: 'police' },
    ];

    for (const { block, zone } of zoneMap) {
        if (!block) continue;
        const { x, z } = block;

        // Block ground patch (consistent surface)
        inst.push(p('Workspace', `ZoneBase_${wid()}`, [BLOCK_SIZE - 2, 0.2, BLOCK_SIZE - 2], [x, gl + 0.1, z], [75, 145, 60], 'Grass'));

        switch (zone) {
            case 'school':
                inst.push(...school(x, z, gl));
                inst.push(...treeCluster(x + 18, z + 18, 4, 6, gl));
                break;
            case 'hospital':
                inst.push(...hospital(x, z, gl));
                inst.push(...treeCluster(x - 14, z + 14, 3, 5, gl));
                break;
            case 'fire_station':
                inst.push(...fireStation(x, z, gl));
                inst.push(...parkingLot(x + 18, z, gl, 22, 14));
                break;
            case 'police':
                inst.push(...policeStation(x, z, gl));
                inst.push(...parkingLot(x, z + 18, gl, 22, 14));
                break;
            case 'park':
                inst.push(...generatePark(x, z, gl, BLOCK_SIZE));
                break;
            case 'commercial':
                inst.push(...commercialBlock(x, z, gl, BLOCK_SIZE));
                break;
            case 'residential':
            default:
                inst.push(...residentialBlock(x, z, gl, BLOCK_SIZE, 'medium'));
                break;
        }
    }

    // ── 4. STREET FURNITURE ON ALL ROAD SIDES ──────────────
    const stride = BLOCK_SIZE + ROAD_W;
    const roadOffsets = [-1.5, -0.5, 0.5, 1.5];
    const swOff = ROAD_W / 2 + SIDEWALK_W * 0.35;
    const rl = stride * 3 * 0.85;

    for (const zo of roadOffsets) {
        const rz = zo * stride;
        inst.push(...streetFurnitureRow(-rl / 2, rz - swOff, rl / 2, rz - swOff, gl, 22));
    }
    for (const xo of roadOffsets) {
        const rx = xo * stride;
        inst.push(...streetFurnitureRow(rx - swOff, -rl / 2, rx - swOff, rl / 2, gl, 22));
    }

    // ── 5. PERIMETER TREE LINE ─────────────────────────────
    const perim = stride * 2.2;
    inst.push(...treeLine(0, -perim, perim * 2, 'x', 12, gl));
    inst.push(...treeLine(0,  perim, perim * 2, 'x', 12, gl));
    inst.push(...treeLine(-perim, 0, perim * 2, 'z', 12, gl));
    inst.push(...treeLine( perim, 0, perim * 2, 'z', 12, gl));

    // ── 6. MISC CORNER TREES ──────────────────────────────
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const dist = perim * 0.85;
        inst.push(...conePine('Workspace',
            Math.cos(angle) * dist, Math.sin(angle) * dist,
            gl, 10 + Math.random() * 6));
    }

    return { instances: inst, terrain };
}

// Backward-compat alias
function generateTown(options) {
    return generateSociety(options);
}

module.exports = {
    generateSociety,
    generateTown,   // alias kept for compatibility
    generateConePine: conePine,
    generateLampPost: lampPost,
    generateBench: bench,
    generateTrashCan: trashCan,
    generateRoadSegment: (opts) => ({ instances: roadSegment(opts.x, opts.z, opts.length, opts.axis, opts.groundLevel || 0) }),
    generateIntersection: (opts) => ({ instances: intersection(opts.x, opts.z, opts.groundLevel || 0) }),
    generateTownRoads: generateCityGrid,
    generateTreeGrove: (opts) => ({ instances: treeCluster(opts.centerX, opts.centerZ, opts.count, opts.spreadRadius, opts.groundLevel || 0) }),
    generateSidewalkFurniture: (opts) => ({ instances: streetFurnitureRow(opts.startX, opts.startZ, opts.endX, opts.endZ, opts.groundLevel || 0) }),
    policeStation,
    school,
    hospital,
    fireStation,
    fountain,
    playground,
    generatePark,
    residentialBlock,
    commercialBlock,
    parkingLot,
};
