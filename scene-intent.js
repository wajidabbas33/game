'use strict';

/**
 * Classifies whether the user's TEXT prompt describes an interior vs outdoor scene.
 * Text prompt always wins over reference images for scene type (images inform style only).
 */
function classifyPromptSceneIntent(prompt) {
    const text = String(prompt || '').toLowerCase();

    const interiorHits = (
        text.match(/\b(office\s+interior|interior|indoor|inside|corridor|hallway|lobby|classroom|kitchen|bedroom|bathroom|ceiling|partition|pendant|kitchenette|warehouse|studio|loft|apartment|supermarket|mall\s+interior|store\s+interior|shop\s+interior|room\s+with|sofa|cubicle|open\s+plan\s+office)\b/g) || []
    ).length;
    const interiorHits2 = (
        text.match(/\b(office|wall|walls|shelving|refrigerator|oven|concrete\s+floor|paneled\s+ceiling)\b/g) || []
    ).length;

    const outdoorHits = (
        text.match(/\b(playable\s+outdoor|outdoor\s+map|park\s+scene|national\s+park|terrain\b|forest\b|island\b|meadow|field\b|beach|desert|mountain|hill\b|hills\b|tree\s+density|benches\s+along|path\s+material|grass\s+color|golden\s+hour\s+lighting|campus|garden|street\s+scene|town\b|village|baseplate)\b/g) || []
    ).length;

    const strongOutdoor = /\b(build\s+this\s+park|outdoor\s+map|playable\s+outdoor|park\s+scene)\b/i.test(text);
    const strongInterior = /\b(modern\s+office|office\s+interior|corridor\s+with|interior\s+in\s+roblox|classroom\s+with|lobby\s+with)\b/i.test(text);

    const hardOutdoor = /\b(park\s+scene|outdoor\s+map|playable\s+outdoor|terrain\s+for\s+the\s+ground|tree\s+density|bench|benches\s+along|path\s+material|hills\s+in\s+the\s+background)\b/i.test(text);
    const hardInterior = /\b(office\s+interior|corridor|classroom|lobby|kitchen\s+island|pendant\s+lights|glass\s+partition|partition\s+walls|polished\s+concrete\s+for\s+the\s+floor|ceiling\s+track)\b/i.test(text);

    let mode = 'mixed';
    const scoreIn = interiorHits + interiorHits2 * 0.5;
    const scoreOut = outdoorHits;

    if (hardInterior && !hardOutdoor) {
        mode = 'interior';
    } else if (hardOutdoor && !hardInterior) {
        mode = 'outdoor';
    } else if (strongInterior && !strongOutdoor) {
        mode = 'interior';
    } else if (strongOutdoor && !strongInterior) {
        mode = 'outdoor';
    } else if (scoreOut > scoreIn + 1) {
        mode = 'outdoor';
    } else if (scoreIn > scoreOut + 1) {
        mode = 'interior';
    }

    return {
        mode,
        scoreIn,
        scoreOut,
        isInterior: mode === 'interior',
        isOutdoor: mode === 'outdoor',
    };
}

function coerceScenePlanToPromptIntent(prompt, scenePlan) {
    if (!scenePlan || typeof scenePlan !== 'object') return;
    const intent = classifyPromptSceneIntent(prompt);
    const st = String(scenePlan.sceneType || '').toLowerCase();
    const title = String(scenePlan.title || '').toLowerCase();
    const looksOutdoorPlan = /park|outdoor|forest|island|floating|beach|meadow|field|town|street|arena/.test(st)
        || /\b(park|outdoor|forest|island|meadow)\b/.test(title);
    const looksInteriorPlan = /lobby|classroom|office|dungeon|house|interior|corridor|kitchen|bedroom/.test(st)
        || /(office|corridor|interior|classroom|lobby|kitchen)/.test(title);

    if (intent.isInterior && looksOutdoorPlan && !looksInteriorPlan) {
        scenePlan.sceneType = 'lobby';
        scenePlan.title = 'Interior space (prompt override)';
        if (scenePlan.coreStructure && typeof scenePlan.coreStructure === 'object') {
            scenePlan.coreStructure.type = 'building';
            scenePlan.coreStructure.description = scenePlan.coreStructure.description || 'Enclosed interior volume from user prompt';
        }
    }

    if (intent.isOutdoor && looksInteriorPlan && !looksOutdoorPlan) {
        scenePlan.sceneType = 'outdoor_park';
        if (!/outdoor|park|terrain/.test(title)) {
            scenePlan.title = `${scenePlan.title || 'Scene'} (outdoor)`.slice(0, 80);
        }
    }
}

/**
 * Production overrides: align environment with text intent; reference images never force outdoor grass.
 */
function applyScenePlanProductionOverrides(prompt, scenePlan, generateEnv) {
    if (!scenePlan || typeof scenePlan !== 'object') return { intent: classifyPromptSceneIntent(prompt) };
    const intent = classifyPromptSceneIntent(prompt);
    coerceScenePlanToPromptIntent(prompt, scenePlan);

    if (!scenePlan.environment || typeof scenePlan.environment !== 'object') {
        scenePlan.environment = { generateSurroundings: true };
    }

    if (intent.isInterior) {
        scenePlan.environment.generateSurroundings = false;
        scenePlan.environment.surroundingElements = [];
        scenePlan.environment.surroundingTerrain = 'Air';
    } else if (generateEnv !== false && intent.isOutdoor) {
        scenePlan.environment.generateSurroundings = true;
    }

    return { intent };
}

function isInteriorPrompt(prompt) {
    return classifyPromptSceneIntent(prompt).isInterior;
}

module.exports = {
    classifyPromptSceneIntent,
    coerceScenePlanToPromptIntent,
    applyScenePlanProductionOverrides,
    isInteriorPrompt,
};
