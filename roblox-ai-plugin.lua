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

local HttpService = game:GetService("HttpService")
local Selection   = game:GetService("Selection")

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
-- Each entry = list of Instances created in one generation turn.
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
    f.Size             = UDim2.new(1, 0, 0, height)
    f.BackgroundColor3 = bg or C.surface
    f.BorderSizePixel  = 0
    f.LayoutOrder      = order
    f.Parent           = parent or root
    applyCorner(f, 8)
    return f
end

local function makeCard(order)
    local card = Instance.new("Frame")
    card.Size = UDim2.new(1, 0, 0, 0)
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
    lbl.Size              = UDim2.new(1, 0, 0, height or 20)
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
    btn.Size             = UDim2.new(1, 0, 0, height or 34)
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

local function makeDivider(order, parent)
    local f = Instance.new("Frame")
    f.Size             = UDim2.new(1, 0, 0, 1)
    f.BackgroundColor3 = C.border
    f.BorderSizePixel  = 0
    f.LayoutOrder      = order
    f.BackgroundTransparency = 0.35
    f.Parent           = parent or root
end

local function makeInfoBox(order, bg, textColor, parent)
    local lbl = Instance.new("TextLabel")
    lbl.Size             = UDim2.new(1, 0, 0, 0)
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
    viewer.Size             = UDim2.new(1, 0, 0, height or 180)
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
    btn.Size = UDim2.new(0.333, -4, 1, 0)
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
flowFrame.Size = UDim2.new(1, 0, 0, 30)
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
urlBox.Size             = UDim2.new(1, 0, 0, 36)
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

local saveUrlBtn = makeButton("Save Endpoint", 5, C.accentDim, 34, connectionCard)
makeLabel("Endpoint used by the plugin: POST /generate", 6, 16, C.subtext, false, false, connectionCard, Enum.Font.Gotham, 11)

local buildCard = makeCard(3)
makeLabel("Build Request", 1, 18, C.white, true, false, buildCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Describe the script, object, layout, or game mode you want previewed before applying.",
    2, 32, C.subtext, false, true, buildCard, Enum.Font.Gotham, 12
)

local selectionFrame = Instance.new("Frame")
selectionFrame.Size = UDim2.new(1, 0, 0, 28)
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

makeLabel("Prompt", 4, 16, C.muted, true, false, buildCard, Enum.Font.GothamMedium, 12)
makeLabel("Example: Create a round-based game with a timer, teams, and a spawn system", 5, 16, C.subtext, false, false, buildCard, Enum.Font.Gotham, 11)

local promptBox = Instance.new("TextBox")
promptBox.Size             = UDim2.new(1, 0, 0, 112)
promptBox.BackgroundColor3 = C.input
promptBox.TextColor3       = C.white
promptBox.PlaceholderText  = 'Describe what to build, for example: "Add a leaderboard with kills and deaths"'
promptBox.TextWrapped      = true
promptBox.ClearTextOnFocus = false
promptBox.MultiLine        = true
promptBox.TextYAlignment   = Enum.TextYAlignment.Top
promptBox.TextXAlignment   = Enum.TextXAlignment.Left
promptBox.Font             = Enum.Font.Gotham
promptBox.TextSize         = 14
promptBox.LayoutOrder      = 6
promptBox.Parent           = buildCard
applyCorner(promptBox, 8)
applyStroke(promptBox, C.border, 1, 0.4)
local pPad = Instance.new("UIPadding")
pPad.PaddingLeft = UDim.new(0, 10)
pPad.PaddingRight = UDim.new(0, 10)
pPad.PaddingTop = UDim.new(0, 10)
pPad.PaddingBottom = UDim.new(0, 10)
pPad.Parent = promptBox

local generateBtn = makeButton("Generate Preview", 7, C.accent, 40, buildCard)

local resultsCard = makeCard(4)
makeLabel("Preview & Output", 1, 18, C.white, true, false, resultsCard, Enum.Font.GothamBold, 14)
makeLabel(
    "Review the backend response, inspect the preview, then apply the result into Studio when ready.",
    2, 32, C.subtext, false, true, resultsCard, Enum.Font.Gotham, 12
)

local statusFrame = Instance.new("Frame")
statusFrame.Size             = UDim2.new(1, 0, 0, 32)
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
viewerTabsRow.Size = UDim2.new(1, 0, 0, 34)
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

local actionsCard = makeCard(9)
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

local pendingPreview = nil

local function setApplyReady(ready)
    applyBtn.Active = ready
    applyBtn.AutoButtonColor = ready
    applyBtn.BackgroundColor3 = ready and C.accent or C.accentDim
    applyBtn.TextColor3 = ready and C.white or C.subtext
end

local function getCurrentTargetParent()
    local sel = Selection:Get()
    if #sel == 1 and sel[1] then
        return sel[1]
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

