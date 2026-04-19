#!/usr/bin/env node
// ============================================================
//  Roblox AI Plugin — Image Reference Pipeline Test
//
//  Runs two test suites:
//
//  1. OFFLINE UNIT TESTS (no server needed)
//     • Verifies image-analyzer prompt & client config
//     • Tests analysisToOverrides() with 3 reference scenarios
//     • Prints full override bundles + summary cards
//
//  2. LIVE SERVER INTEGRATION TESTS (requires: npm run dev)
//     • Sends real HTTP POST /generate requests with image URLs
//     • Each test case = distinct room type + reference image
//     • Prints extracted analysis card + generation stats
//
//  Usage:
//    # Offline only (unit tests, no server required)
//    node test-image-pipeline.js
//
//    # Full test (unit + live server)
//    node test-image-pipeline.js --live
//
//    # Single scenario
//    node test-image-pipeline.js --live --case=office
//    node test-image-pipeline.js --live --case=corridor
//    node test-image-pipeline.js --live --case=exterior
// ============================================================

'use strict';

require('dotenv').config();

const http  = require('http');
const chalk = (() => {
    // Minimal inline colour without a dependency
    const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
    return { green: s => c(32, s), red: s => c(31, s), yellow: s => c(33, s),
             cyan: s => c(36, s), bold: s => c(1, s), dim: s => c(2, s),
             magenta: s => c(35, s), blue: s => c(34, s) };
})();

const SERVER_URL = 'http://localhost:3000';
const LIVE_MODE  = process.argv.includes('--live');
const CASE_FILTER = (process.argv.find(a => a.startsWith('--case=')) || '').replace('--case=', '') || null;

// ══════════════════════════════════════════════════════════════
// REFERENCE IMAGES  (3 distinct scene types)
// All URLs are publicly accessible, high-resolution references.
// ══════════════════════════════════════════════════════════════

const REFERENCE_IMAGES = {

    // ── Case 1: Formal Interior (Oval Office style) ──────────
    office: {
        label: 'Formal Presidential Office',
        prompt: 'Build a grand formal office with marble columns, a fireplace, gold drapes, and herringbone hardwood floor — like the Oval Office. Add a large executive desk at the center-back with two sofas facing each other.',
        expectedRoomType: 'formal_office',
        images: [
            {
                type: 'url',
                label: 'Oval Office reference',
                // White House Oval Office — public domain US Gov photo
                value: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/White_House%2C_Oval_Office%2C_2009.jpg/1280px-White_House%2C_Oval_Office%2C_2009.jpg',
            },
        ],
    },

    // ── Case 2: Sci-Fi Corridor ──────────────────────────────
    corridor: {
        label: 'Futuristic Sci-Fi Corridor',
        prompt: 'Build a long futuristic sci-fi corridor with illuminated wall panels and neon trim. The hallway should be narrow and tall with a dark metal ceiling grid and fluorescent tube lights. Add hedge planters along the sides.',
        expectedRoomType: 'corridor',
        images: [
            {
                type: 'url',
                label: 'Sci-fi corridor reference',
                // Creative Commons futuristic corridor image
                value: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg',
                // Note: Wikimedia redirects for demo; in production, use actual scene image
            },
            {
                type: 'url',
                label: 'Alt corridor lighting',
                value: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
            },
        ],
    },

    // ── Case 3: Exterior Town / Society ──────────────────────
    exterior: {
        label: 'Low-Poly Town Exterior',
        prompt: 'Build a complete residential neighborhood with roads, houses, trees, a police station, a school, and a park with a fountain. Low-poly cartoon style with bright green grass and colorful rooftops.',
        expectedRoomType: 'town_exterior',
        images: [
            {
                type: 'url',
                label: 'Suburban neighborhood aerial',
                // Public domain aerial suburb photo
                value: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Suburbs_of_Colorado_Springs.jpg/1280px-Suburbs_of_Colorado_Springs.jpg',
            },
        ],
    },

    // ── Case 4: Café Interior ─────────────────────────────────
    café: {
        label: 'Cozy Coffee-Shop Café',
        prompt: 'Build a warm cozy café with exposed brick walls, wooden tables, pendant lights, a barista counter with espresso machines, chalk menu boards, and large windows letting in natural light.',
        expectedRoomType: 'café',
        images: [
            {
                type: 'url',
                label: 'Cozy café interior reference',
                value: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
            },
        ],
    },
};

