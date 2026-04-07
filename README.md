# Roblox AI Plugin - Production Ready

A complete AI-powered plugin for Roblox Studio that generates game scripts and objects using natural language commands. Built with Qwen through Alibaba Cloud Model Studio's OpenAI-compatible API and designed for game-mode development (round systems, teams, leaderboards, etc.).

## ✨ Features

### Infrastructure (All 7 Bugs Fixed)
- ✅ **JSON Structure Validation** - Validates AI responses before sending to plugin
- ✅ **Enhanced Error Messages** - Clear, actionable error messages with suggestions
- ✅ **Automatic Retry Logic** - Exponential backoff for transient API failures
- ✅ **IP-Based Rate Limiting** - 15 requests/minute per IP address
- ✅ **Environment Validation** - Fail-fast startup checks for API key
- ✅ **Configurable Backend URL** - No code changes needed when URL changes
- ✅ **Extended Type Support** - CFrame, UDim2, BrickColor, all Roblox Enums

### Game-Mode AI Capabilities
- 🎮 **Round-Based Games** - Complete round system with timers and state management
- 👥 **Team Games** - Team assignment, spawns, and scoring
- 📊 **Leaderboards** - Stats tracking with DataStore persistence
- 🏟️ **Lobby + Arena** - Player management and teleportation
- ⚡ **Kill Bricks** - Touch-based damage and kill credit
- 🚩 **Checkpoints** - Respawn system with progress saving
- 👻 **Spectator Mode** - Camera cycling for eliminated players

### Advanced Features
- 📝 **Multi-Phase Tasks** - Complex requests broken into manageable steps
- 🖼️ **Reference Images** - Mix pasted image URLs with attached Roblox image/decal assets
- 🧭 **Two-Pass Scene Planning** - Detailed mode plans layout first, then generates the final scene
- 🌍 **Playable Map Surroundings** - Adds terrain, roads, props, boundaries, and background structures
- ⚠️ **Cross-Reference Validation** - Warns when scripts reference missing objects
- 🔄 **Conversation Context** - AI remembers previous turns
- 📌 **Selection Awareness** - Includes selected objects in prompts
- ↩️ **Undo Stack** - Remove last generation with one click
- 🗑️ **Clear Conversation** - Reset AI context for fresh start

## 🚀 Quick Start

### Backend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create or edit `.env` file with your Qwen API key:
   ```env
   QWEN_API_KEY=your_qwen_api_key_here
   QWEN_MODEL=qwen3-coder-plus
   AI_PROVIDER=qwen
   # Optional but recommended for reference-image analysis
   VISION_MODEL=qwen-vl-plus
   ```
   
   **Get a Qwen API key:**
   - Go to Alibaba Cloud Model Studio / DashScope
   - Create an API key
   - Copy and paste it into `.env`

3. **Start the server:**
   ```bash
   npm start
   ```
   
   You should see:
   ```
   ✅  Environment validation passed.
   🚀  Roblox AI backend → http://localhost:3000
       Deploy to Railway/Render and paste the URL into the plugin.
   ```

4. **Test the server:**
   ```bash
   npm test
   ```
   
   Expected: All tests passed (varies by API rate limits)

### Plugin Installation

1. **Open Roblox Studio**

2. **Enable HTTP Requests:**
   - File → Game Settings → Security
   - Enable "Allow HTTP Requests"

3. **Install the plugin:**
   - Go to Plugins → Plugins Folder
   - Copy `roblox-ai-plugin.lua` into the plugins folder
   - Restart Roblox Studio
   - You'll see a new "AI Assistant" button in the toolbar

4. **Configure the plugin:**
   - Click the "AI Assistant" button
   - Enter your backend URL: `http://localhost:3000`
   - Click "Save"
   - Type a prompt: `"Create a red brick at position 0,5,0"`
   - Click "Generate"
   - For scene work, use `🔬 Detailed` mode and attach up to 3 reference images via URL or Roblox asset picker

## 📖 Usage Examples

### Simple Objects
```
Create a red brick at position 0,5,0
```

### Game Modes
```
Create a round-based game with 60 second rounds and 2 teams
```

```
Add a leaderboard that tracks kills and deaths
```

```
Create a lobby system that waits for 4 players before starting
```

### Complex Systems
```
Build a capture the flag game with team spawns and flag bases
```

### Detailed Scene Prompt
```
Build a beautiful floating island with grassy ground, 2 hills, a pond, stone path, trees, flowers, warm lighting, boundary water, and surrounding props
```

The AI will automatically break complex requests into phases. Click "Continue to Next Phase" to proceed through each step.

