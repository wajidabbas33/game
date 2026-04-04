# Roblox AI Plugin Improvements Bugfix Design

## Overview

This design addresses 7 critical defects in the Roblox AI Plugin system that prevent production deployment. The bugs span validation, error handling, resilience, type support, resource protection, and configuration management. The fix strategy focuses on:

1. **Lua Syntax Validation**: Server-side validation before sending code to plugin
2. **Enhanced Error Handling**: Clear, actionable error messages throughout the system
3. **Retry Logic**: Exponential backoff for transient API failures
4. **Extended Type Support**: Proper handling of complex Roblox types (CFrame, UDim2, BrickColor, Enums)
5. **Rate Limiting**: Protection against API quota exhaustion
6. **Environment Validation**: Fail-fast startup validation for required configuration
7. **Configuration System**: Flexible backend URL configuration for deployment

The approach maintains all existing functionality while adding robustness and production-readiness.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger each of the 7 defects
- **Property (P)**: The desired correct behavior for each bug condition
- **Preservation**: All existing functionality that must remain unchanged
- **applyChanges()**: The Lua function in the plugin that creates instances and scripts from AI responses
- **SYSTEM_PROMPT**: The OpenAI system prompt that guides AI response generation
- **conversationId**: Unique identifier for maintaining conversation history across requests
- **Exponential Backoff**: Retry strategy with increasing delays (1s, 2s, 4s, etc.)
- **Luau**: Roblox's typed Lua dialect
- **CFrame**: Roblox coordinate frame type (position + rotation)
- **UDim2**: Roblox 2D dimension type with scale and offset components
- **BrickColor**: Roblox legacy color type using named palette
- **Enum**: Roblox enumeration types (e.g., Enum.Material.Plastic)

## Bug Details

### Bug Condition 1: Missing JSON Structure Validation

The bug manifests when the OpenAI API generates a response that doesn't match the expected JSON structure. The backend sends this malformed response directly to the plugin without validation, causing errors when the plugin tries to process it.

**Formal Specification:**
```
FUNCTION isBugCondition1(response)
  INPUT: response of type AIGeneratedResponse
  OUTPUT: boolean
  
  RETURN response EXISTS
         AND NOT hasValidStructure(response)
         AND noValidationPerformed(response)
END FUNCTION
```

**Examples:**
- AI generates response without `scripts` array when scripts are expected → Plugin crashes trying to iterate
- AI generates script without `name` field → Plugin crashes with "attempt to index nil"
- AI generates instance without `properties` object → Plugin crashes trying to iterate properties
- AI generates script with `type` not in ["Script", "LocalScript", "ModuleScript"] → Plugin creates invalid instance