// ══════════════════════════════════════════════════════════════
// OFFLINE UNIT TESTS
// ══════════════════════════════════════════════════════════════

async function runOfflineTests() {
    console.log(chalk.bold('\n╔═══════════════════════════════════════════╗'));
    console.log(chalk.bold('║   OFFLINE UNIT TESTS — No server needed   ║'));
    console.log(chalk.bold('╚═══════════════════════════════════════════╝\n'));

    // ── Test 1: Vision client config ──────────────────────────
    console.log(chalk.cyan('▶ Test 1 — Vision client configuration'));
    const { createVisionClient, DEEP_EXTRACTION_PROMPT } = require('./image-analyzer');
    const client = createVisionClient();
    if (!client) {
        console.log(chalk.red('  ❌ Vision client not configured — check .env'));
    } else {
        console.log(chalk.green(`  ✅ model  : ${client.model}`));
        console.log(chalk.green(`  ✅ detail : ${client.detail}`));
        console.log(chalk.green(`  ✅ baseURL set`));
        const words = DEEP_EXTRACTION_PROMPT.split(/\s+/).length;
        const fields = (DEEP_EXTRACTION_PROMPT.match(/"[a-zA-Z_]+"\s*:/g) || []).length;
        console.log(chalk.green(`  ✅ deep extraction prompt: ${words} words, ${fields} JSON fields extracted`));
    }

    // ── Test 2: analysisToOverrides for each scenario ─────────
    console.log(chalk.cyan('\n▶ Test 2 — analysisToOverrides() per scenario'));
    const { analysisToOverrides, buildAnalysisSummaryCard, mergeOverridesIntoLayout } = require('./image-to-layout');
    const { ROOM_LAYOUTS } = require('./room-layouts');

    const mockAnalyses = {
        // --- Oval Office mock ---
        office: {
            sceneCategory: 'interior', roomType: 'formal_office', confidence: 0.94,
            dimensions: { widthStuds: 72, depthStuds: 54, heightStuds: 16, aspectRatio: 'landscape' },
            architecture: { shape: 'oval', hasColumns: true, columnCount: 6, columnStyle: 'doric', hasFireplace: true, ceilingType: 'coffered' },
            walls: {
                front: { material: 'Fabric', color: [85, 120, 65], hasWindows: true, windowCount: 3, windowStyle: 'floor-to-ceiling', treatment: 'curtains' },
                back:  { material: 'SmoothPlastic', color: [230, 220, 195], hasWindows: false, windowCount: 0, windowStyle: 'none', treatment: 'paneling' },
                left:  { material: 'SmoothPlastic', color: [235, 225, 200], hasWindows: false, windowCount: 0, windowStyle: 'none', treatment: 'wainscoting' },
                right: { material: 'SmoothPlastic', color: [235, 225, 200], hasWindows: false, windowCount: 0, windowStyle: 'none', treatment: 'wainscoting' },
            },
            floor: { material: 'WoodPlanks', color: [140, 90, 45], pattern: 'herringbone', hasRug: true, rugColor: [140, 30, 25] },
            ceiling: { material: 'SmoothPlastic', color: [245, 242, 238], hasBeams: false, hasSkylight: false, height: 16 },
            lighting: { type: 'chandelier', color: [255, 228, 175], intensity: 'moderate', mood: 'warm', hasShadows: true, timeOfDay: 'indoor', ambientColor: [58, 48, 38] },
            props: [
                { name: 'Resolute_Desk', category: 'table', sizeClass: 'large', material: 'Wood', color: [110, 75, 35], zone: 'back-center', count: 1, isRequired: true },
                { name: 'Presidential_Chair', category: 'seating', sizeClass: 'large', material: 'Fabric', color: [55, 80, 45], zone: 'back-center', count: 1, isRequired: true },
                { name: 'Sofa', category: 'seating', sizeClass: 'large', material: 'Fabric', color: [75, 100, 60], zone: 'center', count: 2, isRequired: true },
                { name: 'Doric_Column', category: 'structural', sizeClass: 'xlarge', material: 'Marble', color: [240, 237, 232], zone: 'perimeter', count: 6, isRequired: true },
                { name: 'Gold_Drapes', category: 'decor', sizeClass: 'large', material: 'Fabric', color: [200, 165, 55], zone: 'front-center', count: 3, isRequired: true },
                { name: 'Fireplace', category: 'structural', sizeClass: 'xlarge', material: 'Marble', color: [240, 237, 232], zone: 'back-center', count: 1, isRequired: true },
                { name: 'Oval_Rug', category: 'decor', sizeClass: 'xlarge', material: 'Fabric', color: [140, 30, 25], zone: 'center', count: 1, isRequired: true },
                { name: 'Flag_Stand', category: 'decor', sizeClass: 'medium', material: 'Metal', color: [200, 170, 50], zone: 'front-left', count: 2, isRequired: false },
            ],
            specialElements: { hasDrapes: true, drapeColor: [200, 165, 55], hasIlluminatedPanels: false, hasHedgePlanters: false, hasFountain: false },
            exterior: { isExterior: false },
            colorPalette: { primary: [85, 120, 65], secondary: [240, 237, 232], accent: [200, 165, 55], background: [245, 242, 238], artStyle: 'formal' },
            overrides: { forceDimensions: true, forceWallMaterials: true, forceColorPalette: true, forceLighting: true },
            generationNotes: 'Oval room shape; 6 Doric marble columns along perimeter arc; gold drape panels on all 3 south-facing floor-to-ceiling windows; herringbone oak floor with red oval rug; white coffered ceiling; cream/sage green color scheme; chandelier lighting warm mood',
        },

        // --- Sci-fi corridor mock ---
        corridor: {
            sceneCategory: 'interior', roomType: 'corridor', confidence: 0.88,
            dimensions: { widthStuds: 18, depthStuds: 90, heightStuds: 14, aspectRatio: 'tunnel (4:1+)' },
            architecture: { shape: 'corridor', hasColumns: false, columnCount: 0, columnStyle: 'none', hasFireplace: false, ceilingType: 'grid' },
            walls: {
                front: { material: 'SmoothPlastic', color: [200, 210, 225], hasWindows: false, windowCount: 0, windowStyle: 'none', treatment: 'paneling' },
                back:  { material: 'SmoothPlastic', color: [200, 210, 225], hasWindows: false, windowCount: 0, windowStyle: 'none', treatment: 'paneling' },
                left:  { material: 'SmoothPlastic', color: [220, 228, 238], hasWindows: false, windowCount: 8, windowStyle: 'floor-to-ceiling', treatment: 'paneling' },
                right: { material: 'SmoothPlastic', color: [220, 228, 238], hasWindows: false, windowCount: 8, windowStyle: 'floor-to-ceiling', treatment: 'paneling' },
            },
            floor: { material: 'Concrete', color: [80, 82, 88], pattern: 'none', hasRug: false },
            ceiling: { material: 'Metal', color: [50, 52, 58], hasBeams: true, hasSkylight: false, height: 14 },
            lighting: { type: 'tube', color: [200, 215, 255], intensity: 'bright', mood: 'cool', hasShadows: false, timeOfDay: 'indoor', ambientColor: [30, 32, 42] },
            props: [
                { name: 'Illuminated_Panel', category: 'structural', sizeClass: 'large', material: 'Neon', color: [200, 215, 255], zone: 'perimeter', count: 16, isRequired: true },
                { name: 'Ceiling_Beam', category: 'structural', sizeClass: 'large', material: 'Metal', color: [50, 52, 58], zone: 'ceiling', count: 10, isRequired: true },
                { name: 'Column_Support', category: 'structural', sizeClass: 'medium', material: 'Metal', color: [60, 62, 68], zone: 'perimeter', count: 8, isRequired: false },
                { name: 'Hedge_Planter', category: 'plant', sizeClass: 'medium', material: 'Grass', color: [55, 130, 48], zone: 'center-left', count: 4, isRequired: false },
                { name: 'Ceiling_Light_Tube', category: 'lighting', sizeClass: 'large', material: 'Neon', color: [180, 200, 255], zone: 'ceiling', count: 8, isRequired: true },
            ],
            specialElements: { hasIlluminatedPanels: true, panelColor: [200, 215, 255], hasHedgePlanters: true, hasDrapes: false, hasFountain: false },
            exterior: { isExterior: false },
            colorPalette: { primary: [50, 52, 58], secondary: [200, 215, 255], accent: [120, 180, 255], background: [25, 27, 35], artStyle: 'futuristic' },
            overrides: { forceDimensions: true, forceWallMaterials: true, forceColorPalette: true, forceLighting: true },
            generationNotes: 'Extreme 5:1 aspect ratio tunnel; white glowing panels cover full wall height with Neon emissive material; dark metal ceiling grid with fluorescent tube lights; concrete floor with dark trim; hedge planters in center aisle; cool blue-white neon lighting mood',
        },

        // --- Low-poly town exterior mock ---
        exterior: {
            sceneCategory: 'exterior', roomType: 'town_exterior', confidence: 0.91,
            dimensions: { widthStuds: 280, depthStuds: 280, heightStuds: 0, aspectRatio: 'square' },
            architecture: { shape: 'open', hasColumns: false, columnCount: 0, columnStyle: 'none', hasFireplace: false, ceilingType: 'none' },
            walls: { front: { material: 'Grass', color: [65, 150, 55] }, back: { material: 'Grass', color: [65, 150, 55] }, left: { material: 'Grass', color: [65, 150, 55] }, right: { material: 'Grass', color: [65, 150, 55] } },
            floor: { material: 'Grass', color: [65, 150, 55], pattern: 'none', hasRug: false },
            ceiling: { material: 'none', color: [135, 185, 235], hasBeams: false, hasSkylight: true, height: 0 },
            lighting: { type: 'natural', color: [255, 248, 225], intensity: 'bright', mood: 'warm', hasShadows: true, timeOfDay: 'noon', ambientColor: [120, 140, 160] },
            props: [
                { name: 'Suburban_House', category: 'structural', sizeClass: 'xlarge', material: 'Brick', color: [180, 110, 75], zone: 'perimeter', count: 12, isRequired: true },
                { name: 'Cone_Pine_Tree', category: 'plant', sizeClass: 'large', material: 'Grass', color: [48, 118, 42], zone: 'perimeter', count: 24, isRequired: true },
                { name: 'Road_Segment', category: 'structural', sizeClass: 'xlarge', material: 'Asphalt', color: [42, 42, 46], zone: 'center', count: 8, isRequired: true },
                { name: 'Lamp_Post', category: 'lighting', sizeClass: 'medium', material: 'Metal', color: [68, 68, 74], zone: 'perimeter', count: 16, isRequired: false },
                { name: 'Street_Bench', category: 'seating', sizeClass: 'small', material: 'Wood', color: [115, 78, 38], zone: 'perimeter', count: 8, isRequired: false },
                { name: 'School_Building', category: 'structural', sizeClass: 'xlarge', material: 'Brick', color: [165, 68, 45], zone: 'front-left', count: 1, isRequired: true },
                { name: 'Police_Station', category: 'structural', sizeClass: 'xlarge', material: 'SmoothPlastic', color: [235, 235, 238], zone: 'back-right', count: 1, isRequired: true },
            ],
            specialElements: { hasStreetFurniture: true, hasRoadMarkings: true, hasCrosswalk: true, hasTreeLine: true, hasFountain: true, hasPlayground: true, hasParkedVehicles: true },
            exterior: {
                isExterior: true, roadType: 'asphalt', roadLayout: 'grid',
                hasResidential: true, hasCivic: true, hasCommercial: true, hasPark: true,
                vegetationType: 'pine_trees', treeCount: 'many', buildingStyles: ['cottage', 'modern', 'commercial'],
            },
            colorPalette: { primary: [65, 150, 55], secondary: [255, 255, 255], accent: [255, 200, 80], background: [135, 185, 235], artStyle: 'low_poly' },
            overrides: { forceDimensions: true, forceColorPalette: true, forceWallMaterials: false, forceLighting: true },
            generationNotes: 'Full grid road network; 3-zone society layout (residential/civic/commercial); low-poly style with bright cartoon colors; daytime noon sun; park with fountain at center; school and police station as civic landmarks',
        },
    };

    let unitPass = 0, unitFail = 0;
    for (const [caseKey, analysis] of Object.entries(mockAnalyses)) {
        const scenario = REFERENCE_IMAGES[caseKey];
        console.log(chalk.bold(`\n  [${caseKey.toUpperCase()}] ${scenario.label}`));

        const overrides = analysisToOverrides(analysis, scenario.prompt);
        const card = buildAnalysisSummaryCard(analysis, overrides);

        // Check: room type resolved
        const roomOK = overrides.detectedRoomType === scenario.expectedRoomType;
        console.log(`    ${roomOK ? chalk.green('✅') : chalk.red('❌')} roomType   : ${overrides.detectedRoomType} (expected: ${scenario.expectedRoomType})`);
        if (roomOK) unitPass++; else unitFail++;

        // Check: confidence
        const confOK = overrides.confidence >= 0.7;
        console.log(`    ${confOK ? chalk.green('✅') : chalk.yellow('⚠️ ')} confidence : ${card.confidenceLabel} (${overrides.confidence})`);
        if (confOK) unitPass++; else unitFail++;

        // Show dimensions
        if (overrides.dimensions) {
            const d = overrides.dimensions;
            console.log(`    ${chalk.green('✅')} dimensions : ${d.width}w × ${d.depth}d × ${d.height}h studs`);
            unitPass++;
        }

        // Show walls
        if (overrides.wallOverrides?.front) {
            console.log(`    ${chalk.green('✅')} wall front : ${overrides.wallOverrides.front.material} rgb(${overrides.wallOverrides.front.color})`);
            unitPass++;
        }

        // Show lighting
        if (overrides.lightOverride) {
            const l = overrides.lightOverride;
            console.log(`    ${chalk.green('✅')} lighting   : ${l.type} | ${l.mood} | brightness ${l.brightness}`);
            unitPass++;
        }

        // Show special flags
        console.log(`    ${chalk.green('ℹ️ ')} flags      : ${card.specialFlags.join(', ') || '(none)'}`);

        // Show required props
        console.log(`    ${chalk.green('ℹ️ ')} props      : ${overrides.props.length} total, ${overrides.props.filter(p=>p.required).length} required`);
        if (card.requiredProps.length > 0) {
            console.log(`    ${chalk.dim('    required : ' + card.requiredProps.slice(0,5).join(', ') + (card.requiredProps.length > 5 ? ' …' : ''))}`);
        }

        // Merge test
        if (ROOM_LAYOUTS[overrides.detectedRoomType]) {
            const merged = mergeOverridesIntoLayout(ROOM_LAYOUTS[overrides.detectedRoomType], overrides);
            const mergeOK = merged.defaultDims?.width === overrides.dimensions?.width;
            console.log(`    ${mergeOK ? chalk.green('✅') : chalk.red('❌')} mergeLayout: dims applied → ${JSON.stringify(merged.defaultDims)}`);
            if (mergeOK) unitPass++; else unitFail++;
        }

        console.log(`    ${chalk.dim('notes: ' + analysis.generationNotes.slice(0, 90) + '…')}`);
    }

    console.log(chalk.bold(`\n  UNIT TEST RESULT: ${chalk.green(unitPass + ' passed')}, ${unitFail > 0 ? chalk.red(unitFail + ' failed') : chalk.green('0 failed')}`));
    return unitFail === 0;
}

