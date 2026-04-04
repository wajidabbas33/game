# Implementation Plan

## Phase 1: Exploration Tests (Run on UNFIXED Code)

- [ ] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Infrastructure Bugs Exploration
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each of the 7 bugs exists
  
  - [ ] 1.1 Test Bug 7: Hardcoded Backend URL
    - Verify BACKEND_URL is a string literal in plugin code with no configuration mechanism
    - Expected: Test FAILS (confirms hardcoded URL exists)
    - _Requirements: 1.7, 2.7_
  
  - [ ] 1.2 Test Bug 6: Missing Environment Validation
    - Start server without OPENAI_API_KEY environment variable
    - Verify server starts successfully but crashes on first API request
    - Expected: Test FAILS (confirms no startup validation)
    - _Requirements: 1.6, 2.6_
  
  - [ ] 1.3 Test Bug 3: No Automatic Retry Logic
    - Mock OpenAI to fail with 503 on first call but succeed on second
    - Verify system doesn't retry automatically
    - Expected: Test FAILS (confirms no retry logic)
    - _Requirements: 1.3, 2.3_
  
  - [ ] 1.4 Test Bug 5: Rate Limit Bypass with New GUIDs
    - Generate new conversationId per request (15 rapid requests)
    - Verify all requests are processed without throttling
    - Expected: Test FAILS (confirms conversationId-based limiting can be bypassed)
    - _Requirements: 1.5, 2.5_
  
  - [ ] 1.5 Test Bug 2: Generic Error Messages
    - Trigger network timeout error
    - Verify error message is generic "Failed to generate response from AI"
    - Expected: Test FAILS (confirms generic error messages)
    - _Requirements: 1.2, 2.2_
  
  - [ ] 1.6 Test Bug 4: Complex Type Handling - CFrame Object Format
    - Send CFrame property in object format {position: [x,y,z], rotation: [rx,ry,rz]}
    - Verify applyChanges() fails to apply it correctly
    - Expected: Test FAILS (confirms CFrame object format not handled)
    - _Requirements: 1.4, 2.4_
  
  - [ ] 1.7 Test Bug 4: Complex Type Handling - CFrame Array Format
    - Send CFrame property as 12-element array
    - Verify applyChanges() fails to handle it
    - Expected: Test FAILS (confirms CFrame array format not handled)
    - _Requirements: 1.4, 2.4_
  
  - [ ] 1.8 Test Bug 4: Complex Type Handling - UDim2 Value Shape Detection
    - Send UDim2 value on GUI Size property
    - Verify it's not detected by value shape (old code checks property name)
    - Expected: Test FAILS (confirms UDim2 detection by property name, not value shape)
    - _Requirements: 1.4, 2.4_
  
  - [ ] 1.9 Test Bug 4: Complex Type Handling - Generic Enum Handler
    - Send property with non-hardcoded enum (e.g., SurfaceType, Font)
    - Verify it fails to apply (old code only handles Material, Shape, FormFactor)
    - Expected: Test FAILS (confirms generic enum handler missing)
    - _Requirements: 1.4, 2.4_
  
  - [ ] 1.10 Test Bug 1: Missing JSON Structure Validation
    - Mock OpenAI to return malformed JSON structure (missing required fields)
    - Verify it reaches the plugin without validation
    - Expected: Test FAILS (confirms no JSON structure validation)
    - _Requirements: 1.1, 2.1_

## Phase 2: Preservation Tests (Run on UNFIXED Code)

