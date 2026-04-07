# Roblox AI Plugin - Quick Setup Guide

## 🎯 What You Need

- Node.js 16+ installed
- A Qwen API key
- Roblox Studio

## 📦 Installation (5 minutes)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Get Your Qwen API Key

1. Open Alibaba Cloud Model Studio / DashScope
2. Create or copy your API key
3. Make sure billing is enabled for model calls
4. Copy the key

### Step 3: Configure Environment

Edit the `.env` file and paste your API key:

```env
QWEN_API_KEY=sk-your-key-here
QWEN_MODEL=qwen3-coder-plus
AI_PROVIDER=qwen
# Optional but recommended for reference-image analysis
VISION_MODEL=qwen-vl-plus
```

### Step 4: Start the Server

```bash
npm start
```

You should see:
```
✅  Environment validation passed.
🚀  Roblox AI backend → http://localhost:3000
```

### Step 5: Test It Works

```bash
npm test
```

Expected: All tests passed (varies by API rate limits)

### Step 6: Install Plugin in Roblox Studio

1. Open Roblox Studio
2. Go to **Plugins** → **Plugins Folder**
3. Copy `roblox-ai-plugin.lua` into that folder
4. Restart Roblox Studio
5. You'll see an **AI Assistant** button in the toolbar

### Step 7: Configure Plugin

1. Click the **AI Assistant** button
2. In the URL field, enter: `http://localhost:3000`
3. Click **Save**

### Step 8: Try It Out!

Type in the prompt box:
```
Create a red brick at position 0,5,0
```

Click **Generate** and watch the magic happen! ✨

For richer scene generation:
1. Switch to **🔬 Detailed** mode
2. Leave **Environment** on
3. Add up to 3 reference images using pasted URLs or **Attach Asset**
4. Try:
```text
Build a classroom with rows of desks, a whiteboard, warm lighting, trees outside, a path to the entrance, boundary walls, and surrounding world detail
```

## 🎮 Example Prompts

### Simple Objects
```
Create a blue sphere with size 10,10,10
Make a spinning platform
Add a teleporter that moves players to 0,50,0
```

### Game Modes
```
Create a round-based game with 60 second rounds
Build a team deathmatch with red and blue teams
Make a capture the flag game
Create an obby with 5 checkpoints
```

### Follow-Up Commands
```
You: Create a red brick
AI: [Creates red brick]

You: Make it blue instead
AI: [Changes it to blue]

You: Add a script that makes it spin
AI: [Adds rotation script]
```

## 🚀 Deploy to Production (Optional)

### Railway (Recommended)

1. Go to https://railway.app/
2. Click **New Project** → **Deploy from GitHub**
3. Connect your repository
4. Add environment variable: `QWEN_API_KEY=your_key`
5. Recommended: add `QWEN_MODEL=qwen3-coder-plus`
6. Optional: add `AI_PROVIDER=qwen`
7. Railway gives you a URL like `https://your-app.railway.app`
8. Update the plugin URL in Roblox Studio to this URL

### Render

1. Go to https://render.com/
2. Click **New** → **Web Service**
3. Connect your repository
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variable: `QWEN_API_KEY=your_key`
7. Recommended: add `QWEN_MODEL=qwen3-coder-plus`
8. Optional: add `AI_PROVIDER=qwen`
9. Render gives you a URL like `https://your-app.onrender.com`
10. Update the plugin URL in Roblox Studio to this URL

## ❓ Common Issues

### "Server is not running"
→ Run `npm start` first

### "Environment variable QWEN_API_KEY is missing"
→ Check your `.env` file has the Qwen API key

### "Rate limit exceeded"
→ Check your DashScope balance or quota window
→ Wait for reset, use a lighter Qwen model, or use another key
→ If Railway requests are timing out, pin `QWEN_MODEL=qwen3-coder-plus`

### "Plugin not showing in Roblox Studio"
→ Make sure you copied the file to the plugins folder
→ Restart Roblox Studio completely

### "Connection failed" in plugin
→ Make sure server is running (`npm start`)
→ Check the URL matches (try `http://127.0.0.1:3000`)
→ Enable HTTP Requests in Game Settings → Security

### "Reference images were skipped"
→ Set `VISION_MODEL` in `.env`
→ Use public image URLs or attach valid Roblox image/decal assets
→ The plugin only sends the first 3 references in the current session list

## 📊 API Limits (Free Tier)

- **Requests per minute:** 1000
- **Tokens per minute:** 12,000
- **Tokens per day:** 100,000

Each request uses ~5,000-6,000 tokens, so you get about 15-20 generations per day on the free tier.

## 🎯 What's Included

### All 7 Bug Fixes
✅ JSON structure validation
✅ Structured error messages
✅ Retry with backoff
✅ Extended type handler (CFrame, UDim2, Enums)
✅ IP-based rate limiting
✅ Environment validation
✅ Configurable URL

### Game-Mode AI
✅ Round systems
✅ Team games
✅ Leaderboards
✅ Lobby/arena
✅ Kill bricks
✅ Checkpoints
✅ Spectator mode

### Advanced Features
✅ Multi-phase generation
✅ Cross-reference validation
✅ Conversation context
✅ Selection awareness
✅ Undo stack
✅ Reference-image URLs and attached Roblox assets
✅ Two-pass scene planning in Detailed mode
✅ Wider map environment generation

## 📝 Next Steps

1. Try the example prompts above
2. Experiment with game modes
3. Deploy to production (Railway/Render)
4. Share with your team!

## 🆘 Need Help?

Check the full README.md for detailed troubleshooting and configuration options.

Happy building! 🎮
