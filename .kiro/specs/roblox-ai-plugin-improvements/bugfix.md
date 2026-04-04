# Bugfix Requirements Document

## Introduction

The Roblox AI Plugin implementation contains multiple critical defects that prevent production deployment. These issues span validation, error handling, resilience, type support, resource protection, and configuration management. The bugs manifest as runtime crashes, poor user experience, potential API cost overruns, and deployment fragility. This document defines the defective behaviors, expected correct behaviors, and preservation requirements to ensure existing functionality remains intact.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the backend generates a response that doesn't match the expected JSON structure THEN the system sends the malformed response to the plugin without validation, causing errors when the plugin tries to process it

1.2 WHEN an error occurs during generation or application THEN the system displays generic error messages like "Error: Invalid JSON from server" without actionable details

1.3 WHEN the OpenAI API call fails due to transient network issues or rate limits THEN the system requires manual retry by the user with no automatic recovery

1.4 WHEN applyChanges() encounters complex Roblox property types (CFrame, UDim2, BrickColor, Enum values) THEN the system fails to apply these properties correctly or crashes

1.5 WHEN multiple rapid API requests are made THEN the system has no rate limiting protection, potentially exhausting API quota and incurring unexpected costs

1.6 WHEN the server starts without OPENAI_API_KEY environment variable THEN the system crashes with cryptic errors on first API call instead of failing fast at startup

1.7 WHEN the plugin is deployed THEN the system uses a hardcoded temporary backend URL that will expire, breaking the plugin

### Expected Behavior (Correct)

2.1 WHEN the backend generates a response THEN the system SHALL validate the JSON structure matches the expected schema before sending to the plugin and return validation errors if structure is invalid

2.2 WHEN an error occurs during generation or application THEN the system SHALL provide clear, actionable error messages that help users understand and resolve the issue

2.3 WHEN the OpenAI API call fails due to transient issues THEN the system SHALL automatically retry with exponential backoff (e.g., 1s, 2s, 4s delays) up to a maximum number of attempts

2.4 WHEN applyChanges() encounters complex Roblox property types THEN the system SHALL correctly parse and apply CFrame, UDim2, BrickColor, Enum, and other common Roblox types

2.5 WHEN API requests are made THEN the system SHALL enforce rate limiting to protect against quota exhaustion and provide feedback when limits are reached

2.6 WHEN the server starts THEN the system SHALL validate that OPENAI_API_KEY exists and is non-empty, failing fast with a clear error message if missing

2.7 WHEN the plugin is deployed THEN the system SHALL use a configuration mechanism for the backend URL that can be updated without code changes

### Unchanged Behavior (Regression Prevention)

3.1 WHEN valid Lua code is generated for basic scripts THEN the system SHALL CONTINUE TO successfully create and apply scripts to the workspace

3.2 WHEN basic property types (Vector3, Color3, string, number, boolean) are applied THEN the system SHALL CONTINUE TO correctly set these properties on instances

3.3 WHEN conversation history is maintained across multiple requests THEN the system SHALL CONTINUE TO preserve context using conversationId

3.4 WHEN the user selects objects in Roblox Studio THEN the system SHALL CONTINUE TO include selection context in the AI prompt

3.5 WHEN instances are created through the AI response THEN the system SHALL CONTINUE TO create them in the workspace with specified properties

3.6 WHEN the conversation history exceeds MAX_HISTORY THEN the system SHALL CONTINUE TO trim old messages to prevent memory issues

3.7 WHEN old conversations exceed TTL THEN the system SHALL CONTINUE TO clean up expired conversations to prevent memory leaks

3.8 WHEN the /health endpoint is called THEN the system SHALL CONTINUE TO respond with "Backend is running"
