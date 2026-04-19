// ============================================================
//  Roblox AI Plugin – Multi-Story Building Generator
//
//  Procedural building façade generation for background and
//  foreground buildings. Generates window grids, balconies,
//  awnings, storefronts, and SurfaceGui signage.
//
//  Each building produces 20-80 parts depending on floor count
//  and detail level, vs. current 4 parts per building.
// ============================================================

'use strict';

let _bid = Math.floor(Math.random() * 10000);
function bid() { return ++_bid; }

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

// ── Building style presets ───────────────────────────────────

const BUILDING_STYLES = [
    {
        name: 'modern_glass',
        wallMaterial: 'SmoothPlastic',
        wallColors: [[225, 228, 232], [210, 215, 220], [200, 205, 210]],
        windowMaterial: 'Glass',
        windowColor: [100, 150, 210],
        windowTransparency: 0.35,
        frameMaterial: 'Metal',
        frameColor: [50, 55, 60],
        roofMaterial: 'Concrete',
        roofColor: [90, 88, 85],
        storefrontColor: [40, 40, 45],
        hasBalconies: true,
        balconyFreq: 3,
        trimColor: [60, 60, 65],
    },
    {
        name: 'brick_traditional',
        wallMaterial: 'Brick',
        wallColors: [[165, 90, 55], [150, 80, 50], [175, 95, 60]],
        windowMaterial: 'Glass',
        windowColor: [160, 190, 215],
        windowTransparency: 0.3,
        frameMaterial: 'SmoothPlastic',
        frameColor: [240, 238, 235],
        roofMaterial: 'Slate',
        roofColor: [80, 75, 70],
        storefrontColor: [60, 45, 30],
        hasBalconies: false,
        balconyFreq: 0,
        trimColor: [235, 230, 225],
    },
    {
        name: 'concrete_modern',
        wallMaterial: 'Concrete',
        wallColors: [[200, 198, 195], [190, 188, 185], [210, 208, 205]],
        windowMaterial: 'Glass',
        windowColor: [90, 130, 180],
        windowTransparency: 0.4,
        frameMaterial: 'Metal',
        frameColor: [65, 65, 70],
        roofMaterial: 'Concrete',
        roofColor: [100, 98, 95],
        storefrontColor: [50, 50, 55],
        hasBalconies: true,
        balconyFreq: 2,
        trimColor: [80, 80, 85],
    },
    {
        name: 'white_stucco',
        wallMaterial: 'SmoothPlastic',
        wallColors: [[248, 246, 242], [240, 238, 235], [245, 243, 240]],
        windowMaterial: 'Glass',
        windowColor: [130, 170, 210],
        windowTransparency: 0.3,
        frameMaterial: 'SmoothPlastic',
        frameColor: [160, 155, 148],
        roofMaterial: 'SmoothPlastic',
        roofColor: [185, 95, 55],
        storefrontColor: [55, 55, 58],
        hasBalconies: true,
        balconyFreq: 2,
        trimColor: [170, 165, 158],
    },
    {
        name: 'dark_modern',
        wallMaterial: 'SmoothPlastic',
        wallColors: [[55, 58, 65], [45, 48, 55], [65, 68, 75]],
        windowMaterial: 'Glass',
        windowColor: [60, 120, 200],
        windowTransparency: 0.35,
        frameMaterial: 'Metal',
        frameColor: [35, 35, 40],
        roofMaterial: 'Metal',
        roofColor: [40, 40, 45],
        storefrontColor: [30, 30, 35],
        hasBalconies: true,
        balconyFreq: 4,
        trimColor: [50, 50, 55],
    },
];

const STORE_NAMES = [
    'CAFÉ LUNA', 'BODEGA', 'PRINT SHOP', 'METRO MART', 'SALON',
    'BOOKS & CO.', 'LAUNDRY', 'DELI', 'THE CORNER', 'GALLERY',
    'PHARMACY', 'BAKERY', 'BOUTIQUE', 'PET SHOP', 'FLORIST',
    'PIZZA HUT', 'NOODLE BAR', 'TECH STORE', 'GYM', 'MUSIC',
];

