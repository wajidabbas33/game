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

local function getBackendURL()
    local url = plugin:GetSetting(URL_SETTING_KEY)
    if not url or url == "" then
        plugin:SetSetting(URL_SETTING_KEY, DEFAULT_URL)
        return DEFAULT_URL
    end
    return url
end

local function saveBackendURL(url)
    plugin:SetSetting(URL_SETTING_KEY, url)
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
    bg        = Color3.fromRGB(28,  28,  28),
    surface   = Color3.fromRGB(42,  42,  42),
    input     = Color3.fromRGB(55,  55,  55),
    border    = Color3.fromRGB(70,  70,  70),
    accent    = Color3.fromRGB(0,  162, 255),
    accentDim = Color3.fromRGB(0,   90, 140),
    danger    = Color3.fromRGB(210,  55,  55),
    warning   = Color3.fromRGB(220, 160,  30),
    white     = Color3.new(1, 1, 1),
    subtext   = Color3.fromRGB(160, 160, 160),
    green     = Color3.fromRGB(80,  200,  80),
    red       = Color3.fromRGB(220,  70,  70),
    orange    = Color3.fromRGB(220, 140,  40),
}

-- ── Root scroll frame ─────────────────────────────────────────
local root = Instance.new("ScrollingFrame")
root.Size                = UDim2.new(1, 0, 1, 0)
root.BackgroundColor3    = C.bg
root.BorderSizePixel     = 0
root.ScrollBarThickness  = 4
root.ScrollBarImageColor3= C.accent
root.AutomaticCanvasSize = Enum.AutomaticSize.Y
root.CanvasSize          = UDim2.new(1, 0, 0, 0)
root.Parent              = widget

local layout = Instance.new("UIListLayout")
layout.Padding             = UDim.new(0, 8)
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.SortOrder           = Enum.SortOrder.LayoutOrder
layout.Parent              = root

layout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
    root.CanvasSize = UDim2.new(0, 0, 0, layout.AbsoluteContentSize.Y + 20)
end)

local rootPad = Instance.new("UIPadding")
rootPad.PaddingTop    = UDim.new(0, 10)
rootPad.PaddingBottom = UDim.new(0, 10)
rootPad.PaddingLeft   = UDim.new(0, 10)
rootPad.PaddingRight  = UDim.new(0, 10)
rootPad.Parent        = root

-- ── UI helpers ────────────────────────────────────────────────
local function makeFrame(order, height, bg)
    local f = Instance.new("Frame")
    f.Size             = UDim2.new(1, 0, 0, height)
    f.BackgroundColor3 = bg or C.surface
    f.BorderSizePixel  = 0
    f.LayoutOrder      = order
    f.Parent           = root
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 5)
    corner.Parent = f
    return f
end

local function makeLabel(text, order, height, color, bold, wrap)
    local lbl = Instance.new("TextLabel")
    lbl.Text              = text
    lbl.TextColor3        = color or C.white
    lbl.BackgroundTransparency = 1
    lbl.Size              = UDim2.new(1, 0, 0, height or 20)
    lbl.TextXAlignment    = Enum.TextXAlignment.Left
    lbl.Font              = bold and Enum.Font.SourceSansBold or Enum.Font.SourceSans
    lbl.TextSize          = 14
    lbl.TextWrapped       = wrap ~= false
    lbl.LayoutOrder       = order
    lbl.Parent            = root
    return lbl
end

local function makeButton(text, order, bg, height)
    local btn = Instance.new("TextButton")
    btn.Size             = UDim2.new(1, 0, 0, height or 34)
    btn.BackgroundColor3 = bg or C.accent
    btn.Text             = text
    btn.TextColor3       = C.white
    btn.Font             = Enum.Font.SourceSansBold
    btn.TextSize         = 15
    btn.LayoutOrder      = order
    btn.AutoButtonColor  = true
    btn.Parent           = root
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 5)
    corner.Parent = btn
    return btn
end

local function makeDivider(order)
    local f = Instance.new("Frame")
    f.Size             = UDim2.new(1, 0, 0, 1)
    f.BackgroundColor3 = C.border
    f.BorderSizePixel  = 0
    f.LayoutOrder      = order
    f.Parent           = root
end

local function makeInfoBox(order, bg, textColor)
    local lbl = Instance.new("TextLabel")
    lbl.Size             = UDim2.new(1, 0, 0, 0)
    lbl.AutomaticSize    = Enum.AutomaticSize.Y
    lbl.BackgroundColor3 = bg or C.surface
    lbl.TextColor3       = textColor or C.white
    lbl.Text             = ""
    lbl.TextWrapped      = true
    lbl.Font             = Enum.Font.SourceSans
    lbl.TextSize         = 13
    lbl.TextXAlignment   = Enum.TextXAlignment.Left
    lbl.LayoutOrder      = order
    lbl.Visible          = false
    lbl.Parent           = root
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 5)
    corner.Parent = lbl
    local pad = Instance.new("UIPadding")
    pad.PaddingLeft   = UDim.new(0, 7)
    pad.PaddingRight  = UDim.new(0, 7)
    pad.PaddingTop    = UDim.new(0, 5)
    pad.PaddingBottom = UDim.new(0, 5)
    pad.Parent = lbl
    return lbl
