// ============================================================
//  Roblox AI Plugin – Room Layout Knowledge Base
//
//  Structured spatial reasoning data for common room types.
//  Each entry defines:
//    • Default dimensions (studs)
//    • Functional zones with area ratios and required props
//    • Wall treatments per side
//    • Lighting configuration
//    • Floor and ceiling materials
//
//  The scene planner uses this to produce architecturally
//  coherent plans instead of guessing placement.
// ============================================================

'use strict';

// ── Zone position anchors ────────────────────────────────────
// These describe where a zone sits relative to room bounds.
// The layout resolver converts them to min/max coordinates.
const ZONE_ANCHORS = {
    'front-center':  { xFrac: [0.2, 0.8],  zFrac: [0.0, 0.2]  },
    'front-left':    { xFrac: [0.0, 0.4],  zFrac: [0.0, 0.25] },
    'front-right':   { xFrac: [0.6, 1.0],  zFrac: [0.0, 0.25] },
    'center':        { xFrac: [0.1, 0.9],  zFrac: [0.2, 0.75] },
    'center-left':   { xFrac: [0.0, 0.45], zFrac: [0.2, 0.75] },
    'center-right':  { xFrac: [0.55, 1.0], zFrac: [0.2, 0.75] },
    'back-center':   { xFrac: [0.15, 0.85], zFrac: [0.7, 1.0] },
    'back-left':     { xFrac: [0.0, 0.4],  zFrac: [0.7, 1.0]  },
    'back-right':    { xFrac: [0.6, 1.0],  zFrac: [0.7, 1.0]  },
    'left-wall':     { xFrac: [0.0, 0.15], zFrac: [0.1, 0.9]  },
    'right-wall':    { xFrac: [0.85, 1.0], zFrac: [0.1, 0.9]  },
    'front-wall':    { xFrac: [0.1, 0.9],  zFrac: [0.0, 0.1]  },
    'back-wall':     { xFrac: [0.1, 0.9],  zFrac: [0.9, 1.0]  },
    'full':          { xFrac: [0.0, 1.0],  zFrac: [0.0, 1.0]  },
    'left-half':     { xFrac: [0.0, 0.48], zFrac: [0.05, 0.95] },
    'right-half':    { xFrac: [0.52, 1.0], zFrac: [0.05, 0.95] },
    'front-half':    { xFrac: [0.05, 0.95], zFrac: [0.0, 0.48] },
    'back-half':     { xFrac: [0.05, 0.95], zFrac: [0.52, 1.0] },
};

// ── Wall treatment presets ───────────────────────────────────
const WALL_PRESETS = {
    glass_storefront: { material: 'Glass', color: [180, 210, 225], transparency: 0.4, hasEntrance: true },
    brick_accent:     { material: 'Brick', color: [160, 85, 55], transparency: 0 },
    painted_white:    { material: 'SmoothPlastic', color: [242, 240, 238], transparency: 0 },
    painted_cream:    { material: 'SmoothPlastic', color: [235, 230, 220], transparency: 0 },
    painted_warm:     { material: 'SmoothPlastic', color: [238, 232, 222], transparency: 0 },
    concrete_clean:   { material: 'Concrete', color: [220, 218, 215], transparency: 0 },
    concrete_raw:     { material: 'Concrete', color: [185, 180, 175], transparency: 0 },
    wood_paneling:    { material: 'WoodPlanks', color: [140, 100, 60], transparency: 0 },
    glass_partition:  { material: 'Glass', color: [190, 215, 230], transparency: 0.45 },
    tile_white:       { material: 'SmoothPlastic', color: [245, 245, 245], transparency: 0 },
    drywall_gray:     { material: 'SmoothPlastic', color: [210, 210, 212], transparency: 0 },
};

// ── Room Type Definitions ────────────────────────────────────