- [ ] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Existing Functionality Preservation
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  
  - [ ] 2.1 Observe and test: Valid script generation continues to work
    - Observe: Valid Lua code is successfully created and applied on unfixed code
    - Write property: For all valid script requests, scripts are created and applied
    - Verify test passes on UNFIXED code
    - _Requirements: 3.1_
  
  - [ ] 2.2 Observe and test: Basic property types continue to work
    - Observe: Vector3, Color3, string, number, boolean properties are correctly applied
    - Write property: For all basic property assignments, values are applied correctly
    - Verify test passes on UNFIXED code
    - _Requirements: 3.2_
  
  - [ ] 2.3 Observe and test: Conversation history maintenance continues
    - Observe: conversationId maintains context across requests on unfixed code
    - Write property: For all multi-turn conversations, context is preserved
    - Verify test passes on UNFIXED code
    - _Requirements: 3.3_
  
  - [ ] 2.4 Observe and test: Selection context inclusion continues
    - Observe: Selected objects are included in prompts on unfixed code
    - Write property: For all requests with selection, context is included
    - Verify test passes on UNFIXED code
    - _Requirements: 3.4_
  
  - [ ] 2.5 Observe and test: Instance creation continues to work
    - Observe: Instances are created in workspace on unfixed code
    - Write property: For all instance creation requests, instances appear in workspace
    - Verify test passes on UNFIXED code
    - _Requirements: 3.5_
  
  - [ ] 2.6 Observe and test: History trimming continues to work
    - Observe: Conversation history is trimmed at MAX_HISTORY on unfixed code
    - Write property: For all conversations exceeding MAX_HISTORY, old messages are trimmed
    - Verify test passes on UNFIXED code
    - _Requirements: 3.6_
  
  - [ ] 2.7 Observe and test: Conversation cleanup continues to work
    - Observe: Old conversations are cleaned up after TTL on unfixed code
    - Write property: For all conversations exceeding TTL, they are removed
    - Verify test passes on UNFIXED code
    - _Requirements: 3.7_
  
  - [ ] 2.8 Observe and test: Health endpoint continues to work
    - Observe: /health returns "Backend is running" on unfixed code
    - Write property: For all /health requests, response is "Backend is running"
    - Verify test passes on UNFIXED code
    - _Requirements: 3.8_

## Phase 3: Implementation (Priority Order from Design)

- [ ] 3. Fix Bug 7: Configurable Backend URL

  - [ ] 3.1 Implement plugin settings for backend URL
    - Add BACKEND_URL_SETTING constant and getBackendURL() function
    - Replace hardcoded URL with plugin:GetSetting() call
    - Default to "http://localhost:3000" if not set
    - _Bug_Condition: deployment.backendURL.isHardcoded = true AND NOT hasConfigurationMechanism_
    - _Expected_Behavior: Plugin uses configuration mechanism for backend URL_
    - _Preservation: Existing functionality with default URL unchanged_
    - _Requirements: 1.7, 2.7_
  
  - [ ] 3.2 Add UI for changing backend URL
    - Create urlLabel, urlBox, and saveUrlButton UI elements
    - Implement saveUrlButton click handler to persist URL
    - Update BACKEND_URL variable when saved
    - _Bug_Condition: Backend URL requires code changes to update_
    - _Expected_Behavior: URL can be updated via UI without code changes_
    - _Preservation: Existing UI layout and functionality unchanged_
    - _Requirements: 2.7_
  
  - [ ] 3.3 Verify Bug 7 exploration test now passes
    - **Property 1: Expected Behavior** - Configurable Backend URL
    - **IMPORTANT**: Re-run the SAME test from task 1.1 - do NOT write a new test
    - Run test from step 1.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms configuration mechanism exists)
    - _Requirements: 2.7_

- [ ] 4. Fix Bug 6: Environment Validation

  - [ ] 4.1 Implement startup environment validation
    - Add validateEnvironment() function before OpenAI client initialization
    - Check OPENAI_API_KEY exists and is non-empty
    - Exit with clear error message if validation fails
    - Log success message if validation passes
    - _Bug_Condition: NOT process.env.OPENAI_API_KEY AND NOT startupValidationPerformed_
    - _Expected_Behavior: Server validates OPENAI_API_KEY at startup and fails fast with clear error_
    - _Preservation: Server starts normally when API key is present_
    - _Requirements: 1.6, 2.6_
  
  - [ ] 4.2 Verify Bug 6 exploration test now passes
    - **Property 1: Expected Behavior** - Startup Environment Validation
    - **IMPORTANT**: Re-run the SAME test from task 1.2 - do NOT write a new test
    - Run test from step 1.2
    - **EXPECTED OUTCOME**: Test PASSES (confirms startup validation exists)
    - _Requirements: 2.6_