**Note**: We do NOT validate Lua syntax server-side because:
- luaparse only supports Lua 5.1, not Luau (Roblox's dialect)
- Luau features like `continue`, type annotations, `//` comments would be rejected
- Roblox Studio is the authoritative validator for Luau syntax
- Server-side validation would create false negatives

### Bug Condition 2: Generic Error Messages

The bug manifests when any error occurs during generation or application. The system displays generic messages like "Error: Invalid JSON from server" without context about what failed or how to fix it.

**Formal Specification:**
```
FUNCTION isBugCondition2(error)
  INPUT: error of type Error
  OUTPUT: boolean
  
  RETURN error.occurred = true
         AND error.message IN ["Error: Invalid JSON from server", "Error: Failed to generate response from AI"]
         AND NOT error.hasActionableDetails
END FUNCTION
```


**Examples:**
- OpenAI API returns 429 rate limit → User sees "Error: Failed to generate response from AI" (no mention of rate limit)
- Network timeout occurs → User sees generic error without retry suggestion
- Invalid JSON structure → User sees "Error: Invalid JSON from server" without details about what's invalid

### Bug Condition 3: No Automatic Retry Logic

The bug manifests when the OpenAI API call fails due to transient issues (network glitches, temporary rate limits, service hiccups). The system requires manual retry by the user with no automatic recovery mechanism.

**Formal Specification:**
```
FUNCTION isBugCondition3(apiCall)
  INPUT: apiCall of type OpenAIRequest
  OUTPUT: boolean
  
  RETURN apiCall.failed = true
         AND apiCall.error.isTransient = true
         AND NOT apiCall.hasRetryLogic
END FUNCTION
```

**Examples:**
- Network timeout on first attempt → User must click "Generate & Apply" again manually
- OpenAI returns 503 Service Unavailable → No automatic retry, user sees error
- Temporary rate limit (429) → System fails immediately instead of waiting and retrying

### Bug Condition 4: Complex Roblox Type Handling Failures

The bug manifests when applyChanges() encounters complex Roblox property types beyond basic Vector3 and Color3. The system fails to parse or apply CFrame, UDim2, BrickColor, and Enum values correctly.

**Formal Specification:**
```
FUNCTION isBugCondition4(property)
  INPUT: property of type PropertyAssignment
  OUTPUT: boolean
  
  RETURN property.type IN ["CFrame", "UDim2", "BrickColor", "Enum"]
         AND NOT hasTypeHandler(property.type)
         AND propertyApplicationFails(property)
END FUNCTION
```

**Examples:**
- AI returns `"CFrame": [0, 10, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]` → applyChanges() doesn't parse CFrame correctly
- AI returns `"Size": {"X": {"Scale": 0.5, "Offset": 10}, "Y": {"Scale": 0.3, "Offset": 5}}` → UDim2 not handled
- AI returns `"BrickColor": "Bright red"` → String not converted to BrickColor instance
- AI returns `"Material": "Plastic"` → String not converted to Enum.Material.Plastic

### Bug Condition 5: No Rate Limiting Protection

The bug manifests when multiple rapid API requests are made (either by user clicking repeatedly or multiple users). The system has no rate limiting, potentially exhausting API quota and incurring unexpected costs.

**Formal Specification:**
```
FUNCTION isBugCondition5(requests)
  INPUT: requests of type RequestSequence
  OUTPUT: boolean
  
  RETURN requests.count > SAFE_THRESHOLD
         AND requests.timeWindow < MINIMUM_INTERVAL
         AND NOT hasRateLimiting(system)
END FUNCTION
```

**Examples:**
- User clicks "Generate & Apply" 10 times in 5 seconds → All 10 requests hit OpenAI API
- Multiple users make simultaneous requests → No throttling, all requests processed
- Accidental rapid clicking → Each click costs API credits without protection

### Bug Condition 6: Missing Environment Validation

The bug manifests when the server starts without the OPENAI_API_KEY environment variable. The system doesn't validate at startup, instead crashing with cryptic errors on the first API call.

**Formal Specification:**
```
FUNCTION isBugCondition6(startup)
  INPUT: startup of type ServerStartup
  OUTPUT: boolean
  
  RETURN NOT process.env.OPENAI_API_KEY
         AND NOT startupValidationPerformed
         AND serverStartsSuccessfully
         AND firstAPICallCrashes
END FUNCTION
```


**Examples:**
- Server starts without OPENAI_API_KEY → Server appears healthy, first /generate request crashes
- Typo in .env file (OPENAI_KEY instead of OPENAI_API_KEY) → No warning at startup
- Empty OPENAI_API_KEY value → Server starts but fails on first use

### Bug Condition 7: Hardcoded Backend URL

The bug manifests when the plugin is deployed with a hardcoded temporary backend URL. When the URL expires or changes, the plugin breaks and requires code modification to update.

**Formal Specification:**
```
FUNCTION isBugCondition7(deployment)
  INPUT: deployment of type PluginDeployment
  OUTPUT: boolean
  
  RETURN deployment.backendURL.isHardcoded = true
         AND deployment.backendURL.isTemporary = true
         AND NOT hasConfigurationMechanism
END FUNCTION
```

**Examples:**
- Plugin deployed with `https://3000-ihysmtuuoj8qn6zaqg46p-ef7d14ea.us2.manus.computer` → URL expires after session
- Backend URL changes → Plugin code must be modified and republished
- Different environments (dev/staging/prod) → Requires separate plugin builds

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Valid Lua code generation for basic scripts must continue to work
- Basic property types (Vector3, Color3, string, number, boolean) must continue to be applied correctly
- Conversation history maintenance using conversationId must remain functional
- Selection context inclusion in AI prompts must continue to work
- Instance creation in workspace with specified properties must remain unchanged
- Conversation history trimming (MAX_HISTORY) must continue to prevent memory issues
- Conversation cleanup (TTL) must continue to prevent memory leaks
- /health endpoint must continue to respond with "Backend is running"

**Scope:**
All inputs that do NOT trigger the 7 bug conditions should be completely unaffected by this fix. This includes:
- Successful API calls with valid responses
- Basic property type applications
- Normal conversation flow
- Standard instance creation
- Existing error handling for non-transient errors

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Validation Layer**: The backend lacks a validation step between OpenAI response and plugin transmission. No Lua syntax checker is integrated.

2. **Insufficient Error Context**: Error handling uses generic catch blocks that don't preserve error details or provide user-friendly messages. The plugin's error display is limited to status text.

3. **No Resilience Pattern**: The API call is a single-shot attempt with no retry wrapper. Transient failures are treated the same as permanent failures.

4. **Incomplete Type Mapping**: The applyChanges() function only handles Vector3 and Color3 explicitly. Complex types like CFrame (12 components), UDim2 (nested structure), BrickColor (named palette), and Enums (string to enum conversion) are not implemented.

5. **No Request Throttling**: The backend has no rate limiting middleware. Each request immediately triggers an OpenAI API call regardless of frequency.

6. **Lazy Configuration Loading**: The OpenAI client is initialized at module load time without validating the API key exists. The error only surfaces when the first API call is made.

7. **Static Configuration**: The BACKEND_URL is a string literal in the Lua code with a comment to "REPLACE WITH YOUR EXPOSED URL". No runtime configuration mechanism exists.

## Correctness Properties

Property 1: Bug Condition - JSON Structure Validation

_For any_ AI-generated response, the fixed backend SHALL validate the JSON structure matches the expected schema before sending to the plugin and return a validation error with specific structural issues if invalid.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Enhanced Error Messages

_For any_ error that occurs during generation or application, the fixed system SHALL provide clear, actionable error messages that include error type, context, and suggested resolution steps.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Automatic Retry with Backoff

_For any_ OpenAI API call that fails with a transient error (network timeout, 429 rate limit, 503 service unavailable), the fixed backend SHALL automatically retry up to 3 times with exponential backoff delays (1s, 2s, 4s).

**Validates: Requirements 2.3**


Property 4: Bug Condition - Complex Roblox Type Support

_For any_ property assignment involving complex Roblox types (CFrame, UDim2, BrickColor, Enum), the fixed applyChanges() function SHALL correctly parse and apply these types to instance properties.

**Validates: Requirements 2.4**

Property 5: Bug Condition - Rate Limiting Protection

_For any_ sequence of API requests, the fixed backend SHALL enforce rate limiting (max 10 requests per minute per conversationId) and return a clear rate limit error when exceeded.

**Validates: Requirements 2.5**

Property 6: Bug Condition - Startup Environment Validation

_For any_ server startup, the fixed backend SHALL validate that OPENAI_API_KEY exists and is non-empty before accepting requests, failing fast with a clear error message if missing.

**Validates: Requirements 2.6**

Property 7: Bug Condition - Configurable Backend URL

_For any_ plugin deployment, the fixed plugin SHALL use a configuration mechanism (plugin settings or external config) for the backend URL that can be updated without code changes.

**Validates: Requirements 2.7**

Property 8: Preservation - Existing Functionality

_For any_ input that does NOT trigger the 7 bug conditions, the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing script generation, instance creation, conversation history, and selection context functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Architecture Changes

The fix introduces these architectural components:

1. **JSON Structure Validator** (server.js): Validates AI response structure (NOT Lua syntax)
2. **Retry Wrapper** (server.js): Exponential backoff utility for API calls
3. **Type Parser** (plugin.lua): Extended type handling in applyChanges()
4. **Rate Limiter** (server.js): IP-based request throttling middleware
5. **Startup Validator** (server.js): Environment validation on server start
6. **Configuration System** (plugin.lua): Plugin settings for backend URL

### Implementation Priority Order

1. **Bug 7** (Configurable URL) - Unblocks testing with real backend
2. **Bug 6** (Env validation) - Zero cost, high value, prevents cryptic errors
3. **Bug 3** (Retry logic) - Improves UX for transient failures
4. **Bug 5** (Rate limiting) - Protects API quota (with IP as primary key)
5. **Bug 2** (Error messages) - Already partly done, complete remaining cases
6. **Bug 4** (Complex types) - Requires careful testing of type handlers
7. **Bug 1** (Validation) - JSON structure only, defer Lua syntax to Roblox Studio

### Changes Required

#### File: `server.js`

**Change 1: Add JSON Structure Validation**

Add JSON structure validation (NOT Lua syntax validation - defer that to Roblox Studio):

**Rationale**: luaparse only supports Lua 5.1 and will reject valid Luau code including:
- `continue` keyword
- Type annotations (`local x: number`)
- `//` comments
- Generics (`Array<string>`)
- String interpolation

Validating Lua syntax server-side is actively harmful as it creates false negatives. Roblox Studio is the authoritative validator for Luau syntax.

```javascript
function validateResponseStructure(response) {
  const errors = [];
  const ALLOWED_PARENTS = [
    'Workspace',
    'ServerScriptService',
    'StarterPlayerScripts',
    'ReplicatedStorage',
    'StarterGui'
  ];
  
  // Validate scripts structure
  if (response.scripts) {
    if (!Array.isArray(response.scripts)) {
      errors.push('scripts must be an array');
    } else {
      response.scripts.forEach((script, i) => {
        if (!script.name || typeof script.name !== 'string') {
          errors.push(`scripts[${i}].name must be a string`);
        }
        if (!script.type || !['Script', 'LocalScript', 'ModuleScript'].includes(script.type)) {
          errors.push(`scripts[${i}].type must be Script, LocalScript, or ModuleScript`);
        }
        if (!script.source || typeof script.source !== 'string') {
          errors.push(`scripts[${i}].source must be a string`);
        }
        if (!script.parent || typeof script.parent !== 'string') {
          errors.push(`scripts[${i}].parent must be a string`);
        } else if (!ALLOWED_PARENTS.includes(script.parent)) {
          errors.push(`scripts[${i}].parent must be one of: ${ALLOWED_PARENTS.join(', ')}`);
        }
      });
    }
  }
  
  // Validate instances structure
  if (response.instances) {
    if (!Array.isArray(response.instances)) {
      errors.push('instances must be an array');
    } else {
      response.instances.forEach((inst, i) => {
        if (!inst.className || typeof inst.className !== 'string') {
          errors.push(`instances[${i}].className must be a string`);
        }
        if (!inst.properties || typeof inst.properties !== 'object') {
          errors.push(`instances[${i}].properties must be an object`);
        }
      });
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
```

Integrate validation in the /generate endpoint after receiving AI response:

```javascript
// Validate JSON structure before sending to plugin
const validation = validateResponseStructure(aiResponse);
if (!validation.valid) {
  return res.status(400).json({
    error: 'Invalid Response Structure',
    details: {
      message: 'AI response does not match expected format',
      errors: validation.errors
    },
    suggestion: 'This is a backend issue. Please report to developers.'
  });
}
```


**Change 2: Enhanced Error Handling**

Replace generic error messages with structured error responses:

```javascript
// In /generate endpoint catch block
catch (error) {
  console.error('Error calling OpenAI:', error);
  
  let errorResponse = {
    error: 'AI Generation Failed',
    details: {},
    suggestion: ''
  };
  
  if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    errorResponse.details.type = 'Network Error';
    errorResponse.details.message = 'Could not reach OpenAI API';
    errorResponse.suggestion = 'Check your internet connection and try again';
  } else if (error.status === 429) {
    errorResponse.details.type = 'Rate Limit';
    errorResponse.details.message = 'OpenAI API rate limit exceeded';
    errorResponse.suggestion = 'Wait a moment and try again';
  } else if (error.status === 401) {
    errorResponse.details.type = 'Authentication Error';
    errorResponse.details.message = 'Invalid OpenAI API key';
    errorResponse.suggestion = 'Check OPENAI_API_KEY environment variable';
  } else {
    errorResponse.details.type = 'Unknown Error';
    errorResponse.details.message = error.message || 'Unknown error occurred';
    errorResponse.suggestion = 'Check server logs for details';
  }
  
  res.status(500).json(errorResponse);
}
```

**Change 3: Retry Logic with Exponential Backoff**

Add retry wrapper utility:

```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isTransient = 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' ||
        error.status === 429 ||
        error.status === 503;
      
      if (!isTransient || isLastAttempt) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

Wrap OpenAI API call:

```javascript
const completion = await retryWithBackoff(async () => {
  return await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversation.messages
    ],
    response_format: { type: "json_object" }
  });
});
```

**Change 4: Rate Limiting**

Add rate limiter using express-rate-limit with IP address as primary key:

**Rationale**: conversationId is client-generated and can be spoofed. A malicious or buggy client can generate a new GUID per request to bypass limits. IP address provides actual protection.

```javascript
const rateLimit = require('express-rate-limit');

