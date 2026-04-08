-- ============================================================
--  Roblox AI Plugin  (Final v5)
--
--  Fixes implemented:
--  [B2] Structured error messages with detail + suggestion
--  [B4] Extended type support: CFrame, UDim2 (shape-detected),
--       BrickColor, generic Enum handler
--  [B7] Backend URL stored in plugin settings — no code changes
--       needed when URL changes. Persists across Studio sessions.
--
--  Additions:
--  [G1] Game-mode awareness — UI hints guide users toward
--       natural language game-mode prompts
--  [G2] Phase display — shows progress for multi-phase tasks,
--       "Continue" button auto-sends the next phase prompt
--  [G3] Cross-reference warnings shown in UI
--  [V4] Undo stack — destroy everything from last generation
--  [V4] Conversation clear — new session ID resets AI context
--  [V4] Selection context — selected objects included in prompt
--
--  Setup:
--  1. Open Roblox Studio, insert a Script anywhere
--  2. Paste this file into the script
--  3. Right-click script → Save as Local Plugin
--  4. Enable HTTP Requests: Game Settings → Security
--  5. Open the plugin, set your backend URL, click Save
-- ============================================================

local HttpService      = game:GetService("HttpService")
local Selection        = game:GetService("Selection")
local UserInputService = game:GetService("UserInputService")

-- ── [B7] Configurable backend URL ────────────────────────────
-- Stored in plugin settings so it survives Studio restarts and
-- never needs a code edit when the backend URL changes.
local URL_SETTING_KEY  = "RobloxAI_BackendURL"
local DEFAULT_URL      = "http://localhost:3000"

local function normalizeBackendURL(url)
    if type(url) ~= "string" then
        return nil
    end

    local normalized = url:match("^%s*(.-)%s*$")
    if not normalized or normalized == "" then
        return nil
    end

    normalized = normalized:gsub("/generate/*$", "")
    normalized = normalized:gsub("/+$", "")

    -- Railway public domains redirect HTTP to HTTPS. Roblox HTTP requests
    -- can fail or behave inconsistently across redirects, so store the
    -- canonical HTTPS URL directly.
    normalized = normalized:gsub("^http://([%w%-]+%.up%.railway%.app)$", "https://%1")

    return normalized ~= "" and normalized or nil
end

local function getBackendURL()
    local savedUrl = plugin:GetSetting(URL_SETTING_KEY)
    local url = normalizeBackendURL(savedUrl)

    if not url then
        url = normalizeBackendURL(DEFAULT_URL) or DEFAULT_URL
    end

    if savedUrl ~= url then
        plugin:SetSetting(URL_SETTING_KEY, url)
    end

    return url
end

local function saveBackendURL(url)
    local normalized = normalizeBackendURL(url)
    if normalized then
        plugin:SetSetting(URL_SETTING_KEY, normalized)
    end
end

-- conversationId is unique per Studio session.
-- "Clear Conversation" generates a new one, resetting AI context.
local BACKEND_URL    = getBackendURL()
local conversationId = HttpService:GenerateGUID(false)

-- ── Undo stack ────────────────────────────────────────────────
-- Each entry = instances created in one generation turn, scripts updated
-- in place, plus metadata about terrain operations, which are not reversible.
local undoStack = {}

-- ── Plugin toolbar ────────────────────────────────────────────
local toolbar = plugin:CreateToolbar("AI Assistant")
local openBtn = toolbar:CreateButton(
    "Open AI Assistant",
    "Generate Roblox game scripts and objects using AI",
    "rbxassetid://4458901886"
)

-- ── Dock widget ───────────────────────────────────────────────
local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Right,
    false, false,
    320, 700, 240, 500
)
local widget = plugin:CreateDockWidgetPluginGui("RobloxAIWidget_v5", widgetInfo)
widget.Title = "Roblox AI Assistant"

-- ── Colour palette ────────────────────────────────────────────
local C = {
    bg         = Color3.fromRGB(17, 22, 29),
    surface    = Color3.fromRGB(28, 34, 44),
    surfaceAlt = Color3.fromRGB(33, 40, 52),
    input      = Color3.fromRGB(36, 43, 56),
    border     = Color3.fromRGB(64, 73, 90),
    accent     = Color3.fromRGB(72, 140, 255),
    accentDim  = Color3.fromRGB(49, 102, 189),
    accentSoft = Color3.fromRGB(31, 58, 104),
    danger     = Color3.fromRGB(198, 79, 72),
    dangerDim  = Color3.fromRGB(117, 58, 55),
    warning    = Color3.fromRGB(210, 166, 76),
    white      = Color3.fromRGB(244, 247, 251),
    subtext    = Color3.fromRGB(150, 160, 178),
    muted      = Color3.fromRGB(110, 121, 140),
    green      = Color3.fromRGB(103, 192, 128),
    greenSoft  = Color3.fromRGB(39, 72, 49),
    red        = Color3.fromRGB(235, 123, 116),
    redSoft    = Color3.fromRGB(85, 44, 43),
    orange     = Color3.fromRGB(233, 181, 97),
    orangeSoft = Color3.fromRGB(89, 68, 39),
}

-- ── Root scroll frame ─────────────────────────────────────────
local root = Instance.new("ScrollingFrame")
root.Size                = UDim2.new(1, 0, 1, 0)
root.BackgroundColor3    = C.bg
root.BorderSizePixel     = 0
root.ScrollBarThickness  = 6
root.ScrollBarImageColor3= C.accent
root.AutomaticCanvasSize = Enum.AutomaticSize.Y
root.CanvasSize          = UDim2.new(1, 0, 0, 0)
root.Parent              = widget

local layout = Instance.new("UIListLayout")
layout.Padding             = UDim.new(0, 12)
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.SortOrder           = Enum.SortOrder.LayoutOrder
layout.Parent              = root

layout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
    root.CanvasSize = UDim2.new(0, 0, 0, layout.AbsoluteContentSize.Y + 20)
end)

local rootPad = Instance.new("UIPadding")
rootPad.PaddingTop    = UDim.new(0, 12)
rootPad.PaddingBottom = UDim.new(0, 12)
rootPad.PaddingLeft   = UDim.new(0, 12)
rootPad.PaddingRight  = UDim.new(0, 12)
rootPad.Parent        = root

-- ── UI helpers ────────────────────────────────────────────────
local function applyCorner(gui, radius)
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, radius or 8)
    corner.Parent = gui
    return corner
end

local function applyStroke(gui, color, thickness, transparency)
    local stroke = Instance.new("UIStroke")
    stroke.Color = color or C.border
    stroke.Thickness = thickness or 1
    stroke.Transparency = transparency or 0
    stroke.Parent = gui
    return stroke
end

local function makeFrame(order, height, bg, parent)
    local f = Instance.new("Frame")
    f.Size             = UDim2.new(1, -24, 0, height)
    f.BackgroundColor3 = bg or C.surface
    f.BorderSizePixel  = 0
    f.LayoutOrder      = order
    f.Parent           = parent or root
    applyCorner(f, 8)
    return f
end

local function makeCard(order)
    local card = Instance.new("Frame")
    card.Size = UDim2.new(1, -24, 0, 0)
    card.AutomaticSize = Enum.AutomaticSize.Y
    card.BackgroundColor3 = C.surface
    card.BorderSizePixel = 0
    card.LayoutOrder = order
    card.Parent = root
    applyCorner(card, 10)
    applyStroke(card, C.border, 1, 0.35)

    local pad = Instance.new("UIPadding")
    pad.PaddingTop = UDim.new(0, 12)
    pad.PaddingBottom = UDim.new(0, 12)
    pad.PaddingLeft = UDim.new(0, 12)
    pad.PaddingRight = UDim.new(0, 12)
    pad.Parent = card

    local cardLayout = Instance.new("UIListLayout")
    cardLayout.Padding = UDim.new(0, 8)
    cardLayout.SortOrder = Enum.SortOrder.LayoutOrder
    cardLayout.Parent = card

    return card
end

local function makeLabel(text, order, height, color, bold, wrap, parent, font, size)
    local lbl = Instance.new("TextLabel")
    lbl.Text              = text
    lbl.TextColor3        = color or C.white
    lbl.BackgroundTransparency = 1
    lbl.Size              = UDim2.new(1, -24, 0, height or 20)
    lbl.TextXAlignment    = Enum.TextXAlignment.Left
    lbl.TextYAlignment    = Enum.TextYAlignment.Top
    lbl.Font              = font or (bold and Enum.Font.GothamBold or Enum.Font.Gotham)
    lbl.TextSize          = size or 14
    lbl.TextWrapped       = wrap ~= false
    lbl.LayoutOrder       = order
    lbl.Parent            = parent or root
    return lbl
end

local function makeButton(text, order, bg, height, parent)
    local btn = Instance.new("TextButton")
    btn.Size             = UDim2.new(1, -24, 0, height or 34)
    btn.BackgroundColor3 = bg or C.accent
    btn.Text             = text
    btn.TextColor3       = C.white
    btn.Font             = Enum.Font.GothamBold
    btn.TextSize         = 14
    btn.LayoutOrder      = order
    btn.AutoButtonColor  = true
    btn.Parent           = parent or root
    applyCorner(btn, 8)
    applyStroke(btn, C.border, 1, 0.45)
    return btn
end

local function makeInlineButton(text, order, bg, parent, width)
    local btn = makeButton(text, order, bg, 28, parent)
    btn.Size = width or UDim2.new(0.32, -4, 1, 0)
    btn.TextSize = 11
    return btn
end

local function makeDivider(order, parent)
    local f = Instance.new("Frame")
    f.Size             = UDim2.new(1, -24, 0, 1)
    f.BackgroundColor3 = C.border
    f.BorderSizePixel  = 0
    f.LayoutOrder      = order
    f.BackgroundTransparency = 0.35
    f.Parent           = parent or root
end

local function makeInfoBox(order, bg, textColor, parent)
    local lbl = Instance.new("TextLabel")
    lbl.Size             = UDim2.new(1, -24, 0, 0)
    lbl.AutomaticSize    = Enum.AutomaticSize.Y
    lbl.BackgroundColor3 = bg or C.surface
    lbl.TextColor3       = textColor or C.white
    lbl.Text             = ""
    lbl.TextWrapped      = true
    lbl.Font             = Enum.Font.Gotham
    lbl.TextSize         = 13
    lbl.TextXAlignment   = Enum.TextXAlignment.Left
    lbl.TextYAlignment   = Enum.TextYAlignment.Top
    lbl.LayoutOrder      = order
    lbl.Visible          = false
    lbl.Parent           = parent or root
    applyCorner(lbl, 8)
    applyStroke(lbl, C.border, 1, 0.5)
    local pad = Instance.new("UIPadding")
    pad.PaddingLeft   = UDim.new(0, 10)
    pad.PaddingRight  = UDim.new(0, 10)
    pad.PaddingTop    = UDim.new(0, 8)
    pad.PaddingBottom = UDim.new(0, 8)
    pad.Parent = lbl
    return lbl
end

local function makeViewerCard(order, title, description, emptyText, height)
    local card = makeCard(order)
    makeLabel(title, 1, 18, C.white, true, false, card, Enum.Font.GothamBold, 14)
    makeLabel(description, 2, 32, C.subtext, false, true, card, Enum.Font.Gotham, 12)

    local emptyLbl = makeLabel(emptyText, 3, 18, C.muted, false, true, card, Enum.Font.Gotham, 12)
    emptyLbl.Visible = true

    local viewer = Instance.new("TextBox")
    viewer.Size             = UDim2.new(1, -24, 0, height or 180)
    viewer.BackgroundColor3 = C.input
    viewer.TextColor3       = C.white
    viewer.Text             = ""
    viewer.ClearTextOnFocus = false
    viewer.MultiLine        = true
    viewer.TextWrapped      = false
    viewer.TextXAlignment   = Enum.TextXAlignment.Left
    viewer.TextYAlignment   = Enum.TextYAlignment.Top
    viewer.Font             = Enum.Font.Code
    viewer.TextSize         = 13
    viewer.LayoutOrder      = 4
    viewer.Visible          = false
    viewer.Parent           = card
    pcall(function()
        viewer.TextEditable = false
    end)
    applyCorner(viewer, 8)
    applyStroke(viewer, C.border, 1, 0.4)

    local viewerPad = Instance.new("UIPadding")
    viewerPad.PaddingLeft   = UDim.new(0, 10)
    viewerPad.PaddingRight  = UDim.new(0, 10)
    viewerPad.PaddingTop    = UDim.new(0, 10)
    viewerPad.PaddingBottom = UDim.new(0, 10)
    viewerPad.Parent = viewer

    return card, viewer, emptyLbl