local function buildPreviewSummary(data, targetParent)
    local instanceCount = type(data.instances) == "table" and #data.instances or 0
    local scriptCount   = type(data.scripts) == "table" and #data.scripts or 0
    local lines = {
        string.format(
            "Preview ready for %s: %d instance(s), %d script(s).",
            getTargetLabel(targetParent),
            instanceCount,
            scriptCount
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

    if data.currentPhase and data.totalPhases and data.totalPhases > 1 then
        lines[#lines + 1] = string.format("Phase preview: %d of %d", data.currentPhase, data.totalPhases)
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
    if not instances or #instances == 0 then
        return nil
    end

    local lines = {
        applied and "Generated 3D item output: Applied to Studio." or "Generated 3D item output: Preview only.",
        "Target root: " .. getTargetLabel(targetParent),
        "",
    }

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
    end

    return table.concat(lines, "\n")
end

local function buildArchitectureViewerText(data, targetParent, applied)
    local instances = type(data.instances) == "table" and data.instances or nil
    if not instances or #instances == 0 then
        return nil
    end

    local rootLabel = getTargetLabel(targetParent)
    local childrenByParent = {}

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

    local lines = {
        applied and "Architecture/layout output: Applied to Studio." or "Architecture/layout output: Preview only.",
        "",
        rootLabel,
    }

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

setViewerTab("script")

local function setBusy(busy)
    generateBtn.Active           = not busy
    generateBtn.BackgroundColor3 = busy and C.accentDim or C.accent
    generateBtn.Text             = busy and "Generating Preview..." or "Generate Preview"
    if busy then
        setApplyReady(false)
    elseif pendingPreview then
        setApplyReady(true)
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

-- ── applyChanges ──────────────────────────────────────────────
-- `continue` is intentionally avoided for compatibility.
-- All loop bodies use if/else guards instead.
local function applyChanges(data, targetParent)
    local createdThisTurn = {}
    local createParent = (targetParent and targetParent.Parent) and targetParent or game.Workspace
    local createdByName = {}
    local instanceEntries = {}

    local function resolveInstanceParent(parentName)
        if type(parentName) ~= "string" or parentName == "" or parentName == "Selection" then
            return createParent
        end
        if parentName == "Workspace" then
            return game.Workspace
        end
        return createdByName[parentName] or createParent
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

    -- Create scripts
    if type(data.scripts) == "table" then
        for _, scriptData in ipairs(data.scripts) do
            local okScript, newScript = pcall(function()
                return Instance.new(scriptData.type)
            end)

            if not okScript then
                warn("[AI Plugin] Invalid script type: " .. tostring(scriptData.type))
            else
                newScript.Name   = tostring(scriptData.name   or "GeneratedScript")
                newScript.Source = tostring(scriptData.source or "")

                local okSvc, svc = pcall(function()
                    return game:GetService(scriptData.parent)
                end)
                newScript.Parent = (okSvc and svc) or game.Workspace
                table.insert(createdThisTurn, newScript)
            end
        end
    end

    if #createdThisTurn > 0 then
        table.insert(undoStack, createdThisTurn)
    end

    return #createdThisTurn
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
    local count = applyChanges(preview.data, preview.targetParent)
    setStatus(string.format("Applied %d change(s) from preview.", count), C.green)
    showPreview(buildPreviewSummary(preview.data, preview.targetParent) .. "\nStatus: Applied to Studio.")
    showExplain(preview.data.explanation or "Done")
    showWarnings(preview.data.warnings)
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
    local requestPayload = HttpService:JSONEncode({
        prompt         = fullPrompt,
        conversationId = conversationId,
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
                    local canApply     = hasInstances or hasScripts

                    if canApply then
                        pendingPreview = {
                            data = data,
                            targetParent = targetParent,
                        }
                        showPreview(buildPreviewSummary(data, targetParent))
                        updateDemoViewers(data, targetParent, false)
                        setApplyReady(true)
                        setStatus("Preview ready. Review the backend response, then apply.", C.green)
                    else
                        updateDemoViewers(data, targetParent, false)
                        setStatus("Backend response contained no changes to apply.", C.subtext)
                    end

                    showExplain(explanation)
                    showWarnings(data.warnings)
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

-- ── Undo button ───────────────────────────────────────────────
undoBtn.MouseButton1Click:Connect(function()
    if #undoStack == 0 then
        setStatus("Nothing to undo yet.", C.subtext)
        return
    end
    local batch = table.remove(undoStack)
    local count = 0
    for _, inst in ipairs(batch) do
        if inst and inst.Parent then
            inst:Destroy()
            count += 1
        end
    end
    setStatus(string.format("Removed %d item(s) from the last generation.", count), C.subtext)
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
