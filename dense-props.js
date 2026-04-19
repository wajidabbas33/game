// ============================================================
//  Roblox AI Plugin – Dense Prop System
//
//  High-density small-object generators that fill counters,
//  shelves, tables, and surfaces with realistic-looking clutter.
//  Each prop is built from 2-6 Part primitives with correct
//  proportions and materials.
//
//  Usage:
//    const props = generateSurfaceProps('counter', surfaceY, surfacePos, surfaceSize);
//    // → returns { instances: [...] }
// ============================================================

'use strict';

let _uid = Math.floor(Math.random() * 10000);
function uid() { return ++_uid; }

// ── Helper: make a Part instance ──────────────────────────────
function part(parent, name, size, position, color, material, extras) {
    return {
        className: 'Part',
        parent,
        properties: {
            Name: name,
            Size: size,
            Position: position,
            Color: color,
            Anchored: true,
            Material: material || 'SmoothPlastic',
            ...extras,
        },
    };
}

function model(parent, name) {
    return { className: 'Model', parent, properties: { Name: name } };
}

// ── Prop generators ──────────────────────────────────────────
// Each returns { instances: Part[] }.
// `cx, cy, cz` = center of surface placement point.

function bottleSet(parent, cx, cy, cz, palette) {
    const id = uid();
    const mName = `BottleSet_${id}`;
    const colors = palette || [
        [180, 30, 30], [45, 120, 45], [220, 180, 40], [60, 60, 180], [255, 140, 0],
    ];
    const instances = [model(parent, mName)];
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 bottles
    for (let i = 0; i < count; i++) {
        const bx = cx + (i - count / 2) * 0.55;
        const h = 1.2 + Math.random() * 0.8;
        const r = 0.25 + Math.random() * 0.1;
        const col = colors[i % colors.length];
        // Body
        instances.push(part(mName, `Bottle_${i}`, [r * 2, h, r * 2], [bx, cy + h / 2, cz], col, 'Glass', { Transparency: 0.15 }));
        // Cap
        instances.push(part(mName, `Cap_${i}`, [r * 1.4, 0.15, r * 1.4], [bx, cy + h + 0.07, cz], [220, 220, 225], 'Metal'));
    }
    return { instances };
}

function plateStack(parent, cx, cy, cz) {
    const id = uid();
    const mName = `PlateStack_${id}`;
    const instances = [model(parent, mName)];
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        instances.push(part(mName, `Plate_${i}`,
            [1.8, 0.12, 1.8],
            [cx, cy + 0.06 + i * 0.13, cz],
            [245, 245, 248], 'SmoothPlastic'));
    }
    return { instances };
}

function cupSet(parent, cx, cy, cz) {
    const id = uid();
    const mName = `CupSet_${id}`;
    const instances = [model(parent, mName)];
    const count = 2 + Math.floor(Math.random() * 3);
    const colors = [[245, 245, 248], [200, 180, 150], [180, 60, 60], [60, 100, 160]];
    for (let i = 0; i < count; i++) {
        const bx = cx + (i - count / 2) * 0.7;
        const col = colors[i % colors.length];
        // Cup body
        instances.push(part(mName, `Cup_${i}`, [0.7, 0.9, 0.7], [bx, cy + 0.45, cz], col, 'SmoothPlastic'));
        // Handle (tiny part on the side)
        instances.push(part(mName, `Handle_${i}`, [0.12, 0.4, 0.25], [bx + 0.4, cy + 0.5, cz], col, 'SmoothPlastic'));
    }
    return { instances };
}

function boxStack(parent, cx, cy, cz, boxColor) {
    const id = uid();
    const mName = `BoxStack_${id}`;
    const instances = [model(parent, mName)];
    const count = 2 + Math.floor(Math.random() * 4);
    const baseColor = boxColor || [180, 130, 80];
    for (let i = 0; i < count; i++) {
        const w = 2.2 + Math.random() * 0.6;
        const h = 0.4 + Math.random() * 0.3;
        const d = 2.2 + Math.random() * 0.3;
        const yOff = i === 0 ? h / 2 : 0;
        const prevY = i === 0 ? cy : cy;
        let stackY = cy + h / 2;
        for (let j = 0; j < i; j++) {
            stackY += 0.5 + Math.random() * 0.2;
        }
        const slight = (Math.random() - 0.5) * 0.3;
        instances.push(part(mName, `Box_${i}`,
            [w, h, d],
            [cx + slight, stackY, cz + slight],
            [baseColor[0] + (i * 8), baseColor[1] + (i * 5), baseColor[2]],
            'Cardboard'));
    }
    return { instances };
}

function cashRegister(parent, cx, cy, cz) {
    const id = uid();
    const mName = `CashRegister_${id}`;
    const instances = [model(parent, mName)];
    // Body
    instances.push(part(mName, 'Body', [1.8, 1.0, 1.4], [cx, cy + 0.5, cz], [55, 55, 60], 'Metal'));
    // Screen
    instances.push(part(mName, 'Screen', [1.4, 0.9, 0.1], [cx, cy + 1.2, cz - 0.5], [30, 30, 35], 'SmoothPlastic'));
    // Screen glow
    instances.push(part(mName, 'ScreenGlow', [1.2, 0.7, 0.05], [cx, cy + 1.2, cz - 0.52], [80, 180, 255], 'Neon', { Transparency: 0.1 }));
    // Number pad
    instances.push(part(mName, 'Numpad', [0.8, 0.05, 0.6], [cx + 0.4, cy + 1.02, cz + 0.2], [45, 45, 48], 'SmoothPlastic'));
    return { instances };
}