end

local function makeTabButton(text, parent)
    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(0.25, -5, 1, 0)
    btn.BackgroundColor3 = C.surfaceAlt
    btn.Text = text
    btn.TextColor3 = C.subtext
    btn.Font = Enum.Font.GothamBold
    btn.TextSize = 12
    btn.AutoButtonColor = true
    btn.Parent = parent
    applyCorner(btn, 8)
    applyStroke(btn, C.border, 1, 0.45)
    return btn
end

-- ── UI layout ─────────────────────────────────────────────────
local headerCard = makeCard(1)
makeLabel("Roblox AI Assistant", 1, 24, C.white, true, false, headerCard, Enum.Font.GothamBold, 18)
makeLabel(
    "Generate scripts, structures, and gameplay systems directly into your Studio project.",
    2, 34, C.subtext, false, true, headerCard, Enum.Font.Gotham, 13
)

local flowFrame = Instance.new("Frame")
flowFrame.Size = UDim2.new(1, -24, 0, 30)
flowFrame.BackgroundColor3 = C.accentSoft
flowFrame.BorderSizePixel = 0
flowFrame.LayoutOrder = 3
flowFrame.Parent = headerCard
applyCorner(flowFrame, 8)
applyStroke(flowFrame, C.accent, 1, 0.45)

local flowPad = Instance.new("UIPadding")
flowPad.PaddingLeft = UDim.new(0, 10)
flowPad.PaddingRight = UDim.new(0, 10)
flowPad.Parent = flowFrame

local flowLabel = Instance.new("TextLabel")
flowLabel.Size = UDim2.new(1, 0, 1, 0)
flowLabel.BackgroundTransparency = 1
flowLabel.Text = "Workflow: Prompt -> Backend Response -> Preview -> Apply"
flowLabel.TextColor3 = C.white
flowLabel.Font = Enum.Font.GothamMedium
flowLabel.TextSize = 12
flowLabel.TextXAlignment = Enum.TextXAlignment.Left
flowLabel.Parent = flowFrame

local connectionCard = makeCard(2)
makeLabel("Connection", 1, 18, C.white, true, false, connectionCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Set the backend endpoint used by the plugin to request AI-generated Studio changes.",
    2, 32, C.subtext, false, true, connectionCard, Enum.Font.Gotham, 12
)
makeLabel("Backend Endpoint", 3, 16, C.muted, true, false, connectionCard, Enum.Font.GothamMedium, 12)

local urlBox = Instance.new("TextBox")
urlBox.Size             = UDim2.new(1, -24, 0, 36)
urlBox.BackgroundColor3 = C.input
urlBox.TextColor3       = C.white
urlBox.PlaceholderText  = "https://your-backend.up.railway.app"
urlBox.Text             = BACKEND_URL
urlBox.TextWrapped      = false
urlBox.ClearTextOnFocus = false
urlBox.Font             = Enum.Font.Gotham
urlBox.TextSize         = 13
urlBox.TextXAlignment   = Enum.TextXAlignment.Left
urlBox.LayoutOrder      = 4
urlBox.Parent           = connectionCard
applyCorner(urlBox, 8)
applyStroke(urlBox, C.border, 1, 0.4)
local urlPad = Instance.new("UIPadding")
urlPad.PaddingLeft = UDim.new(0, 10)
urlPad.PaddingRight = UDim.new(0, 10)
urlPad.Parent = urlBox

local connectionBtnRow = Instance.new("Frame")
connectionBtnRow.Size = UDim2.new(1, -24, 0, 34)
connectionBtnRow.BackgroundTransparency = 1
connectionBtnRow.LayoutOrder = 5
connectionBtnRow.Parent = connectionCard

local connectionBtnLayout = Instance.new("UIListLayout")
connectionBtnLayout.FillDirection = Enum.FillDirection.Horizontal
connectionBtnLayout.Padding = UDim.new(0, 8)
connectionBtnLayout.VerticalAlignment = Enum.VerticalAlignment.Center
connectionBtnLayout.SortOrder = Enum.SortOrder.LayoutOrder
connectionBtnLayout.Parent = connectionBtnRow

local saveUrlBtn = makeInlineButton("Save Endpoint", 1, C.accentDim, connectionBtnRow, UDim2.new(0.5, -4, 1, 0))
saveUrlBtn.TextSize = 12
local testConnectionBtn = makeInlineButton("Test Connection", 2, C.surfaceAlt, connectionBtnRow, UDim2.new(0.5, -4, 1, 0))
testConnectionBtn.TextSize = 12

makeLabel("Endpoint used by the plugin: POST /generate and GET /health", 6, 16, C.subtext, false, false, connectionCard, Enum.Font.Gotham, 11)

local buildCard = makeCard(3)
makeLabel("Build Request", 1, 18, C.white, true, false, buildCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Describe the script, object, layout, or game mode you want previewed before applying.",
    2, 32, C.subtext, false, true, buildCard, Enum.Font.Gotham, 12
)

local selectionFrame = Instance.new("Frame")
selectionFrame.Size = UDim2.new(1, -24, 0, 28)
selectionFrame.BackgroundColor3 = C.surfaceAlt
selectionFrame.BorderSizePixel = 0
selectionFrame.LayoutOrder = 3
selectionFrame.Parent = buildCard
applyCorner(selectionFrame, 8)
applyStroke(selectionFrame, C.border, 1, 0.5)

local selPad = Instance.new("UIPadding")
selPad.PaddingLeft = UDim.new(0, 10)
selPad.PaddingRight = UDim.new(0, 10)
selPad.Parent = selectionFrame

local selLabel = Instance.new("TextLabel")
selLabel.Size = UDim2.new(1, 0, 1, 0)
selLabel.BackgroundTransparency = 1
selLabel.Text = "Selection: No selection"
selLabel.TextColor3 = C.subtext
selLabel.Font = Enum.Font.GothamMedium
selLabel.TextSize = 12
selLabel.TextXAlignment = Enum.TextXAlignment.Left
selLabel.Parent = selectionFrame

-- ── Game Mode Quick-Fill ────────────────────────────────────
makeLabel("Game Mode", 4, 16, C.muted, true, false, buildCard, Enum.Font.GothamMedium, 12)

local GAME_MODES = {
    { label = "None",          prompt = nil },
    { label = "Round-Based",   prompt = "Create a complete round-based game system with a RoundManager script, intermission timer, round timer, player respawn control, and a LocalScript UI showing the countdown. Use RemoteEvents for round start/end. Include phases." },
    { label = "Capture Flag",  prompt = "Create a full Capture The Flag game: two teams (Red and Blue), flag objects in Workspace, a FlagManager server script that tracks pickup/drop/return/capture states, team scoring, and a FlagUI LocalScript showing flag status and score." },
    { label = "King of Hill",  prompt = "Create a King of the Hill game: a hill zone in Workspace, a HillManager server script that tracks players inside the zone, awards score over time to the controlling team, and a HillUI LocalScript showing current owner and progress." },
    { label = "Survival Waves",prompt = "Create a survival waves system: a WaveManager script that spawns NPC enemies each wave, tracks when all enemies are defeated before starting the next wave, scales difficulty per wave, and a WaveUI LocalScript showing wave number and enemy count." },
    { label = "Tycoon",        prompt = "Create a Tycoon game: each player owns a plot (assigned on join), plots contain purchasable building pads with prices shown on BillboardGuis, a TycoonManager server script tracks ownership and currency, a MoneyCollector pad auto-collects cash every few seconds, and purchases unlock new build pads." },
    { label = "Obby",          prompt = "Create an obstacle course (obby): a series of 10 platforms with increasing difficulty (moving parts, rotating parts, kill bricks, jump pads, narrow paths), a CheckpointSystem script that saves the last touched checkpoint per player and respawns them there, and a finish pad that awards a 'Course Complete' badge or prize." },
    { label = "Team Deathmatch",prompt = "Create a Team Deathmatch game: two teams (Red and Blue) with separate spawn locations, a TeamManager server script that assigns players to balanced teams, a LeaderboardManager tracking kills and deaths via DataStore, a StatUpdater script listening for kills via RemoteEvent, and a TeamUI LocalScript." },
    { label = "Lobby + Arena", prompt = "Create a Lobby and Arena system: a Workspace.Lobby area where players wait, a Workspace.Arena combat area, a LobbyManager server script that waits for minimum players then teleports all to Arena spawns, runs a round, then teleports back to Lobby. Include a LocalScript countdown UI." },
}

local gameModeRow = Instance.new("Frame")
gameModeRow.Size = UDim2.new(1, -24, 0, 28)
gameModeRow.BackgroundTransparency = 1
gameModeRow.LayoutOrder = 5
gameModeRow.Parent = buildCard

local gameModeLayout = Instance.new("UIListLayout")
gameModeLayout.FillDirection = Enum.FillDirection.Horizontal
gameModeLayout.Padding = UDim.new(0, 6)
gameModeLayout.VerticalAlignment = Enum.VerticalAlignment.Center
gameModeLayout.SortOrder = Enum.SortOrder.LayoutOrder
gameModeLayout.Parent = gameModeRow

local gameModeIndex = 1

local gameModeBtn = Instance.new("TextButton")
gameModeBtn.Size = UDim2.new(0, 148, 0, 26)
gameModeBtn.BackgroundColor3 = C.surfaceAlt
gameModeBtn.TextColor3 = C.white
gameModeBtn.Font = Enum.Font.GothamMedium
gameModeBtn.TextSize = 11
gameModeBtn.Text = "Mode: None"
gameModeBtn.LayoutOrder = 1
gameModeBtn.Parent = gameModeRow
applyCorner(gameModeBtn, 6)
applyStroke(gameModeBtn, C.border, 1, 0.4)

local gameModeHintLabel = Instance.new("TextLabel")
gameModeHintLabel.Size = UDim2.new(1, -162, 1, 0)
gameModeHintLabel.BackgroundTransparency = 1
gameModeHintLabel.TextColor3 = C.muted
gameModeHintLabel.Font = Enum.Font.Gotham
gameModeHintLabel.TextSize = 10
gameModeHintLabel.TextXAlignment = Enum.TextXAlignment.Left
gameModeHintLabel.TextWrapped = true
gameModeHintLabel.Text = "Select a preset to auto-fill the prompt"
gameModeHintLabel.LayoutOrder = 2
gameModeHintLabel.Parent = gameModeRow

local function updateGameModeBtn()
    local m = GAME_MODES[gameModeIndex]
    if m.prompt then
        gameModeBtn.Text = "Mode: " .. m.label
        gameModeBtn.BackgroundColor3 = C.accent
        gameModeHintLabel.Text = m.label .. " preset loaded"
    else
        gameModeBtn.Text = "Mode: None"
        gameModeBtn.BackgroundColor3 = C.surfaceAlt
        gameModeHintLabel.Text = "Select a preset to auto-fill the prompt"
    end
end