// Create rate limiter per IP address (primary) and conversationId (secondary)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyGenerator: (req) => {
    // Use IP as primary key for actual protection
    // conversationId as secondary for user feedback
    return req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate Limit Exceeded',
      details: {
        type: 'Rate Limit',
        message: 'Too many requests from your IP address',
        limit: '10 requests per minute'
      },
      suggestion: 'Please wait a moment before trying again'
    });
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

// Apply to /generate endpoint
app.post('/generate', apiLimiter, async (req, res) => {
  // ... existing code
});
```

**Change 5: Startup Environment Validation**

Add validation before server starts:

```javascript
// Validate environment at startup
function validateEnvironment() {
  const required = ['OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these in your .env file or environment');
    process.exit(1);
  }
  
  if (process.env.OPENAI_API_KEY.trim() === '') {
    console.error('❌ OPENAI_API_KEY is empty');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
}

// Call before initializing OpenAI client
validateEnvironment();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```


**Change 6: Update SYSTEM_PROMPT for Type Guidance**

Enhance the system prompt to guide AI on proper type formatting:

```javascript
const SYSTEM_PROMPT = `You are an expert Roblox Luau developer assistant.
Your goal is to help users generate high-quality, efficient, and safe Roblox scripts.
When given a prompt, you should return a JSON object with the following structure:
{
    "explanation": "A brief explanation of what the script does.",
    "scripts": [
        {
            "name": "ScriptName",
            "type": "Script" | "LocalScript" | "ModuleScript",
            "parent": "Workspace" | "StarterPlayerScripts" | "ServerScriptService" | "ReplicatedStorage",
            "source": "The Luau code here"
        }
    ],
    "instances": [
        {
            "className": "Part",
            "properties": {
                "Name": "ExamplePart",
                "Size": [4, 1, 4],
                "Position": [0, 10, 0],
                "Color": [255, 0, 0],
                "CFrame": {"position": [0, 10, 0], "rotation": [0, 0, 0]},
                "Material": "Plastic",
                "BrickColor": "Bright red"
            }
        }
    ]
}

IMPORTANT TYPE FORMATTING:
- Vector3: Use array [x, y, z]
- Color3: Use RGB array [r, g, b] (0-255)
- CFrame: Use {"position": [x, y, z], "rotation": [rx, ry, rz]} (rotation in degrees)
- UDim2: Use {"X": {"Scale": s, "Offset": o}, "Y": {"Scale": s, "Offset": o}}
- BrickColor: Use string name like "Bright red"
- Enums: Use string name like "Plastic" for Material

Only return valid JSON. Do not include any markdown formatting like \`\`\`json.
Ensure all className values are valid Roblox instance types.
Ensure all parent values are valid Roblox service names or "Workspace".
For scripts, ensure the source contains valid, syntactically correct Luau code.`;
```

#### File: `roblox-ai-plugin (2).lua`

**Change 7: Extended Type Handling in applyChanges()**

Replace the applyChanges() function with extended type support:

**Critical Fixes:**
1. UDim2 detection by value shape: `type(value) == "table" and value.X and value.Y` instead of checking property name
2. CFrame multiple format support: handles object format, 12-element array, and 3-element array
3. Generic enum detection: Use `Enum[prop]` pattern instead of hardcoded list
4. Remove `continue` keyword: Use if/else pattern for Lua 5.1 compatibility

```lua
local function applyChanges(data)
	if data.instances then
		for _, instData in ipairs(data.instances) do
			local ok, newInst = pcall(function() return Instance.new(instData.className) end)
			if not ok then 
				warn("Invalid ClassName: " .. tostring(instData.className))
			else
				for prop, value in pairs(instData.properties) do
					pcall(function()
						if prop == "Size" or prop == "Position" then
							newInst[prop] = Vector3.new(table.unpack(value))
						elseif prop == "Color" then
							newInst[prop] = Color3.fromRGB(table.unpack(value))
						elseif type(value) == "table" and value.X and value.Y then
							-- Handle UDim2: detect by value shape, not property name
							-- Works for Size, Position, AnchorPoint, ImageRectOffset, etc.
							newInst[prop] = UDim2.new(
								value.X.Scale or 0, value.X.Offset or 0,
								value.Y.Scale or 0, value.Y.Offset or 0
							)
						elseif prop == "CFrame" then
							-- Handle CFrame: multiple formats
							if type(value) == "table" then
								if value.position then
									-- Object format: {position: [x,y,z], rotation: [rx,ry,rz]}
									local pos = Vector3.new(table.unpack(value.position))
									local rot = value.rotation or {0, 0, 0}
									newInst[prop] = CFrame.new(pos) 
										* CFrame.Angles(math.rad(rot[1]), math.rad(rot[2]), math.rad(rot[3]))
								elseif #value == 12 then
									-- Raw matrix format: [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22]
									newInst[prop] = CFrame.new(table.unpack(value))
								elseif #value == 3 then
									-- Position only: [x, y, z]
									newInst[prop] = CFrame.new(table.unpack(value))
								end
							end
						elseif prop == "BrickColor" then
							-- Handle BrickColor: string name
							if type(value) == "string" then
								newInst[prop] = BrickColor.new(value)
							end
						elseif type(value) == "string" and Enum[prop] then
							-- Generic enum handler: works for Material, Shape, FormFactor, 
							-- SurfaceType, TopSurface, BottomSurface, Style, Font, etc.
							local enumType = Enum[prop]
							if enumType[value] then
								newInst[prop] = enumType[value]
							end
						else
							newInst[prop] = value
						end
					end)
				end
				newInst.Parent = game.Workspace
			end
		end
	end

	if data.scripts then
		for _, scriptData in ipairs(data.scripts) do
			local ok, newScript = pcall(function() return Instance.new(scriptData.type) end)
			if not ok then 
				warn("Invalid Script Type: " .. tostring(scriptData.type))
			else
				newScript.Name = scriptData.name
				newScript.Source = scriptData.source
				
				local parent
				local okSvc, svc = pcall(function() return game:GetService(scriptData.parent) end)
				parent = okSvc and svc or game.Workspace
				newScript.Parent = parent
			end
		end
	end