end

-- ── UI layout ─────────────────────────────────────────────────
-- Section 1: Header
makeLabel("🤖  Roblox AI Studio", 1, 24, C.white, true)
makeLabel("Type a command — AI generates and applies it.", 2, 17, C.subtext)
makeDivider(3)

-- Section 2: Backend URL config [B7]
makeLabel("Backend URL", 4, 18, C.subtext, true)
local urlBox = Instance.new("TextBox")
urlBox.Size             = UDim2.new(1, 0, 0, 28)
urlBox.BackgroundColor3 = C.input
urlBox.TextColor3       = C.white
urlBox.PlaceholderText  = "https://your-backend.up.railway.app"
urlBox.Text             = BACKEND_URL
urlBox.TextWrapped      = false
urlBox.ClearTextOnFocus = false
urlBox.Font             = Enum.Font.SourceSans
urlBox.TextSize         = 13
urlBox.LayoutOrder      = 5
urlBox.Parent           = root
local urlCorner = Instance.new("UICorner"); urlCorner.CornerRadius = UDim.new(0,5); urlCorner.Parent = urlBox
local urlPad = Instance.new("UIPadding"); urlPad.PaddingLeft = UDim.new(0,5); urlPad.Parent = urlBox

local saveUrlBtn = makeButton("💾  Save URL", 6, C.accentDim, 28)

makeDivider(7)

-- Section 3: Selection context
local selLabel = makeLabel("📌  No selection", 8, 18, C.subtext)

-- Section 4: Prompt input
makeLabel("Describe what you want to build:", 9, 20, C.white, true)
makeLabel("Try: 'Create a round-based game with 60s timer and 2 teams'", 10, 17, C.subtext)

local promptBox = Instance.new("TextBox")
promptBox.Size             = UDim2.new(1, 0, 0, 90)
promptBox.BackgroundColor3 = C.input
promptBox.TextColor3       = C.white
promptBox.PlaceholderText  = 'e.g. "Add a leaderboard with kills and deaths"'
promptBox.TextWrapped      = true
promptBox.ClearTextOnFocus = false
promptBox.MultiLine        = true
promptBox.TextYAlignment   = Enum.TextYAlignment.Top
promptBox.Font             = Enum.Font.SourceSans
promptBox.TextSize         = 14
promptBox.LayoutOrder      = 11
promptBox.Parent           = root
local pCorner = Instance.new("UICorner"); pCorner.CornerRadius = UDim.new(0,5); pCorner.Parent = promptBox
local pPad = Instance.new("UIPadding"); pPad.PaddingLeft = UDim.new(0,6); pPad.PaddingTop = UDim.new(0,6); pPad.Parent = promptBox

local generateBtn = makeButton("⚡  Generate & Apply", 12, C.accent, 40)

-- Section 5: Status bar
local statusFrame = Instance.new("Frame")
statusFrame.Size             = UDim2.new(1, 0, 0, 26)
statusFrame.BackgroundColor3 = C.surface
statusFrame.BorderSizePixel  = 0
statusFrame.LayoutOrder      = 13
statusFrame.Parent           = root
local sfCorner = Instance.new("UICorner"); sfCorner.CornerRadius = UDim.new(0,5); sfCorner.Parent = statusFrame
local statusLbl = Instance.new("TextLabel")
statusLbl.Size              = UDim2.new(1,-8,1,0)
statusLbl.Position          = UDim2.new(0,4,0,0)
statusLbl.BackgroundTransparency = 1
statusLbl.TextColor3        = C.subtext
statusLbl.Text              = "Ready — enter a prompt above"
statusLbl.TextWrapped       = true
statusLbl.TextTruncate      = Enum.TextTruncate.AtEnd
statusLbl.Font              = Enum.Font.SourceSans
statusLbl.TextSize          = 13
statusLbl.TextXAlignment    = Enum.TextXAlignment.Left
statusLbl.Parent            = statusFrame

-- Section 6: Info boxes
local explainBox  = makeInfoBox(14, Color3.fromRGB(35,58,35), C.green)   -- success
local errorBox    = makeInfoBox(15, Color3.fromRGB(58,30,30), C.red)      -- error
local warningBox  = makeInfoBox(16, Color3.fromRGB(58,50,25), C.orange)   -- warnings