const ROOM_LAYOUTS = {

    // ── CAFÉ / COFFEE SHOP ───────────────────────────────────
    café: {
        aliases: ['cafe', 'coffee shop', 'coffee house', 'coffeehouse', 'bakery café'],
        defaultDims: { width: 48, depth: 38, height: 14 },
        sceneType: 'custom',
        zones: [
            {
                name: 'entrance_vestibule',
                purpose: 'Entry area with door mat and welcome space',
                position: 'front-center',
                areaRatio: 0.08,
                requiredProps: [],
                optionalProps: ['planter_indoor', 'coat_rack'],
            },
            {
                name: 'counter_service',
                purpose: 'Service counter with register, espresso machine, and display',
                position: 'back-center',
                areaRatio: 0.20,
                requiredProps: ['counter_long', 'espresso_machine', 'menu_board'],
                optionalProps: ['bar_stool', 'bar_stool', 'bar_stool'],
                alignment: 'wall-flush-back',
            },
            {
                name: 'main_seating',
                purpose: 'Primary seating area with café tables and chairs',
                position: 'center',
                areaRatio: 0.38,
                requiredProps: [
                    'café_table_round', 'café_chair', 'café_chair',
                    'café_table_round', 'café_chair', 'café_chair',
                    'café_table_square', 'café_chair', 'café_chair',
                    'café_table_round', 'café_chair', 'café_chair',
                ],
                spacing: 'grid',
                density: 'moderate',
                grouping: [
                    { template: 'café_table_round', chairs: 2, count: 3 },
                    { template: 'café_table_square', chairs: 2, count: 1 },
                ],
            },
            {
                name: 'bench_seating',
                purpose: 'Wall-side bench/booth seating for a cozy feel',
                position: 'right-wall',
                areaRatio: 0.18,
                requiredProps: ['sofa_modern', 'coffee_table', 'sofa_modern', 'coffee_table'],
                alignment: 'wall-flush-right',
            },
            {
                name: 'kitchen_prep',
                purpose: 'Back kitchen / prep area behind the counter',
                position: 'back-left',
                areaRatio: 0.16,
                requiredProps: ['kitchen_counter', 'sink_unit', 'shelving_unit', 'refrigerator'],
                alignment: 'wall-flush-back',
                separated: true,
                separatorMaterial: 'wall_half',
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.glass_storefront,
            left:  WALL_PRESETS.brick_accent,
            right: WALL_PRESETS.painted_warm,
            back:  WALL_PRESETS.concrete_clean,
        },
        lighting: {
            type: 'warm_pendants',
            color: [255, 210, 140],
            ambientColor: [55, 42, 32],
            count: 6,
            brightness: 1.2,
            range: 24,
        },
        floorMaterial: 'WoodPlanks',
        floorColor: [135, 95, 55],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [240, 238, 235],
        windowConfig: { count: 3, wall: 'front', height: 5, width: 5, elevation: 4 },
        doorConfig: { wall: 'front', width: 5, height: 7.5 },
        colorPalette: {
            primary: [135, 95, 55],
            secondary: [160, 85, 55],
            accent: [255, 210, 140],
            style: 'rustic_warm',
        },
    },

    // ── CLASSROOM ─────────────────────────────────────────────
    classroom: {
        aliases: ['class', 'school room', 'lecture room', 'lecture hall'],
        defaultDims: { width: 52, depth: 36, height: 14 },
        sceneType: 'classroom',
        zones: [
            {
                name: 'teacher_area',
                purpose: 'Front teaching area with whiteboard and teacher desk',
                position: 'front-center',
                areaRatio: 0.18,
                requiredProps: [],
                customObjects: [
                    // Front wall: realistic chalkboard + whiteboard set (with frames/trays)
                    { name: 'ChalkBoard', className: 'Part', size: [11.5, 5.2, 0.22], material: 'Slate', color: [24, 58, 34], wallMount: 'front', elevation: 5.2, wallGap: 0.18, offsetX: -11 },
                    { name: 'ChalkBoardFrame', className: 'Part', size: [12.1, 5.8, 0.28], material: 'WoodPlanks', color: [94, 70, 42], wallMount: 'front', elevation: 5.2, wallGap: 0.36, offsetX: -11 },
                    { name: 'ChalkTray', className: 'Part', size: [11.2, 0.24, 0.7], material: 'WoodPlanks', color: [108, 82, 50], wallMount: 'front', elevation: 2.48, wallGap: 0.28, offsetX: -11 },
                    { name: 'Whiteboard', className: 'Part', size: [18, 7, 0.2], material: 'SmoothPlastic', color: [252, 252, 252], wallMount: 'front', elevation: 5.8, wallGap: 0.2, offsetX: 5 },
                    { name: 'WhiteboardFrame', className: 'Part', size: [18.6, 7.6, 0.28], material: 'Metal', color: [130, 132, 138], wallMount: 'front', elevation: 5.8, wallGap: 0.4, offsetX: 5 },
                    { name: 'WhiteboardTray', className: 'Part', size: [18, 0.35, 0.9], material: 'Metal', color: [120, 118, 115], wallMount: 'front', elevation: 2.15, wallGap: 0.35, offsetX: 5 },
                    // Teacher station — less bulky proportions, clearer material contrast.
                    { name: 'TeacherDesk', className: 'Part', size: [8.8, 2.7, 3.2], material: 'WoodPlanks', color: [104, 74, 42], wallMount: 'front', elevation: 2.35, wallGap: 5.7 },
                    { name: 'TeacherDeskTop', className: 'Part', size: [9.2, 0.28, 3.45], material: 'SmoothPlastic', color: [224, 219, 210], wallMount: 'front', elevation: 3.08, wallGap: 5.7 },
                    { name: 'TeacherChair', className: 'Part', size: [2.6, 3.4, 2.6], material: 'Fabric', color: [56, 58, 65], wallMount: 'front', elevation: 2.78, wallGap: 9.6 },
                ],
            },
            {
                name: 'student_desks',
                purpose: 'Rows of student desks and chairs facing the front',
                position: 'center',
                areaRatio: 0.65,
                requiredProps: [],
                grouping: [
                    { template: 'desk', chairs: 1, count: 16, layout: 'rows', rows: 4, cols: 4, minSpacing: 10 },
                ],
                spacing: 'rows',
                density: 'dense',
                faceDirection: 'front',
            },
            {
                name: 'supply_corner',
                purpose: 'Supply shelf and storage area',
                position: 'back-right',
                areaRatio: 0.10,
                requiredProps: ['bookshelf', 'bookshelf', 'wall_art', 'wall_art'],
                alignment: 'wall-flush-right',
            },
            {
                name: 'entry_area',
                purpose: 'Door entry and movement lane',
                position: 'back-left',
                areaRatio: 0.07,
                requiredProps: [],
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.painted_cream,
            left:  WALL_PRESETS.painted_cream,
            right: WALL_PRESETS.painted_cream,
            back:  WALL_PRESETS.painted_cream,
        },
        lighting: {
            type: 'overhead_panels',
            color: [240, 240, 245],
            ambientColor: [60, 60, 65],
            count: 6,
            brightness: 1.05,
            range: 26,
        },
        floorMaterial: 'WoodPlanks',
        floorColor: [168, 128, 88],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [245, 245, 245],
        windowConfig: { count: 4, wall: 'left', height: 5, width: 4, elevation: 4 },
        doorConfig: { wall: 'back', width: 4, height: 7, position: 'left' },
        /** When true (default), add chair rail, wallpaper decal panel, bulletin board, and framed posters. */
        classroomPhotoWalls: true,
        colorPalette: {
            primary: [195, 190, 180],
            secondary: [156, 114, 68],
            accent: [90, 140, 200],
            style: 'modern_clean',
        },
    },

    // ── OFFICE / MEETING ROOM ─────────────────────────────────
    office: {
        aliases: ['meeting room', 'conference room', 'workspace', 'work space', 'coworking'],
        defaultDims: { width: 56, depth: 40, height: 14 },
        sceneType: 'custom',
        zones: [
            {
                name: 'reception',
                purpose: 'Reception desk and waiting area near entrance',
                position: 'front-center',
                areaRatio: 0.15,
                requiredProps: ['reception_desk', 'sofa_modern', 'coffee_table', 'planter_indoor'],
            },
            {
                name: 'open_workspace',
                purpose: 'Open-plan work desks with chairs',
                position: 'center-left',
                areaRatio: 0.35,
                grouping: [
                    { template: 'office_desk', chairs: 1, count: 6, layout: 'rows', rows: 3, cols: 2 },
                ],
                spacing: 'grid',
                density: 'moderate',
            },
            {
                name: 'meeting_area',
                purpose: 'Glass-partitioned meeting room',
                position: 'center-right',
                areaRatio: 0.22,
                requiredProps: ['glass_partition'],
                customObjects: [
                    { name: 'MeetingTable', className: 'Part', size: [12, 3.2, 6], material: 'WoodPlanks', color: [110, 78, 44] },
                ],
                grouping: [
                    { template: 'office_chair', count: 6, layout: 'around-table' },
                ],
                separated: true,
                separatorTemplate: 'glass_partition',
            },
            {
                name: 'storage_wall',
                purpose: 'Filing cabinets and bookshelves along back wall',
                position: 'back-wall',
                areaRatio: 0.12,
                requiredProps: ['bookshelf', 'filing_cabinet', 'filing_cabinet', 'bookshelf'],
                alignment: 'wall-flush-back',
            },
            {
                name: 'break_corner',
                purpose: 'Small kitchen/break corner',
                position: 'back-left',
                areaRatio: 0.16,
                requiredProps: ['kitchen_counter', 'sink_unit', 'refrigerator', 'shelving_unit'],
                alignment: 'wall-flush-back',
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.glass_storefront,
            left:  WALL_PRESETS.drywall_gray,
            right: WALL_PRESETS.drywall_gray,
            back:  WALL_PRESETS.concrete_clean,
        },
        lighting: {
            type: 'overhead_panels',
            color: [235, 238, 245],
            ambientColor: [55, 55, 60],
            count: 6,
            brightness: 1.3,
            range: 26,
        },
        floorMaterial: 'SmoothPlastic',
        floorColor: [195, 195, 200],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [242, 242, 245],
        windowConfig: { count: 4, wall: 'front', height: 6, width: 5, elevation: 3 },
        doorConfig: { wall: 'front', width: 5, height: 7.5 },
        colorPalette: {
            primary: [195, 195, 200],
            secondary: [110, 78, 44],
            accent: [70, 130, 200],
            style: 'modern_clean',
        },
    },

    // ── SHOP / RETAIL STORE ───────────────────────────────────
    shop: {
        aliases: ['store', 'retail', 'boutique', 'clothing store', 'merchandise'],
        defaultDims: { width: 44, depth: 34, height: 14 },
        sceneType: 'custom',
        zones: [
            {
                name: 'entrance_display',
                purpose: 'Front window display area and entrance',
                position: 'front-center',
                areaRatio: 0.12,
                requiredProps: ['planter_indoor'],
                customObjects: [
                    { name: 'DisplayPlatform', className: 'Part', size: [8, 1.5, 6], material: 'SmoothPlastic', color: [60, 60, 65] },
                ],
            },
            {
                name: 'main_floor',
                purpose: 'Display shelves and browsing aisles',
                position: 'center',
                areaRatio: 0.45,
                requiredProps: ['shelving_unit', 'shelving_unit', 'shelving_unit', 'shelving_unit'],
                spacing: 'rows',
                density: 'moderate',
            },
            {
                name: 'checkout',
                purpose: 'Checkout counter near the front',
                position: 'front-right',
                areaRatio: 0.12,
                requiredProps: ['counter_long'],
            },
            {
                name: 'fitting_rooms',
                purpose: 'Fitting/changing rooms along back wall',
                position: 'back-right',
                areaRatio: 0.15,
                customObjects: [
                    { name: 'FittingBooth1', className: 'Part', size: [5, 10, 5], material: 'WoodPlanks', color: [130, 95, 55] },
                    { name: 'FittingBooth2', className: 'Part', size: [5, 10, 5], material: 'WoodPlanks', color: [130, 95, 55] },
                ],
            },
            {
                name: 'stock_room',
                purpose: 'Back storage area',
                position: 'back-left',
                areaRatio: 0.16,
                requiredProps: ['shelving_unit', 'shelving_unit'],
                separated: true,
                separatorMaterial: 'wall_full',
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.glass_storefront,
            left:  WALL_PRESETS.painted_white,
            right: WALL_PRESETS.painted_white,
            back:  WALL_PRESETS.concrete_clean,
        },
        lighting: {
            type: 'overhead_panels',
            color: [255, 250, 240],
            ambientColor: [50, 50, 55],
            count: 6,
            brightness: 1.4,
            range: 26,
        },
        floorMaterial: 'SmoothPlastic',
        floorColor: [220, 218, 215],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [245, 245, 248],
        windowConfig: { count: 2, wall: 'front', height: 7, width: 6, elevation: 3 },
        doorConfig: { wall: 'front', width: 5, height: 7.5 },
        colorPalette: {
            primary: [220, 218, 215],
            secondary: [60, 60, 65],
            accent: [200, 165, 100],
            style: 'modern_clean',
        },
    },

    // ── LOBBY / RECEPTION ─────────────────────────────────────
    lobby: {
        aliases: ['reception', 'reception hall', 'foyer', 'entrance hall', 'waiting room'],
        defaultDims: { width: 52, depth: 42, height: 16 },
        sceneType: 'lobby',
        zones: [
            {
                name: 'entrance',
                purpose: 'Main entrance with double doors',
                position: 'front-center',
                areaRatio: 0.10,
                requiredProps: ['planter_indoor', 'planter_indoor'],
            },
            {
                name: 'reception_desk',
                purpose: 'Central reception desk facing the entrance',
                position: 'center',
                areaRatio: 0.15,
                requiredProps: ['reception_desk', 'office_chair'],
            },
            {
                name: 'waiting_left',
                purpose: 'Left seating area with sofas and coffee table',
                position: 'center-left',
                areaRatio: 0.22,
                requiredProps: ['sofa_modern', 'coffee_table', 'sofa_modern', 'planter_indoor'],
            },
            {
                name: 'waiting_right',
                purpose: 'Right seating area with sofas and magazines',
                position: 'center-right',
                areaRatio: 0.22,
                requiredProps: ['sofa_modern', 'coffee_table', 'sofa_modern'],
            },
            {
                name: 'corridor_back',
                purpose: 'Back corridor leading to other rooms',
                position: 'back-center',
                areaRatio: 0.15,
                requiredProps: [],
                customObjects: [
                    { name: 'DirectorySign', className: 'Part', size: [6, 4, 0.3], material: 'SmoothPlastic', color: [40, 40, 45], wallMount: 'back', elevation: 6 },
                ],
            },
            {
                name: 'elevator_alcove',
                purpose: 'Elevator or stairwell alcove',
                position: 'back-right',
                areaRatio: 0.16,
                customObjects: [
                    { name: 'ElevatorDoors', className: 'Part', size: [5, 8, 0.5], material: 'Metal', color: [160, 158, 155] },
                ],
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.glass_storefront,
            left:  WALL_PRESETS.concrete_clean,
            right: WALL_PRESETS.concrete_clean,
            back:  WALL_PRESETS.drywall_gray,
        },
        lighting: {
            type: 'recessed_ceiling',
            color: [245, 240, 235],
            ambientColor: [50, 48, 45],
            count: 8,
            brightness: 1.3,
            range: 30,
        },
        floorMaterial: 'Marble',
        floorColor: [210, 208, 205],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [245, 245, 245],
        windowConfig: { count: 3, wall: 'front', height: 8, width: 5, elevation: 3 },
        doorConfig: { wall: 'front', width: 6, height: 8, double: true },
        colorPalette: {
            primary: [210, 208, 205],
            secondary: [160, 158, 155],
            accent: [180, 155, 100],
            style: 'modern_clean',
        },
    },

    // ── RESTAURANT ────────────────────────────────────────────
    restaurant: {
        aliases: ['diner', 'dining room', 'eatery', 'bistro', 'pizzeria', 'steakhouse', 'brasserie', 'trattoria'],
        defaultDims: { width: 56, depth: 42, height: 14 },
        sceneType: 'custom',
        zones: [
            {
                name: 'hostess_stand',
                purpose: 'Entrance host/hostess stand with waiting bench',
                position: 'front-center',
                areaRatio: 0.08,
                requiredProps: ['counter_long'],
                optionalProps: ['bench'],
            },
            {
                name: 'main_dining',
                purpose: 'Primary dining area with table groups',
                position: 'center',
                areaRatio: 0.40,
                grouping: [
                    { template: 'café_table_square', chairs: 4, count: 4, layout: 'grid' },
                    { template: 'café_table_round', chairs: 2, count: 3, layout: 'grid' },
                ],
                spacing: 'grid',
                density: 'moderate',
            },
            {
                name: 'booth_seating',
                purpose: 'Booth/banquette seating along one wall',
                position: 'right-wall',
                areaRatio: 0.16,
                requiredProps: ['sofa_modern', 'café_table_square', 'sofa_modern', 'café_table_square'],
                alignment: 'wall-flush-right',
            },
            {
                name: 'bar_area',
                purpose: 'Bar counter with stools',
                position: 'back-right',
                areaRatio: 0.14,
                requiredProps: ['counter_long', 'bar_stool', 'bar_stool', 'bar_stool', 'bar_stool'],
                alignment: 'wall-flush-back',
            },
            {
                name: 'kitchen',
                purpose: 'Commercial kitchen behind counter',
                position: 'back-left',
                areaRatio: 0.22,
                requiredProps: ['kitchen_counter', 'kitchen_counter', 'sink_unit', 'refrigerator', 'shelving_unit'],
                separated: true,
                separatorMaterial: 'wall_full',
                alignment: 'wall-flush-back',
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.glass_storefront,
            left:  WALL_PRESETS.brick_accent,
            right: WALL_PRESETS.wood_paneling,
            back:  WALL_PRESETS.concrete_clean,
        },
        lighting: {
            type: 'warm_pendants',
            color: [255, 200, 120],
            ambientColor: [50, 38, 28],
            count: 8,
            brightness: 1.1,
            range: 22,
        },
        floorMaterial: 'WoodPlanks',
        floorColor: [120, 85, 48],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [38, 35, 32],
        windowConfig: { count: 3, wall: 'front', height: 6, width: 5, elevation: 3 },
        doorConfig: { wall: 'front', width: 5, height: 7.5 },
        colorPalette: {
            primary: [120, 85, 48],
            secondary: [160, 85, 55],
            accent: [255, 200, 120],
            style: 'rustic_warm',
        },
    },

    // ── BAR / WINE CELLAR ──────────────────────────────────────
    bar: {
        aliases: ['wine cellar', 'cellar bar', 'speakeasy', 'brewery', 'taproom', 'lounge bar', 'wine bar', 'cocktail bar', 'pub', 'tavern', 'nightclub'],
        defaultDims: { width: 54, depth: 38, height: 12 },
        sceneType: 'custom',
        zones: [
            {
                name: 'bar_counter',
                purpose: 'Main bar counter with stools and back bar shelves',
                position: 'back-center',
                areaRatio: 0.25,
                requiredProps: ['counter_long', 'bar_stool', 'bar_stool', 'bar_stool', 'bar_stool', 'bar_stool'],
                alignment: 'wall-flush-back',
            },
            {
                name: 'wine_storage',
                purpose: 'Wine rack wall with bottle storage and barrels',
                position: 'left-wall',
                areaRatio: 0.22,
                requiredProps: ['shelving_unit', 'shelving_unit'],
                alignment: 'wall-flush-left',
                customObjects: [
                    { name: 'WineRackWall', className: 'Part', size: [1, 10, 18], material: 'Wood', color: [100, 65, 30] },
                ],
            },
            {
                name: 'barrel_row',
                purpose: 'Decorative barrels along the front wall',
                position: 'front-wall',
                areaRatio: 0.10,
                requiredProps: [],
                customObjects: [
                    { name: 'Barrel_1', className: 'Part', size: [2.4, 3.2, 2.4], material: 'Wood', color: [120, 75, 35] },
                    { name: 'Barrel_2', className: 'Part', size: [2.4, 3.2, 2.4], material: 'Wood', color: [110, 68, 30] },
                    { name: 'Barrel_3', className: 'Part', size: [2.4, 3.2, 2.4], material: 'Wood', color: [130, 80, 40] },
                ],
            },
            {
                name: 'seating_area',
                purpose: 'Main seating area with chairs along bar counter',
                position: 'center',
                areaRatio: 0.35,
                grouping: [
                    { template: 'café_table_square', chairs: 2, count: 3, layout: 'grid' },
                    { template: 'sofa_modern', count: 1, layout: 'centered' },
                ],
                spacing: 'grid',
                density: 'moderate',
            },
            {
                name: 'back_bar',
                purpose: 'Back bar display shelves behind counter with bottles',
                position: 'back-wall',
                areaRatio: 0.08,
                requiredProps: ['shelving_unit', 'shelving_unit'],
                alignment: 'wall-flush-back',
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.brick_accent,
            left:  WALL_PRESETS.brick_accent,
            right: WALL_PRESETS.brick_accent,
            back:  WALL_PRESETS.brick_accent,
        },
        lighting: {
            type: 'warm_pendants',
            color: [255, 190, 100],
            ambientColor: [35, 25, 18],
            count: 5,
            brightness: 0.9,
            range: 18,
        },
        floorMaterial: 'WoodPlanks',
        floorColor: [55, 40, 25],
        ceilingMaterial: 'Brick',
        ceilingColor: [120, 72, 48],
        windowConfig: { count: 1, wall: 'front', height: 4, width: 4, elevation: 4 },
        doorConfig: { wall: 'front', width: 4, height: 7, position: 'left' },
        colorPalette: {
            primary: [55, 40, 25],
            secondary: [120, 75, 35],
            accent: [255, 80, 200],
            style: 'rustic_warm',
        },
    },

    // ── LIVING ROOM / APARTMENT ───────────────────────────────
    living_room: {
        aliases: ['living room', 'apartment', 'flat', 'house interior', 'lounge', 'den', 'family room'],
        defaultDims: { width: 42, depth: 34, height: 13 },
        sceneType: 'custom',
        zones: [
            {
                name: 'seating_area',
                purpose: 'Main sofa and coffee table arrangement',
                position: 'center',
                areaRatio: 0.35,
                requiredProps: ['sofa_modern', 'coffee_table', 'sofa_modern'],
                customObjects: [
                    { name: 'TVStand', className: 'Part', size: [10, 2.5, 2], material: 'WoodPlanks', color: [80, 58, 35] },
                    { name: 'Television', className: 'Part', size: [8, 4.5, 0.3], material: 'SmoothPlastic', color: [25, 25, 28] },
                ],
            },
            {
                name: 'dining_nook',
                purpose: 'Dining table with chairs',
                position: 'front-right',
                areaRatio: 0.20,
                grouping: [
                    { template: 'café_table_square', chairs: 4, count: 1, layout: 'centered' },
                ],
            },
            {
                name: 'kitchenette',
                purpose: 'Open kitchen along one wall',
                position: 'back-wall',
                areaRatio: 0.22,
                requiredProps: ['kitchen_counter', 'sink_unit', 'refrigerator'],
                alignment: 'wall-flush-back',
            },
            {
                name: 'entry_foyer',
                purpose: 'Small entry with coat rack',
                position: 'front-left',
                areaRatio: 0.08,
                requiredProps: ['coat_rack'],
            },
            {
                name: 'corner_reading',
                purpose: 'Reading corner with bookshelf and plant',
                position: 'back-left',
                areaRatio: 0.15,
                requiredProps: ['bookshelf', 'planter_indoor'],
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.painted_warm,
            left:  WALL_PRESETS.painted_warm,
            right: WALL_PRESETS.painted_cream,
            back:  WALL_PRESETS.painted_cream,
        },
        lighting: {
            type: 'warm_pendants',
            color: [255, 215, 150],
            ambientColor: [55, 45, 35],
            count: 4,
            brightness: 1.0,
            range: 22,
        },
        floorMaterial: 'WoodPlanks',
        floorColor: [145, 105, 62],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [248, 245, 242],
        windowConfig: { count: 2, wall: 'front', height: 5, width: 5, elevation: 4 },
        doorConfig: { wall: 'front', width: 4, height: 7, position: 'left' },
        colorPalette: {
            primary: [145, 105, 62],
            secondary: [235, 230, 220],
            accent: [180, 140, 80],
            style: 'rustic_warm',
        },
    },

    // ── FORMAL OFFICE / OVAL OFFICE ───────────────────────────
    formal_office: {
        aliases: [
            'oval office', 'formal office', 'presidential suite', 'state room',
            'grand office', 'classic interior', 'mansion interior', 'stately room',
            'government office', 'official office', 'prime minister', 'white house',
        ],
        defaultDims: { width: 62, depth: 52, height: 16 },
        sceneType: 'custom',
        zones: [
            {
                name: 'presidential_desk',
                purpose: 'Formal desk with 2 guest chairs, flags, and desk lamp',
                position: 'back-center',
                areaRatio: 0.20,
                requiredProps: ['executive_desk', 'guest_chair', 'guest_chair', 'desk_lamp'],
                alignment: 'wall-flush-back',
            },
            {
                name: 'conversation_group_front',
                purpose: 'Primary sofa pair with armchairs and coffee table',
                position: 'center',
                areaRatio: 0.30,
                grouping: [
                    { template: 'sofa_formal', chairs: 0, count: 2, layout: 'facing' },
                    { template: 'arm_chair', count: 4, layout: 'corners' },
                    { template: 'coffee_table', count: 1, layout: 'centered' },
                ],
                density: 'full',
            },
            {
                name: 'fireplace_alcove',
                purpose: 'Fireplace with mantel, flanking chairs, and portrait above',
                position: 'right-wall',
                areaRatio: 0.15,
                requiredProps: ['arm_chair', 'arm_chair'],
                alignment: 'wall-flush-right',
            },
            {
                name: 'window_bays',
                purpose: 'Three tall window bays with gold drapes',
                position: 'back-wall',
                areaRatio: 0.10,
                requiredProps: [],
                alignment: 'wall-flush-back',
            },
            {
                name: 'column_perimeter',
                purpose: 'Decorative columns evenly spaced along the oval perimeter',
                position: 'full',
                areaRatio: 0.05,
                requiredProps: [],
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.painted_white,
            left:  WALL_PRESETS.painted_white,
            right: WALL_PRESETS.painted_white,
            back:  WALL_PRESETS.painted_white,
        },
        lighting: {
            type: 'chandelier',
            color: [255, 235, 190],
            ambientColor: [65, 58, 45],
            count: 1,
            brightness: 1.2,
            range: 40,
        },
        floorMaterial: 'WoodPlanks',
        floorColor: [175, 140, 90],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [248, 246, 243],
        windowConfig: { count: 3, wall: 'back', height: 9, width: 5, elevation: 3 },
        doorConfig: { wall: 'front', width: 4, height: 8, position: 'center' },
        colorPalette: {
            primary: [175, 140, 90],
            secondary: [248, 246, 243],
            accent: [200, 165, 55],
            style: 'formal_classic',
        },
        specialFlags: {
            hasColumns: true,
            columnCount: 6,
            hasFireplace: true,
            hasDrapes: true,
            hasPortraits: true,
            hasRug: true,
        },
    },

    // ── SCI-FI CORRIDOR / FUTURISTIC HALLWAY ──────────────────
    corridor: {
        aliases: [
            'corridor', 'hallway', 'tunnel', 'sci-fi corridor', 'space station',
            'futuristic hallway', 'mall corridor', 'indoor walkway', 'spaceship interior',
            'sci fi', 'futuristic interior', 'station corridor', 'airport corridor',
        ],
        defaultDims: { width: 18, depth: 90, height: 14 },
        sceneType: 'custom',
        zones: [
            {
                name: 'wall_panels_left',
                purpose: 'Row of large illuminated white panels along left wall',
                position: 'left-wall',
                areaRatio: 0.25,
                requiredProps: [],
                alignment: 'wall-flush-left',
            },
            {
                name: 'wall_panels_right',
                purpose: 'Row of large illuminated white panels along right wall',
                position: 'right-wall',
                areaRatio: 0.25,
                requiredProps: [],
                alignment: 'wall-flush-right',
            },
            {
                name: 'planter_left',
                purpose: 'Long low dark metal planter with hedge shrubs',
                position: 'left-wall',
                areaRatio: 0.12,
                requiredProps: [],
                alignment: 'wall-flush-left',
            },
            {
                name: 'planter_right',
                purpose: 'Long low dark metal planter with hedge shrubs',
                position: 'right-wall',
                areaRatio: 0.12,
                requiredProps: [],
                alignment: 'wall-flush-right',
            },
            {
                name: 'ceiling_grid',
                purpose: 'Dark cross-beam grid with recessed tube lights',
                position: 'full',
                areaRatio: 0.05,
                requiredProps: [],
            },
        ],
        wallTreatment: {
            front: WALL_PRESETS.concrete_clean,
            left:  WALL_PRESETS.concrete_clean,
            right: WALL_PRESETS.concrete_clean,
            back:  WALL_PRESETS.concrete_clean,
        },
        lighting: {
            type: 'cool_overhead',
            color: [220, 230, 248],
            ambientColor: [60, 65, 80],
            count: 10,
            brightness: 1.4,
            range: 20,
        },
        floorMaterial: 'Concrete',
        floorColor: [215, 215, 218],
        ceilingMaterial: 'SmoothPlastic',
        ceilingColor: [65, 65, 70],
        windowConfig: { count: 0 },
        doorConfig: { wall: 'back', width: 6, height: 12, position: 'center' },
        colorPalette: {
            primary: [215, 215, 218],
            secondary: [250, 252, 255],
            accent: [200, 220, 255],
            style: 'futuristic_clean',
        },
        specialFlags: {
            hasPanelWalls: true,
            panelCount: 8,
            hasColumnRow: true,
            columnSpacing: 12,
            hasHedgePlanters: true,
            hasCeilingGrid: true,
        },
    },

    // ── TOWN / NEIGHBORHOOD EXTERIOR ──────────────────────────
    town_exterior: {
        aliases: [
            'town', 'neighborhood', 'village', 'suburb', 'city block',
            'streets', 'residential area', 'housing area', 'low poly town',
            'residential neighborhood', 'small town', 'countryside town',
            'town map', 'game map', 'roblox town',
        ],
        defaultDims: { width: 200, depth: 200, height: 0 },
        sceneType: 'exterior_world',
        zones: [],
        wallTreatment: {},
        lighting: {
            type: 'daylight',
            color: [255, 245, 220],
            ambientColor: [100, 110, 120],
            count: 0,
            brightness: 2.5,
            range: 0,
        },
        floorMaterial: 'Grass',
        floorColor: [80, 165, 65],
        ceilingMaterial: null,
        ceilingColor: null,
        windowConfig: { count: 0 },
        doorConfig: null,
        colorPalette: {
            primary: [80, 165, 65],
            secondary: [45, 45, 48],
            accent: [240, 200, 20],
            style: 'low_poly_cartoon',
        },
        specialFlags: {
            isExteriorWorld: true,
            useWorldGenerator: true,
            houseCount: 6,
            treeGroves: 4,
            hasCommercialBlock: true,
        },
    },

};

// ── Public API ───────────────────────────────────────────────

/**
 * Identify the room type from a user prompt.
 * Returns the matching layout object or null.
 */
function identifyRoomType(prompt) {
    const text = String(prompt || '').toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, layout] of Object.entries(ROOM_LAYOUTS)) {
        // Check key name itself (score by key length)
        if (text.includes(key.replace(/_/g, ' ')) || text.includes(key)) {
            const score = key.length;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { key, layout };
            }
        }
        // Check each alias — longer matches win (more specific)
        for (const alias of layout.aliases || []) {
            if (text.includes(alias)) {
                const score = alias.length + 1; // +1 so aliases beat same-length key matches
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { key, layout };
                }
            }
        }
    }
    return bestMatch;
}

/**
 * Resolve zone anchor positions to actual stud coordinates
 * given room dimensions.
 */
function resolveZoneBounds(zone, roomDims) {
    const anchor = ZONE_ANCHORS[zone.position] || ZONE_ANCHORS.center;
    const halfW = roomDims.width / 2;
    const halfD = roomDims.depth / 2;

    return {
        minX: -halfW + anchor.xFrac[0] * roomDims.width,
        maxX: -halfW + anchor.xFrac[1] * roomDims.width,
        minZ: -halfD + anchor.zFrac[0] * roomDims.depth,
        maxZ: -halfD + anchor.zFrac[1] * roomDims.depth,
    };
}

function isInteriorRoomType(roomType) {
    return roomType !== 'town_exterior';
}

function promptRequestsExpandedSurroundings(promptText) {
    const text = String(promptText || '').toLowerCase();
    return /\b(campus|school grounds|schoolyard|playground|bus|parking|drop[- ]off|road|street|sidewalk|courtyard|quad|grounds|outside|neighborhood|block|district|town|city)\b/.test(text);
}

/**
 * Returns true when the prompt explicitly asks for an INTERIOR ONLY scene
 * ("interior", "inside", "within the room", etc.) with no outdoor markers.
 * Used to suppress noisy trees/rocks/grass outside the room.
 */
function promptRequestsInteriorOnly(promptText) {
    const text = String(promptText || '').toLowerCase();
    const hasInteriorWord = /\b(interior|indoors?|inside|in[- ]the[- ]room|view from inside|room only|just the room)\b/.test(text);
    if (!hasInteriorWord) return false;
    // If they also mention ANY outdoor/expanded-world keyword, don't treat as interior-only.
    if (promptRequestsExpandedSurroundings(text)) return false;
    if (/\b(outdoor|exterior|surroundings?|environment|landscape|park|forest|yard|garden|trees|grass field)\b/.test(text)) return false;
    return true;
}

/**
 * Wall thickness must match generateArchitecturalShell (default 1.2).
 * Boards were placed using -halfD + depth/2, which puts them *inside* the wall slab — invisible from the room.
 */
function resolveCustomObjectPosition(custom, bounds, roomDims, groundLevel = 0) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const size = Array.isArray(custom.size) ? custom.size : [4, 4, 4];
    const wallT = typeof custom._wallThickness === 'number' ? custom._wallThickness : 1.2;
    const halfW = roomDims.width / 2;
    const halfD = roomDims.depth / 2;
    // Extra inset (studs) from inner wall plane into the room — keeps boards off z-fighting with drywall.
    const wallGap = typeof custom.wallGap === 'number' ? custom.wallGap : 0.1;

    let x = centerX;
    let z = centerZ;

    if (custom.wallMount === 'front') {
        const innerFaceZ = -halfD + wallT;
        z = innerFaceZ + size[2] / 2 + wallGap;
    } else if (custom.wallMount === 'back') {
        const innerFaceZ = halfD - wallT;
        z = innerFaceZ - size[2] / 2 - wallGap;
    } else if (custom.wallMount === 'left') {
        const innerFaceX = -halfW + wallT;
        x = innerFaceX + size[0] / 2 + wallGap;
    } else if (custom.wallMount === 'right') {
        const innerFaceX = halfW - wallT;
        x = innerFaceX - size[0] / 2 - wallGap;
    }

    if (typeof custom.offsetX === 'number') x += custom.offsetX;
    if (typeof custom.offsetZ === 'number') z += custom.offsetZ;

    const y = typeof custom.elevation === 'number'
        ? groundLevel + custom.elevation
        : groundLevel + size[1] / 2;

    return [x, y, z];
}

/**
 * Convert a room layout into a structured ScenePlan compatible
 * with the existing pipeline.
 */
function applyPromptMaterialOverrides(layout, promptText) {
    // Shallow clone so we don't mutate the shared template.
    const text = String(promptText || '').toLowerCase();
    const overridden = { ...layout };

    if (/\b(?:tile|tiled|tiles)\s+floors?\b|\bfloors?\s+(?:of\s+)?tiles?\b|\bceramic\s+floors?\b|\bchecker(?:ed)?\s+floors?\b/.test(text)) {
        overridden.floorMaterial = 'SmoothPlastic';
        overridden.floorColor = [235, 235, 238];
        overridden._floorIsTile = true;
    }
    if (/\bwood(?:en)?\s+floors?\b|\bhardwood\b|\bparquet\b/.test(text)) {
        overridden.floorMaterial = 'WoodPlanks';
        overridden.floorColor = [150, 108, 68];
    }
    if (/\bconcrete\s+floors?\b|\bcement\s+floors?\b/.test(text)) {
        overridden.floorMaterial = 'Concrete';
        overridden.floorColor = [180, 178, 172];
    }
    if (/\bcarpet(?:ed)?\s+floors?\b|\bcarpet\b/.test(text)) {
        overridden.floorMaterial = 'Fabric';
        overridden.floorColor = [120, 95, 75];
    }
    if (/drop[- ]ceiling|drop[- ]ceiling grid|ceiling\s+(?:tile|tiles|grid|panels)|acoustic ceiling|suspended ceiling/.test(text)) {
        overridden.ceilingMaterial = 'SmoothPlastic';
        overridden.ceilingColor = [238, 238, 240];
        overridden._ceilingIsDropGrid = true;
    }
    if (/\bglass\s+storefront|\bglass\s+front\b/.test(text)) {
        overridden._forceGlassFront = true;
    }
    if (/\bmarble\b|\bmarble\s+floor\b|\bstone\s+tile\b/.test(text)) {
        overridden.floorMaterial = 'Marble';
        overridden.floorColor = [228, 224, 218];
        overridden._floorIsTile = true;
    }
    if (/\blinoleum\b|\bvinyl\b\s+floor\b/.test(text)) {
        overridden.floorMaterial = 'Plastic';
        overridden.floorColor = [210, 215, 220];
    }
    overridden._preferGreenChalkboard = /\b(green\s*board|greenboard|chalk\s*board|chalkboard)\b/.test(text);
    overridden._preferBlackChalkboard = /\bblack\s*board|blackboard\b/.test(text);
    return overridden;
}

function layoutToScenePlan(roomType, roomLayout, promptText) {
    // Apply prompt-driven material overrides BEFORE we read layout fields below.
    roomLayout = applyPromptMaterialOverrides(roomLayout, promptText);
    const dims = roomLayout.defaultDims;
    const zones = [];
    const objects = [];
    const isInterior = isInteriorRoomType(roomType);
    const wantsExpandedWorld = promptRequestsExpandedSurroundings(promptText);
    // Strict "room only" — user said interior/inside/just the room (no exterior layer).
    const interiorOnly = isInterior && !wantsExpandedWorld && promptRequestsInteriorOnly(promptText);
    // No Workspace.Terrain fills for classroom/lobby shells (avoids grass through Part floors).
    // This is independent of exterior *Parts* (roads, trees, buildings) which we still want.
    const skipTerrainOperations = isInterior && !wantsExpandedWorld && (
        interiorOnly
        || roomType === 'classroom'
        || roomType === 'lobby'
    );
    const zoneTerrainMaterial = isInterior
        ? (roomLayout.floorMaterial || 'Concrete')
        : 'Grass';
    let surroundingElements;
    if (!isInterior) {
        surroundingElements = ['trees_sparse', 'roads', 'background_structures', 'lamps'];
    } else if (interiorOnly) {
        // Explicit room-only prompt — no outdoor clutter.
        surroundingElements = [];
    } else if (wantsExpandedWorld) {
        surroundingElements = ['trees_sparse', 'roads', 'background_structures', 'lamps', 'benches'];
    } else if (roomType === 'classroom' || roomType === 'lobby') {
        // Campus ring: roads + institutional shells + lamps + trees — no retail/park-heavy props.
        surroundingElements = ['roads', 'background_structures', 'lamps', 'trees_sparse'];
    } else {
        surroundingElements = ['trees_sparse', 'lamps'];
    }
    const surroundingTerrain = isInterior && !wantsExpandedWorld ? 'Ground' : 'Grass';
    const protectedMargin = isInterior ? 6 : 0;

    for (const zone of roomLayout.zones) {
        const bounds = resolveZoneBounds(zone, dims);
        zones.push({
            name: zone.name,
            purpose: zone.purpose,
            bounds,
            elevation: 0,
            terrainMaterial: zoneTerrainMaterial,
        });

        // Add required template props
        if (Array.isArray(zone.requiredProps)) {
            const templateCounts = {};
            for (const prop of zone.requiredProps) {
                templateCounts[prop] = (templateCounts[prop] || 0) + 1;
            }
            for (const [template, count] of Object.entries(templateCounts)) {
                objects.push({
                    template,
                    count,
                    zone: zone.name,
                    spacing: zone.spacing || 'grid',
                    notes: `${zone.purpose} — ${template}`,
                });
            }
        }

        // Classroom safety rail: keep one dustbin visible near the entry door every time.
        if (roomType === 'classroom' && zone.name === 'entry_area') {
            objects.push({
                template: 'trash_bin',
                count: 1,
                zone: zone.name,
                position: [-(dims.width / 2) + 6.2, 0, (dims.depth / 2) - 4.2],
                rotation: 0,
                notes: 'Forced visible classroom dustbin near back-left door',
            });
        }

        // Add grouping-based furniture
        if (Array.isArray(zone.grouping)) {
            for (const group of zone.grouping) {
                const groupCount = group.count || 1;
                const chairTemplate = group.template.includes('café') ? 'café_chair'
                    : group.template.includes('office') ? 'office_chair'
                    : 'chair';

                // For explicit row/col layouts, compute per-instance positions
                // so desks form neat rows and chairs sit directly behind each desk.
                if (group.layout === 'rows' && group.rows && group.cols) {
                    const rows = group.rows;
                    const cols = group.cols;
                    const rangeX = bounds.maxX - bounds.minX;
                    const rangeZ = bounds.maxZ - bounds.minZ;
                    const marginX = Math.max(rangeX * 0.12, 2);
                    const marginZ = Math.max(rangeZ * 0.12, 2);
                    const usableX = rangeX - marginX * 2;
                    const usableZ = rangeZ - marginZ * 2;
                    const stepX = cols > 1 ? usableX / (cols - 1) : 0;
                    const stepZ = rows > 1 ? usableZ / (rows - 1) : 0;
                    // Chair is placed 2.2 studs behind desk (toward +Z == back of room; students face -Z / front).
                    const chairOffsetZ = 3.1;

                    let placed = 0;
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            if (placed >= groupCount) break;
                            const dx = bounds.minX + marginX + c * stepX;
                            const dz = bounds.minZ + marginZ + r * stepZ;

                            objects.push({
                                template: group.template,
                                count: 1,
                                zone: zone.name,
                                position: [dx, 0, dz],
                                rotation: 0,
                                notes: `Row ${r + 1} col ${c + 1}`,
                            });
                            if (group.chairs) {
                                objects.push({
                                    template: chairTemplate,
                                    count: 1,
                                    zone: zone.name,
                                    position: [dx, 0, dz + chairOffsetZ],
                                    rotation: 180,
                                    notes: `Chair paired with desk r${r + 1}c${c + 1}`,
                                });
                            }
                            placed += 1;
                        }
                        if (placed >= groupCount) break;
                    }
                    continue;
                }

                objects.push({
                    template: group.template,
                    count: groupCount,
                    zone: zone.name,
                    spacing: group.layout || zone.spacing || 'grid',
                    notes: `Grouped ${group.template} × ${groupCount}`,
                });
                if (group.chairs) {
                    objects.push({
                        template: chairTemplate,
                        count: groupCount * group.chairs,
                        zone: zone.name,
                        spacing: 'paired',
                        notes: `Chairs paired with ${group.template}`,
                    });
                }
            }
        }

        // Add custom objects
        if (Array.isArray(zone.customObjects)) {
            for (const custom of zone.customObjects) {
                const position = resolveCustomObjectPosition(custom, bounds, dims, 0);
                objects.push({
                    type: 'custom',
                    name: custom.name,
                    className: custom.className || 'Part',
                    description: custom.name,
                    position,
                    size: custom.size || [4, 4, 4],
                    material: custom.material || 'SmoothPlastic',
                    color: custom.color || [180, 180, 185],
                });
            }
        }
    }

    if (roomLayout._preferBlackChalkboard) {
        for (const o of objects) {
            if (o.type === 'custom' && o.name === 'ChalkBoard') {
                o.color = [26, 28, 30];
                o.material = 'Slate';
            }
        }
    }

    return {
        sceneType: roomLayout.sceneType || 'custom',
        title: `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} Layout`,
        dimensions: { width: dims.width, depth: dims.depth, height: dims.height },
        groundLevel: 0,
        zones,
        objects,
        lighting: {
            timeOfDay: 'default',
            ambience: roomLayout.lighting?.type === 'warm_pendants' ? 'warm' : 'neutral',
            fogDensity: 'none',
            pointLightCount: roomLayout.lighting?.count || 4,
            pointLightColor: roomLayout.lighting?.color || [255, 240, 220],
        },
        environment: {
            generateSurroundings: true,
            expandedWorld: wantsExpandedWorld,
            interiorOnly,
            skipTerrainOperations,
            /** Realistic K–12 campus ring: roads + school wings, not shops/city POIs (see scene-planner + server). */
            schoolCampusExterior: (roomType === 'classroom' || roomType === 'lobby') && !interiorOnly,
            boundaryType: isInterior && !wantsExpandedWorld ? 'invisible_walls' : 'terrain_fade',
            surroundingTerrain,
            surroundingElements,
            mapBoundarySize: {
                width: dims.width * (isInterior
                    ? (wantsExpandedWorld ? 2.4 : interiorOnly ? 1.15 : (roomType === 'classroom' || roomType === 'lobby') ? 1.68 : 1.45)
                    : 1.8),
                depth: dims.depth * (isInterior
                    ? (wantsExpandedWorld ? 2.4 : interiorOnly ? 1.15 : (roomType === 'classroom' || roomType === 'lobby') ? 1.68 : 1.45)
                    : 1.8),
            },
        },
        colorPalette: roomLayout.colorPalette || {
            primary: [180, 180, 185],
            secondary: [140, 140, 145],
            accent: [255, 220, 140],
            style: 'modern_clean',
        },
        _protectedFootprint: {
            minX: -(dims.width / 2) - protectedMargin,
            maxX:  (dims.width / 2) + protectedMargin,
            minZ: -(dims.depth / 2) - protectedMargin,
            maxZ:  (dims.depth / 2) + protectedMargin,
        },
        // Carry layout metadata for the structure builder
        _roomLayout: roomLayout,
        _roomType: roomType,
    };
}

/** Curated Roblox image assets for classroom wall decals (neutral plaster / wood / linen). */
const CLASSROOM_WALL_DECALS = {
    wallpaper: 'rbxassetid://6372946142',
    posterA: 'rbxassetid://2947027747',
    posterB: 'rbxassetid://1084990225',
    posterC: 'rbxassetid://6372946142',
};

/**
 * Extra interior detail for classroom layouts: chair rail, photo-style wallpaper panel,
 * cork bulletin board, and framed poster decals (reads more like a real classroom).
 */
function generateClassroomInteriorEnhancements(roomLayout, dims, gl, wallH, halfW, halfD, wallT, modelName) {
    const instances = [];
    if (roomLayout.sceneType !== 'classroom' || roomLayout.classroomPhotoWalls === false) {
        return instances;
    }

    const inset = wallT / 2 + 0.14;
    const railY = gl + 4.25;
    const railH = 0.28;
    const railD = 0.22;
    const woodRail = [138, 105, 72];
    const doorW = (roomLayout.doorConfig && roomLayout.doorConfig.width) || 4;
    const doorPos = (roomLayout.doorConfig && roomLayout.doorConfig.position) || 'left';
    let doorOffset = 0;
    if (doorPos === 'left') doorOffset = -dims.width * 0.3;
    if (doorPos === 'right') doorOffset = dims.width * 0.3;
    const segGap = doorW + 0.5;

    // Chair rail — right wall (full usable length) + back wall (segments avoiding door gap)
    const rightRailLen = dims.depth * 0.88;
    instances.push({
        className: 'Part',
        parent: modelName,
        properties: {
            Name: 'ChairRail_Right',
            Size: [railD, railH, rightRailLen],
            Position: [halfW - inset, railY, 0],
            Color: woodRail,
            Anchored: true,
            Material: 'Wood',
        },
    });

    const backLeftLen = Math.max(1, (dims.width + doorOffset * 2 - segGap) / 2);
    const backRightLen = Math.max(1, dims.width - backLeftLen - segGap);
    const backRailZ = halfD - inset;
    if (backLeftLen > 1.5) {
        const lOff = doorOffset - segGap / 2 - backLeftLen / 2;
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: 'ChairRail_Back_L',
                Size: [backLeftLen, railH, railD],
                Position: [lOff, railY, backRailZ],
                Color: woodRail,
                Anchored: true,
                Material: 'Wood',
            },
        });
    }
    if (backRightLen > 1.5) {
        const rOff = doorOffset + segGap / 2 + backRightLen / 2;
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: 'ChairRail_Back_R',
                Size: [backRightLen, railH, railD],
                Position: [rOff, railY, backRailZ],
                Color: woodRail,
                Anchored: true,
                Material: 'Wood',
            },
        });
    }

    // Large “wallpaper” panel on right wall (away from windows) — Fabric + photo decal
    const wpW = 0.12;
    const wpH = wallH * 0.72;
    const wpZSpan = dims.depth * 0.78;
    const wpX = halfW - inset;
    const wpY = gl + wallH * 0.42;
    instances.push({
        className: 'Part',
        parent: modelName,
        properties: {
            Name: 'ClassroomWallpaper_Right',
            Size: [wpW, wpH, wpZSpan],
            Position: [wpX, wpY, 0],
            Color: [238, 234, 228],
            Anchored: true,
            Material: 'Fabric',
        },
    });
    instances.push({
        className: 'Decal',
        parent: 'ClassroomWallpaper_Right',
        properties: {
            Name: 'ClassroomWallpaper_Decal',
            Texture: CLASSROOM_WALL_DECALS.wallpaper,
            Face: 'Left',
        },
    });

    // Cork bulletin board on back wall (right side, above chair rail)
    const bbW = Math.min(18, dims.width * 0.32);
    const bbH = 6.2;
    const bbX = Math.min(halfW - bbW * 0.35, 10);
    const bbZ = halfD - wallT / 2 - 0.07;
    instances.push({
        className: 'Part',
        parent: modelName,
        properties: {
            Name: 'BulletinBoard_Back',
            Size: [bbW, bbH, 0.14],
            Position: [bbX, gl + 5.8, bbZ],
            Color: [152, 118, 88],
            Anchored: true,
            Material: 'Fabric',
        },
    });
    // Paper slips on bulletin (slightly toward room center, -Z)
    const slips = [
        { ox: -bbW * 0.25, oz: 0, sw: 3.5, sh: 4.5, c: [250, 248, 235] },
        { ox: bbW * 0.15, oz: 0, sw: 4, sh: 3, c: [235, 245, 255] },
        { ox: bbW * 0.05, oz: 0.06, sw: 3, sh: 2.5, c: [255, 252, 230] },
    ];
    slips.forEach((s, i) => {
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: `BulletinPaper_${i + 1}`,
                Size: [s.sw, s.sh, 0.06],
                Position: [bbX + s.ox, gl + 5.6 + s.oz, bbZ - 0.11],
                Color: s.c,
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        });
    });

    // Framed posters on right wall (stacked along Z)
    const posterZ = [-dims.depth * 0.22, 0, dims.depth * 0.2];
    const posterDecals = [CLASSROOM_WALL_DECALS.posterA, CLASSROOM_WALL_DECALS.posterB, CLASSROOM_WALL_DECALS.posterC];
    const posterH = 5.2;
    const posterW = 6.8;
    const frameT = 0.35;
    posterZ.forEach((zOff, i) => {
        const base = `ClassroomPoster_${i + 1}`;
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: `${base}_Frame`,
                Size: [0.12, posterH + frameT, posterW + frameT],
                Position: [wpX, gl + wallH * 0.48, zOff],
                Color: [95, 78, 58],
                Anchored: true,
                Material: 'Wood',
            },
        });
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: `${base}_Art`,
                Size: [0.08, posterH, posterW],
                Position: [wpX - 0.04, gl + wallH * 0.48, zOff],
                Color: [245, 243, 238],
                Anchored: true,
                Material: 'SmoothPlastic',
            },
        });
        instances.push({
            className: 'Decal',
            parent: `${base}_Art`,
            properties: {
                Name: `${base}_Decal`,
                Texture: posterDecals[i],
                Face: 'Left',
            },
        });
    });

    return instances;
}