end
```


**Change 8: Enhanced Error Display in Plugin**

Update error handling to display detailed error information:

```lua
-- Replace the error handling section in generateButton.MouseButton1Click
if success then
	local okJson, data = pcall(function() return HttpService:JSONDecode(result) end)
	if okJson then
		-- Check if response is an error object
		if data.error then
			statusLabel.Text = "Error: " .. data.error
			if data.details and data.details.message then
				explanationLabel.Text = "Details: " .. data.details.message
				if data.suggestion then
					explanationLabel.Text = explanationLabel.Text .. "\n\nSuggestion: " .. data.suggestion
				end
			end
		else
			applyChanges(data)
			statusLabel.Text = "Applied Successfully!"
			explanationLabel.Text = "AI Explanation: " .. (data.explanation or "No explanation provided.")
			promptBox.Text = ""
		end
	else
		statusLabel.Text = "Error: Invalid JSON from server"
		explanationLabel.Text = "The server returned malformed data. Please try again."
	end
else
	-- Enhanced error display for HTTP failures
	local errorMsg = tostring(result)
	statusLabel.Text = "Error: Request Failed"
	
	if errorMsg:match("429") then
		explanationLabel.Text = "Rate limit exceeded. Please wait a moment and try again."
	elseif errorMsg:match("timeout") or errorMsg:match("ETIMEDOUT") then
		explanationLabel.Text = "Request timed out. Check your connection and try again."
	elseif errorMsg:match("ECONNREFUSED") then
		explanationLabel.Text = "Cannot connect to backend. Verify the backend URL is correct."
	else
		explanationLabel.Text = "Error: " .. errorMsg
	end
	
	warn("AI Plugin Error: " .. errorMsg)