-- Section 7: Phase progress [G2]
makeDivider(17)
local phaseLabel = makeLabel("", 18, 18, C.subtext)
local continueBtn = makeButton("▶  Continue to Next Phase", 19, C.accentDim, 32)
continueBtn.Visible = false

-- Section 8: Actions
makeDivider(20)
makeLabel("Actions", 21, 18, C.subtext, true)
local undoBtn  = makeButton("↩  Undo Last Generation", 22, C.danger,  32)
local clearBtn = makeButton("🗑  Clear Conversation",  23, Color3.fromRGB(65,65,65), 32)

-- ── Status helpers ────────────────────────────────────────────
local function setStatus(msg, color)
    statusLbl.TextColor3 = color or C.subtext
    statusLbl.Text = tostring(msg):sub(1, 150)
end

local function showExplain(text)
    explainBox.Text    = "✔  " .. tostring(text)
    explainBox.Visible = text ~= nil and text ~= ""
end

local function showError(msg, detail, suggestion)
    local parts = { "✖  " .. tostring(msg) }
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
    local lines = { "⚠  Cross-reference warnings:" }
    for _, w in ipairs(warnings) do
        lines[#lines+1] = "• " .. w
    end
    warningBox.Text    = table.concat(lines, "\n")
    warningBox.Visible = true
end

local function clearInfoBoxes()
    explainBox.Visible  = false
    errorBox.Visible    = false
    warningBox.Visible  = false
end

local function setBusy(busy)
    generateBtn.Active           = not busy
    generateBtn.BackgroundColor3 = busy and C.accentDim or C.accent
    generateBtn.Text             = busy and "⏳  Generating…" or "⚡  Generate & Apply"
end

-- Track next-phase prompt for the continue button
local nextPhasePrompt = nil

-- ── Selection label ───────────────────────────────────────────
local function updateSelLabel()
    local sel = Selection:Get()
    if #sel == 0 then
        selLabel.Text = "📌  No selection"
    elseif #sel == 1 then
        selLabel.Text = "📌  " .. sel[1].Name .. " (" .. sel[1].ClassName .. ")"
    else
        selLabel.Text = "📌  " .. #sel .. " objects selected"
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
        -- Vector3 properties (array of 3 numbers)
        if prop == "Size" or prop == "Position" then
            if type(value) == "table" and #value == 3 then
                inst[prop] = Vector3.new(table.unpack(value))
            elseif type(value) == "table" and value.X and type(value.X) == "number" then
                -- Object format fallback: {X=1, Y=2, Z=3}
                inst[prop] = Vector3.new(value.X, value.Y or 0, value.Z or 0)
            end

        -- Color3
        elseif prop == "Color" then
            if type(value) == "table" and #value == 3 then
                inst[prop] = Color3.fromRGB(table.unpack(value))
            end

        -- CFrame — three input formats
        elseif prop == "CFrame" then
            if type(value) == "table" then
                if value.position then
                    -- Object format: {position:[x,y,z], rotation:[rx,ry,rz]}
                    local pos = Vector3.new(table.unpack(value.position))
                    local rot = value.rotation or {0, 0, 0}
                    inst[prop] = CFrame.new(pos)
                        * CFrame.Angles(math.rad(rot[1]), math.rad(rot[2]), math.rad(rot[3]))
                elseif #value == 12 then
                    -- Raw 12-component CFrame matrix
                    inst[prop] = CFrame.new(table.unpack(value))
                elseif #value == 3 then
                    -- Position-only shorthand
                    inst[prop] = CFrame.new(table.unpack(value))
                end
            end

        -- UDim2 — detected by VALUE SHAPE, not property name
        -- Handles Size, Position, AnchorPoint on any GUI element
        elseif type(value) == "table" and value.X and value.Y
                and type(value.X) == "table" and type(value.Y) == "table" then
            inst[prop] = UDim2.new(
                value.X.Scale  or 0, value.X.Offset or 0,
                value.Y.Scale  or 0, value.Y.Offset or 0
            )

        -- BrickColor
        elseif prop == "BrickColor" then
            if type(value) == "string" then
                inst[prop] = BrickColor.new(value)
            end

        -- Generic Enum handler — works for Material, Shape, FormFactor,
        -- SurfaceType, TopSurface, BottomSurface, Style, Font, and any other
        elseif type(value) == "string" then
            local enumOk, enumType = pcall(function() return Enum[prop] end)
            if enumOk and enumType then
                local valOk, enumVal = pcall(function() return enumType[value] end)
                if valOk and enumVal then
                    inst[prop] = enumVal
                else
                    -- Enum lookup failed — fall through to plain assignment
                    inst[prop] = value
                end
            else
                -- Not an enum — plain string assignment
                inst[prop] = value
            end

        -- Primitives (number, boolean)
        else
            inst[prop] = value
        end
    end)