/**
 * Generate a detailed multi-story building.
 * @param {object} options
 * @param {number} options.x - center X position
 * @param {number} options.z - center Z position
 * @param {number} options.groundLevel - Y position of ground
 * @param {number} [options.floors] - number of floors (1-10)
 * @param {number} [options.width] - building width in studs
 * @param {number} [options.depth] - building depth in studs
 * @param {number} [options.floorHeight] - height per floor
 * @param {string} [options.style] - style preset name
 * @param {string} [options.storeName] - ground floor store name
 * @param {string} [options.facing] - 'front'|'back'|'left'|'right' (which face gets windows)
 * @param {boolean} [options.groundFloorShop] - whether to add storefront
 * @param {string} [options.detailLevel] - 'low'|'medium'|'high'
 * @returns {{ instances: object[] }}
 */
function generateBuilding(options) {
    const {
        x = 0,
        z = 0,
        groundLevel = 0,
        floors = 3 + Math.floor(Math.random() * 5),
        width = 16 + Math.random() * 10,
        depth = 12 + Math.random() * 6,
        floorHeight = 3.5 + Math.random() * 0.5,
        style: styleName,
        storeName,
        facing = 'front',
        groundFloorShop = true,
        detailLevel = 'medium',
    } = options || {};

    const id = bid();
    const mName = `Building_${id}`;
    const style = styleName
        ? BUILDING_STYLES.find(s => s.name === styleName) || BUILDING_STYLES[0]
        : BUILDING_STYLES[Math.floor(Math.random() * BUILDING_STYLES.length)];

    const instances = [model('Workspace', mName)];
    const totalHeight = floors * floorHeight;
    const halfW = width / 2;
    const halfD = depth / 2;
    const wallColor = style.wallColors[Math.floor(Math.random() * style.wallColors.length)];

    // ── Ground floor (taller, with storefront) ───────────────
    const gfHeight = floorHeight * 1.15;

    if (groundFloorShop) {
        // Ground floor wall (back portion)
        instances.push(part(mName, 'GF_BackWall',
            [width, gfHeight, depth * 0.6],
            [x, groundLevel + gfHeight / 2, z - depth * 0.2],
            wallColor, style.wallMaterial));

        // Storefront glass
        instances.push(part(mName, 'GF_Storefront',
            [width * 0.85, gfHeight * 0.7, 0.2],
            [x, groundLevel + gfHeight * 0.4, z + halfD],
            style.windowColor, 'Glass',
            { Transparency: style.windowTransparency }));

        // Storefront frame
        instances.push(part(mName, 'GF_Frame_Top',
            [width, 0.2, 0.3],
            [x, groundLevel + gfHeight * 0.78, z + halfD],
            style.frameColor, style.frameMaterial));
        instances.push(part(mName, 'GF_Frame_Bot',
            [width, 0.15, 0.3],
            [x, groundLevel + 0.08, z + halfD],
            style.frameColor, style.frameMaterial));
        instances.push(part(mName, 'GF_Frame_L',
            [0.2, gfHeight * 0.7, 0.3],
            [x - width * 0.425, groundLevel + gfHeight * 0.4, z + halfD],
            style.frameColor, style.frameMaterial));
        instances.push(part(mName, 'GF_Frame_R',
            [0.2, gfHeight * 0.7, 0.3],
            [x + width * 0.425, groundLevel + gfHeight * 0.4, z + halfD],
            style.frameColor, style.frameMaterial));

        // Door
        instances.push(part(mName, 'GF_Door',
            [3.5, gfHeight * 0.65, 0.3],
            [x, groundLevel + gfHeight * 0.33, z + halfD + 0.1],
            [80, 70, 60], 'Wood'));

        // Awning
        instances.push(part(mName, 'Awning',
            [width * 0.9, 0.15, 3],
            [x, groundLevel + gfHeight * 0.85, z + halfD + 1.5],
            style.storefrontColor, 'Fabric'));

        // Interior light (visible through glass)
        instances.push(part(mName, 'GF_IntLight',
            [0.3, 0.3, 0.3],
            [x, groundLevel + gfHeight * 0.7, z],
            [255, 230, 180], 'Neon', { Transparency: 0.5 }));
        instances.push({
            className: 'PointLight',
            parent: 'GF_IntLight',
            properties: {
                Name: 'ShopLight',
                Brightness: 0.8,
                Range: 15,
                Color: [255, 230, 180],
            },
        });

        // Store name sign
        const name = storeName || STORE_NAMES[Math.floor(Math.random() * STORE_NAMES.length)];
        instances.push(part(mName, 'StoreName_Bg',
            [width * 0.6, 1.2, 0.15],
            [x, groundLevel + gfHeight * 0.92, z + halfD + 0.1],
            style.storefrontColor, 'SmoothPlastic'));
        instances.push({
            className: 'SurfaceGui',
            parent: 'StoreName_Bg',
            properties: {
                Name: 'StoreNameGui',
                Face: 'Front',
                SizingMode: 'FixedSize',
                CanvasSize: [600, 120],
            },
        });
        instances.push({
            className: 'TextLabel',
            parent: 'StoreNameGui',
            properties: {
                Name: 'Label',
                Size: { XScale: 1, YScale: 1, XOffset: 0, YOffset: 0 },
                Position: { XScale: 0, YScale: 0, XOffset: 0, YOffset: 0 },
                Text: name,
                TextColor3: [255, 255, 255],
                BackgroundTransparency: 1,
                TextScaled: true,
                Font: 'GothamBold',
            },
        });
    } else {
        // Plain ground floor
        instances.push(part(mName, 'GF_Wall',
            [width, gfHeight, depth],
            [x, groundLevel + gfHeight / 2, z],
            wallColor, style.wallMaterial));
    }

    // ── Upper floors ─────────────────────────────────────────
    for (let floor = 1; floor < floors; floor++) {
        const floorY = groundLevel + gfHeight + (floor - 1) * floorHeight;
        const fName = `Floor_${floor}`;

        // Floor plate (facade wall)
        instances.push(part(mName, `${fName}_Wall`,
            [width, floorHeight, depth],
            [x, floorY + floorHeight / 2, z],
            wallColor, style.wallMaterial));

        // Window grid on the front face
        const windowsPerFloor = Math.max(2, Math.floor(width / 4.5));
        const windowWidth = 2.5;
        const windowHeight = floorHeight * 0.55;
        const windowSpacing = width / (windowsPerFloor + 1);

        if (detailLevel !== 'low') {
            for (let w = 0; w < windowsPerFloor; w++) {
                const wx = x - halfW + windowSpacing * (w + 1);
                const wy = floorY + floorHeight * 0.45;
                const wz = z + halfD + 0.05;

                // Glass pane
                instances.push(part(mName, `${fName}_Win_${w}`,
                    [windowWidth, windowHeight, 0.12],
                    [wx, wy, wz],
                    style.windowColor, style.windowMaterial,
                    { Transparency: style.windowTransparency }));

                // Frame (4 sides)
                if (detailLevel === 'high') {
                    const ft = 0.12;
                    instances.push(part(mName, `${fName}_WF_T${w}`,
                        [windowWidth + 0.2, ft, 0.2],
                        [wx, wy + windowHeight / 2 + ft / 2, wz],
                        style.frameColor, style.frameMaterial));
                    instances.push(part(mName, `${fName}_WF_B${w}`,
                        [windowWidth + 0.2, ft, 0.2],
                        [wx, wy - windowHeight / 2 - ft / 2, wz],
                        style.frameColor, style.frameMaterial));
                    instances.push(part(mName, `${fName}_WF_L${w}`,
                        [ft, windowHeight, 0.2],
                        [wx - windowWidth / 2 - ft / 2, wy, wz],
                        style.frameColor, style.frameMaterial));
                    instances.push(part(mName, `${fName}_WF_R${w}`,
                        [ft, windowHeight, 0.2],
                        [wx + windowWidth / 2 + ft / 2, wy, wz],
                        style.frameColor, style.frameMaterial));
                }
            }
        }

        // Floor line / trim
        instances.push(part(mName, `${fName}_Trim`,
            [width + 0.3, 0.12, depth + 0.3],
            [x, floorY, z],
            style.trimColor, style.frameMaterial));

        // Balcony (every N floors)
        if (style.hasBalconies && style.balconyFreq > 0 && floor % style.balconyFreq === 0 && detailLevel !== 'low') {
            // Balcony slab
            instances.push(part(mName, `${fName}_Balcony`,
                [width * 0.7, 0.2, 2.5],
                [x, floorY + 0.1, z + halfD + 1.25],
                [180, 178, 175], 'Concrete'));
            // Railing
            instances.push(part(mName, `${fName}_Railing_F`,
                [width * 0.7, 0.8, 0.1],
                [x, floorY + 0.5, z + halfD + 2.4],
                style.frameColor, 'Metal'));
            instances.push(part(mName, `${fName}_Railing_L`,
                [0.1, 0.8, 2.5],
                [x - width * 0.35, floorY + 0.5, z + halfD + 1.25],
                style.frameColor, 'Metal'));
            instances.push(part(mName, `${fName}_Railing_R`,
                [0.1, 0.8, 2.5],
                [x + width * 0.35, floorY + 0.5, z + halfD + 1.25],
                style.frameColor, 'Metal'));
            // Railing posts
            for (let p = 0; p < 4; p++) {
                const px = x - width * 0.35 + (p / 3) * width * 0.7;
                instances.push(part(mName, `${fName}_Post_${p}`,
                    [0.12, 0.9, 0.12],
                    [px, floorY + 0.55, z + halfD + 2.4],
                    style.frameColor, 'Metal'));
            }
        }
    }

    // ── Roof ─────────────────────────────────────────────────
    const roofY = groundLevel + gfHeight + (floors - 1) * floorHeight;
    // Parapet
    instances.push(part(mName, 'Roof_Slab',
        [width + 0.5, 0.4, depth + 0.5],
        [x, roofY + floorHeight + 0.2, z],
        style.roofColor, style.roofMaterial));
    instances.push(part(mName, 'Parapet_F',
        [width + 0.6, 1.0, 0.2],
        [x, roofY + floorHeight + 0.9, z + halfD + 0.2],
        wallColor, style.wallMaterial));
    instances.push(part(mName, 'Parapet_B',
        [width + 0.6, 1.0, 0.2],
        [x, roofY + floorHeight + 0.9, z - halfD - 0.2],
        wallColor, style.wallMaterial));

    // AC unit on roof (detail touch)
    if (detailLevel !== 'low') {
        instances.push(part(mName, 'AC_Unit',
            [2.5, 1.5, 2],
            [x + halfW * 0.4, roofY + floorHeight + 1.15, z - halfD * 0.3],
            [180, 178, 175], 'Metal'));
    }

    return { instances };
}