function napkinDispenser(parent, cx, cy, cz) {
    const id = uid();
    const mName = `NapkinDisp_${id}`;
    const instances = [model(parent, mName)];
    instances.push(part(mName, 'Body', [1.0, 0.8, 0.6], [cx, cy + 0.4, cz], [190, 190, 195], 'Metal'));
    instances.push(part(mName, 'Slot', [0.8, 0.05, 0.1], [cx, cy + 0.82, cz], [255, 255, 255], 'SmoothPlastic'));
    return { instances };
}

function candleHolder(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Candle_${id}`;
    const instances = [model(parent, mName)];
    // Base
    instances.push(part(mName, 'Base', [0.6, 0.3, 0.6], [cx, cy + 0.15, cz], [160, 140, 100], 'SmoothPlastic'));
    // Candle
    instances.push(part(mName, 'Wax', [0.3, 0.8, 0.3], [cx, cy + 0.7, cz], [255, 245, 220], 'SmoothPlastic'));
    // Flame
    instances.push(part(mName, 'Flame', [0.15, 0.25, 0.15], [cx, cy + 1.2, cz], [255, 200, 80], 'Neon'));
    // PointLight
    instances.push({
        className: 'PointLight',
        parent: 'Flame',
        properties: {
            Name: 'CandleGlow',
            Brightness: 0.6,
            Range: 8,
            Color: [255, 200, 100],
        },
    });
    return { instances };
}

function barrel(parent, cx, cy, cz, color) {
    const id = uid();
    const mName = `Barrel_${id}`;
    const instances = [model(parent, mName)];
    const barrelColor = color || [120, 75, 35];
    // Body
    instances.push(part(mName, 'Body', [2.4, 3.2, 2.4], [cx, cy + 1.6, cz], barrelColor, 'Wood'));
    // Top band
    instances.push(part(mName, 'BandTop', [2.5, 0.15, 2.5], [cx, cy + 3.0, cz], [80, 75, 70], 'Metal'));
    // Middle band
    instances.push(part(mName, 'BandMid', [2.55, 0.15, 2.55], [cx, cy + 1.6, cz], [80, 75, 70], 'Metal'));
    // Bottom band
    instances.push(part(mName, 'BandBot', [2.5, 0.15, 2.5], [cx, cy + 0.3, cz], [80, 75, 70], 'Metal'));
    return { instances };
}

function wineRackCell(parent, cx, cy, cz) {
    const id = uid();
    const mName = `WineRack_${id}`;
    const instances = [model(parent, mName)];
    // Frame
    instances.push(part(mName, 'Frame', [3.0, 3.0, 1.2], [cx, cy + 1.5, cz], [100, 65, 30], 'Wood', { Transparency: 0.0 }));
    // Cross lattice (4 diagonal parts)
    instances.push(part(mName, 'DiagA', [0.12, 2.8, 0.1], [cx, cy + 1.5, cz - 0.3], [90, 58, 25], 'Wood',
        { CFrame: { position: [cx, cy + 1.5, cz - 0.3], rotation: [0, 0, 45] } }));
    instances.push(part(mName, 'DiagB', [0.12, 2.8, 0.1], [cx, cy + 1.5, cz - 0.3], [90, 58, 25], 'Wood',
        { CFrame: { position: [cx, cy + 1.5, cz - 0.3], rotation: [0, 0, -45] } }));
    // Bottles in rack (2-3)
    const bottleCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < bottleCount; i++) {
        const by = cy + 0.6 + i * 0.9;
        instances.push(part(mName, `RackBottle_${i}`,
            [0.28, 0.28, 1.4],
            [cx + (Math.random() - 0.5) * 0.8, by, cz],
            [45 + Math.floor(Math.random() * 80), 80 + Math.floor(Math.random() * 60), 30],
            'Glass', { Transparency: 0.2 }));
    }
    return { instances };
}

function pizzaOnPlate(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Pizza_${id}`;
    const instances = [model(parent, mName)];
    // Plate
    instances.push(part(mName, 'Plate', [2.2, 0.1, 2.2], [cx, cy + 0.05, cz], [245, 245, 248], 'SmoothPlastic'));
    // Pizza base
    instances.push(part(mName, 'Dough', [2.0, 0.15, 2.0], [cx, cy + 0.17, cz], [210, 175, 110], 'SmoothPlastic'));
    // Sauce layer
    instances.push(part(mName, 'Sauce', [1.8, 0.05, 1.8], [cx, cy + 0.27, cz], [180, 45, 30], 'SmoothPlastic'));
    // Cheese layer
    instances.push(part(mName, 'Cheese', [1.7, 0.06, 1.7], [cx, cy + 0.33, cz], [255, 220, 100], 'SmoothPlastic'));
    return { instances };
}

function blender(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Blender_${id}`;
    const instances = [model(parent, mName)];
    // Base
    instances.push(part(mName, 'Base', [1.0, 0.5, 1.0], [cx, cy + 0.25, cz], [55, 55, 58], 'Metal'));
    // Jar
    instances.push(part(mName, 'Jar', [0.8, 1.4, 0.8], [cx, cy + 1.2, cz], [200, 220, 230], 'Glass', { Transparency: 0.3 }));
    // Lid
    instances.push(part(mName, 'Lid', [0.85, 0.2, 0.85], [cx, cy + 2.0, cz], [50, 50, 55], 'SmoothPlastic'));
    return { instances };
}

function monitorDesk(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Monitor_${id}`;
    const instances = [model(parent, mName)];
    // Stand base
    instances.push(part(mName, 'StandBase', [1.2, 0.12, 0.8], [cx, cy + 0.06, cz], [60, 60, 65], 'Metal'));
    // Stand neck
    instances.push(part(mName, 'StandNeck', [0.25, 1.2, 0.25], [cx, cy + 0.66, cz], [60, 60, 65], 'Metal'));
    // Screen
    instances.push(part(mName, 'Screen', [3.2, 2.0, 0.12], [cx, cy + 1.9, cz], [30, 30, 35], 'SmoothPlastic'));
    // Screen glow
    instances.push(part(mName, 'ScreenGlow', [3.0, 1.8, 0.05], [cx, cy + 1.9, cz - 0.08], [50, 130, 220], 'Neon', { Transparency: 0.15 }));
    // Keyboard
    instances.push(part(mName, 'Keyboard', [2.4, 0.12, 0.9], [cx, cy + 0.06, cz - 1.2], [45, 45, 48], 'SmoothPlastic'));
    // Mouse
    instances.push(part(mName, 'Mouse', [0.5, 0.15, 0.7], [cx + 1.8, cy + 0.07, cz - 1.2], [45, 45, 48], 'SmoothPlastic'));
    return { instances };
}