end

-- ── applyChanges ──────────────────────────────────────────────
-- `continue` is intentionally avoided for compatibility.
-- All loop bodies use if/else guards instead.
local function applyChanges(data)
    local createdThisTurn = {}

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

                -- Parent to single selected object if applicable, else Workspace
                local sel = Selection:Get()
                newInst.Parent = (#sel == 1) and sel[1] or game.Workspace
                table.insert(createdThisTurn, newInst)
            end
        end
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

    phaseLabel.Text = string.format("Phase %d of %d  [%s task]", current, total, complexity)

    if current < total then
        local nextPhaseDesc = phases[current + 1] or ("Phase " .. (current + 1))
        nextPhasePrompt = "continue"
        continueBtn.Text    = "▶  Continue: " .. nextPhaseDesc:sub(1, 40)
        continueBtn.Visible = true
    else
        continueBtn.Visible = false
        nextPhasePrompt     = nil
        phaseLabel.Text     = phaseLabel.Text .. "  ✔ Complete"
    end
end

-- ── Core generate function ────────────────────────────────────
local function doGenerate(promptText)
    if not promptText or promptText:match("^%s*$") then return end

    setBusy(true)
    clearInfoBoxes()
    setStatus("Generating…")
    continueBtn.Visible = false

    -- Build full prompt with selection context
    local ctx = getSelectionContext()
    local fullPrompt = ctx
        and (ctx .. "\n\nRequest: " .. promptText:sub(1, 3800))
        or  promptText:sub(1, 4000)

    local ok, result = pcall(function()
        return HttpService:PostAsync(
            BACKEND_URL .. "/generate",
            HttpService:JSONEncode({
                prompt         = fullPrompt,
                conversationId = conversationId,
            }),
            Enum.HttpContentType.ApplicationJson
        )
    end)

    if ok then
        local okJson, data = pcall(function()
            return HttpService:JSONDecode(result)
        end)

        if okJson then
            if data.error then
                -- [B2] Structured error from server
                local detail     = data.details and data.details.message or nil
                local suggestion = data.suggestion or nil
                setStatus("Error: " .. tostring(data.error), C.red)
                showError(data.error, detail, suggestion)
            else
                local count = applyChanges(data)
                local explanation = data.explanation or "Done"
                setStatus(string.format("✔  Applied %d object(s)", count), C.green)
                showExplain(explanation)
                showWarnings(data.warnings)
                updatePhaseUI(data)
                promptBox.Text = ""
            end
        else
            setStatus("Error: Server response unreadable", C.red)
            showError("Server returned unreadable data.", nil, "Try again. If it persists, check server logs.")
        end
    else
        -- HTTP-level failure
        local msg, sug = parseHttpError(result)
        setStatus("Error: " .. msg, C.red)
        showError(msg, nil, sug)
        warn("[AI Plugin] HTTP error: " .. tostring(result))
    end

    setBusy(false)
end

-- ── Generate button ───────────────────────────────────────────
generateBtn.MouseButton1Click:Connect(function()
    doGenerate(promptBox.Text)
end)

-- ── Continue button (next phase) [G2] ────────────────────────
continueBtn.MouseButton1Click:Connect(function()
    if nextPhasePrompt then
        doGenerate(nextPhasePrompt)
    end
end)

-- ── Save URL button [B7] ──────────────────────────────────────
saveUrlBtn.MouseButton1Click:Connect(function()
    local newUrl = urlBox.Text:match("^%s*(.-)%s*$")  -- trim whitespace
    if newUrl and newUrl ~= "" then
        BACKEND_URL = newUrl
        saveBackendURL(newUrl)
        setStatus("Backend URL saved: " .. newUrl:sub(1, 50), C.green)
    else
        setStatus("URL cannot be empty.", C.red)
    end
end)

-- ── Undo button ───────────────────────────────────────────────
undoBtn.MouseButton1Click:Connect(function()
    if #undoStack == 0 then
        setStatus("Nothing to undo.", C.subtext)
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
    setStatus(string.format("Undone: %d object(s) removed.", count), C.subtext)
    clearInfoBoxes()
    continueBtn.Visible = false
end)

-- ── Clear conversation button ─────────────────────────────────
clearBtn.MouseButton1Click:Connect(function()
    conversationId      = HttpService:GenerateGUID(false)
    undoStack           = {}
    promptBox.Text      = ""
    nextPhasePrompt     = nil
    continueBtn.Visible = false
    phaseLabel.Text     = ""
    clearInfoBoxes()
    setStatus("Conversation cleared — new session started.", C.subtext)
end)

-- ── Toolbar toggle ────────────────────────────────────────────
openBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)