// ══════════════════════════════════════════════════════════════
// LIVE SERVER INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════

function httpPost(path, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const opts = {
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk.toString(); });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: { raw: data.slice(0, 200) } }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(120000, () => req.destroy(new Error('Timeout')));
        req.write(payload);
        req.end();
    });
}

async function checkServerAlive() {
    return new Promise(resolve => {
        const req = http.get(`${SERVER_URL}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    });
}

async function runLiveTest(caseKey, scenario) {
    const convId = `test-${caseKey}-${Date.now()}`;
    console.log(chalk.bold(`\n┌─ [${caseKey.toUpperCase()}] ${scenario.label}`));
    console.log(chalk.dim(`│  prompt: "${scenario.prompt.slice(0, 80)}…"`));
    console.log(chalk.dim(`│  images: ${scenario.images.length} reference image(s)`));

    const startTime = Date.now();

    let response;
    try {
        response = await httpPost('/generate', {
            prompt: scenario.prompt,
            conversationId: convId,
            mode: 'detailed',
            generateEnv: true,
            referenceImages: scenario.images,
        });
    } catch (err) {
        console.log(chalk.red(`│  ❌ Request failed: ${err.message}`));
        console.log('└─');
        return false;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const body = response.body;
    const ok = response.status === 200;

    console.log(`│  ${ok ? chalk.green('✅') : chalk.red('❌')} HTTP ${response.status}  (${elapsed}s)`);
    if (!ok) {
        console.log(chalk.red(`│  Error: ${body?.error || body?.raw || 'unknown'}`));
        console.log('└─');
        return false;
    }

    // ── Instance count ─────────────────────────────────────
    const instCount = Array.isArray(body.instances) ? body.instances.length : 0;
    const terrCount = Array.isArray(body.terrain)   ? body.terrain.length   : 0;
    const instOK    = instCount >= 50;
    console.log(`│  ${instOK ? chalk.green('✅') : chalk.yellow('⚠️ ')} instances  : ${instCount} (terrain ops: ${terrCount})`);

    // ── Image analysis card ────────────────────────────────
    const card = body.imageAnalysisSummaryCard;
    if (card) {
        console.log(`│  ${chalk.green('✅')} image model: ${card.model} | detail=${card.detail}`);
        console.log(`│  ${chalk.green('✅')} room type  : ${card.roomType} (${card.confidenceLabel} — ${card.confidence})`);
        if (card.dimensions) {
            const d = card.dimensions;
            console.log(`│  ${chalk.green('✅')} dimensions : ${d.width}×${d.depth}×${d.height} studs`);
        }
        if (card.specialFlags?.length > 0) {
            console.log(`│  ${chalk.green('✅')} flags      : ${card.specialFlags.join(', ')}`);
        }
        if (card.requiredProps?.length > 0) {
            console.log(`│  ${chalk.green('ℹ️ ')} req. props : ${card.requiredProps.slice(0,5).join(', ')}`);
        }
        console.log(`│  ${chalk.green('ℹ️ ')} art style  : ${card.artStyle}`);
        console.log(`│  ${chalk.green('ℹ️ ')} notes      : ${String(card.notes).slice(0,90)}`);
    } else {
        console.log(chalk.yellow('│  ⚠️  No image analysis summary card in response'));
        console.log(chalk.yellow('│     (Check VISION_MODEL and VISION_API_KEY in .env)'));
    }

    // ── Quality grade ──────────────────────────────────────
    if (body.quality) {
        const color = body.quality.grade === 'excellent' ? chalk.green
                    : body.quality.grade === 'good'      ? chalk.green
                    : body.quality.grade === 'acceptable' ? chalk.yellow
                    : chalk.red;
        console.log(`│  ${chalk.green('✅')} quality    : ${color(body.quality.grade)} (score: ${body.quality.overall})`);
    }

    // ── Lighting config ────────────────────────────────────
    if (body.lightingConfig) {
        const lc = body.lightingConfig;
        console.log(`│  ${chalk.green('✅')} lighting   : brightness=${lc.Brightness} clock=${lc.ClockTime}h`);
    }

    // ── Warnings ───────────────────────────────────────────
    const warns = body.warnings || [];
    if (warns.length > 0) {
        console.log(chalk.yellow(`│  ⚠️  warnings  : ${warns.slice(0, 3).join(' | ')}`));
    }

    // ── Expected room type match ───────────────────────────
    const detectedType = card?.roomType || body.detectedRoomType || 'unknown';
    const roomMatch = detectedType === scenario.expectedRoomType;
    console.log(`│  ${roomMatch ? chalk.green('✅') : chalk.yellow('⚠️ ')} room match : detected=${detectedType} expected=${scenario.expectedRoomType}`);

    console.log('└─ ' + chalk.dim(`PASS (${elapsed}s)`));
    return ok && instOK;
}

// ══════════════════════════════════════════════════════════════
// ENTRYPOINT
// ══════════════════════════════════════════════════════════════

async function main() {
    console.log(chalk.bold(chalk.magenta('\n════════════════════════════════════════════════')));
    console.log(chalk.bold(chalk.magenta(' Roblox AI Plugin — Image Reference Test Suite  ')));
    console.log(chalk.bold(chalk.magenta('════════════════════════════════════════════════')));
    console.log(chalk.dim(`  Time  : ${new Date().toLocaleString()}`));
    console.log(chalk.dim(`  Mode  : ${LIVE_MODE ? 'OFFLINE + LIVE SERVER' : 'OFFLINE ONLY'}`));
    if (CASE_FILTER) console.log(chalk.dim(`  Filter: case=${CASE_FILTER}`));
    console.log(chalk.dim('  Model : qwen-vl-max | detail=high | max_tokens=2500'));
    console.log('');

    // ── Offline unit tests always run ─────────────────────
    const unitOK = await runOfflineTests();

    // ── Live server tests (opt-in) ─────────────────────────
    if (!LIVE_MODE) {
        console.log(chalk.yellow('\n╔═══════════════════════════════════════════════════════╗'));
        console.log(chalk.yellow('║  Live server tests skipped (pass --live to enable)    ║'));
        console.log(chalk.yellow('║  Start server first:  npm run dev                     ║'));
        console.log(chalk.yellow('║  Then run:            node test-image-pipeline.js --live ║'));
        console.log(chalk.yellow('╚═══════════════════════════════════════════════════════╝\n'));
        process.exit(unitOK ? 0 : 1);
    }

    console.log(chalk.bold('\n╔═══════════════════════════════════════════╗'));
    console.log(chalk.bold('║  LIVE SERVER INTEGRATION TESTS             ║'));
    console.log(chalk.bold('╚═══════════════════════════════════════════╝'));

    const alive = await checkServerAlive();
    if (!alive) {
        console.log(chalk.red('\n  ❌ Server not reachable at http://localhost:3000'));
        console.log(chalk.yellow('     Start it with: npm run dev'));
        console.log(chalk.yellow('     Then re-run   : node test-image-pipeline.js --live\n'));
        process.exit(1);
    }
    console.log(chalk.green('\n  ✅ Server is alive\n'));

    // Determine which cases to run
    const cases = Object.entries(REFERENCE_IMAGES).filter(([key]) => !CASE_FILTER || key === CASE_FILTER);
    if (cases.length === 0) {
        console.log(chalk.red(`  ❌ No case found for --case=${CASE_FILTER}`));
        console.log(`     Valid: ${Object.keys(REFERENCE_IMAGES).join(', ')}`);
        process.exit(1);
    }

    let pass = 0, fail = 0;
    for (const [key, scenario] of cases) {
        const ok = await runLiveTest(key, scenario);
        if (ok) pass++; else fail++;
        // Small gap between requests
        if (cases.indexOf(cases.find(c => c[0] === key)) < cases.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    console.log(chalk.bold('\n════════════════════════════════════════════'));
    console.log(chalk.bold(` FINAL RESULT: ${chalk.green(pass + ' passed')}, ${fail > 0 ? chalk.red(fail + ' failed') : chalk.green('0 failed')}`));
    console.log(chalk.bold('════════════════════════════════════════════\n'));
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
    console.error(chalk.red('\n❌ Uncaught error:'), err.message);
    process.exit(1);
});