/**
 * Generate a row of varied buildings along one side of a road.
 * @param {object} options
 * @param {number} options.startX - starting X position
 * @param {number} options.z - Z position (perpendicular to road)
 * @param {number} options.count - number of buildings
 * @param {number} options.groundLevel - Y position of ground
 * @param {string} [options.facing] - direction buildings face
 * @param {string} [options.detailLevel] - 'low'|'medium'|'high'
 * @returns {{ instances: object[] }}
 */
function generateBuildingRow(options) {
    const {
        startX = -40,
        z = 30,
        count = 4,
        groundLevel = 0,
        facing = 'front',
        detailLevel = 'medium',
        spacing = 1.5,
    } = options || {};

    const instances = [];
    let currentX = startX;

    for (let i = 0; i < count; i++) {
        const bWidth = 14 + Math.random() * 12;
        const bDepth = 10 + Math.random() * 8;
        const bFloors = 2 + Math.floor(Math.random() * 6);

        const building = generateBuilding({
            x: currentX + bWidth / 2,
            z,
            groundLevel,
            floors: bFloors,
            width: bWidth,
            depth: bDepth,
            facing,
            groundFloorShop: true,
            detailLevel,
        });

        instances.push(...building.instances);
        currentX += bWidth + spacing;
    }

    return { instances };
}