function potPlantSmall(parent, cx, cy, cz) {
    const id = uid();
    const mName = `PotPlant_${id}`;
    const instances = [model(parent, mName)];
    // Pot
    instances.push(part(mName, 'Pot', [0.8, 0.7, 0.8], [cx, cy + 0.35, cz], [160, 90, 50], 'SmoothPlastic'));
    // Soil
    instances.push(part(mName, 'Soil', [0.7, 0.1, 0.7], [cx, cy + 0.72, cz], [80, 55, 30], 'Slate'));
    // Foliage
    instances.push(part(mName, 'Foliage', [1.2, 1.0, 1.2], [cx, cy + 1.3, cz], [60, 140, 50], 'Grass'));
    return { instances };
}

function condimentSet(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Condiments_${id}`;
    const instances = [model(parent, mName)];
    // Tray
    instances.push(part(mName, 'Tray', [1.6, 0.1, 1.0], [cx, cy + 0.05, cz], [55, 55, 58], 'Metal'));
    // Ketchup
    instances.push(part(mName, 'Ketchup', [0.3, 1.1, 0.3], [cx - 0.4, cy + 0.6, cz], [200, 30, 20], 'SmoothPlastic'));
    // Mustard
    instances.push(part(mName, 'Mustard', [0.3, 1.1, 0.3], [cx, cy + 0.6, cz], [230, 200, 30], 'SmoothPlastic'));
    // Salt
    instances.push(part(mName, 'Salt', [0.25, 0.6, 0.25], [cx + 0.4, cy + 0.35, cz - 0.2], [240, 240, 242], 'SmoothPlastic'));
    // Pepper
    instances.push(part(mName, 'Pepper', [0.25, 0.6, 0.25], [cx + 0.4, cy + 0.35, cz + 0.2], [40, 40, 42], 'SmoothPlastic'));
    return { instances };
}

function tubeLightFixture(parent, cx, cy, cz, length, color) {
    const id = uid();
    const mName = `TubeLight_${id}`;
    const instances = [model(parent, mName)];
    const lightColor = color || [255, 245, 230];
    // Mounting bracket
    instances.push(part(mName, 'Bracket', [length * 0.3, 0.15, 0.4], [cx, cy, cz], [70, 70, 75], 'Metal'));
    // Tube
    instances.push(part(mName, 'Tube', [length, 0.2, 0.3], [cx, cy - 0.2, cz], lightColor, 'Neon'));
    // SurfaceLight
    instances.push({
        className: 'SurfaceLight',
        parent: 'Tube',
        properties: {
            Name: 'Glow',
            Face: 'Bottom',
            Brightness: 1.2,
            Range: 18,
            Angle: 120,
            Color: lightColor,
        },
    });
    return { instances };
}

function neonAccentStrip(parent, cx, cy, cz, length, color, axis) {
    const id = uid();
    const mName = `NeonStrip_${id}`;
    const instances = [model(parent, mName)];
    const stripColor = color || [255, 80, 200]; // pink neon default
    const size = axis === 'x' ? [length, 0.08, 0.15] : [0.15, 0.08, length];
    instances.push(part(mName, 'Strip', size, [cx, cy, cz], stripColor, 'Neon'));
    instances.push({
        className: 'PointLight',
        parent: 'Strip',
        properties: {
            Name: 'NeonGlow',
            Brightness: 0.8,
            Range: 10,
            Color: stripColor,
        },
    });
    return { instances };
}

function bookRow(parent, cx, cy, cz, width) {
    const id = uid();
    const mName = `Books_${id}`;
    const instances = [model(parent, mName)];
    const bookCount = Math.floor(width / 0.35);
    const colors = [
        [140, 40, 40], [40, 60, 140], [45, 120, 50], [160, 120, 40],
        [80, 40, 100], [180, 60, 30], [50, 50, 55], [120, 90, 60],
    ];
    let bx = cx - width / 2 + 0.2;
    for (let i = 0; i < bookCount && i < 12; i++) {
        const bw = 0.2 + Math.random() * 0.15;
        const bh = 1.2 + Math.random() * 0.5;
        const col = colors[i % colors.length];
        instances.push(part(mName, `Book_${i}`,
            [bw, bh, 0.9],
            [bx + bw / 2, cy + bh / 2, cz],
            col, 'SmoothPlastic'));
        bx += bw + 0.02;
    }
    return { instances };
}

function streetSign(parent, cx, cy, cz, text) {
    const id = uid();
    const mName = `StreetSign_${id}`;
    const instances = [model(parent, mName)];
    // Pole
    instances.push(part(mName, 'Pole', [0.3, 8, 0.3], [cx, cy + 4, cz], [120, 120, 125], 'Metal'));
    // Sign board
    const signPart = part(mName, 'Board', [4, 1.2, 0.15], [cx, cy + 8.5, cz], [20, 80, 30], 'SmoothPlastic');
    instances.push(signPart);
    // SurfaceGui with text
    instances.push({
        className: 'SurfaceGui',
        parent: 'Board',
        properties: {
            Name: 'SignGui',
            Face: 'Front',
            SizingMode: 'FixedSize',
            CanvasSize: [400, 120],
        },
    });
    instances.push({
        className: 'TextLabel',
        parent: 'SignGui',
        properties: {
            Name: 'Label',
            Size: { XScale: 1, YScale: 1, XOffset: 0, YOffset: 0 },
            Position: { XScale: 0, YScale: 0, XOffset: 0, YOffset: 0 },
            Text: text || 'MAIN ST',
            TextColor3: [255, 255, 255],
            BackgroundTransparency: 1,
            TextScaled: true,
            Font: 'GothamBold',
        },
    });
    return { instances };
}

function menuBoard(parent, cx, cy, cz, items) {
    const id = uid();
    const mName = `MenuBoard_${id}`;
    const instances = [model(parent, mName)];
    // Board
    instances.push(part(mName, 'Board', [5, 4, 0.2], [cx, cy + 2, cz], [250, 248, 245], 'SmoothPlastic'));
    // Frame
    instances.push(part(mName, 'FrameTop', [5.2, 0.15, 0.3], [cx, cy + 4.05, cz], [60, 40, 25], 'Wood'));
    instances.push(part(mName, 'FrameBot', [5.2, 0.15, 0.3], [cx, cy + 0.0, cz], [60, 40, 25], 'Wood'));
    instances.push(part(mName, 'FrameL', [0.15, 4.1, 0.3], [cx - 2.55, cy + 2, cz], [60, 40, 25], 'Wood'));
    instances.push(part(mName, 'FrameR', [0.15, 4.1, 0.3], [cx + 2.55, cy + 2, cz], [60, 40, 25], 'Wood'));
    // Title SurfaceGui
    instances.push({
        className: 'SurfaceGui',
        parent: 'Board',
        properties: {
            Name: 'MenuGui',
            Face: 'Front',
            SizingMode: 'FixedSize',
            CanvasSize: [500, 400],
        },
    });
    // Title
    instances.push({
        className: 'TextLabel',
        parent: 'MenuGui',
        properties: {
            Name: 'Title',
            Size: { XScale: 1, YScale: 0.18, XOffset: 0, YOffset: 0 },
            Position: { XScale: 0, YScale: 0.02, XOffset: 0, YOffset: 0 },
            Text: 'MENU',
            TextColor3: [200, 50, 30],
            BackgroundTransparency: 1,
            TextScaled: true,
            Font: 'GothamBold',
        },
    });
    // Menu items
    const menuItems = items || ['Pepperoni Pizza ... $8', 'Margherita ... $7', 'Caesar Salad ... $6', 'Garlic Bread ... $4', 'Soda ... $2'];
    for (let i = 0; i < menuItems.length && i < 8; i++) {
        instances.push({
            className: 'TextLabel',
            parent: 'MenuGui',
            properties: {
                Name: `Item_${i}`,
                Size: { XScale: 0.9, YScale: 0.1, XOffset: 0, YOffset: 0 },
                Position: { XScale: 0.05, YScale: 0.22 + i * 0.11, XOffset: 0, YOffset: 0 },
                Text: menuItems[i],
                TextColor3: [40, 40, 45],
                BackgroundTransparency: 1,
                TextScaled: true,
                Font: 'Gotham',
                TextXAlignment: 'Left',
            },
        });
    }
    return { instances };
}

function storeNameSign(parent, cx, cy, cz, storeName, bgColor) {
    const id = uid();
    const mName = `StoreSign_${id}`;
    const instances = [model(parent, mName)];
    const bg = bgColor || [35, 35, 40];
    // Sign board
    instances.push(part(mName, 'SignBoard', [8, 1.8, 0.2], [cx, cy, cz], bg, 'SmoothPlastic'));
    // Neon glow outline
    instances.push(part(mName, 'GlowTop', [8.2, 0.08, 0.3], [cx, cy + 0.92, cz - 0.05], [255, 220, 100], 'Neon'));
    instances.push(part(mName, 'GlowBot', [8.2, 0.08, 0.3], [cx, cy - 0.92, cz - 0.05], [255, 220, 100], 'Neon'));
    // SurfaceGui with store name
    instances.push({
        className: 'SurfaceGui',
        parent: 'SignBoard',
        properties: {
            Name: 'NameGui',
            Face: 'Front',
            SizingMode: 'FixedSize',
            CanvasSize: [800, 180],
        },
    });
    instances.push({
        className: 'TextLabel',
        parent: 'NameGui',
        properties: {
            Name: 'StoreName',
            Size: { XScale: 1, YScale: 1, XOffset: 0, YOffset: 0 },
            Position: { XScale: 0, YScale: 0, XOffset: 0, YOffset: 0 },
            Text: storeName || 'SHOP',
            TextColor3: [255, 255, 255],
            BackgroundTransparency: 1,
            TextScaled: true,
            Font: 'GothamBold',
        },
    });
    return { instances };
}

// ── Formal Office Props ──────────────────────────────────────

function fireplace(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Fireplace_${id}`;
    const instances = [model(parent, mName)];
    const whiteMarble = [235, 232, 228];
    const darkInterior = [30, 28, 25];
    instances.push(part(mName, 'SurroundL', [0.8, 8, 1.5], [cx - 4.4, cy + 4, cz], whiteMarble, 'Marble'));
    instances.push(part(mName, 'SurroundR', [0.8, 8, 1.5], [cx + 4.4, cy + 4, cz], whiteMarble, 'Marble'));
    instances.push(part(mName, 'Mantel', [10, 0.6, 2.2], [cx, cy + 8.3, cz], whiteMarble, 'Marble'));
    instances.push(part(mName, 'Firebox', [7, 5, 0.5], [cx, cy + 3, cz - 0.3], darkInterior, 'SmoothPlastic'));
    for (let g = 0; g < 5; g++) {
        instances.push(part(mName, `Grate_${g}`, [0.15, 2, 0.15], [cx - 2.4 + g * 1.2, cy + 1, cz - 0.1], [35, 32, 30], 'Metal'));
    }
    instances.push(part(mName, 'Fire_L', [1.5, 2, 0.3], [cx - 1.5, cy + 1.2, cz - 0.1], [255, 120, 30], 'Neon', { Transparency: 0.1 }));
    instances.push(part(mName, 'Fire_R', [1.2, 2.5, 0.3], [cx + 1, cy + 1.4, cz - 0.1], [255, 180, 50], 'Neon', { Transparency: 0.15 }));
    instances.push({ className: 'PointLight', parent: 'Fire_L', properties: { Name: 'FireGlow', Brightness: 1.5, Range: 20, Color: [255, 140, 40] } });
    instances.push(part(mName, 'Vase_L', [0.8, 1.8, 0.8], [cx - 3.5, cy + 8.9, cz], [195, 65, 45], 'SmoothPlastic'));
    instances.push(part(mName, 'Vase_R', [0.8, 1.8, 0.8], [cx + 3.5, cy + 8.9, cz], [195, 65, 45], 'SmoothPlastic'));
    instances.push(part(mName, 'Clock', [1.2, 2, 0.6], [cx, cy + 9.2, cz], [45, 40, 35], 'Metal'));
    return { instances };
}