gameModeBtn.MouseButton1Click:Connect(function()
    gameModeIndex = (gameModeIndex % #GAME_MODES) + 1
    updateGameModeBtn()
    local m = GAME_MODES[gameModeIndex]
    if m.prompt then
        promptBox.Text = m.prompt
    end
end)

makeLabel("Prompt", 6, 16, C.muted, true, false, buildCard, Enum.Font.GothamMedium, 12)

local promptBox = Instance.new("TextBox")
promptBox.Size             = UDim2.new(1, -24, 0, 112)
promptBox.BackgroundColor3 = C.input
promptBox.TextColor3       = C.white
promptBox.PlaceholderText  = 'Describe what to build, or pick a Game Mode above to auto-fill'
promptBox.TextWrapped      = true
promptBox.ClearTextOnFocus = false
promptBox.MultiLine        = true
promptBox.TextYAlignment   = Enum.TextYAlignment.Top
promptBox.TextXAlignment   = Enum.TextXAlignment.Left
promptBox.Font             = Enum.Font.Gotham
promptBox.TextSize         = 14
promptBox.LayoutOrder      = 7
promptBox.Parent           = buildCard
applyCorner(promptBox, 8)
applyStroke(promptBox, C.border, 1, 0.4)
local pPad = Instance.new("UIPadding")
pPad.PaddingLeft = UDim.new(0, 10)
pPad.PaddingRight = UDim.new(0, 10)
pPad.PaddingTop = UDim.new(0, 10)
pPad.PaddingBottom = UDim.new(0, 10)
pPad.Parent = promptBox

-- ── Reference Images ─────────────────────────────────────────
-- Header row: label + live counter
local refSectionHeader = Instance.new("Frame")
refSectionHeader.Size = UDim2.new(1, -24, 0, 20)
refSectionHeader.BackgroundTransparency = 1
refSectionHeader.LayoutOrder = 7
refSectionHeader.Parent = buildCard
local _rsh = Instance.new("UIListLayout")
_rsh.FillDirection = Enum.FillDirection.Horizontal
_rsh.VerticalAlignment = Enum.VerticalAlignment.Center
_rsh.SortOrder = Enum.SortOrder.LayoutOrder
_rsh.Parent = refSectionHeader

local refImageLabel = Instance.new("TextLabel")
refImageLabel.Size = UDim2.new(0.6, 0, 1, 0)
refImageLabel.BackgroundTransparency = 1
refImageLabel.Text = "Reference Images (optional)"
refImageLabel.TextColor3 = C.white
refImageLabel.Font = Enum.Font.GothamMedium
refImageLabel.TextSize = 12
refImageLabel.TextXAlignment = Enum.TextXAlignment.Left
refImageLabel.LayoutOrder = 1
refImageLabel.Parent = refSectionHeader

local refCountLabel = Instance.new("TextLabel")
refCountLabel.Size = UDim2.new(0.4, 0, 1, 0)
refCountLabel.BackgroundTransparency = 1
refCountLabel.Text = "0 / 3 attached"
refCountLabel.TextColor3 = C.muted
refCountLabel.Font = Enum.Font.Gotham
refCountLabel.TextSize = 11
refCountLabel.TextXAlignment = Enum.TextXAlignment.Right
refCountLabel.LayoutOrder = 2
refCountLabel.Parent = refSectionHeader

-- ── Primary input: large text box the user clicks into and Cmd+V ──
-- This is the ONLY interaction needed. Paste a URL → press Enter.
local refInputBox = Instance.new("TextBox")
refInputBox.Size             = UDim2.new(1, -24, 0, 52)
refInputBox.BackgroundColor3 = Color3.fromRGB(24, 28, 40)
refInputBox.TextColor3       = Color3.fromRGB(200, 210, 255)
refInputBox.PlaceholderText  = "Paste an image URL here, then press Enter  (https://...)"
refInputBox.PlaceholderColor3 = Color3.fromRGB(70, 85, 120)
refInputBox.TextWrapped      = true
refInputBox.ClearTextOnFocus = false
refInputBox.MultiLine        = false
refInputBox.Font             = Enum.Font.Gotham
refInputBox.TextSize         = 12
refInputBox.TextXAlignment   = Enum.TextXAlignment.Left
refInputBox.TextYAlignment   = Enum.TextYAlignment.Center
refInputBox.LayoutOrder      = 8
refInputBox.Parent           = buildCard
applyCorner(refInputBox, 8)

local refInputStroke = Instance.new("UIStroke")
refInputStroke.Color = Color3.fromRGB(70, 90, 160)
refInputStroke.Thickness = 1.5
refInputStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
refInputStroke.Parent = refInputBox

local refInputPad = Instance.new("UIPadding")
refInputPad.PaddingLeft = UDim.new(0, 12)
refInputPad.PaddingRight = UDim.new(0, 12)
refInputPad.PaddingTop = UDim.new(0, 8)
refInputPad.PaddingBottom = UDim.new(0, 8)
refInputPad.Parent = refInputBox

-- Instruction label under the text box
local refHintLabel = Instance.new("TextLabel")
refHintLabel.Size = UDim2.new(1, -24, 0, 14)
refHintLabel.BackgroundTransparency = 1
refHintLabel.Text = "Click the box above → Cmd+V (Mac) or Ctrl+V (Windows) to paste, then press Enter"
refHintLabel.TextColor3 = Color3.fromRGB(70, 85, 110)
refHintLabel.Font = Enum.Font.Gotham
refHintLabel.TextSize = 10
refHintLabel.TextXAlignment = Enum.TextXAlignment.Left
refHintLabel.TextWrapped = true
refHintLabel.LayoutOrder = 9
refHintLabel.Parent = buildCard

-- Highlight the text box border when focused
refInputBox.Focused:Connect(function()
    refInputStroke.Color = Color3.fromRGB(100, 140, 255)
    refInputStroke.Thickness = 2
end)
refInputBox.FocusLost:Connect(function()
    refInputStroke.Color = Color3.fromRGB(70, 90, 160)
    refInputStroke.Thickness = 1.5
end)

-- Action row: Add URL button + Attach Asset + Clear All
local refActionRow = Instance.new("Frame")
refActionRow.Size = UDim2.new(1, -24, 0, 28)
refActionRow.BackgroundTransparency = 1
refActionRow.LayoutOrder = 10
refActionRow.Parent = buildCard

local refActionLayout = Instance.new("UIListLayout")
refActionLayout.FillDirection = Enum.FillDirection.Horizontal
refActionLayout.Padding = UDim.new(0, 8)
refActionLayout.VerticalAlignment = Enum.VerticalAlignment.Center
refActionLayout.SortOrder = Enum.SortOrder.LayoutOrder
refActionLayout.Parent = refActionRow

local addRefUrlBtn = makeInlineButton("Add URL", 1, C.accentDim, refActionRow)
local attachRefAssetBtn = makeInlineButton("Attach Asset", 2, C.surfaceAlt, refActionRow)
local clearRefBtn = makeInlineButton("Clear All", 3, C.surfaceAlt, refActionRow)

-- Dummy for compatibility (paste zone no longer exists but is referenced in click handlers)
local pasteZone = Instance.new("Frame")
pasteZone.Size = UDim2.new(0, 0, 0, 0)
pasteZone.BackgroundTransparency = 1
pasteZone.Visible = false
pasteZone.Parent = buildCard
local pasteZoneStroke = Instance.new("UIStroke")
pasteZoneStroke.Parent = pasteZone
local pasteIcon = Instance.new("TextLabel")
pasteIcon.Parent = pasteZone
local pasteHint = Instance.new("TextLabel")
pasteHint.Parent = pasteZone

-- Attached images list
local refListCard = Instance.new("Frame")
refListCard.Size = UDim2.new(1, -24, 0, 0)
refListCard.AutomaticSize = Enum.AutomaticSize.Y
refListCard.BackgroundColor3 = C.surfaceAlt
refListCard.BorderSizePixel = 0
refListCard.LayoutOrder = 12
refListCard.Parent = buildCard
applyCorner(refListCard, 8)
applyStroke(refListCard, C.border, 1, 0.35)

local refListPad = Instance.new("UIPadding")
refListPad.PaddingLeft = UDim.new(0, 8)
refListPad.PaddingRight = UDim.new(0, 8)
refListPad.PaddingTop = UDim.new(0, 8)
refListPad.PaddingBottom = UDim.new(0, 8)
refListPad.Parent = refListCard

local refListBody = Instance.new("Frame")
refListBody.Size = UDim2.new(1, -16, 0, 0)
refListBody.AutomaticSize = Enum.AutomaticSize.Y
refListBody.BackgroundTransparency = 1
refListBody.Parent = refListCard

local refListLayout = Instance.new("UIListLayout")
refListLayout.Padding = UDim.new(0, 6)
refListLayout.SortOrder = Enum.SortOrder.LayoutOrder
refListLayout.Parent = refListBody

local refEmptyLabel = makeLabel(
    "No reference images attached yet. Paste an image URL above.",
    1, 18, C.muted, false, true, refListBody, Enum.Font.Gotham, 11
)

-- ── Options row (Quality toggle + Environment toggle) ─────────
local optionsRow = Instance.new("Frame")
optionsRow.Size = UDim2.new(1, -24, 0, 30)
optionsRow.BackgroundTransparency = 1
optionsRow.LayoutOrder = 13
optionsRow.Parent = buildCard

local optionsLayout = Instance.new("UIListLayout")
optionsLayout.FillDirection = Enum.FillDirection.Horizontal
optionsLayout.Padding = UDim.new(0, 12)
optionsLayout.VerticalAlignment = Enum.VerticalAlignment.Center
optionsLayout.SortOrder = Enum.SortOrder.LayoutOrder
optionsLayout.Parent = optionsRow

-- Quality toggle: Quick / Detailed
local qualityToggle = Instance.new("TextButton")
qualityToggle.Size = UDim2.new(0, 110, 0, 26)
qualityToggle.BackgroundColor3 = C.surfaceAlt
qualityToggle.TextColor3 = C.white
qualityToggle.Font = Enum.Font.GothamMedium
qualityToggle.TextSize = 11
qualityToggle.Text = "🔬 Detailed"
qualityToggle.LayoutOrder = 1
qualityToggle.Parent = optionsRow
applyCorner(qualityToggle, 6)
applyStroke(qualityToggle, C.border, 1, 0.4)

local isDetailedMode = true
local function updateQualityToggle()
    if isDetailedMode then
        qualityToggle.Text = "🔬 Detailed"
        qualityToggle.BackgroundColor3 = C.accent
    else
        qualityToggle.Text = "⚡ Quick"
        qualityToggle.BackgroundColor3 = C.surfaceAlt
    end
end

updateQualityToggle()

qualityToggle.MouseButton1Click:Connect(function()
    isDetailedMode = not isDetailedMode
    updateQualityToggle()
end)

-- Environment toggle
local envToggle = Instance.new("TextButton")
envToggle.Size = UDim2.new(0, 140, 0, 26)
envToggle.BackgroundColor3 = C.accent
envToggle.TextColor3 = C.white
envToggle.Font = Enum.Font.GothamMedium
envToggle.TextSize = 11
envToggle.Text = "\xF0\x9F\x8C\x8D Environment: ON"
envToggle.LayoutOrder = 2
envToggle.Parent = optionsRow
applyCorner(envToggle, 6)
applyStroke(envToggle, C.border, 1, 0.4)

local generateEnvironment = true
envToggle.MouseButton1Click:Connect(function()
    generateEnvironment = not generateEnvironment
    if generateEnvironment then
        envToggle.Text = "\xF0\x9F\x8C\x8D Environment: ON"
        envToggle.BackgroundColor3 = C.accent
    else
        envToggle.Text = "\xF0\x9F\x8C\x8D Environment: OFF"
        envToggle.BackgroundColor3 = C.surfaceAlt
    end
end)

local generateBtn = makeButton("Generate Preview", 14, C.accent, 40, buildCard)

local resultsCard = makeCard(4)
makeLabel("Preview & Output", 1, 18, C.white, true, false, resultsCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Review the backend response, inspect the preview, then apply the result into Studio when ready.",
    2, 32, C.subtext, false, true, resultsCard, Enum.Font.Gotham, 12
)

local statusFrame = Instance.new("Frame")
statusFrame.Size             = UDim2.new(1, -24, 0, 32)
statusFrame.BackgroundColor3 = C.surfaceAlt
statusFrame.BorderSizePixel  = 0
statusFrame.LayoutOrder      = 3
statusFrame.Parent           = resultsCard
applyCorner(statusFrame, 8)
applyStroke(statusFrame, C.border, 1, 0.45)

local statusLbl = Instance.new("TextLabel")
statusLbl.Size              = UDim2.new(1, -20, 1, 0)
statusLbl.Position          = UDim2.new(0, 10, 0, 0)
statusLbl.BackgroundTransparency = 1
statusLbl.TextColor3        = C.subtext
statusLbl.Text              = "Ready. Enter a prompt to begin."
statusLbl.TextWrapped       = true
statusLbl.TextTruncate      = Enum.TextTruncate.AtEnd
statusLbl.Font              = Enum.Font.GothamMedium
statusLbl.TextSize          = 12
statusLbl.TextXAlignment    = Enum.TextXAlignment.Left
statusLbl.Parent            = statusFrame

local previewBox  = makeInfoBox(4, C.accentSoft, C.white, resultsCard)
local explainBox  = makeInfoBox(5, C.greenSoft, C.green, resultsCard)
local errorBox    = makeInfoBox(6, C.redSoft, C.red, resultsCard)
local warningBox  = makeInfoBox(7, C.orangeSoft, C.orange, resultsCard)
local phaseLabel  = makeLabel("", 8, 18, C.subtext, false, true, resultsCard, Enum.Font.GothamMedium, 12)
local applyBtn    = makeButton("Apply Preview to Studio", 9, C.accentDim, 36, resultsCard)
local continueBtn = makeButton("Continue Next Phase", 10, C.accentDim, 34, resultsCard)
applyBtn.Active = false
applyBtn.AutoButtonColor = false
applyBtn.TextColor3 = C.subtext
continueBtn.Visible = false

local viewerTabsCard = makeCard(5)
makeLabel("Viewer Tabs", 1, 18, C.white, true, false, viewerTabsCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Switch between generated script output, 3D output, and hierarchy views for the current preview.",
    2, 32, C.subtext, false, true, viewerTabsCard, Enum.Font.Gotham, 12
)

local viewerTabsRow = Instance.new("Frame")
viewerTabsRow.Size = UDim2.new(1, -24, 0, 34)
viewerTabsRow.BackgroundTransparency = 1
viewerTabsRow.LayoutOrder = 3
viewerTabsRow.Parent = viewerTabsCard

local viewerTabsLayout = Instance.new("UIListLayout")
viewerTabsLayout.FillDirection = Enum.FillDirection.Horizontal
viewerTabsLayout.Padding = UDim.new(0, 6)
viewerTabsLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
viewerTabsLayout.SortOrder = Enum.SortOrder.LayoutOrder
viewerTabsLayout.Parent = viewerTabsRow

local scriptTabBtn = makeTabButton("Script", viewerTabsRow)
local outputTabBtn = makeTabButton("3D Output", viewerTabsRow)
local architectureTabBtn = makeTabButton("Hierarchy", viewerTabsRow)
local planTabBtn = makeTabButton("Plan", viewerTabsRow)

local scriptViewerCard, scriptViewer, scriptViewerEmpty = makeViewerCard(
    6,
    "Script Viewer",
    "Inspect the Luau scripts returned by the backend for the current preview or applied result.",
    "No generated script output yet.",
    220
)

local outputViewerCard, outputViewer, outputViewerEmpty = makeViewerCard(
    7,
    "3D Output Viewer",
    "Review generated 3D items, placement data, and object details for the current turn.",
    "No generated 3D item output yet.",
    190
)

local architectureViewerCard, architectureViewer, architectureViewerEmpty = makeViewerCard(
    8,
    "Architecture Viewer",
    "See the generated hierarchy for models, parts, and layout structure before or after apply.",
    "No generated architecture/layout output yet.",
    210
)

local planViewerCard, planViewer, planViewerEmpty = makeViewerCard(
    9,
    "Scene Plan",
    "Structured scene plan showing what the AI understood from your prompt — zones, objects, dimensions, style.",
    "No scene plan generated yet. Use Detailed mode to enable scene planning.",
    260
)

local actionsCard = makeCard(10)
makeLabel("Session Controls", 1, 18, C.white, true, false, actionsCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Undo the last applied generation or reset the current conversation before a new request.",
    2, 32, C.subtext, false, true, actionsCard, Enum.Font.Gotham, 12
)
local undoBtn  = makeButton("Undo Last Generation", 3, C.danger, 34, actionsCard)
local clearBtn = makeButton("Clear Conversation", 4, C.surfaceAlt, 34, actionsCard)

-- ── Status helpers ────────────────────────────────────────────
local function setStatus(msg, color)
    statusLbl.TextColor3 = color or C.subtext
    statusLbl.Text = tostring(msg):sub(1, 150)
end

local MAX_REFERENCE_IMAGES = 3
local referenceImages = {}
local referenceRows = {}

local function trimString(value)
    if type(value) ~= "string" then
        return ""
    end
    return value:match("^%s*(.-)%s*$") or ""
end

local function truncateMiddle(text, maxLen)
    local value = tostring(text or "")
    local limit = maxLen or 52
    if #value <= limit then
        return value
    end

    local head = math.max(8, math.floor((limit - 3) / 2))
    local tail = math.max(8, limit - head - 3)
    return value:sub(1, head) .. "..." .. value:sub(-tail)
end

local function isHttpUrl(text)
    local value = trimString(text)
    return value:match("^https?://") ~= nil
end

local function isDataImageUrl(text)
    local value = trimString(text)
    return value:match("^data:image/[%w%+%-%.]+;base64,") ~= nil
end

local function normalizeAssetId(text)
    local value = trimString(tostring(text or ""))
    if value == "" then
        return nil
    end

    return value:match("^rbxassetid://(%d+)$")
        or value:match("[?&]id=(%d+)")
        or value:match("/library/(%d+)")
        or value:match("/catalog/(%d+)")
        or value:match("/assets/(%d+)")
        or value:match("^([0-9]+)$")
end

local function normalizeReferenceEntry(entry)
    if type(entry) ~= "table" then
        return nil, "Reference image entry is invalid."
    end

    local entryType = trimString(tostring(entry.type or "")):lower()
    local rawValue = trimString(tostring(entry.value or ""))
    local label = trimString(tostring(entry.label or ""))

    if rawValue == "" then
        return nil, "Reference image entry is empty."
    end

    if entryType == "" then
        if isHttpUrl(rawValue) then
            entryType = "url"
        elseif isDataImageUrl(rawValue) then
            entryType = "inline"
        elseif normalizeAssetId(rawValue) then
            entryType = "asset"
        end
    end

    if entryType == "url" then
        if not isHttpUrl(rawValue) then
            return nil, "Reference image URL must start with http:// or https://"
        end
        return {
            type = "url",
            value = rawValue,
            label = label ~= "" and label or rawValue,
        }
    end

    if entryType == "asset" then
        local assetId = normalizeAssetId(rawValue)
        if not assetId then
            return nil, "Roblox asset references must be numeric IDs or rbxassetid:// IDs."
        end
        return {
            type = "asset",
            value = assetId,
            label = label ~= "" and label or ("Asset " .. assetId),
        }
    end

    if entryType == "inline" then
        if not isDataImageUrl(rawValue) then
            return nil, "Inline image payload must start with data:image/...;base64,"
        end
        return {
            type = "inline",
            value = rawValue,
            label = label ~= "" and label or "Pasted image",
        }
    end

    return nil, "Reference image type must be URL, inline data image, or Roblox asset."
end

local function clearReferenceRows()
    for _, row in ipairs(referenceRows) do
        if row and row.Parent then
            row:Destroy()
        end
    end
    referenceRows = {}
end

local function renderReferenceImages()
    clearReferenceRows()

    local count = #referenceImages
    refCountLabel.Text = string.format("%d / %d attached", count, MAX_REFERENCE_IMAGES)

    -- Update input box hint based on capacity
    if count >= MAX_REFERENCE_IMAGES then
        refInputBox.PlaceholderText = "3 / 3 images attached — remove one below to add another"
        refInputStroke.Color = Color3.fromRGB(60, 160, 90)
    else
        refInputBox.PlaceholderText = "Paste an image URL here, then press Enter  (https://...)"
        refInputStroke.Color = Color3.fromRGB(70, 90, 160)
    end

    refEmptyLabel.Visible = count == 0
    refListCard.Visible = true

    -- Type badge colors
    local typeBadgeColors = {
        url    = Color3.fromRGB(60, 120, 200),
        inline = Color3.fromRGB(150, 80, 200),
        asset  = Color3.fromRGB(200, 130, 40),
    }
    local typeBadgeLabels = {
        url    = "URL",
        inline = "PASTED",
        asset  = "ASSET",
    }

    for index, item in ipairs(referenceImages) do
        local row = Instance.new("Frame")
        row.Size = UDim2.new(1, 0, 0, 42)
        row.BackgroundColor3 = C.input
        row.BorderSizePixel = 0
        row.LayoutOrder = index + 1
        row.Parent = refListBody
        applyCorner(row, 8)
        applyStroke(row, C.border, 1, 0.4)

        local rowPad = Instance.new("UIPadding")
        rowPad.PaddingLeft = UDim.new(0, 10)
        rowPad.PaddingRight = UDim.new(0, 10)
        rowPad.PaddingTop = UDim.new(0, 6)
        rowPad.PaddingBottom = UDim.new(0, 6)
        rowPad.Parent = row

        -- Type badge pill
        local badge = Instance.new("Frame")
        badge.Size = UDim2.new(0, 52, 0, 16)
        badge.Position = UDim2.new(0, 0, 0, 0)
        badge.BackgroundColor3 = typeBadgeColors[item.type] or C.accentDim
        badge.BorderSizePixel = 0
        badge.Parent = row
        applyCorner(badge, 4)

        local badgeLbl = Instance.new("TextLabel")
        badgeLbl.Size = UDim2.new(1, 0, 1, 0)
        badgeLbl.BackgroundTransparency = 1
        badgeLbl.Text = typeBadgeLabels[item.type] or item.type:upper()
        badgeLbl.TextColor3 = Color3.fromRGB(255, 255, 255)
        badgeLbl.Font = Enum.Font.GothamBold
        badgeLbl.TextSize = 9
        badgeLbl.Parent = badge

        -- Image value label
        local rowLabel = Instance.new("TextLabel")
        rowLabel.Size = UDim2.new(1, -64, 0, 14)
        rowLabel.Position = UDim2.new(0, 0, 0, 18)
        rowLabel.BackgroundTransparency = 1
        rowLabel.TextColor3 = C.subtext
        rowLabel.Font = Enum.Font.Gotham
        rowLabel.TextSize = 10
        rowLabel.TextXAlignment = Enum.TextXAlignment.Left
        rowLabel.TextTruncate = Enum.TextTruncate.AtEnd
        rowLabel.Text = item.label or truncateMiddle(item.value, 60)
        rowLabel.Parent = row

        -- Index number
        local indexLbl = Instance.new("TextLabel")
        indexLbl.Size = UDim2.new(0, 14, 0, 14)
        indexLbl.Position = UDim2.new(1, -60, 0, 0)
        indexLbl.BackgroundTransparency = 1
        indexLbl.Text = tostring(index)
        indexLbl.TextColor3 = C.muted
        indexLbl.Font = Enum.Font.GothamBold
        indexLbl.TextSize = 10
        indexLbl.Parent = row

        -- Remove button
        local removeBtn = Instance.new("TextButton")
        removeBtn.Size = UDim2.new(0, 44, 0, 20)
        removeBtn.Position = UDim2.new(1, -44, 0.5, -10)
        removeBtn.BackgroundColor3 = Color3.fromRGB(160, 50, 50)
        removeBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
        removeBtn.Font = Enum.Font.GothamMedium
        removeBtn.TextSize = 10
        removeBtn.Text = "Remove"
        removeBtn.BorderSizePixel = 0
        removeBtn.Parent = row
        applyCorner(removeBtn, 4)

        local capturedIndex = index
        removeBtn.MouseButton1Click:Connect(function()
            table.remove(referenceImages, capturedIndex)
            renderReferenceImages()
            setStatus("Reference image removed.", C.subtext)
        end)

        table.insert(referenceRows, row)
    end
end

local function addReferenceImage(entry, showStatusMessage)
    local normalized, err = normalizeReferenceEntry(entry)
    if not normalized then
        return false, err
    end

    for _, existing in ipairs(referenceImages) do
        if existing.type == normalized.type and existing.value == normalized.value then
            return false, "That reference image is already attached."
        end
    end

    if #referenceImages >= MAX_REFERENCE_IMAGES then
        return false, "Only 3 reference images can be attached at once."
    end

    table.insert(referenceImages, normalized)
    renderReferenceImages()
    if showStatusMessage then
        setStatus(
            string.format("Reference image added (%d/%d).", #referenceImages, MAX_REFERENCE_IMAGES),
            C.green
        )
    end
    return true, nil
end

local function parseReferenceInput(raw)
    local entries = {}
    local text = tostring(raw or "")
    if isDataImageUrl(text) then
        table.insert(entries, trimString(text))
        return entries
    end

    for token in text:gmatch("[^\n]+") do
        local trimmed = trimString(token)
        if trimmed ~= "" then
            -- Allow comma-separated URLs/assets on a single line for convenience,
            -- but keep inline data:image payloads intact.
            if isDataImageUrl(trimmed) then
                table.insert(entries, trimmed)
            else
                for piece in trimmed:gmatch("[^,]+") do
                    local normalized = trimString(piece)
                    if normalized ~= "" then
                        table.insert(entries, normalized)
                    end
                end
            end
        end
    end
    return entries
end

local function flushReferenceInput(showStatusMessage)
    local raw = trimString(refInputBox.Text or "")
    if raw == "" then
        return nil
    end

    local warnings = {}
    local added = 0

    for _, token in ipairs(parseReferenceInput(raw)) do
        local inferredType = isHttpUrl(token) and "url"
            or (isDataImageUrl(token) and "inline" or (normalizeAssetId(token) and "asset" or ""))
        local ok, message = addReferenceImage({
            type = inferredType,
            value = token,
        }, false)
        if ok then
            added += 1
        elseif message then
            warnings[#warnings + 1] = message
        end
    end

    if added > 0 then
        refInputBox.Text = ""
        if showStatusMessage then
            setStatus(
                string.format("Added %d reference image(s).", added),
                C.green
            )
        end
    elseif showStatusMessage and #warnings > 0 then
        setStatus(warnings[1], C.orange)
    end

    return #warnings > 0 and warnings or nil
end

local function buildReferenceImagePayload()
    local payload = {}
    for _, item in ipairs(referenceImages) do
        payload[#payload + 1] = {
            type = item.type,
            value = item.value,
            label = item.label,
        }
    end
    return #payload > 0 and payload or nil
end

local function promptForReferenceAsset()
    if #referenceImages >= MAX_REFERENCE_IMAGES then
        setStatus("Only 3 reference images can be attached at once.", C.orange)
        return
    end

    setStatus("Select a Roblox decal/image asset...", C.subtext)
    task.spawn(function()
        local assetId = nil
        local lastErr = nil
        local assetTypes = { "Decal", "Image" }

        for _, assetType in ipairs(assetTypes) do
            local ok, result = pcall(function()
                return plugin:PromptForExistingAssetId(assetType)
            end)
            if ok then
                assetId = result
                break
            end
            lastErr = result
        end

        if type(assetId) == "number" and assetId > 0 then
            local ok, err = addReferenceImage({
                type = "asset",
                value = tostring(assetId),
                label = "Asset " .. tostring(assetId),
            }, true)
            if not ok and err then
                setStatus(err, C.orange)
            end
            return
        end

        if assetId == -1 then
            setStatus("Reference asset selection cancelled.", C.subtext)
            return
        end

        setStatus("Could not open the Roblox asset picker.", C.red)
        if lastErr then
            warn("[AI Plugin] Asset picker error: " .. tostring(lastErr))
        end
    end)
end

local pendingPreview = nil

local function setApplyReady(ready)
    applyBtn.Active = ready
    applyBtn.AutoButtonColor = ready
    applyBtn.BackgroundColor3 = ready and C.accent or C.accentDim
    applyBtn.TextColor3 = ready and C.white or C.subtext
end

local function getApplyRoot(target)
    if not target or not target.Parent then
        return game.Workspace
    end

    if target:IsA("LuaSourceContainer") then
        return target.Parent
    end

    return target
end

local function getCurrentTargetParent()
    local sel = Selection:Get()
    if #sel == 1 and sel[1] then
        return getApplyRoot(sel[1])
    end
    return game.Workspace
end

local function getTargetLabel(target)
    if not target or target == game.Workspace then
        return "Workspace"
    end
    local ok, fullName = pcall(function()
        return target:GetFullName()
    end)
    return ok and fullName or target.Name or "Workspace"
end

local function resolveServiceOrContainerPath(path)
    if type(path) ~= "string" then
        return nil
    end

    local trimmed = path:match("^%s*(.-)%s*$")
    if not trimmed or trimmed == "" then
        return nil
    end

    local aliases = {
        workspace = "Workspace",
        ["game.Workspace"] = "Workspace",
        ["StarterPlayerScripts"] = "StarterPlayer.StarterPlayerScripts",
        ["game.StarterPlayerScripts"] = "StarterPlayer.StarterPlayerScripts",
        ["StarterCharacterScripts"] = "StarterPlayer.StarterCharacterScripts",
        ["game.StarterCharacterScripts"] = "StarterPlayer.StarterCharacterScripts",
        ["PlayerGui"] = "StarterGui",
        ["game.PlayerGui"] = "StarterGui",
        ["PlayerScripts"] = "StarterPlayer.StarterPlayerScripts",
        ["game.PlayerScripts"] = "StarterPlayer.StarterPlayerScripts",
    }

    trimmed = aliases[trimmed] or trimmed

    local current = nil
    for segment in trimmed:gmatch("[^.]+") do
        if segment == "game" then
            current = game
        elseif not current or current == game then
            if segment == "Workspace" then
                current = game.Workspace
            else
                local okService, service = pcall(function()
                    return game:GetService(segment)
                end)
                if okService and service then
                    current = service
                else
                    current = game:FindFirstChild(segment)
                end
            end
        else
            current = current:FindFirstChild(segment)
        end

        if not current then
            return nil
        end
    end

    return current ~= game and current or nil
end

local function buildPreviewSummary(data, targetParent)
    local instanceCount = type(data.instances) == "table" and #data.instances or 0
    local scriptCount   = type(data.scripts) == "table" and #data.scripts or 0
    local terrainCount  = type(data.terrain) == "table" and #data.terrain or 0
    local lines = {
        string.format(
            "Preview ready for %s: %d instance(s), %d script(s), %d terrain op(s).",
            getTargetLabel(targetParent),
            instanceCount,
            scriptCount,
            terrainCount
        )
    }

    if instanceCount > 0 then
        lines[#lines + 1] = "Objects:"
        for i = 1, math.min(instanceCount, 5) do
            local instData = data.instances[i]
            local name = instData.properties and instData.properties.Name or instData.className
            lines[#lines + 1] = string.format("• %s (%s)", tostring(name), tostring(instData.className))
        end
        if instanceCount > 5 then
            lines[#lines + 1] = string.format("• ...and %d more object(s)", instanceCount - 5)
        end
    end

    if scriptCount > 0 then
        lines[#lines + 1] = "Scripts:"
        for i = 1, math.min(scriptCount, 4) do
            local scriptData = data.scripts[i]
            lines[#lines + 1] = string.format(
                "• %s -> %s",
                tostring(scriptData.name or scriptData.type or "Script"),
                tostring(scriptData.parent or "Workspace")
            )
        end
        if scriptCount > 4 then
            lines[#lines + 1] = string.format("• ...and %d more script(s)", scriptCount - 4)
        end
    end

    if terrainCount > 0 then
        lines[#lines + 1] = "Terrain:"
        for i = 1, math.min(terrainCount, 4) do
            local op = data.terrain[i]
            lines[#lines + 1] = string.format(
                "• %s %s",
                tostring(op.shape or "Terrain"),
                tostring(op.material or "Material")
            )
        end
        if terrainCount > 4 then
            lines[#lines + 1] = string.format("• ...and %d more terrain operation(s)", terrainCount - 4)
        end
    end

    if data.currentPhase and data.totalPhases and data.totalPhases > 1 then
        lines[#lines + 1] = string.format("Phase preview: %d of %d", data.currentPhase, data.totalPhases)
    end

    if data.generationMode then
        lines[#lines + 1] = string.format("Mode: %s", data.generationMode)
    end

    -- Image analysis status — critical for client demos using reference images
    if data.imageAnalysisState then
        local stateMap = {
            used              = "Vision: analyzed reference image(s)",
            text_fallback     = "Vision: used image label fallback (no vision model active)",
            skipped_or_empty  = "Vision: image provided but analysis returned empty",
            no_resolved_images= "Vision: could not resolve image URL",
            failed            = "Vision: analysis failed (check server logs)",
            not_requested     = nil,
            no_reference_images = nil,
        }
        local stateMsg = stateMap[data.imageAnalysisState]
        if stateMsg then
            lines[#lines + 1] = stateMsg
        end
    end

    if type(data.coherenceScore) == "table" then
        local cs = data.coherenceScore
        lines[#lines + 1] = string.format(
            "Quality: %s (%d/%d — %d%%)",
            tostring(cs.grade or "?"),
            cs.score or 0,
            cs.maxScore or 10,
            cs.percentage or 0
        )
    end

    return table.concat(lines, "\n")
end

local function formatNumber(n)
    if type(n) ~= "number" then
        return tostring(n)
    end
    if math.floor(n) == n then
        return tostring(n)
    end
    return string.format("%.2f", n)
end

local function formatTriple(value)
    if type(value) ~= "table" or #value ~= 3 then
        return nil
    end
    return string.format(
        "(%s, %s, %s)",
        formatNumber(value[1]),
        formatNumber(value[2]),
        formatNumber(value[3])
    )
end

local function formatColor(value)
    if type(value) ~= "table" or #value ~= 3 then
        return nil
    end
    return string.format(
        "RGB(%s, %s, %s)",
        formatNumber(value[1]),
        formatNumber(value[2]),
        formatNumber(value[3])
    )
end

local function formatTerrainOperation(op)
    if type(op) ~= "table" then
        return nil
    end

    local shape = tostring(op.shape or "Terrain")
    local material = tostring(op.material or "Material")
    local position = formatTriple(op.position)

    if shape == "Block" then
        return string.format(
            "%s %s at %s size %s",
            material,
            shape,
            position or "(?, ?, ?)",
            formatTriple(op.size) or "(?, ?, ?)"
        )
    end

    if shape == "Ball" then
        return string.format(
            "%s %s at %s radius %s",
            material,
            shape,
            position or "(?, ?, ?)",
            formatNumber(op.radius)
        )
    end

    if shape == "Cylinder" then
        return string.format(
            "%s %s at %s radius %s height %s",
            material,
            shape,
            position or "(?, ?, ?)",
            formatNumber(op.radius),
            formatNumber(op.height)
        )
    end

    return string.format("%s %s", material, shape)
end

local function getPreviewParentName(instData, targetParent)
    local parentName = instData and instData.parent
    if type(parentName) ~= "string" or parentName == "" or parentName == "Selection" then
        return getTargetLabel(targetParent)
    end
    return parentName
end

local function buildScriptViewerText(data)
    local scripts = type(data.scripts) == "table" and data.scripts or nil
    if not scripts or #scripts == 0 then
        return nil
    end

    local lines = {}
    for i, scriptData in ipairs(scripts) do
        lines[#lines + 1] = string.format(
            "[%d] %s (%s -> %s)",
            i,
            tostring(scriptData.name or "GeneratedScript"),
            tostring(scriptData.type or "Script"),
            tostring(scriptData.parent or "Workspace")
        )
        lines[#lines + 1] = string.rep("-", 56)

        local source = tostring(scriptData.source or "")
        if #source > 12000 then
            source = source:sub(1, 12000) .. "\n-- [truncated in viewer]"
        end
        lines[#lines + 1] = source ~= "" and source or "-- no source returned --"

        if i < #scripts then
            lines[#lines + 1] = ""
        end
    end

    return table.concat(lines, "\n")
end

local function build3DOutputText(data, targetParent, applied)
    local instances = type(data.instances) == "table" and data.instances or nil
    local terrainOps = type(data.terrain) == "table" and data.terrain or nil
    local hasInstances = instances and #instances > 0
    local hasTerrain = terrainOps and #terrainOps > 0

    if not hasInstances and not hasTerrain then
        return nil
    end

    local lines = {
        applied and "Generated 3D item output: Applied to Studio." or "Generated 3D item output: Preview only.",
        "Target root: " .. getTargetLabel(targetParent),
        "",
    }

    if hasInstances then
        local limit = math.min(#instances, 30)
        for i = 1, limit do
            local instData = instances[i]
            local props = instData.properties or {}
            lines[#lines + 1] = string.format(
                "[%d] %s (%s)",
                i,
                tostring(props.Name or instData.className),
                tostring(instData.className)
            )
            lines[#lines + 1] = "Parent: " .. getPreviewParentName(instData, targetParent)

            local size = formatTriple(props.Size)
            if size then
                lines[#lines + 1] = "Size: " .. size
            end

            local position = formatTriple(props.Position)
            if not position and type(props.CFrame) == "table" then
                position = formatTriple(props.CFrame.position)
            end
            if position then
                lines[#lines + 1] = "Position: " .. position
            end

            local color = formatColor(props.Color)
            if color then
                lines[#lines + 1] = "Color: " .. color
            end

            if props.Material then
                lines[#lines + 1] = "Material: " .. tostring(props.Material)
            end
            if props.Anchored ~= nil then
                lines[#lines + 1] = "Anchored: " .. tostring(props.Anchored)
            end

            lines[#lines + 1] = ""
        end

        if #instances > limit then
            lines[#lines + 1] = string.format("...and %d more generated item(s)", #instances - limit)
            lines[#lines + 1] = ""
        end
    end

    if hasTerrain then
        lines[#lines + 1] = "Terrain operations:"
        local terrainLimit = math.min(#terrainOps, 20)
        for i = 1, terrainLimit do
            lines[#lines + 1] = string.format("[T%d] %s", i, formatTerrainOperation(terrainOps[i]) or "Terrain op")
        end
        if #terrainOps > terrainLimit then
            lines[#lines + 1] = string.format("...and %d more terrain operation(s)", #terrainOps - terrainLimit)
        end
    end

    return table.concat(lines, "\n")
end

local function buildArchitectureViewerText(data, targetParent, applied)
    local instances = type(data.instances) == "table" and data.instances or nil
    local terrainOps = type(data.terrain) == "table" and data.terrain or nil
    local hasInstances = instances and #instances > 0
    local hasTerrain = terrainOps and #terrainOps > 0

    if not hasInstances and not hasTerrain then
        return nil
    end

    local rootLabel = getTargetLabel(targetParent)
    local childrenByParent = {}

    if hasInstances then
        for i, instData in ipairs(instances) do
            local props = instData.properties or {}
            local nodeName = tostring(props.Name or (instData.className .. "_" .. tostring(i)))
            local parentName = getPreviewParentName(instData, targetParent)
            childrenByParent[parentName] = childrenByParent[parentName] or {}
            table.insert(childrenByParent[parentName], {
                name = nodeName,
                className = tostring(instData.className),
            })
        end
    end

    local lines = {
        applied and "Architecture/layout output: Applied to Studio." or "Architecture/layout output: Preview only.",
        "",
        rootLabel,
    }

    if hasTerrain then
        lines[#lines + 1] = "└─ Terrain [" .. tostring(#terrainOps) .. " ops]"
        for i, op in ipairs(terrainOps) do
            lines[#lines + 1] = "   └─ " .. (formatTerrainOperation(op) or ("Terrain " .. tostring(i)))
        end
        if hasInstances then
            lines[#lines + 1] = ""
            lines[#lines + 1] = rootLabel
        end
    end

    local visited = {}
    local function renderTree(parentName, prefix)
        local children = childrenByParent[parentName]
        if not children then
            return
        end

        for index, child in ipairs(children) do
            local isLast = index == #children
            local branch = isLast and "└─ " or "├─ "
            local childPrefix = prefix .. (isLast and "   " or "│  ")
            lines[#lines + 1] = prefix .. branch .. child.name .. " [" .. child.className .. "]"

            if not visited[child.name] then
                visited[child.name] = true
                renderTree(child.name, childPrefix)
            end
        end
    end

    renderTree(rootLabel, "")

    if rootLabel ~= "Workspace" and childrenByParent["Workspace"] then
        lines[#lines + 1] = ""
        lines[#lines + 1] = "Workspace"
        renderTree("Workspace", "")
    end

    return table.concat(lines, "\n")
end

local function setViewerContent(viewer, emptyLabel, text)
    local hasText = type(text) == "string" and text ~= ""
    viewer.Text = hasText and text or ""
    viewer.Visible = hasText
    emptyLabel.Visible = not hasText
end

local function combineWarnings(primary, secondary)
    local combined = {}

    if type(primary) == "table" then
        for _, warning in ipairs(primary) do
            combined[#combined + 1] = warning
        end
    end

    if type(secondary) == "table" then
        for _, warning in ipairs(secondary) do
            combined[#combined + 1] = warning
        end
    end

    return #combined > 0 and combined or nil
end

local activeViewerTab = "script"
local viewerTabs = {
    script = {
        button = scriptTabBtn,
        card = scriptViewerCard,
        activeColor = C.accent,
    },
    output = {
        button = outputTabBtn,
        card = outputViewerCard,
        activeColor = C.greenSoft,
    },
    architecture = {
        button = architectureTabBtn,
        card = architectureViewerCard,
        activeColor = C.orangeSoft,
    },
    plan = {
        button = planTabBtn,
        card = planViewerCard,
        activeColor = C.accentSoft,
    },
}

local function setViewerTab(tabName)
    local targetTab = viewerTabs[tabName] and tabName or "script"
    activeViewerTab = targetTab

    for name, tab in pairs(viewerTabs) do
        local selected = name == targetTab
        tab.card.Visible = selected
        tab.button.BackgroundColor3 = selected and tab.activeColor or C.surfaceAlt
        tab.button.TextColor3 = selected and C.white or C.subtext
        tab.button.AutoButtonColor = not selected
    end
end

local function getPreferredViewerTab(data)
    if type(data.scripts) == "table" and #data.scripts > 0 then
        return "script"
    end

    if type(data.terrain) == "table" and #data.terrain > 0 then
        return "output"
    end

    if type(data.instances) == "table" and #data.instances > 0 then
        for _, instData in ipairs(data.instances) do
            local parentName = instData and instData.parent
            if type(parentName) == "string"
                and parentName ~= ""
                and parentName ~= "Workspace"
                and parentName ~= "Selection" then
                return "architecture"
            end
        end
        return "output"
    end

    return activeViewerTab
end

local function updateDemoViewers(data, targetParent, applied)
    setViewerContent(scriptViewer, scriptViewerEmpty, buildScriptViewerText(data))
    setViewerContent(outputViewer, outputViewerEmpty, build3DOutputText(data, targetParent, applied))
    setViewerContent(architectureViewer, architectureViewerEmpty, buildArchitectureViewerText(data, targetParent, applied))
    -- Update plan viewer with structured preview data or raw scene plan
    local planText = nil
    if type(data.previewData) == "table" then
        local pd = data.previewData
        local planLines = {}
        if pd.summary then
            local s = pd.summary
            planLines[#planLines + 1] = string.format("Scene: %s (%s)", s.title or "Untitled", s.sceneType or "?")
            if s.dimensions then
                planLines[#planLines + 1] = string.format("Dimensions: %dx%dx%d studs", s.dimensions.width or 0, s.dimensions.depth or 0, s.dimensions.height or 0)
            end
            planLines[#planLines + 1] = string.format("Total output: %d items, %d zones, %d planned objects", s.totalInstances or 0, s.zoneCount or 0, s.objectCount or 0)
        end
        if type(pd.zones) == "table" and #pd.zones > 0 then
            planLines[#planLines + 1] = "\nZones:"
            for _, z in ipairs(pd.zones) do
                planLines[#planLines + 1] = string.format("  • %s (%s)", z.name or "?", z.terrain or "?")
            end
        end
        if pd.environment then
            local env = pd.environment
            planLines[#planLines + 1] = string.format("\nEnvironment: %s, boundary: %s", env.enabled and "ON" or "OFF", env.boundaryType or "?")
            if type(env.elements) == "table" and #env.elements > 0 then
                planLines[#planLines + 1] = "  Elements: " .. table.concat(env.elements, ", ")
            end
        end
        if type(pd.validationHints) == "table" and #pd.validationHints > 0 then
            planLines[#planLines + 1] = "\nHints:"
            for _, h in ipairs(pd.validationHints) do
                planLines[#planLines + 1] = "  • " .. h
            end
        end
        planText = table.concat(planLines, "\n")
    elseif type(data.scenePlan) == "string" and data.scenePlan ~= "" then
        planText = data.scenePlan
    end
    if planText then
        setViewerContent(planViewer, planViewerEmpty, planText)
    end
    setViewerTab(getPreferredViewerTab(data))
end

local function showPreview(text)
    previewBox.Text = tostring(text or "")
    previewBox.Visible = text ~= nil and text ~= ""
end

local function showExplain(text)
    explainBox.Text    = "Backend response: " .. tostring(text)
    explainBox.Visible = text ~= nil and text ~= ""
end

local function showError(msg, detail, suggestion)
    local parts = { "Error: " .. tostring(msg) }
    if detail     then parts[#parts+1] = "Detail: "     .. tostring(detail)     end
    if suggestion then parts[#parts+1] = "Suggestion: " .. tostring(suggestion) end
    errorBox.Text    = table.concat(parts, "\n")
    errorBox.Visible = true
end

local function showWarnings(warnings)
    if not warnings or #warnings == 0 then
        warningBox.Visible = false
        return
    end
    local lines = { "Warnings:" }
    for _, w in ipairs(warnings) do
        lines[#lines+1] = "• " .. w
    end
    warningBox.Text    = table.concat(lines, "\n")
    warningBox.Visible = true
end

local function clearInfoBoxes()
    previewBox.Visible  = false
    explainBox.Visible  = false
    errorBox.Visible    = false
    warningBox.Visible  = false
    phaseLabel.Text     = ""
    scriptViewer.Text = ""
    scriptViewer.Visible = false
    scriptViewerEmpty.Visible = true
    outputViewer.Text = ""
    outputViewer.Visible = false
    outputViewerEmpty.Visible = true
    architectureViewer.Text = ""
    architectureViewer.Visible = false
    architectureViewerEmpty.Visible = true
    planViewer.Text = ""
    planViewer.Visible = false
    planViewerEmpty.Visible = true
    setViewerTab("script")
end

scriptTabBtn.MouseButton1Click:Connect(function()
    setViewerTab("script")
end)

outputTabBtn.MouseButton1Click:Connect(function()
    setViewerTab("output")
end)

architectureTabBtn.MouseButton1Click:Connect(function()
    setViewerTab("architecture")
end)

planTabBtn.MouseButton1Click:Connect(function()
    setViewerTab("plan")
end)

setViewerTab("script")
local isGenerating = false
renderReferenceImages()

-- Auto-add when text is pasted and looks like a URL (text Changed fires immediately on paste)
local refInputLastText = ""
refInputBox:GetPropertyChangedSignal("Text"):Connect(function()
    local current = refInputBox.Text or ""
    -- Only auto-add when new text appears that looks like a URL (not just typing a char at a time)
    if #current > 8 and current ~= refInputLastText then
        local trimmed = current:match("^%s*(.-)%s*$")
        if isHttpUrl(trimmed) and #trimmed > 10 then
            refInputLastText = ""
            refInputBox.Text = ""
            local inferredType = "url"
            local success, err = addReferenceImage({ type = inferredType, value = trimmed }, true)
            if not success and err then
                setStatus(err, C.orange)
                refInputBox.Text = trimmed
            end
        end
    end
    refInputLastText = current
end)

addRefUrlBtn.MouseButton1Click:Connect(function()
    flushReferenceInput(true)
end)

attachRefAssetBtn.MouseButton1Click:Connect(function()
    if not isGenerating then
        promptForReferenceAsset()
    end
end)

clearRefBtn.MouseButton1Click:Connect(function()
    referenceImages = {}
    refInputBox.Text = ""
    renderReferenceImages()
    setStatus("Reference images cleared.", C.subtext)
end)

refInputBox.FocusLost:Connect(function(enterPressed)
    if enterPressed and not isGenerating then
        flushReferenceInput(true)
    end
end)

local function setBusy(busy)
    busy = not not busy
    isGenerating = busy
    generateBtn.Active           = not busy
    generateBtn.BackgroundColor3 = busy and C.accentDim or C.accent
    generateBtn.Text             = busy and "Generating Preview..." or "Generate Preview"
    if busy then
        setApplyReady(false)
    elseif pendingPreview then
        local hasValidationErrors = type(pendingPreview.data.validationErrors) == "table"
            and #pendingPreview.data.validationErrors > 0
        setApplyReady(not hasValidationErrors)
    end
end

-- Track next-phase prompt for the continue button
local nextPhasePrompt = nil

-- ── Selection label ───────────────────────────────────────────
local function updateSelLabel()
    local sel = Selection:Get()
    if #sel == 0 then
        selLabel.Text = "Selection: No selection"
    elseif #sel == 1 then
        selLabel.Text = "Selection: " .. sel[1].Name .. " (" .. sel[1].ClassName .. ")"
    else
        selLabel.Text = "Selection: " .. #sel .. " objects selected"
    end
end
Selection.SelectionChanged:Connect(updateSelLabel)
updateSelLabel()

-- Selection context builder (cap at 5 objects)
local function getSelectionContext()
    local sel = Selection:Get()
    if #sel == 0 then return nil end
    local lines = {}
    for i = 1, math.min(#sel, 5) do
        local obj = sel[i]
        lines[i] = string.format("  - %s (%s)", obj.Name, obj.ClassName)
    end
    return "Currently selected in Studio:\n" .. table.concat(lines, "\n")
end

-- ── [B4] Extended type handler for applyChanges ───────────────
--
-- Design decisions:
--   • UDim2 detected by VALUE SHAPE (has .X and .Y with Scale/Offset)
--     not by property name — handles Size, Position, AnchorPoint, etc.
--   • CFrame handles three input formats: object, 12-element matrix, 3-element pos
--   • Generic Enum uses Enum[prop][value] pattern — covers all Roblox enums
--   • `continue` is NOT used — if/else pattern for full Luau compatibility
--   • Every property set is wrapped in pcall so one bad prop never
--     aborts the rest of the instance creation

local function tryApplyProperty(inst, prop, value)
    pcall(function()
        local resolvedProp = prop == "name" and "Name" or prop

        -- UDim2 — detected by VALUE SHAPE, not property name
        -- Handles GUI Size, Position, and other UDim2-based properties.
        if type(value) == "table" and value.X and value.Y
                and type(value.X) == "table" and type(value.Y) == "table" then
            inst[resolvedProp] = UDim2.new(
                value.X.Scale  or 0, value.X.Offset or 0,
                value.Y.Scale  or 0, value.Y.Offset or 0
            )

        -- Vector3 properties (array of 3 numbers)
        elseif resolvedProp == "Size" or resolvedProp == "Position" then
            if type(value) == "table" and #value == 3 then
                inst[resolvedProp] = Vector3.new(table.unpack(value))
            elseif type(value) == "table" and value.X and type(value.X) == "number" then
                -- Object format fallback: {X=1, Y=2, Z=3}
                inst[resolvedProp] = Vector3.new(value.X, value.Y or 0, value.Z or 0)
            end

        -- Color3
        elseif resolvedProp == "Color" or resolvedProp:match("Color3$") then
            if type(value) == "table" and #value == 3 then
                inst[resolvedProp] = Color3.fromRGB(table.unpack(value))
            end

        -- CFrame — three input formats
        elseif resolvedProp == "CFrame" then
            if type(value) == "table" then
                if value.position then
                    -- Object format: {position:[x,y,z], rotation:[rx,ry,rz]}
                    local pos = Vector3.new(table.unpack(value.position))
                    local rot = value.rotation or {0, 0, 0}
                    inst[resolvedProp] = CFrame.new(pos)
                        * CFrame.Angles(math.rad(rot[1]), math.rad(rot[2]), math.rad(rot[3]))
                elseif #value == 12 then
                    -- Raw 12-component CFrame matrix
                    inst[resolvedProp] = CFrame.new(table.unpack(value))
                elseif #value == 3 then
                    -- Position-only shorthand
                    inst[resolvedProp] = CFrame.new(table.unpack(value))
                end
            end

        -- BrickColor
        elseif resolvedProp == "BrickColor" then
            if type(value) == "string" then
                inst[resolvedProp] = BrickColor.new(value)
            end

        -- Generic Enum handler — works for Material, Shape, FormFactor,
        -- SurfaceType, TopSurface, BottomSurface, Style, Font, and any other
        elseif type(value) == "string" then
            local enumOk, enumType = pcall(function() return Enum[resolvedProp] end)
            if enumOk and enumType then
                local valOk, enumVal = pcall(function() return enumType[value] end)
                if valOk and enumVal then
                    inst[resolvedProp] = enumVal
                else
                    -- Enum lookup failed — fall through to plain assignment
                    inst[resolvedProp] = value
                end
            else
                -- Not an enum — plain string assignment
                inst[resolvedProp] = value
            end

        -- Primitives (number, boolean)
        else
            inst[resolvedProp] = value
        end
    end)
end

local function resolveEnumItem(enumName, valueName)
    if type(valueName) ~= "string" then
        return nil
    end

    local enumType = Enum[enumName]
    if not enumType then
        return nil
    end

    local direct = enumType[valueName]
    if direct then
        return direct
    end

    local normalizedTarget = valueName:gsub("[%s_%-]", ""):lower()
    for _, item in ipairs(enumType:GetEnumItems()) do
        if item.Name:gsub("[%s_%-]", ""):lower() == normalizedTarget then
            return item
        end
    end

    return nil
end

local function buildTerrainCFrame(op)
    local position = Vector3.new(table.unpack(op.position))
    local rotation = op.rotation or {0, 0, 0}
    return CFrame.new(position)
        * CFrame.Angles(math.rad(rotation[1] or 0), math.rad(rotation[2] or 0), math.rad(rotation[3] or 0))
end

local function applyTerrainOperation(terrain, op)
    if type(op) ~= "table" or type(op.shape) ~= "string" or type(op.position) ~= "table" then
        return false
    end

    local material = resolveEnumItem("Material", op.material) or Enum.Material.Grass
    local ok = pcall(function()
        if op.shape == "Block" and type(op.size) == "table" and #op.size == 3 then
            terrain:FillBlock(
                buildTerrainCFrame(op),
                Vector3.new(table.unpack(op.size)),
                material
            )
        elseif op.shape == "Ball" and type(op.radius) == "number" then
            terrain:FillBall(
                Vector3.new(table.unpack(op.position)),
                op.radius,
                material
            )
        elseif op.shape == "Cylinder" and type(op.radius) == "number" and type(op.height) == "number" then
            terrain:FillCylinder(
                buildTerrainCFrame(op),
                op.height,
                op.radius,
                material
            )
        else
            error("Unsupported terrain operation")
        end
    end)

    return ok
end

-- ── applyChanges ──────────────────────────────────────────────
-- `continue` is intentionally avoided for compatibility.
-- All loop bodies use if/else guards instead.
local function applyChanges(data, targetParent)
    local createdThisTurn = {}
    local updatedScriptsThisTurn = {}
    local terrainOperationsApplied = 0
    local createParent = (targetParent and targetParent.Parent) and targetParent or game.Workspace
    local createdByName = {}
    local updatedScriptsByInstance = {}
    local instanceEntries = {}

    local function resolveInstanceParent(parentName)
        if type(parentName) ~= "string" or parentName == "" or parentName == "Selection" then
            return createParent
        end

        local explicitParent = resolveServiceOrContainerPath(parentName)
        if explicitParent then
            return explicitParent
        end

        return createdByName[parentName] or createParent
    end

    local function resolveScriptParent(parentName)
        if type(parentName) ~= "string" or parentName == "" then
            return game.Workspace
        end

        if parentName == "Selection" then
            return createParent
        end

        local explicitParent = resolveServiceOrContainerPath(parentName)
        if explicitParent then
            return explicitParent
        end

        return createdByName[parentName] or game.Workspace
    end

    local function trackScriptUpdate(scriptInstance)
        if updatedScriptsByInstance[scriptInstance] then
            return
        end

        updatedScriptsByInstance[scriptInstance] = true
        table.insert(updatedScriptsThisTurn, {
            script = scriptInstance,
            previousSource = scriptInstance.Source,
        })
    end

    -- Create instances
    if type(data.instances) == "table" then
        for _, instData in ipairs(data.instances) do
            local okInst, newInst = pcall(function()
                return Instance.new(instData.className)
            end)

            if not okInst then
                warn("[AI Plugin] Unknown ClassName: " .. tostring(instData.className))
            else
                if type(instData.properties) == "table" then
                    for prop, value in pairs(instData.properties) do
                        tryApplyProperty(newInst, prop, value)
                    end
                end
                local instName = newInst.Name
                if instName and instName ~= "" and not createdByName[instName] then
                    createdByName[instName] = newInst
                end
                table.insert(instanceEntries, {
                    inst = newInst,
                    parent = instData.parent,
                })
                table.insert(createdThisTurn, newInst)
            end
        end
    end

    for _, entry in ipairs(instanceEntries) do
        entry.inst.Parent = resolveInstanceParent(entry.parent)
    end

    if type(data.terrain) == "table" and #data.terrain > 0 then
        local terrain = game.Workspace:FindFirstChildOfClass("Terrain") or game.Workspace.Terrain
        if terrain then
            for _, operation in ipairs(data.terrain) do
                if applyTerrainOperation(terrain, operation) then
                    terrainOperationsApplied += 1
                end
            end
        end
    end

    -- Create scripts
    if type(data.scripts) == "table" then
        for _, scriptData in ipairs(data.scripts) do
            local scriptName = tostring(scriptData.name or "GeneratedScript")
            local scriptSource = tostring(scriptData.source or "")
            local scriptParent = resolveScriptParent(scriptData.parent)
            local existingScript = scriptParent and scriptParent:FindFirstChild(scriptName)

            if existingScript and existingScript:IsA("LuaSourceContainer") then
                trackScriptUpdate(existingScript)

                local okSource, sourceErr = pcall(function()
                    existingScript.Source = scriptSource
                end)

                if not okSource then
                    warn("[AI Plugin] Failed to update script " .. scriptName .. ": " .. tostring(sourceErr))
                elseif scriptData.type and existingScript.ClassName ~= scriptData.type then
                    warn(
                        "[AI Plugin] Updated existing "
                            .. existingScript.ClassName
                            .. " named "
                            .. scriptName
                            .. " instead of creating requested "
                            .. tostring(scriptData.type)
                    )
                end
            else
                local okScript, newScript = pcall(function()
                    return Instance.new(scriptData.type)
                end)

                if not okScript then
                    warn("[AI Plugin] Invalid script type: " .. tostring(scriptData.type))
                else
                    newScript.Name   = scriptName
                    newScript.Source = scriptSource
                    newScript.Parent = scriptParent
                    table.insert(createdThisTurn, newScript)
                end
            end
        end
    end

    if #createdThisTurn > 0 or #updatedScriptsThisTurn > 0 or terrainOperationsApplied > 0 then
        table.insert(undoStack, {
            instances = createdThisTurn,
            scriptUpdates = updatedScriptsThisTurn,
            terrainOperations = terrainOperationsApplied,
        })
    end

    return {
        createdInstances = #createdThisTurn,
        updatedScripts = #updatedScriptsThisTurn,
        terrainOperations = terrainOperationsApplied,
        totalChanges = #createdThisTurn + #updatedScriptsThisTurn + terrainOperationsApplied,
    }
end

-- ── [B2] HTTP error parser ────────────────────────────────────
local function parseHttpError(errMsg)
    errMsg = tostring(errMsg)
    if errMsg:match("429")          then return "Rate limit hit.", "Wait a moment and try again." end
    if errMsg:match("401")          then return "Auth error.", "Check your AI API key on the backend." end
    if errMsg:match("301") or errMsg:match("302") then
        return "Endpoint redirected.", "Use the HTTPS base URL directly. Example: https://your-app.up.railway.app"
    end
    if errMsg:match("404")          then
        return "Endpoint not found.", "Save only the base backend URL, without a trailing slash or /generate."
    end
    if errMsg:match("500") or errMsg:match("502") then
        return "Backend request failed.", "Check the backend error details below or review server logs."
    end
    if errMsg:match("503")          then return "AI provider is down.", "Try again in a few minutes." end
    if errMsg:match("ECONNREFUSED") then return "Backend unreachable.", "Check Backend URL in plugin settings." end
    if errMsg:match("timeout") or errMsg:match("ETIMEDOUT") then
        return "Request timed out.", "Check your connection or retry." end
    return "Request failed.", errMsg:sub(1, 120)
end

-- ── Phase display helper [G2] ─────────────────────────────────
local function updatePhaseUI(data)
    local total   = data.totalPhases   or 1
    local current = data.currentPhase  or 1
    local phases  = data.phases        or {}
    local complexity = data.complexity or "simple"

    if total <= 1 or complexity == "simple" then
        phaseLabel.Text      = ""
        continueBtn.Visible  = false
        nextPhasePrompt      = nil
        return
    end

    phaseLabel.Text = string.format("Phase %d of %d • %s task", current, total, complexity)

    if current < total then
        local nextPhaseDesc = phases[current + 1] or ("Phase " .. (current + 1))
        nextPhasePrompt = "continue"
        continueBtn.Text    = "Continue: " .. nextPhaseDesc:sub(1, 40)
        continueBtn.Visible = true
    else
        continueBtn.Visible = false
        nextPhasePrompt     = nil
        phaseLabel.Text     = phaseLabel.Text .. " • Complete"
    end
end

-- ── Core generate function ────────────────────────────────────
local function applyPendingPreview()
    if not pendingPreview then
        setStatus("No preview is ready to apply.", C.subtext)
        return
    end

    local preview = pendingPreview
    local result = applyChanges(preview.data, preview.targetParent)
    local extraWarnings = nil

    if result.terrainOperations > 0 then
        extraWarnings = {
            "Terrain edits were applied to Workspace.Terrain and are not included in Undo Last Generation.",
        }
        setStatus(
            string.format(
                "Applied %d change(s), including %d terrain operation(s).",
                result.totalChanges,
                result.terrainOperations
            ),
            C.green
        )
    else
        setStatus(string.format("Applied %d change(s) from preview.", result.totalChanges), C.green)
    end

    showPreview(buildPreviewSummary(preview.data, preview.targetParent) .. "\nStatus: Applied to Studio.")
    showExplain(preview.data.explanation or "Done")
    showWarnings(combineWarnings(preview.data.warnings, extraWarnings))
    updateDemoViewers(preview.data, preview.targetParent, true)
    promptBox.Text = ""

    pendingPreview = nil
    setApplyReady(false)

    if nextPhasePrompt then
        continueBtn.Visible = true
    end
end

local function doGenerate(promptText)
    if not promptText or promptText:match("^%s*$") then return end

    local localReferenceWarnings = flushReferenceInput(false)

    pendingPreview = nil
    nextPhasePrompt = nil
    setBusy(true)
    clearInfoBoxes()
    setStatus("Submitting generation request...")
    setApplyReady(false)
    continueBtn.Visible = false

    -- Build full prompt with selection context
    local ctx = getSelectionContext()
    local fullPrompt = ctx
        and (ctx .. "\n\nRequest: " .. promptText:sub(1, 3800))
        or  promptText:sub(1, 4000)
    local targetParent = getCurrentTargetParent()
    local requestBaseUrl = normalizeBackendURL(BACKEND_URL) or BACKEND_URL
    local referenceImagePayload = buildReferenceImagePayload()

    local selectedMode = GAME_MODES[gameModeIndex]
    local requestPayload = HttpService:JSONEncode({
        prompt         = fullPrompt,
        conversationId = conversationId,
        mode           = isDetailedMode and "detailed" or "quick",
        generateEnv    = generateEnvironment,
        referenceImages = referenceImagePayload,
        gameMode       = (selectedMode and selectedMode.label ~= "None") and selectedMode.label or nil,
    })

    local ok, response = pcall(function()
        return HttpService:RequestAsync({
            Url = requestBaseUrl .. "/generate",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
            },
            Body = requestPayload,
        })
    end)

    if ok then
        local body = response.Body or ""
        local okJson, data = pcall(function()
            return HttpService:JSONDecode(body)
        end)

        if response.Success then
            if okJson then
                if data.error then
                    -- [B2] Structured error from server
                    local detail     = data.details and data.details.message or nil
                    local suggestion = data.suggestion or nil
                    setStatus("Request returned an error.", C.red)
                    showError(data.error, detail, suggestion)
                else
                    local explanation = data.explanation or "Done"
                    local hasInstances = type(data.instances) == "table" and #data.instances > 0
                    local hasScripts   = type(data.scripts) == "table" and #data.scripts > 0
                    local hasTerrain   = type(data.terrain) == "table" and #data.terrain > 0
                    local canApply     = hasInstances or hasScripts or hasTerrain
                    local previewWarnings = hasTerrain and {
                        "Terrain operations will edit Workspace.Terrain when applied. Undo Last Generation only removes created instances.",
                    } or nil

                    if canApply then
                        pendingPreview = {
                            data = data,
                            targetParent = targetParent,
                        }
                        showPreview(buildPreviewSummary(data, targetParent))
                        updateDemoViewers(data, targetParent, false)

                        -- Hard-gate: block apply if validation found critical errors
                        if type(data.validationErrors) == "table" and #data.validationErrors > 0 then
                            setApplyReady(false)
                            local errLines = { "Critical validation errors (apply blocked):" }
                            for _, e in ipairs(data.validationErrors) do
                                errLines[#errLines + 1] = "• " .. e
                            end
                            showError(table.concat(errLines, "\n"), nil,
                                "The output has structural issues. Try rephrasing or simplifying your prompt.")
                            setStatus("Preview has validation errors — apply is blocked.", C.orange)
                        else
                            setApplyReady(true)
                            setStatus("Preview ready. Review the backend response, then apply.", C.green)
                        end
                    else
                        updateDemoViewers(data, targetParent, false)
                        setStatus("Backend response contained no changes to apply.", C.subtext)
                    end

                    showExplain(explanation)
                    showWarnings(combineWarnings(combineWarnings(data.warnings, previewWarnings), localReferenceWarnings))
                    updatePhaseUI(data)
                end
            else
                setStatus("Server response could not be read.", C.red)
                showError("Server returned unreadable data.", nil, "Try again. If it persists, check server logs.")
            end
        else
            local detail = response.StatusMessage or ("HTTP " .. tostring(response.StatusCode))

            if okJson and data then
                local errorMessage = data.error or "Backend request failed."
                local errorDetail = data.details and data.details.message or detail
                local suggestion = data.suggestion
                if not suggestion then
                    local _, parsedSuggestion = parseHttpError(detail)
                    suggestion = parsedSuggestion
                end
                setStatus("Request could not be completed.", C.red)
                showError(errorMessage, errorDetail, suggestion)
            else
                local msg, sug = parseHttpError(detail)
                setStatus("Request could not be completed.", C.red)
                showError(msg, detail, sug)
            end

            warn("[AI Plugin] HTTP error: " .. tostring(detail) .. " body: " .. tostring(body):sub(1, 200))
        end
    else
        local msg, sug = parseHttpError(response)
        setStatus("Request could not be completed.", C.red)
        showError(msg, nil, sug)
        warn("[AI Plugin] RequestAsync error: " .. tostring(response))
    end

    setBusy(false)
end

local function isShiftHeld()
    return UserInputService:IsKeyDown(Enum.KeyCode.LeftShift)
        or UserInputService:IsKeyDown(Enum.KeyCode.RightShift)
end

local function isEnterKey(inputObject)
    if not inputObject then
        return false
    end

    return inputObject.KeyCode == Enum.KeyCode.Return
        or inputObject.KeyCode == Enum.KeyCode.KeypadEnter
end

local pendingEnterSubmit = false

UserInputService.InputBegan:Connect(function(inputObject)
    if isGenerating then
        return
    end

    if UserInputService:GetFocusedTextBox() ~= promptBox then
        return
    end

    if not isEnterKey(inputObject) or isShiftHeld() then
        return
    end

    pendingEnterSubmit = true
    task.defer(function()
        if UserInputService:GetFocusedTextBox() == promptBox then
            promptBox:ReleaseFocus()
        end
    end)
end)

promptBox.FocusLost:Connect(function(enterPressed)
    local shouldSubmit = pendingEnterSubmit or (enterPressed and not isShiftHeld())
    pendingEnterSubmit = false

    if shouldSubmit and not isGenerating then
        doGenerate(promptBox.Text)
    end
end)

-- ── Generate button ───────────────────────────────────────────
generateBtn.MouseButton1Click:Connect(function()
    doGenerate(promptBox.Text)
end)

applyBtn.MouseButton1Click:Connect(function()
    applyPendingPreview()
end)

-- ── Continue button (next phase) [G2] ────────────────────────
continueBtn.MouseButton1Click:Connect(function()
    if nextPhasePrompt then
        doGenerate(nextPhasePrompt)
    end
end)

-- ── Save URL button [B7] ──────────────────────────────────────
saveUrlBtn.MouseButton1Click:Connect(function()
    local newUrl = normalizeBackendURL(urlBox.Text)
    if newUrl then
        BACKEND_URL = newUrl
        urlBox.Text = newUrl
        saveBackendURL(newUrl)
        setStatus("Endpoint saved: " .. newUrl:sub(1, 50), C.green)
    else
        setStatus("URL cannot be empty.", C.red)
    end
end)

-- ── Test connection button ────────────────────────────────────
testConnectionBtn.MouseButton1Click:Connect(function()
    local testUrl = normalizeBackendURL(urlBox.Text or "")
    if not testUrl then
        setStatus("Set a valid backend URL before testing.", C.red)
        return
    end

    setStatus("Testing backend connection...", C.subtext)
    local ok, response = pcall(function()
        return HttpService:RequestAsync({
            Url = testUrl .. "/health",
            Method = "GET",
        })
    end)

    if not ok then
        setStatus("Connection test failed: " .. tostring(response):sub(1, 70), C.red)
        return
    end

    if not response.Success then
        setStatus(
            string.format("Health check failed (%s %s).", tostring(response.StatusCode), tostring(response.StatusMessage)),
            C.red
        )
        return
    end

    local okJson, payload = pcall(function()
        return HttpService:JSONDecode(response.Body or "{}")
    end)
    if not okJson or type(payload) ~= "table" then
        setStatus("Health endpoint responded, but body was not valid JSON.", C.orange)
        return
    end

    local provider = tostring(payload.provider or "unknown")
    local model = tostring(payload.model or "unknown")
    local status = tostring(payload.status or "ok")
    setStatus(
        string.format("Connected: %s (%s) via %s", provider, model, status),
        C.green
    )
end)

-- ── Undo button ───────────────────────────────────────────────
undoBtn.MouseButton1Click:Connect(function()
    if #undoStack == 0 then
        setStatus("Nothing to undo yet.", C.subtext)
        return
    end
    local batch = table.remove(undoStack)
    local instances = type(batch) == "table" and batch.instances or batch
    local scriptUpdates = type(batch) == "table" and batch.scriptUpdates or nil
    local terrainOperations = type(batch) == "table" and batch.terrainOperations or 0
    local count = 0
    local restoredScripts = 0

    if type(scriptUpdates) == "table" then
        for _, entry in ipairs(scriptUpdates) do
            if entry.script and entry.script.Parent then
                local okRestore = pcall(function()
                    entry.script.Source = entry.previousSource or ""
                end)
                if okRestore then
                    restoredScripts += 1
                end
            end
        end
    end

    for _, inst in ipairs(instances) do
        if inst and inst.Parent then
            inst:Destroy()
            count += 1
        end
    end

    if terrainOperations > 0 then
        setStatus(
            string.format(
                "Removed %d created item(s), restored %d updated script(s). %d terrain operation(s) from that generation cannot be undone automatically.",
                count,
                restoredScripts,
                terrainOperations
            ),
            C.subtext
        )
    elseif restoredScripts > 0 then
        setStatus(
            string.format("Removed %d created item(s) and restored %d updated script(s).", count, restoredScripts),
            C.subtext
        )
    else
        setStatus(string.format("Removed %d item(s) from the last generation.", count), C.subtext)
    end

    clearInfoBoxes()
    continueBtn.Visible = false
end)

-- ── Clear conversation button ─────────────────────────────────
clearBtn.MouseButton1Click:Connect(function()
    conversationId      = HttpService:GenerateGUID(false)
    undoStack           = {}
    pendingPreview      = nil
    promptBox.Text      = ""
    nextPhasePrompt     = nil
    setApplyReady(false)
    continueBtn.Visible = false
    phaseLabel.Text     = ""
    clearInfoBoxes()
    setStatus("Conversation cleared. A new session is ready.", C.subtext)
end)

-- ── Toolbar toggle ────────────────────────────────────────────
openBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)