/**
 * Generate the architectural shell (floor, walls with openings, ceiling, door)
 * from a room layout. Returns { instances: [] }.
 */
function generateArchitecturalShell(roomLayout, scenePlan) {
    const instances = [];
    const dims = scenePlan.dimensions;
    const gl = scenePlan.groundLevel || 0;
    const halfW = dims.width / 2;
    const halfD = dims.depth / 2;
    const wallH = dims.height;
    const wallT = 1.2;
    const modelName = 'MainBuilding';

    instances.push({
        className: 'Model',
        parent: 'Workspace',
        properties: { Name: modelName },
    });

    // ── Floor ────────────────────────────────────────────────
    instances.push({
        className: 'Part',
        parent: modelName,
        properties: {
            Name: 'MainFloor',
            Size: [dims.width, 1, dims.depth],
            Position: [0, gl + 0.5, 0],
            Color: roomLayout.floorColor || [200, 195, 185],
            Anchored: true,
            Material: roomLayout.floorMaterial || 'Concrete',
        },
    });

    // ── Ceiling ──────────────────────────────────────────────
    instances.push({
        className: 'Part',
        parent: modelName,
        properties: {
            Name: 'Ceiling',
            Size: [dims.width, 0.8, dims.depth],
            Position: [0, gl + wallH + 0.4, 0],
            Color: roomLayout.ceilingColor || [242, 242, 245],
            Anchored: true,
            Material: roomLayout.ceilingMaterial || 'SmoothPlastic',
        },
    });

    // ── Drop-ceiling grid overlay ────────────────────────────
    // Draws thin metal rails across the ceiling to simulate a commercial
    // drop-ceiling tile grid (2×4 ft tiles, scaled to studs).
    if (roomLayout._ceilingIsDropGrid) {
        const tileX = 8;   // stud size of a drop-ceiling tile (X)
        const tileZ = 4;   // stud size of a drop-ceiling tile (Z)
        const railY = gl + wallH - 0.05;
        const railColor = [200, 200, 205];
        const railMaterial = 'Metal';
        // Long-axis rails (run in X across the room, evenly spaced along Z)
        const zLines = Math.max(1, Math.floor(dims.depth / tileZ));
        for (let i = 1; i < zLines; i++) {
            const zPos = -halfD + i * (dims.depth / zLines);
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `CeilingRail_X_${i}`,
                    Size: [dims.width, 0.12, 0.25],
                    Position: [0, railY, zPos],
                    Color: railColor, Anchored: true, Material: railMaterial,
                },
            });
        }
        const xLines = Math.max(1, Math.floor(dims.width / tileX));
        for (let i = 1; i < xLines; i++) {
            const xPos = -halfW + i * (dims.width / xLines);
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `CeilingRail_Z_${i}`,
                    Size: [0.25, 0.12, dims.depth],
                    Position: [xPos, railY, 0],
                    Color: railColor, Anchored: true, Material: railMaterial,
                },
            });
        }
    }

    // ── Tile-floor grid overlay ──────────────────────────────
    // Very thin dark lines on top of the floor to suggest tile seams.
    if (roomLayout._floorIsTile) {
        const seamColor = [200, 200, 203];
        const seamY = gl + 1.02;
        const tileSize = 6;
        const xCount = Math.max(1, Math.floor(dims.width / tileSize));
        const zCount = Math.max(1, Math.floor(dims.depth / tileSize));
        for (let i = 1; i < xCount; i++) {
            const xPos = -halfW + i * (dims.width / xCount);
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `FloorSeam_Z_${i}`,
                    Size: [0.12, 0.05, dims.depth],
                    Position: [xPos, seamY, 0],
                    Color: seamColor, Anchored: true, Material: 'SmoothPlastic',
                },
            });
        }
        for (let i = 1; i < zCount; i++) {
            const zPos = -halfD + i * (dims.depth / zCount);
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `FloorSeam_X_${i}`,
                    Size: [dims.width, 0.05, 0.12],
                    Position: [0, seamY, zPos],
                    Color: seamColor, Anchored: true, Material: 'SmoothPlastic',
                },
            });
        }
    }

    // ── Walls with openings ──────────────────────────────────
    const wallDefs = [
        { side: 'front', axis: 'x', offset: [0, 0, -halfD + wallT / 2], length: dims.width, perpSize: [0, 0, wallT] },
        { side: 'back',  axis: 'x', offset: [0, 0,  halfD - wallT / 2], length: dims.width, perpSize: [0, 0, wallT] },
        { side: 'left',  axis: 'z', offset: [-halfW + wallT / 2, 0, 0], length: dims.depth, perpSize: [wallT, 0, 0] },
        { side: 'right', axis: 'z', offset: [ halfW - wallT / 2, 0, 0], length: dims.depth, perpSize: [wallT, 0, 0] },
    ];

    const doorCfg = roomLayout.doorConfig || {};
    const winCfg = roomLayout.windowConfig || {};
    const wallTreatment = roomLayout.wallTreatment || {};

    for (const wallDef of wallDefs) {
        const treatment = wallTreatment[wallDef.side] || WALL_PRESETS.concrete_clean;
        const hasDoor = doorCfg.wall === wallDef.side;
        const hasWindows = winCfg.wall === wallDef.side;
        const isDoorGlassWall = treatment.hasEntrance && treatment.material === 'Glass';

        if (isDoorGlassWall) {
            // Glass storefront — generate as mostly glass with entrance gap
            const doorW = doorCfg.width || 5;
            const doorH = doorCfg.height || 7.5;
            const segmentGap = doorW + 1;

            // Left glass segment
            const leftLen = (wallDef.length - segmentGap) / 2;
            if (leftLen > 1) {
                const leftX = wallDef.axis === 'x' ? -segmentGap / 2 - leftLen / 2 : 0;
                const leftZ = wallDef.axis === 'z' ? -segmentGap / 2 - leftLen / 2 : 0;
                const size = wallDef.axis === 'x'
                    ? [leftLen, wallH, wallT]
                    : [wallT, wallH, leftLen];

                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Wall_${wallDef.side}_glassL`,
                        Size: size,
                        Position: [
                            wallDef.offset[0] + leftX,
                            gl + wallH / 2,
                            wallDef.offset[2] + leftZ,
                        ],
                        Color: treatment.color || [180, 210, 225],
                        Anchored: true,
                        Material: treatment.material,
                        Transparency: treatment.transparency || 0,
                    },
                });
            }

            // Right glass segment
            const rightLen = leftLen;
            if (rightLen > 1) {
                const rightX = wallDef.axis === 'x' ? segmentGap / 2 + rightLen / 2 : 0;
                const rightZ = wallDef.axis === 'z' ? segmentGap / 2 + rightLen / 2 : 0;
                const size = wallDef.axis === 'x'
                    ? [rightLen, wallH, wallT]
                    : [wallT, wallH, rightLen];

                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Wall_${wallDef.side}_glassR`,
                        Size: size,
                        Position: [
                            wallDef.offset[0] + rightX,
                            gl + wallH / 2,
                            wallDef.offset[2] + rightZ,
                        ],
                        Color: treatment.color || [180, 210, 225],
                        Anchored: true,
                        Material: treatment.material,
                        Transparency: treatment.transparency || 0,
                    },
                });
            }

            // Top transom above door
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Wall_${wallDef.side}_transom`,
                    Size: wallDef.axis === 'x'
                        ? [segmentGap, wallH - doorH, wallT]
                        : [wallT, wallH - doorH, segmentGap],
                    Position: [
                        wallDef.offset[0],
                        gl + doorH + (wallH - doorH) / 2,
                        wallDef.offset[2],
                    ],
                    Color: treatment.color || [180, 210, 225],
                    Anchored: true,
                    Material: treatment.material,
                    Transparency: treatment.transparency || 0,
                },
            });

            // Door frame
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Door_${wallDef.side}`,
                    Size: wallDef.axis === 'x'
                        ? [doorW, doorH, 0.3]
                        : [0.3, doorH, doorW],
                    Position: [
                        wallDef.offset[0],
                        gl + doorH / 2,
                        wallDef.offset[2],
                    ],
                    Color: [100, 75, 45],
                    Anchored: true,
                    Material: 'Wood',
                },
            });
        } else if (hasDoor && !hasWindows) {
            // Solid wall with door opening
            const doorW = doorCfg.width || 4;
            const doorH = doorCfg.height || 7;
            const doorPos = doorCfg.position || 'center';
            let doorOffset = 0;
            if (doorPos === 'left') doorOffset = -wallDef.length * 0.3;
            if (doorPos === 'right') doorOffset = wallDef.length * 0.3;
            const segGap = doorW + 0.5;

            // Left wall segment
            const lLen = (wallDef.length + doorOffset * 2 - segGap) / 2;
            if (lLen > 1) {
                const lOff = wallDef.axis === 'x' ? doorOffset - segGap / 2 - lLen / 2 : 0;
                const lOffZ = wallDef.axis === 'z' ? doorOffset - segGap / 2 - lLen / 2 : 0;
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Wall_${wallDef.side}_L`,
                        Size: wallDef.axis === 'x' ? [lLen, wallH, wallT] : [wallT, wallH, lLen],
                        Position: [wallDef.offset[0] + lOff, gl + wallH / 2, wallDef.offset[2] + lOffZ],
                        Color: treatment.color, Anchored: true, Material: treatment.material,
                    },
                });
            }
            // Right wall segment
            const rLen = wallDef.length - lLen - segGap;
            if (rLen > 1) {
                const rOff = wallDef.axis === 'x' ? doorOffset + segGap / 2 + rLen / 2 : 0;
                const rOffZ = wallDef.axis === 'z' ? doorOffset + segGap / 2 + rLen / 2 : 0;
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Wall_${wallDef.side}_R`,
                        Size: wallDef.axis === 'x' ? [rLen, wallH, wallT] : [wallT, wallH, rLen],
                        Position: [wallDef.offset[0] + rOff, gl + wallH / 2, wallDef.offset[2] + rOffZ],
                        Color: treatment.color, Anchored: true, Material: treatment.material,
                    },
                });
            }
            // Above-door
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Wall_${wallDef.side}_aboveDoor`,
                    Size: wallDef.axis === 'x' ? [segGap, wallH - doorH, wallT] : [wallT, wallH - doorH, segGap],
                    Position: [
                        wallDef.offset[0] + (wallDef.axis === 'x' ? doorOffset : 0),
                        gl + doorH + (wallH - doorH) / 2,
                        wallDef.offset[2] + (wallDef.axis === 'z' ? doorOffset : 0),
                    ],
                    Color: treatment.color, Anchored: true, Material: treatment.material,
                },
            });
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Door_${wallDef.side}`,
                    Size: wallDef.axis === 'x' ? [doorW, doorH, 0.3] : [0.3, doorH, doorW],
                    Position: [
                        wallDef.offset[0] + (wallDef.axis === 'x' ? doorOffset : 0),
                        gl + doorH / 2,
                        wallDef.offset[2] + (wallDef.axis === 'z' ? doorOffset : 0),
                    ],
                    Color: [102, 74, 48], Anchored: true, Material: 'Wood',
                },
            });
        } else if (hasWindows && !hasDoor) {
            // Full wall with window openings
            const winCount = winCfg.count || 2;
            const winW = winCfg.width || 4;
            const winH = winCfg.height || 5;
            const winElev = winCfg.elevation || 4;
            const spacing = wallDef.length / (winCount + 1);

            // Bottom strip (below windows)
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Wall_${wallDef.side}_bottom`,
                    Size: wallDef.axis === 'x' ? [wallDef.length, winElev, wallT] : [wallT, winElev, wallDef.length],
                    Position: [wallDef.offset[0], gl + winElev / 2, wallDef.offset[2]],
                    Color: treatment.color, Anchored: true, Material: treatment.material,
                },
            });
            // Top strip (above windows)
            const topH = wallH - winElev - winH;
            if (topH > 0.5) {
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Wall_${wallDef.side}_top`,
                        Size: wallDef.axis === 'x' ? [wallDef.length, topH, wallT] : [wallT, topH, wallDef.length],
                        Position: [wallDef.offset[0], gl + winElev + winH + topH / 2, wallDef.offset[2]],
                        Color: treatment.color, Anchored: true, Material: treatment.material,
                    },
                });
            }
            // Pillars between windows and window glass
            for (let w = 0; w < winCount; w++) {
                const frac = (w + 1) / (winCount + 1);
                const wOff = -wallDef.length / 2 + frac * wallDef.length;
                const winPosX = wallDef.axis === 'x' ? wOff : 0;
                const winPosZ = wallDef.axis === 'z' ? wOff : 0;

                // Window glass
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Window_${wallDef.side}_${w + 1}_glass`,
                        Size: wallDef.axis === 'x' ? [winW, winH, 0.15] : [0.15, winH, winW],
                        Position: [wallDef.offset[0] + winPosX, gl + winElev + winH / 2, wallDef.offset[2] + winPosZ],
                        Color: [170, 205, 225], Anchored: true, Material: 'Glass', Transparency: 0.45,
                    },
                });
                // Window frame
                instances.push({
                    className: 'Part',
                    parent: modelName,
                    properties: {
                        Name: `Window_${wallDef.side}_${w + 1}_frame`,
                        Size: wallDef.axis === 'x' ? [winW + 0.6, winH + 0.6, 0.3] : [0.3, winH + 0.6, winW + 0.6],
                        Position: [wallDef.offset[0] + winPosX, gl + winElev + winH / 2, wallDef.offset[2] + winPosZ],
                        Color: [165, 162, 158], Anchored: true, Material: 'Metal',
                    },
                });
            }
            // Wall segments between windows (pillars)
            for (let p = 0; p <= winCount; p++) {
                const leftEdge = p === 0 ? -wallDef.length / 2 : -wallDef.length / 2 + (p / (winCount + 1)) * wallDef.length + winW / 2;
                const rightEdge = p === winCount ? wallDef.length / 2 : -wallDef.length / 2 + ((p + 1) / (winCount + 1)) * wallDef.length - winW / 2;
                const pillarLen = rightEdge - leftEdge;
                if (pillarLen > 0.5) {
                    const pillarCenter = (leftEdge + rightEdge) / 2;
                    instances.push({
                        className: 'Part',
                        parent: modelName,
                        properties: {
                            Name: `Wall_${wallDef.side}_pillar_${p}`,
                            Size: wallDef.axis === 'x' ? [pillarLen, winH, wallT] : [wallT, winH, pillarLen],
                            Position: [
                                wallDef.offset[0] + (wallDef.axis === 'x' ? pillarCenter : 0),
                                gl + winElev + winH / 2,
                                wallDef.offset[2] + (wallDef.axis === 'z' ? pillarCenter : 0),
                            ],
                            Color: treatment.color, Anchored: true, Material: treatment.material,
                        },
                    });
                }
            }
        } else {
            // Simple solid wall (no openings)
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Wall_${wallDef.side}`,
                    Size: wallDef.axis === 'x' ? [wallDef.length, wallH, wallT] : [wallT, wallH, wallDef.length],
                    Position: [wallDef.offset[0], gl + wallH / 2, wallDef.offset[2]],
                    Color: treatment.color, Anchored: true, Material: treatment.material,
                    Transparency: treatment.transparency || 0,
                },
            });
        }
    }

    // ── Baseboards (classroom): floor-line trim so wall/wall/ceiling corners read as real edges ─
    if (roomLayout.sceneType === 'classroom') {
        const floorTop = gl + 1;
        const bbH = 0.42;
        const bbY = floorTop + bbH / 2;
        const bbColor = [88, 82, 76];
        const bbThick = 0.14;
        const innerZFront = -halfD + wallT + bbThick * 0.5;
        const innerZBack = halfD - wallT - bbThick * 0.5;
        const innerXLeft = -halfW + wallT + bbThick * 0.5;
        const innerXRight = halfW - wallT - bbThick * 0.5;
        const inset = 1.2;
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: 'Baseboard_front',
                Size: [dims.width - inset * 2, bbH, bbThick],
                Position: [0, bbY, innerZFront],
                Color: bbColor,
                Anchored: true,
                Material: 'Wood',
            },
        });
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: 'Baseboard_back',
                Size: [dims.width - inset * 2, bbH, bbThick],
                Position: [0, bbY, innerZBack],
                Color: bbColor,
                Anchored: true,
                Material: 'Wood',
            },
        });
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: 'Baseboard_left',
                Size: [bbThick, bbH, dims.depth - inset * 2],
                Position: [innerXLeft, bbY, 0],
                Color: bbColor,
                Anchored: true,
                Material: 'Wood',
            },
        });
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: 'Baseboard_right',
                Size: [bbThick, bbH, dims.depth - inset * 2],
                Position: [innerXRight, bbY, 0],
                Color: bbColor,
                Anchored: true,
                Material: 'Wood',
            },
        });
    }

    // ── Interior separator walls for separated zones ─────────
    for (const zone of roomLayout.zones) {
        if (!zone.separated) continue;
        const bounds = resolveZoneBounds(zone, dims);
        const sepMat = zone.separatorMaterial || 'wall_full';
        const sepH = sepMat === 'wall_half' ? wallH * 0.55 : wallH;
        const sepColor = sepMat === 'wall_half' ? [210, 208, 205] : [225, 222, 218];

        // Determine which edge to place the separator on
        if (zone.position.includes('left') || zone.position.includes('right')) {
            const sepX = zone.position.includes('left') ? bounds.maxX : bounds.minX;
            const sepLen = bounds.maxZ - bounds.minZ;
            const sepCenterZ = (bounds.minZ + bounds.maxZ) / 2;
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Separator_${zone.name}`,
                    Size: [0.8, sepH, sepLen],
                    Position: [sepX, gl + sepH / 2, sepCenterZ],
                    Color: sepColor,
                    Anchored: true,
                    Material: 'Concrete',
                },
            });
        } else {
            const sepZ = zone.position.includes('back') ? bounds.minZ : bounds.maxZ;
            const sepLen = bounds.maxX - bounds.minX;
            const sepCenterX = (bounds.minX + bounds.maxX) / 2;
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `Separator_${zone.name}`,
                    Size: [sepLen, sepH, 0.8],
                    Position: [sepCenterX, gl + sepH / 2, sepZ],
                    Color: sepColor,
                    Anchored: true,
                    Material: 'Concrete',
                },
            });
        }
    }

    // ── Interior lighting ────────────────────────────────────
    const lightCfg = roomLayout.lighting || {};
    const lightCount = lightCfg.count || 4;
    const lightColor = lightCfg.color || [255, 240, 220];
    const lightBrightness = lightCfg.brightness || 1.2;
    const lightRange = lightCfg.range || 24;
    const isPendant = lightCfg.type === 'warm_pendants';

    const lightCols = Math.ceil(Math.sqrt(lightCount));
    const lightRows = Math.ceil(lightCount / lightCols);

    for (let i = 0; i < lightCount; i++) {
        const row = Math.floor(i / lightCols);
        const col = i % lightCols;
        const lx = -halfW * 0.7 + (col + 0.5) * (dims.width * 0.7 / lightCols);
        const lz = -halfD * 0.7 + (row + 0.5) * (dims.depth * 0.7 / lightRows);
        const ly = gl + wallH - (isPendant ? 2.5 : 0.3);
        const lightName = `Light_${i + 1}`;

        if (isPendant) {
            // Pendant cord
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `PendantCord_${i + 1}`,
                    Size: [0.1, 2.2, 0.1],
                    Position: [lx, gl + wallH - 1.1, lz],
                    Color: [60, 58, 55],
                    Anchored: true,
                    Material: 'Metal',
                },
            });
            // Pendant shade
            instances.push({
                className: 'Part',
                parent: modelName,
                properties: {
                    Name: `PendantShade_${i + 1}`,
                    Size: [2.5, 1.2, 2.5],
                    Position: [lx, ly, lz],
                    Color: [55, 52, 48],
                    Anchored: true,
                    Material: 'Metal',
                },
            });
        }

        // Light bulb / emitter
        instances.push({
            className: 'Part',
            parent: modelName,
            properties: {
                Name: lightName,
                Size: isPendant ? [1.5, 0.5, 1.5] : [3, 0.3, 3],
                Position: [lx, ly - (isPendant ? 0.6 : 0), lz],
                Color: lightColor,
                Anchored: true,
                Material: 'Neon',
                Transparency: 0.15,
            },
        });

        // PointLight
        instances.push({
            className: 'PointLight',
            parent: lightName,
            properties: {
                Name: 'Glow',
                Brightness: lightBrightness,
                Range: lightRange,
                Color: lightColor,
            },
        });
    }

    instances.push(
        ...generateClassroomInteriorEnhancements(roomLayout, dims, gl, wallH, halfW, halfD, wallT, modelName),
    );

    return { instances };
}

/**
 * Render fully-specified custom objects (whiteboard, teacher desk, etc.)
 * from a scenePlan into concrete Roblox Part instances. These are objects
 * with type === 'custom' that already have position/size/material/color.
 * Returns { instances: [] }.
 */
function generateCustomObjectInstances(scenePlan, parentModelName = 'MainBuilding') {
    const instances = [];
    if (!scenePlan || !Array.isArray(scenePlan.objects)) {
        return { instances };
    }
    for (const obj of scenePlan.objects) {
        if (obj.type !== 'custom') continue;
        if (!Array.isArray(obj.position) || !Array.isArray(obj.size)) continue;

        const props = {
            Name: String(obj.name || 'CustomProp').slice(0, 64),
            Size: obj.size,
            Position: obj.position,
            Color: obj.color || [180, 180, 185],
            Anchored: true,
            Material: obj.material || 'SmoothPlastic',
        };
        if (typeof obj.reflectance === 'number') {
            props.Reflectance = obj.reflectance;
        } else if (/whiteboard/i.test(String(obj.name)) && /Plastic|SmoothPlastic/i.test(String(obj.material))) {
            props.Reflectance = 0.12;
        }
        if (/chalk|whiteboard|board/i.test(String(obj.name))) {
            props.CastShadow = true;
        }
        instances.push({
            className: obj.className || 'Part',
            parent: parentModelName,
            properties: props,
        });
    }
    return { instances };
}

/**
 * Get a text summary of all available room types for prompt injection.
 */
function getRoomTypeCatalogText() {
    const lines = ['Available room-type presets (use when the prompt matches):'];
    for (const [key, layout] of Object.entries(ROOM_LAYOUTS)) {
        const zoneNames = layout.zones.map(z => z.name).join(', ');
        lines.push(
            `  • ${key} (aliases: ${layout.aliases.join(', ')}) — ${layout.zones.length} zones: ${zoneNames}`
        );
    }
    return lines.join('\n');
}

module.exports = {
    ROOM_LAYOUTS,
    ZONE_ANCHORS,
    WALL_PRESETS,
    identifyRoomType,
    resolveZoneBounds,
    layoutToScenePlan,
    generateArchitecturalShell,
    generateCustomObjectInstances,
    getRoomTypeCatalogText,
    promptRequestsExpandedSurroundings,
    promptRequestsInteriorOnly,
};