function curtainDrape(parent, cx, cy, cz, height, color) {
    const id = uid();
    const mName = `Drape_${id}`;
    const instances = [model(parent, mName)];
    const drapeColor = color || [200, 165, 55];
    const darkColor = [drapeColor[0] - 40, drapeColor[1] - 30, drapeColor[2] - 15];
    instances.push(part(mName, 'Pelmet', [8, 1.2, 0.5], [cx, cy + height - 0.6, cz], darkColor, 'Fabric'));
    instances.push(part(mName, 'PanelL', [2.8, height - 1, 0.25], [cx - 2.5, cy + (height - 1) / 2, cz], drapeColor, 'Fabric'));
    instances.push(part(mName, 'PanelR', [2.8, height - 1, 0.25], [cx + 2.5, cy + (height - 1) / 2, cz], drapeColor, 'Fabric'));
    instances.push(part(mName, 'TieL', [0.3, 0.3, 0.6], [cx - 1.5, cy + height * 0.4, cz], [200, 165, 50], 'Metal'));
    instances.push(part(mName, 'TieR', [0.3, 0.3, 0.6], [cx + 1.5, cy + height * 0.4, cz], [200, 165, 50], 'Metal'));
    return { instances };
}

function columnPillar(parent, cx, cy, cz, height) {
    const id = uid();
    const mName = `Column_${id}`;
    const instances = [model(parent, mName)];
    const white = [242, 240, 238];
    instances.push(part(mName, 'Plinth', [4, 1, 4], [cx, cy + 0.5, cz], white, 'Marble'));
    instances.push(part(mName, 'Shaft', [2.8, height - 2.5, 2.8], [cx, cy + 1 + (height - 2.5) / 2, cz], white, 'Marble'));
    instances.push(part(mName, 'Necking', [3.0, 0.3, 3.0], [cx, cy + height - 1.7, cz], white, 'Marble'));
    instances.push(part(mName, 'Capital', [3.8, 0.8, 3.8], [cx, cy + height - 0.9, cz], white, 'Marble'));
    instances.push(part(mName, 'CapTop', [4.2, 0.5, 4.2], [cx, cy + height - 0.25, cz], white, 'Marble'));
    return { instances };
}