end
```

**Change 9: Configuration System for Backend URL**

Add plugin settings for configurable backend URL:

```lua
-- At the top of the file, replace hardcoded URL with plugin setting
local BACKEND_URL_SETTING = "BackendURL"
local DEFAULT_BACKEND_URL = "http://localhost:3000"

-- Get or set backend URL from plugin settings
local function getBackendURL()
	local url = plugin:GetSetting(BACKEND_URL_SETTING)
	if not url or url == "" then
		url = DEFAULT_BACKEND_URL
		plugin:SetSetting(BACKEND_URL_SETTING, url)
	end
	return url
end

local BACKEND_URL = getBackendURL()

-- Add UI for changing backend URL
local urlLabel = Instance.new("TextLabel")
urlLabel.Text = "Backend URL:"
urlLabel.TextColor3 = Color3.new(1, 1, 1)
urlLabel.BackgroundTransparency = 1
urlLabel.Size = UDim2.new(1, 0, 0, 20)
urlLabel.TextXAlignment = Enum.TextXAlignment.Left
urlLabel.Font = Enum.Font.SourceSans
urlLabel.TextSize = 14
urlLabel.Parent = mainFrame

local urlBox = Instance.new("TextBox")
urlBox.Size = UDim2.new(1, 0, 0, 30)
urlBox.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
urlBox.TextColor3 = Color3.new(1, 1, 1)
urlBox.Text = BACKEND_URL
urlBox.TextWrapped = false
urlBox.ClearTextOnFocus = false
urlBox.Parent = mainFrame