### Reference Images
- Paste one or more public image URLs into the **Reference Images** field and click **Add URL**
- Paste inline clipboard image payloads in `data:image/<type>;base64,...` format (one per line) and click **Add URL**
- Click **Attach Asset** to pick a Roblox decal/image asset from Studio
- The plugin keeps up to 3 references in order and sends them as `referenceImages` to the backend
- If `VISION_MODEL` is not configured, generation still works but the backend returns a warning that image analysis was skipped

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Roblox Studio Plugin (Lua)                             │
│  • UI for prompts and configuration                     │
│  • Reference-image asset picker + URL references        │
│  • Detailed/Quick generation modes                      │
│  • Phase management for complex tasks                   │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP POST /generate
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Node.js Backend Server                                 │
│  • IP-based rate limiting (15 req/min)                  │
│  • Reference image normalization + asset resolution     │
│  • Two-pass scene planning + template resolution        │
│  • Environment generation + validation gating           │
└────────────────┬────────────────────────────────────────┘
                 │ Qwen API
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Qwen via DashScope OpenAI-Compatible API               │
│  • Fast text generation for Luau and game systems       │
│  • Round systems, teams, leaderboards                   │
│  • Task complexity assessment                           │
│  • Multi-phase generation for complex requests          │
└─────────────────────────────────────────────────────────┘
```

## 🧪 Testing

The test suite validates all 7 bug fixes and game-mode capabilities:

```bash
npm test
```

Tests include:
- Health endpoint
- Input validation
- Legacy `imageUrls` compatibility
- `referenceImages` normalization and warning flow
- Simple generation
- Game mode generation
- Rate limiting (IP-based)
- JSON structure validation
- Conversation context
- Cross-reference validation
- Error handling

## 🌐 Deployment

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add environment variable: `QWEN_API_KEY`
4. Recommended: add `QWEN_MODEL=qwen3-coder-plus`
5. Optional: add `AI_PROVIDER=qwen`
6. Deploy
7. Copy the public URL and paste it into the plugin

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variable: `QWEN_API_KEY`
6. Recommended: add `QWEN_MODEL=qwen3-coder-plus`
7. Optional: add `AI_PROVIDER=qwen`
8. Deploy
9. Copy the public URL and paste it into the plugin

## 📁 Project Structure

```
.
├── server.js               # Backend server (all 7 fixes + game-mode AI)
├── roblox-ai-plugin.lua    # Roblox Studio plugin
├── package.json            # Node.js dependencies
├── .env                    # Environment variables (API key)
├── test-server.js          # Test suite
├── README.md               # This file
└── .kiro/specs/            # Design documentation
    └── roblox-ai-plugin-improvements/
        ├── bugfix.md       # Bug requirements
        ├── design.md       # Technical design
        └── tasks.md        # Implementation tasks
```

## 🔧 Configuration

### Backend Environment Variables

- `QWEN_API_KEY` - Your Qwen / DashScope API key
- `QWEN_MODEL` - Qwen model to use (default: `qwen3-coder-plus`)
- `AI_PROVIDER` - `qwen` or `openai` (default auto-detects, but this project uses `qwen`)
- `OPENAI_API_KEY` - Optional OpenAI fallback key
- `VISION_MODEL` - Vision-capable model used for reference-image analysis
- `VISION_API_KEY` - Optional separate key for the vision model
- `VISION_BASE_URL` - Optional separate base URL for the vision provider
- `PORT` - Server port (default: 3000)

### Plugin Settings

- **Backend URL** - Configurable via plugin UI, persists across Studio sessions
- **Conversation ID** - Auto-generated per session, reset with "Clear Conversation"
- **Reference Images** - Session-local list of up to 3 URL or Roblox-asset references; not persisted across Studio restarts

## 🛡️ Security

- **IP-Based Rate Limiting** - Prevents API quota exhaustion
- **Parent Allowlist** - Scripts can only be created in safe locations
- **Input Validation** - All requests validated before processing
- **Environment Validation** - Server won't start without API key
- **No Lua Syntax Validation** - Deferred to Roblox Studio (avoids false negatives)

## 📊 Performance

- **Response Time** - Typically 2-5 seconds for simple requests
- **Retry Logic** - Up to 3 retries with 1s, 2s, 4s delays
- **Rate Limit** - 15 requests per minute per IP
- **Conversation TTL** - 1 hour of inactivity
- **Max History** - Last 10 conversation turns kept

## 🐛 Troubleshooting

### "Server is not running"
**Solution:** Start the server first:
```bash
npm start
```

### "Environment variable QWEN_API_KEY is missing"
**Solution:** Add your API key to `.env`:
```env
QWEN_API_KEY=your_key_here
```

### "Backend unreachable"
**Solution:**
- Verify the backend URL in plugin settings
- Check that the server is running (`npm start`)
- Ensure HTTP Requests are enabled in Roblox Studio
- Try `http://127.0.0.1:3000` instead of `http://localhost:3000`
- On Railway, explicitly set `QWEN_MODEL=qwen3-coder-plus` if requests are timing out

### "Reference images were skipped"
**Solution:**
- Set `VISION_MODEL` in `.env`
- If you use attached Roblox assets, make sure they are valid image/decal assets
- If you use URLs, use public `http://` or `https://` image links

### "Rate limit exceeded" (from Qwen API)
**Solution:**
- Check your Alibaba Cloud / DashScope balance and billing status
- Wait for the provider limit window to reset
- Try a lighter model such as `qwen-turbo`
- Use a different Qwen API key if needed

### "Rate limit exceeded" (from backend)
**Solution:**
- Wait 1 minute before trying again
- Check if multiple users are sharing the same IP

### "Auth error"
**Solution:**
- Verify `QWEN_API_KEY` in `.env` file
- Check your Alibaba Cloud Model Studio / DashScope key
- Restart the server after changing environment variables

### "Invalid response structure"
**Solution:**
- This is an AI generation issue
- Try rephrasing your prompt more specifically
- Check server logs for details

### "Plugin not showing in Roblox Studio"
**Solution:**
1. Make sure you copied `roblox-ai-plugin.lua` to the plugins folder
2. Restart Roblox Studio completely
3. Check Plugins → Manage Plugins to see if it's listed

### Tests failing with "Rate limit reached"
**Solution:** This is usually a provider quota or timing issue, not a plugin bug. Either:
- Wait a few minutes and run tests again
- Use a fresh Qwen API key
- Reduce the test frequency if your account has tight limits

## 📝 License

MIT

## 🙏 Credits

Built with:
- [Qwen / DashScope](https://www.alibabacloud.com/help/en/model-studio/) - Text generation via an OpenAI-compatible API
- [OpenAI SDK](https://www.npmjs.com/package/openai) - Client library used to call Qwen
- [Express.js](https://expressjs.com)
- [Roblox Studio](https://www.roblox.com/create)