function decorativeRug(parent, cx, cy, cz, width, depth) {
    const id = uid();
    const mName = `Rug_${id}`;
    const instances = [model(parent, mName)];
    instances.push(part(mName, 'RugBody', [width, 0.12, depth], [cx, cy + 0.06, cz], [160, 40, 35], 'Fabric'));
    const bw = width * 0.06;
    instances.push(part(mName, 'BorderN', [width, 0.15, bw], [cx, cy + 0.08, cz - depth / 2 + bw / 2], [210, 175, 70], 'Fabric'));
    instances.push(part(mName, 'BorderS', [width, 0.15, bw], [cx, cy + 0.08, cz + depth / 2 - bw / 2], [210, 175, 70], 'Fabric'));
    instances.push(part(mName, 'BorderW', [bw, 0.15, depth - bw * 2], [cx - width / 2 + bw / 2, cy + 0.08, cz], [210, 175, 70], 'Fabric'));
    instances.push(part(mName, 'BorderE', [bw, 0.15, depth - bw * 2], [cx + width / 2 - bw / 2, cy + 0.08, cz], [210, 175, 70], 'Fabric'));
    instances.push(part(mName, 'Medallion', [width * 0.35, 0.14, depth * 0.35], [cx, cy + 0.07, cz], [195, 155, 60], 'Fabric'));
    return { instances };
}

function portraitFrame(parent, cx, cy, cz, w, h) {
    const id = uid();
    const mName = `Portrait_${id}`;
    const instances = [model(parent, mName)];
    const fw = w || 6;
    const fh = h || 8;
    const goldColor = [200, 160, 50];
    const ft = 0.3;
    instances.push(part(mName, 'Frame_T', [fw + ft * 2, ft, ft], [cx, cy + fh / 2 + ft / 2, cz - 0.1], goldColor, 'Metal'));
    instances.push(part(mName, 'Frame_B', [fw + ft * 2, ft, ft], [cx, cy - fh / 2 - ft / 2, cz - 0.1], goldColor, 'Metal'));
    instances.push(part(mName, 'Frame_L', [ft, fh, ft], [cx - fw / 2 - ft / 2, cy, cz - 0.1], goldColor, 'Metal'));
    instances.push(part(mName, 'Frame_R', [ft, fh, ft], [cx + fw / 2 + ft / 2, cy, cz - 0.1], goldColor, 'Metal'));
    const canvasColors = [[180, 100, 60], [80, 100, 140], [140, 80, 80], [60, 100, 60]];
    const bk = canvasColors[Math.floor(Math.random() * canvasColors.length)];
    instances.push(part(mName, 'Canvas', [fw, fh, 0.1], [cx, cy, cz - 0.15], bk, 'SmoothPlastic'));
    instances.push(part(mName, 'Figure', [fw * 0.45, fh * 0.7, 0.05], [cx, cy - fh * 0.05, cz - 0.22], [bk[0] + 40, bk[1] + 30, bk[2] + 20], 'SmoothPlastic'));
    return { instances };
}