- [ ] 5. Fix Bug 3: Automatic Retry Logic

  - [ ] 5.1 Implement retry wrapper with exponential backoff
    - Add retryWithBackoff() utility function
    - Support maxRetries (default 3) and baseDelay (default 1000ms)
    - Only retry on transient errors (ETIMEDOUT, ECONNRESET, 429, 503)
    - Calculate delay as baseDelay * 2^attempt
    - Log retry attempts for debugging
    - _Bug_Condition: apiCall.failed = true AND apiCall.error.isTransient = true AND NOT apiCall.hasRetryLogic_
    - _Expected_Behavior: System automatically retries with exponential backoff (1s, 2s, 4s)_
    - _Preservation: Non-transient errors fail immediately without retry_
    - _Requirements: 1.3, 2.3_
  
  - [ ] 5.2 Wrap OpenAI API call with retry logic
    - Wrap openai.chat.completions.create() call with retryWithBackoff()
    - Maintain existing parameters (model, messages, response_format)
    - _Bug_Condition: Transient API failures require manual retry_
    - _Expected_Behavior: Transient failures retry automatically_
    - _Preservation: Successful API calls work identically_
    - _Requirements: 2.3_
  
  - [ ] 5.3 Verify Bug 3 exploration test now passes
    - **Property 1: Expected Behavior** - Automatic Retry with Backoff
    - **IMPORTANT**: Re-run the SAME test from task 1.3 - do NOT write a new test
    - Run test from step 1.3
    - **EXPECTED OUTCOME**: Test PASSES (confirms retry logic exists)
    - _Requirements: 2.3_

- [ ] 6. Fix Bug 5: Rate Limiting with IP-Based Protection

  - [ ] 6.1 Install express-rate-limit dependency
    - Run: npm install express-rate-limit
    - _Requirements: 2.5_
  
  - [ ] 6.2 Implement IP-based rate limiter
    - Import express-rate-limit
    - Create apiLimiter with windowMs: 60000, max: 10
    - Use req.ip as keyGenerator (primary protection)
    - Add handler for rate limit exceeded with structured error response
    - Enable standardHeaders for rate limit info
    - _Bug_Condition: requests.count > SAFE_THRESHOLD AND NOT hasRateLimiting(system)_
    - _Expected_Behavior: System enforces rate limiting (10 requests per minute per IP)_
    - _Preservation: Normal request flow unchanged when under limit_
    - _Requirements: 1.5, 2.5_
  
  - [ ] 6.3 Apply rate limiter to /generate endpoint
    - Add apiLimiter middleware to /generate route
    - _Bug_Condition: Multiple rapid requests from same IP bypass limits_
    - _Expected_Behavior: Requests from same IP are throttled after 10 per minute_
    - _Preservation: Requests from different IPs have independent limits_
    - _Requirements: 2.5_
  
  - [ ] 6.4 Verify Bug 5 exploration test now passes
    - **Property 1: Expected Behavior** - IP-Based Rate Limiting
    - **IMPORTANT**: Re-run the SAME test from task 1.4 - do NOT write a new test
    - Run test from step 1.4
    - **EXPECTED OUTCOME**: Test PASSES (confirms IP-based rate limiting exists)
    - _Requirements: 2.5_

- [ ] 7. Fix Bug 2: Enhanced Error Messages

  - [ ] 7.1 Implement structured error response handling
    - Replace generic catch block with detailed error analysis
    - Create errorResponse object with error, details, suggestion fields
    - Handle specific error types: ENOTFOUND, ETIMEDOUT, 429, 401
    - Provide actionable suggestions for each error type
    - _Bug_Condition: error.occurred = true AND NOT error.hasActionableDetails_
    - _Expected_Behavior: System provides clear, actionable error messages_
    - _Preservation: Successful responses unchanged_
    - _Requirements: 1.2, 2.2_
  
  - [ ] 7.2 Update plugin error display
    - Check for data.error in response
    - Display error, details.message, and suggestion in UI
    - Handle HTTP failure errors (429, timeout, ECONNREFUSED)
    - Provide user-friendly messages for each error type
    - _Bug_Condition: Generic error messages without context_
    - _Expected_Behavior: Clear error messages with resolution steps_
    - _Preservation: Success messages unchanged_
    - _Requirements: 2.2_
  
  - [ ] 7.3 Verify Bug 2 exploration test now passes
    - **Property 1: Expected Behavior** - Enhanced Error Messages
    - **IMPORTANT**: Re-run the SAME test from task 1.5 - do NOT write a new test
    - Run test from step 1.5
    - **EXPECTED OUTCOME**: Test PASSES (confirms enhanced error messages exist)
    - _Requirements: 2.2_