/**
 * Generate an urban street scene with buildings on both sides.
 * @param {object} options
 * @returns {{ instances: object[] }}
 */
function generateUrbanStreet(options) {
    const {
        length = 120,
        roadWidth = 14,
        sidewalkWidth = 5,
        groundLevel = 0,
        buildingCount = 3,
        detailLevel = 'medium',
    } = options || {};

    const instances = [];
    const halfLen = length / 2;
    const halfRoad = roadWidth / 2;

    // Road surface
    const roadModel = 'UrbanRoad';
    instances.push(model('Workspace', roadModel));
    instances.push(part(roadModel, 'RoadSurface',
        [roadWidth, 0.3, length],
        [0, groundLevel + 0.15, 0],
        [58, 58, 62], 'Asphalt'));

    // Center line dashes
    for (let d = -halfLen + 4; d < halfLen; d += 6) {
        instances.push(part(roadModel, `Dash_${Math.floor(d)}`,
            [0.3, 0.05, 2.5],
            [0, groundLevel + 0.32, d],
            [255, 255, 255], 'SmoothPlastic'));
    }

    // Sidewalks
    instances.push(part(roadModel, 'Sidewalk_W',
        [sidewalkWidth, 0.35, length],
        [-halfRoad - sidewalkWidth / 2, groundLevel + 0.17, 0],
        [195, 192, 188], 'Concrete'));
    instances.push(part(roadModel, 'Sidewalk_E',
        [sidewalkWidth, 0.35, length],
        [halfRoad + sidewalkWidth / 2, groundLevel + 0.17, 0],
        [195, 192, 188], 'Concrete'));

    // Curbs
    instances.push(part(roadModel, 'Curb_W',
        [0.25, 0.4, length],
        [-halfRoad - 0.12, groundLevel + 0.2, 0],
        [180, 178, 175], 'Concrete'));
    instances.push(part(roadModel, 'Curb_E',
        [0.25, 0.4, length],
        [halfRoad + 0.12, groundLevel + 0.2, 0],
        [180, 178, 175], 'Concrete'));

    // Buildings on west side
    const westRow = generateBuildingRow({
        startX: -halfRoad - sidewalkWidth - 2,
        z: -20,
        count: buildingCount,
        groundLevel,
        facing: 'right',
        detailLevel,
    });
    // Mirror X for west side
    for (const inst of westRow.instances) {
        if (inst.properties?.Position) {
            inst.properties.Position[0] = -(inst.properties.Position[0] + halfRoad * 2);
        }
    }
    instances.push(...westRow.instances);

    // Buildings on east side
    const eastRow = generateBuildingRow({
        startX: halfRoad + sidewalkWidth,
        z: 0,
        count: buildingCount,
        groundLevel,
        facing: 'left',
        detailLevel,
    });
    instances.push(...eastRow.instances);

    return { instances };
}

module.exports = {
    generateBuilding,
    generateBuildingRow,
    generateUrbanStreet,
    BUILDING_STYLES,
    STORE_NAMES,
};