local saveUrlButton = Instance.new("TextButton")
saveUrlButton.Size = UDim2.new(1, 0, 0, 30)
saveUrlButton.BackgroundColor3 = Color3.fromRGB(0, 120, 215)
saveUrlButton.Text = "Save Backend URL"
saveUrlButton.TextColor3 = Color3.new(1, 1, 1)
saveUrlButton.Font = Enum.Font.SourceSans
saveUrlButton.TextSize = 14
saveUrlButton.Parent = mainFrame

saveUrlButton.MouseButton1Click:Connect(function()
	local newUrl = urlBox.Text
	if newUrl and newUrl ~= "" then
		plugin:SetSetting(BACKEND_URL_SETTING, newUrl)
		BACKEND_URL = newUrl
		statusLabel.Text = "Backend URL updated!"
	end
end)
```

### Dependencies to Add

**server.js:**
- `express-rate-limit`: For rate limiting middleware

Install with:
```bash
npm install express-rate-limit
```

Note: luaparse is NOT needed - we validate JSON structure only, not Lua syntax.

### Configuration Changes

**Environment Variables (.env):**
```
OPENAI_API_KEY=your_api_key_here
PORT=3000
```

**Plugin Settings (Roblox Studio):**
- BackendURL: Configurable via plugin UI, defaults to `http://localhost:3000`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the 7 bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that trigger each bug condition on the UNFIXED code to observe failures and understand root causes.


**Test Cases:**

1. **JSON Structure Validation Test**: Mock OpenAI to return malformed JSON structure (missing required fields) and verify it reaches the plugin without validation (will fail on unfixed code)

2. **Generic Error Message Test**: Trigger network timeout and verify error message is generic "Failed to generate response from AI" (will fail on unfixed code)

3. **No Retry Test**: Mock OpenAI to fail with 503 on first call but succeed on second, verify system doesn't retry automatically (will fail on unfixed code)

4. **Complex Type Test - CFrame**: Send CFrame property in object format and verify applyChanges() fails to apply it correctly (will fail on unfixed code)

5. **Complex Type Test - CFrame Array**: Send CFrame property as 12-element array and verify applyChanges() fails to handle it (will fail on unfixed code)

6. **Complex Type Test - UDim2**: Send UDim2 value on a GUI Size property and verify it's not detected by value shape (will fail on unfixed code)

7. **Enum Handler Test**: Send property with non-hardcoded enum (e.g., SurfaceType) and verify it fails to apply (will fail on unfixed code)

7. **Enum Handler Test**: Send property with non-hardcoded enum (e.g., SurfaceType) and verify it fails to apply (will fail on unfixed code)

8. **Rate Limit Bypass Test**: Generate new conversationId per request and verify all requests are processed without throttling (will fail on unfixed code)

9. **Missing API Key Test**: Start server without OPENAI_API_KEY and verify it starts successfully but crashes on first request (will fail on unfixed code)

10. **Hardcoded URL Test**: Verify BACKEND_URL is a string literal in plugin code with no configuration mechanism (will fail on unfixed code)

**Expected Counterexamples:**
- Malformed JSON structure passes through validation and causes plugin errors
- Errors display as generic messages without actionable details
- Transient API failures require manual retry
- CFrame in object format fails to apply
- CFrame as 12-element array fails to apply
- UDim2 values not detected by structure on GUI properties
- Non-hardcoded enums fail to apply
- Rapid requests with new GUIDs bypass rate limiting
- Server starts without API key but crashes on first use
- Backend URL requires code changes to update

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed system produces the expected behavior.