- [ ] 8. Fix Bug 4: Complex Roblox Type Handling

  - [ ] 8.1 Implement UDim2 detection by value shape
    - Replace property name check with value shape check
    - Use: type(value) == "table" and value.X and value.Y
    - Handle X.Scale, X.Offset, Y.Scale, Y.Offset components
    - Works for Size, Position, AnchorPoint, ImageRectOffset, etc.
    - _Bug_Condition: property.type = "UDim2" AND NOT hasTypeHandler("UDim2")_
    - _Expected_Behavior: UDim2 values detected by structure and applied correctly_
    - _Preservation: Existing Vector3 and Color3 handling unchanged_
    - _Requirements: 1.4, 2.4_
  
  - [ ] 8.2 Implement CFrame multiple format support
    - Handle object format: {position: [x,y,z], rotation: [rx,ry,rz]}
    - Handle 12-element array: [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22]
    - Handle 3-element array: [x, y, z] (position only)
    - Convert rotation from degrees to radians for object format
    - _Bug_Condition: property.type = "CFrame" AND NOT hasTypeHandler("CFrame")_
    - _Expected_Behavior: CFrame values in all formats applied correctly_
    - _Preservation: Existing property handling unchanged_
    - _Requirements: 1.4, 2.4_
  
  - [ ] 8.3 Implement BrickColor string conversion
    - Check if prop == "BrickColor" and value is string
    - Convert string to BrickColor.new(value)
    - _Bug_Condition: property.type = "BrickColor" AND NOT hasTypeHandler("BrickColor")_
    - _Expected_Behavior: BrickColor string names converted correctly_
    - _Preservation: Existing property handling unchanged_
    - _Requirements: 1.4, 2.4_
  
  - [ ] 8.4 Implement generic Enum handler
    - Replace hardcoded enum list with generic detection
    - Use: type(value) == "string" and Enum[prop]
    - Check if Enum[prop][value] exists
    - Works for Material, Shape, FormFactor, SurfaceType, Font, etc.
    - _Bug_Condition: property.type = "Enum" AND NOT hasTypeHandler(property.type)_
    - _Expected_Behavior: All Roblox enum properties handled automatically_
    - _Preservation: Existing enum handling (Material, Shape, FormFactor) unchanged_
    - _Requirements: 1.4, 2.4_
  
  - [ ] 8.5 Remove continue keyword for Lua 5.1 compatibility
    - Replace continue with if/else pattern
    - Ensure code works without Luau-specific features
    - _Bug_Condition: Code uses Luau-only features_
    - _Expected_Behavior: Code compatible with Lua 5.1_
    - _Preservation: Logic unchanged, only syntax adjustment_
    - _Requirements: 2.4_
  
  - [ ] 8.6 Verify Bug 4 exploration tests now pass
    - **Property 1: Expected Behavior** - Complex Type Handling
    - **IMPORTANT**: Re-run the SAME tests from tasks 1.6, 1.7, 1.8, 1.9 - do NOT write new tests
    - Run tests from steps 1.6 (CFrame object), 1.7 (CFrame array), 1.8 (UDim2), 1.9 (Enum)
    - **EXPECTED OUTCOME**: All tests PASS (confirms complex type handling works)
    - _Requirements: 2.4_

- [ ] 9. Fix Bug 1: JSON Structure Validation

  - [ ] 9.1 Implement validateResponseStructure() function
    - Define ALLOWED_PARENTS array: Workspace, ServerScriptService, StarterPlayerScripts, ReplicatedStorage, StarterGui
    - Validate scripts array structure (name, type, source, parent fields)
    - Validate script.type is in [Script, LocalScript, ModuleScript]
    - Validate script.parent is in ALLOWED_PARENTS
    - Validate instances array structure (className, properties fields)
    - Return {valid: boolean, errors: string[]}
    - _Bug_Condition: response EXISTS AND NOT hasValidStructure(response) AND noValidationPerformed_
    - _Expected_Behavior: JSON structure validated before sending to plugin_
    - _Preservation: Valid responses pass through unchanged_
    - _Requirements: 1.1, 2.1_
  
  - [ ] 9.2 Integrate validation in /generate endpoint
    - Call validateResponseStructure() after receiving AI response
    - Return 400 error with validation.errors if invalid
    - Include structured error response with details and suggestion
    - _Bug_Condition: Malformed JSON reaches plugin without validation_
    - _Expected_Behavior: Validation errors returned with specific structural issues_
    - _Preservation: Valid responses processed normally_
    - _Requirements: 2.1_
  
  - [ ] 9.3 Verify Bug 1 exploration test now passes
    - **Property 1: Expected Behavior** - JSON Structure Validation
    - **IMPORTANT**: Re-run the SAME test from task 1.10 - do NOT write a new test
    - Run test from step 1.10
    - **EXPECTED OUTCOME**: Test PASSES (confirms JSON structure validation exists)
    - _Requirements: 2.1_