function bustPedestal(parent, cx, cy, cz) {
    const id = uid();
    const mName = `Bust_${id}`;
    const instances = [model(parent, mName)];
    const white = [235, 232, 228];
    instances.push(part(mName, 'Plinth', [2, 0.5, 2], [cx, cy + 0.25, cz], white, 'Marble'));
    instances.push(part(mName, 'Shaft', [1.4, 3.5, 1.4], [cx, cy + 2.25, cz], white, 'Marble'));
    instances.push(part(mName, 'Neck', [0.9, 1.0, 0.9], [cx, cy + 4.2, cz], white, 'Marble'));
    instances.push(part(mName, 'Head', [1.8, 2.2, 1.8], [cx, cy + 5.4, cz], white, 'Marble'));
    instances.push(part(mName, 'Nose', [0.3, 0.25, 0.5], [cx, cy + 5.35, cz + 0.85], white, 'Marble'));
    return { instances };
}

// ── Corridor Props ────────────────────────────────────────────

function corridorWallPanel(parent, cx, cy, cz, panelW, panelH, facing) {
    const id = uid();
    const mName = `WallPanel_${id}`;
    const instances = [model(parent, mName)];
    const isZ = (facing === 'left' || facing === 'right');
    const panelSize = isZ ? [0.18, panelH, panelW] : [panelW, panelH, 0.18];
    const glowSize = isZ ? [0.08, panelH - 0.4, panelW - 0.4] : [panelW - 0.4, panelH - 0.4, 0.08];
    const frameH = isZ ? [0.3, 0.25, panelW + 0.4] : [panelW + 0.4, 0.25, 0.3];
    const frameV = isZ ? [0.3, panelH + 0.3, 0.25] : [0.25, panelH + 0.3, 0.3];
    instances.push(part(mName, 'Panel', panelSize, [cx, cy, cz], [248, 250, 255], 'SmoothPlastic'));
    instances.push(part(mName, 'PanelGlow', glowSize, [cx, cy, cz], [220, 235, 255], 'Neon', { Transparency: 0.05 }));
    instances.push({ className: 'SurfaceLight', parent: 'PanelGlow', properties: { Name: 'PanelLight', Face: isZ ? 'Right' : 'Front', Brightness: 1.0, Range: 15, Angle: 85, Color: [220, 235, 255] } });
    instances.push(part(mName, 'TrimT', frameH, [cx, cy + panelH / 2 + 0.12, cz], [55, 58, 65], 'Metal'));
    instances.push(part(mName, 'TrimB', frameH, [cx, cy - panelH / 2 - 0.12, cz], [55, 58, 65], 'Metal'));
    const offX = isZ ? 0 : panelW / 2 + 0.2;
    const offZ = isZ ? panelW / 2 + 0.2 : 0;
    instances.push(part(mName, 'TrimL', frameV, [cx - offX, cy, cz - offZ], [55, 58, 65], 'Metal'));
    instances.push(part(mName, 'TrimR', frameV, [cx + offX, cy, cz + offZ], [55, 58, 65], 'Metal'));
    return { instances };
}

function hedgePlanter(parent, cx, cz, groundLevel, length, facing) {
    const id = uid();
    const mName = `HedgePlanter_${id}`;
    const instances = [model(parent, mName)];
    const isZ = (facing === 'left' || facing === 'right');
    const traySize = isZ ? [1.8, 1.2, length] : [length, 1.2, 1.8];
    const hedgeSize = isZ ? [1.6, 1.8, length - 0.4] : [length - 0.4, 1.8, 1.6];
    instances.push(part(mName, 'Tray', traySize, [cx, groundLevel + 0.6, cz], [40, 42, 48], 'Metal'));
    instances.push(part(mName, 'Hedge', hedgeSize, [cx, groundLevel + 2.1, cz], [40, 110, 38], 'Grass'));
    return { instances };
}

function ceilingGridBeam(parent, cx, cy, cz, length, axis) {
    const id = uid();
    const mName = `CeilBeam_${id}`;
    const instances = [model(parent, mName)];
    const beamColor = [45, 48, 55];
    const beamSize = axis === 'x' ? [length, 0.6, 0.5] : [0.5, 0.6, length];
    const tubeSize = axis === 'x' ? [length * 0.7, 0.2, 0.3] : [0.3, 0.2, length * 0.7];
    instances.push(part(mName, 'Beam', beamSize, [cx, cy, cz], beamColor, 'Metal'));
    instances.push(part(mName, 'TubeLight', tubeSize, [cx, cy - 0.4, cz], [220, 235, 255], 'Neon'));
    instances.push({ className: 'SurfaceLight', parent: 'TubeLight', properties: { Name: 'GridLight', Face: 'Bottom', Brightness: 1.2, Range: 14, Angle: 100, Color: [220, 235, 255] } });
    return { instances };
}