**Note**: Actual test implementation will be defined in the tasks phase. Tests will verify:
- JSON structure validation catches malformed responses
- Enhanced error messages provide actionable details
- Retry logic handles transient failures automatically
- Complex Roblox types are applied correctly
- Rate limiting enforces IP-based limits
- Environment validation fails fast on startup
- Backend URL configuration persists correctly

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed system produces the same result as the original system.

**Note**: Actual test implementation will be defined in the tasks phase. Tests will verify:
- Valid script generation continues to work
- Basic property types continue to be applied correctly
- Conversation history maintenance continues to function
- Selection context inclusion continues to work
- Instance creation continues to work
- History trimming continues to prevent memory issues
- Conversation cleanup continues to prevent memory leaks
- /health endpoint continues to respond correctly

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal operations, then write property-based tests capturing that behavior.

**Test Cases:**

1. **Valid Script Generation Preservation**: Observe that valid Lua code is successfully created and applied on unfixed code, then verify this continues after fix

2. **Basic Property Types Preservation**: Observe that Vector3, Color3, string, number, boolean properties are correctly applied on unfixed code, then verify this continues after fix

3. **Conversation History Preservation**: Observe that conversationId maintains context across requests on unfixed code, then verify this continues after fix

4. **Selection Context Preservation**: Observe that selected objects are included in prompts on unfixed code, then verify this continues after fix

5. **Instance Creation Preservation**: Observe that instances are created in workspace on unfixed code, then verify this continues after fix

6. **History Trimming Preservation**: Observe that conversation history is trimmed at MAX_HISTORY on unfixed code, then verify this continues after fix

7. **Conversation Cleanup Preservation**: Observe that old conversations are cleaned up after TTL on unfixed code, then verify this continues after fix

8. **Health Endpoint Preservation**: Observe that /health returns "Backend is running" on unfixed code, then verify this continues after fix


### Unit Tests

**Backend (server.js):**
- Test validateResponseStructure() with valid and invalid JSON structures
- Test retryWithBackoff() with transient and permanent errors
- Test rate limiter with rapid requests from same IP
- Test rate limiter with requests from different IPs
- Test environment validation with missing/empty API key
- Test enhanced error handling for different error types
- Test conversation history trimming and cleanup
- Test /health endpoint

**Plugin (roblox-ai-plugin.lua):**
- Test applyChanges() with CFrame properties in object format
- Test applyChanges() with CFrame properties as 12-element array
- Test applyChanges() with CFrame properties as 3-element array
- Test applyChanges() with UDim2 properties (verify value shape detection)
- Test applyChanges() with BrickColor properties
- Test applyChanges() with various Enum properties (Material, SurfaceType, Font, etc.)
- Test getBackendURL() with and without saved settings
- Test error display with structured error responses
- Test basic property types (Vector3, Color3) continue to work
- Test that code works without `continue` keyword

### Property-Based Tests

**Backend:**
- Generate random JSON structures and verify validation correctly identifies valid/invalid structures
- Generate random error scenarios and verify all produce actionable error messages
- Generate random API failure patterns and verify retry logic handles them correctly
- Generate random request patterns from different IPs and verify rate limiting enforces limits
- Generate random conversation histories and verify trimming/cleanup works correctly

**Plugin:**
- Generate random property assignments with complex types and verify correct application
- Generate random backend URLs and verify configuration system handles them
- Generate random error responses and verify display formatting is correct
- Generate random valid responses and verify existing functionality is preserved
- Generate random enum properties and verify generic enum handler works

### Integration Tests

**End-to-End Flow:**
- Test full flow: user prompt → API call → validation → response → application
- Test error flow: user prompt → API failure → retry → error display
- Test rate limit flow: rapid requests → rate limit → error feedback
- Test configuration flow: change backend URL → save → use new URL
- Test complex type flow: request with CFrame/UDim2/BrickColor → validation → application
- Test startup flow: missing API key → validation → fail fast with clear message

**Cross-Component:**
- Test that backend validation errors are correctly displayed in plugin UI
- Test that retry logic works transparently from plugin perspective
- Test that rate limiting provides clear feedback to plugin users
- Test that configuration changes persist across plugin sessions

### Manual Testing Checklist