- [ ] 10. Enhancement: Game Mode System Prompt

  - [ ] 10.1 Enhance SYSTEM_PROMPT with game mode guidance
    - Add section for round systems (start/end logic, timers)
    - Add section for team games (team assignment, scoring)
    - Add section for leaderboards (stats tracking, display)
    - Add section for lobby/arena patterns
    - Add section for kill bricks, checkpoints, spectator mode
    - Add guidance on how scripts should reference each other
    - _Expected_Behavior: AI generates better game mode implementations_
    - _Preservation: Existing prompt functionality unchanged_
    - _Requirements: User enhancement request_
  
  - [ ] 10.2 Update type formatting guidance in SYSTEM_PROMPT
    - Ensure Vector3, Color3, CFrame, UDim2, BrickColor, Enum formatting is documented
    - Include examples for each type format
    - _Expected_Behavior: AI generates correctly formatted complex types_
    - _Preservation: Existing type guidance unchanged_
    - _Requirements: 2.4, User enhancement request_

- [ ] 11. Enhancement: Task Complexity Handling

  - [ ] 11.1 Add complexity schema fields to response structure
    - Add "complexity" field: "simple" | "moderate" | "complex"
    - Add "currentPhase" field: number
    - Add "totalPhases" field: number
    - Add "phases" field: array describing each step
    - _Expected_Behavior: Complex requests can be broken across multiple turns_
    - _Preservation: Simple requests work identically_
    - _Requirements: User enhancement request_
  
  - [ ] 11.2 Update SYSTEM_PROMPT with complexity guidance
    - Explain when to use each complexity level
    - Provide examples of multi-phase generation
    - Guide AI on how to structure phases
    - _Expected_Behavior: AI breaks down complex tasks appropriately_
    - _Preservation: Simple task generation unchanged_
    - _Requirements: User enhancement request_
  
  - [ ] 11.3 Update plugin UI to handle multi-phase responses
    - Display current phase and total phases
    - Show phase descriptions
    - Allow continuation to next phase
    - _Expected_Behavior: Users can work through complex tasks step-by-step_
    - _Preservation: Single-phase responses work identically_
    - _Requirements: User enhancement request_

- [ ] 12. Enhancement: Cross-Reference Validation

  - [ ] 12.1 Implement cross-reference validation in backend
    - Scan generated script sources for workspace.Name patterns
    - Extract referenced names from scripts
    - Check if referenced names exist in response's instances array
    - Collect warnings for missing references
    - _Expected_Behavior: Backend detects when scripts reference non-existent instances_
    - _Preservation: Validation is non-blocking, only warns_
    - _Requirements: User enhancement request_
  
  - [ ] 12.2 Add warnings to response structure
    - Add "warnings" field to response structure
    - Include cross-reference warnings in response
    - Format: "Script 'X' references 'Y' which is not in the instances array"
    - _Expected_Behavior: Users are warned about potential reference issues_
    - _Preservation: Existing response structure unchanged_
    - _Requirements: User enhancement request_
  
  - [ ] 12.3 Display warnings in plugin UI
    - Show warnings section in UI when warnings exist
    - Use yellow/orange color for warning text
    - Allow users to proceed despite warnings
    - _Expected_Behavior: Users see warnings but can still apply changes_
    - _Preservation: No warnings = no UI change_
    - _Requirements: User enhancement request_

## Phase 4: Final Verification

- [ ] 13. Verify all preservation tests still pass
  - **Property 2: Preservation** - Existing Functionality Preserved
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
  - Run all preservation tests from step 2
  - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Verify all bug condition exploration tests pass (confirm bugs are fixed)
  - Verify all preservation tests pass (confirm no regressions)
  - Run manual testing checklist from design document
  - Ask user if questions arise