function generateFormalOfficeProps(w, d, h, specialFlags) {
    const instances = [];
    const sf = specialFlags || {};
    const gl = 0;
    if (sf.hasColumns !== false) {
        const colCount = sf.columnCount || 6;
        for (let i = 0; i < colCount; i++) {
            const angle = (i / colCount) * Math.PI * 2;
            const rx = (w / 2 - 3) * Math.cos(angle);
            const rz = (d / 2 - 3) * Math.sin(angle);
            instances.push(...columnPillar('Workspace', rx, gl, rz, h * 0.9).instances);
        }
    }
    if (sf.hasFireplace !== false) {
        instances.push(...fireplace('Workspace', w / 2 - 1, gl, 0).instances);
        instances.push(...portraitFrame('Workspace', w / 2 - 0.1, gl + h * 0.65, 0).instances);
    }
    if (sf.hasDrapes !== false) {
        for (let i = 0; i < 3; i++) {
            const dx = (i - 1) * (w * 0.22);
            instances.push(...curtainDrape('Workspace', dx, gl, -d / 2 + 0.2, h * 0.85, [200, 165, 55]).instances);
        }
    }
    if (sf.hasRug !== false) {
        instances.push(...decorativeRug('Workspace', 0, gl, d * 0.1, w * 0.55, d * 0.45).instances);
    }
    if (sf.hasPortraits !== false) {
        instances.push(...portraitFrame('Workspace', -w / 2 + 0.1, gl + h * 0.5, d * 0.15, 5, 7).instances);
        instances.push(...portraitFrame('Workspace', -w / 2 + 0.1, gl + h * 0.5, -d * 0.15, 5, 7).instances);
    }
    instances.push(...bustPedestal('Workspace', -w * 0.25, gl, d * 0.25).instances);
    instances.push(...bustPedestal('Workspace', w * 0.25, gl, d * 0.25).instances);
    return { instances };
}

function generateCorridorProps(w, d, h) {
    const instances = [];
    const gl = 0;
    const panelH = h * 0.72;
    const panelW = 7;
    const panelCount = Math.max(2, Math.floor(d / 11));
    for (let i = 0; i < panelCount; i++) {
        const pz = -d / 2 + 5 + i * 11;
        instances.push(...corridorWallPanel('Workspace', -w / 2 + 0.1, gl + panelH / 2 + 1, pz, panelW, panelH, 'left').instances);
        instances.push(...corridorWallPanel('Workspace', w / 2 - 0.1, gl + panelH / 2 + 1, pz, panelW, panelH, 'right').instances);
        if (i < panelCount - 1) {
            instances.push(part('Workspace', `ColSupL_${i}`, [1.2, h, 1.2], [-w / 2 + 0.6, gl + h / 2, pz + 5.5], [50, 53, 60], 'Metal'));
            instances.push(part('Workspace', `ColSupR_${i}`, [1.2, h, 1.2], [w / 2 - 0.6, gl + h / 2, pz + 5.5], [50, 53, 60], 'Metal'));
        }
    }
    const planterCount = Math.floor(panelCount * 0.6);
    for (let i = 0; i < planterCount; i++) {
        const pz = -d / 2 + 6 + i * 14;
        instances.push(...hedgePlanter('Workspace', -w / 2 + 2.2, pz, gl, 8, 'left').instances);
        instances.push(...hedgePlanter('Workspace', w / 2 - 2.2, pz, gl, 8, 'right').instances);
    }
    const beamCountZ = Math.max(1, Math.floor(d / 10));
    for (let i = 0; i < beamCountZ; i++) {
        const bz = -d / 2 + 5 + i * 10;
        instances.push(...ceilingGridBeam('Workspace', 0, gl + h - 0.3, bz, w + 2, 'x').instances);
    }
    for (let i = 0; i < 3; i++) {
        const bx = -w / 2 + (i + 1) * (w / 4);
        instances.push(...ceilingGridBeam('Workspace', bx, gl + h - 0.3, 0, d + 2, 'z').instances);
    }
    return { instances };
}

// ── Surface prop auto-placement ──────────────────────────────

// Given a surface type and its dimensions, scatter appropriate props.

const SURFACE_PROP_RECIPES = {
    counter: {
        props: [
            { fn: cashRegister, weight: 0.8, once: true },
            { fn: condimentSet, weight: 0.7, max: 2 },
            { fn: napkinDispenser, weight: 0.5, max: 2 },
            { fn: bottleSet, weight: 0.4, max: 1 },
            { fn: plateStack, weight: 0.4, max: 2 },
            { fn: cupSet, weight: 0.3, max: 1 },
        ],
    },
    kitchen_counter: {
        props: [
            { fn: blender, weight: 0.6, max: 1 },
            { fn: bottleSet, weight: 0.7, max: 2 },
            { fn: plateStack, weight: 0.5, max: 2 },
            { fn: potPlantSmall, weight: 0.2, max: 1 },
            { fn: boxStack, weight: 0.4, max: 1 },
        ],
    },
    café_table: {
        props: [
            { fn: cupSet, weight: 0.6, max: 1 },
            { fn: plateStack, weight: 0.3, max: 1 },
            { fn: condimentSet, weight: 0.3, max: 1 },
            { fn: candleHolder, weight: 0.4, max: 1 },
            { fn: potPlantSmall, weight: 0.2, max: 1 },
        ],
    },
    restaurant_table: {
        props: [
            { fn: plateStack, weight: 0.7, max: 2 },
            { fn: condimentSet, weight: 0.5, max: 1 },
            { fn: cupSet, weight: 0.4, max: 1 },
            { fn: candleHolder, weight: 0.5, max: 1 },
        ],
    },
    desk: {
        props: [
            { fn: monitorDesk, weight: 0.7, max: 1 },
            { fn: cupSet, weight: 0.3, max: 1 },
            { fn: potPlantSmall, weight: 0.2, max: 1 },
        ],
    },
    classroom_desk: {
        props: [
            { fn: bookRow, weight: 0.55, max: 1 },
            { fn: cupSet, weight: 0.12, max: 1 },
        ],
    },
    shelf: {
        props: [
            { fn: bookRow, weight: 0.6, max: 3 },
            { fn: bottleSet, weight: 0.3, max: 2 },
            { fn: potPlantSmall, weight: 0.3, max: 1 },
            { fn: boxStack, weight: 0.3, max: 1 },
        ],
    },
    bar: {
        props: [
            { fn: bottleSet, weight: 0.9, max: 3 },
            { fn: cupSet, weight: 0.5, max: 2 },
            { fn: condimentSet, weight: 0.3, max: 1 },
            { fn: napkinDispenser, weight: 0.4, max: 1 },
        ],
    },
    display: {
        props: [
            { fn: pizzaOnPlate, weight: 0.5, max: 3 },
            { fn: plateStack, weight: 0.4, max: 2 },
            { fn: bottleSet, weight: 0.3, max: 1 },
        ],
    },
    wine_wall: {
        props: [
            { fn: wineRackCell, weight: 0.9, max: 6 },
            { fn: barrel, weight: 0.5, max: 3 },
        ],
    },
};