1. Start server without OPENAI_API_KEY → Should fail fast with clear error
2. Start server with valid API key → Should start successfully
3. Generate script with valid prompt → Should create and apply successfully
4. Generate malformed JSON response → Should show structure validation error with details
5. Disconnect network and generate → Should retry automatically and show clear error
6. Make 15 rapid requests from same IP → Should rate limit after 10 with clear message
7. Make requests from different IPs → Each IP should have independent rate limit
8. Change backend URL in plugin UI → Should save and use new URL
9. Generate instance with CFrame property in object format → Should apply correctly
10. Generate instance with CFrame property as 12-element array → Should apply correctly
11. Generate instance with CFrame property as 3-element position array → Should apply correctly
12. Generate instance with UDim2 property on GUI element → Should apply correctly (detected by value shape)
13. Generate instance with BrickColor property → Should apply correctly
14. Generate instance with various Enum properties (Material, SurfaceType, Font) → Should apply correctly
15. Verify conversation history maintains context across multiple requests
16. Verify selection context is included in prompts
17. Verify /health endpoint returns "Backend is running"
18. Test Luau-specific syntax (continue, type annotations, //) → Should work in Roblox Studio

## Implementation Notes

### JSON Structure Validation (Not Lua Syntax)

**Critical Decision**: We validate JSON structure only, NOT Lua syntax.

**Rationale**: 
- luaparse only supports Lua 5.1, not Luau (Roblox's dialect)
- Luau features that luaparse rejects as invalid:
  - `continue` keyword
  - Type annotations (`local x: number = 5`)
  - `//` single-line comments
  - Generics (`Array<string>`)
  - String interpolation (`` `Hello {name}` ``)
  - Compound assignment operators (`+=`, `-=`)
- Server-side Lua validation creates false negatives
- Roblox Studio is the authoritative validator for Luau syntax
- Users get immediate, accurate feedback from Studio's built-in parser

**What We Validate**:
- JSON structure matches expected schema
- Required fields are present (name, type, source, parent, className, properties)
- Field types are correct (arrays, objects, strings)
- Enum values are from valid sets (Script types)

**What We Don't Validate**:
- Lua/Luau syntax correctness (deferred to Roblox Studio)
- Roblox API correctness (className validity, property names)
- Semantic correctness (logic errors, runtime issues)

### Retry Logic Considerations

The exponential backoff implementation should:
- Only retry on transient errors (network, 429, 503)
- Not retry on permanent errors (401, 400)
- Log retry attempts for debugging
- Consider adding jitter to prevent thundering herd

### Rate Limiting Considerations

**Critical Decision**: Use IP address as primary rate limit key, not conversationId.

**Rationale**:
- conversationId is client-generated (HttpService:GenerateGUID())
- Malicious or buggy client can generate new GUID per request
- This completely bypasses conversationId-based rate limiting
- IP address provides actual protection against abuse

**Implementation**:
- Primary key: `req.ip` (actual protection)
- Secondary context: conversationId (for user feedback/logging)
- Rate limit: 10 requests per minute per IP
- Headers: Include rate limit info in response headers

**Considerations**:
- Multiple users behind same NAT/proxy share IP limit
- For production, consider authenticated rate limiting
- Consider making limits configurable via environment variables
- Consider adding global rate limit for total API usage

### Type Handling Considerations

**Critical Fixes Applied**:

1. **UDim2 Detection by Value Shape**:
   - Old: `prop == "Size2D"` - not a real Roblox property
   - Old: Operator precedence bug with `(prop == "Size" and instData.className:match("Gui")) or prop == "Size2D"`
   - New: `type(value) == "table" and value.X and value.Y` - detects by structure
   - Works automatically for Size, Position, AnchorPoint, ImageRectOffset, etc.
   - Handles any property that receives UDim2 values without hardcoding property names

2. **CFrame Multiple Format Support**:
   - Old: Only handled object format `{position: [x,y,z], rotation: [rx,ry,rz]}`
   - New: Supports 3 formats:
     - Object format: `{position: [x,y,z], rotation: [rx,ry,rz]}`
     - Raw matrix format: `[x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22]` (12 elements)
     - Position only: `[x, y, z]` (3 elements)
   - Handles all AI-generated CFrame representations

3. **Generic Enum Detection**:
   - Old: Hardcoded list (Material, Shape, FormFactor)
   - Missing: SurfaceType, TopSurface, BottomSurface, Style, Font, etc.
   - New: `if type(value) == "string" and Enum[prop] then`
   - Works for any Roblox enum property automatically

4. **Lua 5.1 Compatibility**:
   - Removed `continue` keyword (Luau-only)
   - Use if/else pattern instead
   - Ensures compatibility with older Lua versions

**Additional Types to Consider**:
- NumberSequence and ColorSequence
- PhysicalProperties
- Custom data types
- Nested tables with mixed types

### Configuration System Considerations

The plugin settings approach:
- Persists across Roblox Studio sessions
- Is user-specific (not shared across team)
- For team deployments, consider using a shared configuration service
- For production, consider validating URL format before saving

### Security Considerations

- Validate backend URL format to prevent injection attacks
- Sanitize error messages to avoid leaking sensitive information
- Consider adding authentication between plugin and backend
- Rate limiting protects against accidental quota exhaustion but not malicious abuse

### Performance Considerations

- JSON structure validation adds minimal latency (~1-5ms per response)
- Retry logic can add up to 7 seconds delay (1+2+4) for failed requests
- Rate limiting adds minimal overhead (<1ms)
- IP-based rate limiting is faster than conversationId lookup
- Consider caching validation schemas for better performance

### Deployment Considerations

- Backend requires `express-rate-limit` npm package (NOT luaparse)
- Environment variables must be set before server start
- Plugin settings UI should be tested in Roblox Studio before publishing
- Consider adding version checking between plugin and backend
- Document backend URL format for users (http://host:port)
- IP-based rate limiting works correctly behind reverse proxies with proper X-Forwarded-For headers