/**
 * Generate props for a surface.
 * @param {string} surfaceType - 'counter', 'café_table', 'desk', 'shelf', 'bar', 'display', 'wine_wall'
 * @param {number} surfaceY - Y position of the surface top
 * @param {number[]} surfaceCenter - [x, y, z] center of surface
 * @param {number[]} surfaceSize - [width, height, depth] of surface
 * @param {string} parentModel - parent model name
 * @returns {{ instances: object[] }}
 */
function generateSurfaceProps(surfaceType, surfaceY, surfaceCenter, surfaceSize, parentModel) {
    const recipe = SURFACE_PROP_RECIPES[surfaceType] || SURFACE_PROP_RECIPES.counter;
    const instances = [];
    const [sx, , sz] = surfaceCenter;
    const [sw, , sd] = surfaceSize;
    const parent = parentModel || 'Workspace';

    const usableLengthX = sw * 0.8;
    let placed = 0;
    const counters = {};

    for (const entry of recipe.props) {
        if (Math.random() > entry.weight) continue;
        const max = entry.max || 1;
        counters[entry.fn.name] = counters[entry.fn.name] || 0;
        if (counters[entry.fn.name] >= max) continue;
        if (entry.once && counters[entry.fn.name] > 0) continue;

        const px = sx - usableLengthX / 2 + (placed / 6) * usableLengthX + (Math.random() - 0.5) * 1.5;
        const pz = sz + (Math.random() - 0.5) * (sd * 0.4);

        const result = entry.fn(parent, px, surfaceY, pz);
        instances.push(...result.instances);
        counters[entry.fn.name]++;
        placed++;
    }

    return { instances };
}

/**
 * Auto-populate all surfaces in a scene with appropriate props.
 * Scans instances for counters, tables, desks, shelves and adds props.
 */
function autoPopulateSurfaces(instances, roomType) {
    // Classroom desks already get bookRow/cup clutter that reads as random “small boxes”.
    // Skip auto clutter so the layout stays readable (teacher desk + boards stay the focus).
    if (roomType === 'classroom') {
        return { instances: [] };
    }
    const allProps = [];
    const surfaceMap = {
        counter: 'counter',
        kitchen_counter: 'kitchen_counter',
        KitchenCounter: 'kitchen_counter',
        café_table: 'café_table',
        CafeTable: 'café_table',
        restaurant_table: 'restaurant_table',
        desk: 'desk',
        Desk: 'desk',
        office_desk: 'desk',
        bookshelf: 'shelf',
        Bookshelf: 'shelf',
        shelving: 'shelf',
        Shelf: 'shelf',
        bar: 'bar',
        BarCounter: 'bar',
    };

    // Room-type based default prop additions
    if (roomType === 'café' || roomType === 'restaurant') {
        // Add menu board on back wall
        const dims = roomType === 'café' ? { w: 48, d: 38, h: 14 } : { w: 56, d: 42, h: 14 };
        const menuResult = menuBoard('Workspace', 0, dims.h * 0.6, -dims.d / 2 + 0.5);
        allProps.push(...menuResult.instances);
    }

    for (const inst of instances) {
        const name = String(inst?.properties?.Name || '').toLowerCase();
        const pos = inst?.properties?.Position || inst?.properties?.CFrame?.position;
        const size = inst?.properties?.Size;
        if (!pos || !size) continue;

        let surfaceType = null;
        for (const [pattern, type] of Object.entries(surfaceMap)) {
            if (name.includes(pattern.toLowerCase())) {
                surfaceType = type;
                break;
            }
        }
        if (!surfaceType) continue;
        if (surfaceType === 'desk' && roomType === 'classroom') {
            surfaceType = 'classroom_desk';
        }

        const surfaceY = pos[1] + size[1] / 2; // top of the surface
        const result = generateSurfaceProps(surfaceType, surfaceY, pos, size, inst?.parent || 'Workspace');
        allProps.push(...result.instances);
    }

    return { instances: allProps };
}

module.exports = {
    // Individual prop generators
    bottleSet,
    plateStack,
    cupSet,
    boxStack,
    cashRegister,
    napkinDispenser,
    candleHolder,
    barrel,
    wineRackCell,
    pizzaOnPlate,
    blender,
    monitorDesk,
    potPlantSmall,
    condimentSet,
    tubeLightFixture,
    neonAccentStrip,
    bookRow,
    streetSign,
    menuBoard,
    storeNameSign,
    // Formal office props
    fireplace,
    curtainDrape,
    columnPillar,
    decorativeRug,
    portraitFrame,
    bustPedestal,
    // Corridor props
    corridorWallPanel,
    hedgePlanter,
    ceilingGridBeam,
    // Room-level prop generators
    generateFormalOfficeProps,
    generateCorridorProps,
    // Auto-placement
    generateSurfaceProps,
    autoPopulateSurfaces,
    SURFACE_PROP_RECIPES,
};
