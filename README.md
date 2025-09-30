# 🪙 Pixel Arena – VibeCoding Coin Pixel Battle

A simple pixel battle game where the largest holders of your Solana PumpFun coin fight for board dominance – built with Next.js and TypeScript.

### How does it work?
- **Top holders** are fetched (e.g. top 100) via Helius/RPC.
- **Pixels are distributed** proportionally based on holdings (everyone gets at least 1 pixel).
- **Battles** run continuously; neighboring pixels duel and change owner on victory.
- **Rounds** end when one holder dominates the board – the winner is announced.
- **Centralized game** – All users see the same game via Docker engine + SSE stream

## 🚀 Quick Start

### Local Development (without Docker)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   cp env.example .env.local
   ```
   Add to `.env.local`:
   ```
   HELIUS_API_KEY=your-api-key
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Open: `http://localhost:3000`

### Local Testing with Docker
1. Start Docker engine:
   ```bash
   docker-compose up
   ```
2. In another terminal, start Next.js:
   ```bash
   ENGINE_URL=http://localhost:8080 npm run dev
   ```
3. Open multiple browser tabs at `http://localhost:3000` - everyone sees the same game!

## 🐳 Production Deployment (Docker + Vercel)

For all users to see the same game, you must deploy with this architecture:

```
┌─────────────┐
│    Users    │ ←─── See same game state
└──────┬──────┘
       │ HTTP/SSE
┌──────▼──────┐
│   Vercel    │ ←─── Frontend (Next.js)
│  (Frontend) │
└──────┬──────┘
       │ Proxy
┌──────▼──────┐
│   Docker    │ ←─── Game Engine (centralized)
│  Container  │      Runs on Render/Railway/VPS
└─────────────┘
```

### Step 1: Deploy Docker Engine

Choose one of these services:

**Option A: Render.com (Recommended)**
1. Go to [render.com](https://render.com)
2. Create new "Web Service" from this repo
3. Select "Docker" environment
4. Deploy! Copy your URL (e.g. `https://your-app.onrender.com`)

**Option B: Railway.app**
1. Go to [railway.app](https://railway.app)
2. Deploy from GitHub repo
3. Railway automatically detects Dockerfile
4. Copy generated URL

**Option C: Your own server**
```bash
docker-compose up -d
# Remember to open port 8080 in firewall
```

### Step 2: Configure Vercel

1. Go to Vercel project → Settings → Environment Variables
2. Add:
   - **Key**: `ENGINE_URL`
   - **Value**: Your Docker URL from Step 1
   - **Environments**: Production, Preview, Development
3. Redeploy: `vercel --prod`

### Step 3: Test

Open your Vercel URL in multiple browsers/tabs - everyone should see the same game! 🎉

📖 **Detailed guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📁 Structure

```
.
├── engine/
│   └── server.ts          # Docker game engine (Express + SSE)
├── src/
│   ├── app/
│   │   ├── api/           # Next.js API routes (proxy to Docker)
│   │   └── page.tsx       # Frontend
│   ├── components/        # UI components
│   └── server/
│       └── gameEngine.ts  # Shared game logic
├── Dockerfile             # Docker container setup
├── docker-compose.yml     # Local Docker test
└── DEPLOYMENT.md          # Full deployment guide
```

## 🛠 Scripts

- `npm run dev` – development (local engine)
- `npm run build` – build for production
- `npm run start` – run production build
- `npm run engine` – run Docker engine locally
- `docker-compose up` – start Docker container

## 🔧 Configuration

Environment variables (`.env.local` or Vercel):

```bash
# Game Engine URL (for Vercel deployment)
ENGINE_URL=https://your-docker-server.com

# Solana
HELIUS_API_KEY=your-api-key
NEXT_PUBLIC_MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump

# Docker Engine (optional tuning)
FIGHTS_PER_TICK=1200      # Number of fights per tick
TICK_INTERVAL_MS=15       # MS between ticks
```

## 🔍 Troubleshooting

**"Failed to connect to game engine"**
- Check that Docker container is running
- Verify ENGINE_URL is correct in Vercel
- Test: `curl https://your-engine-url.com/api/round/state`

**Stream not updating**
- Open browser console for errors
- Check Docker logs: `docker-compose logs -f`

**Performance issues**
- Reduce `FIGHTS_PER_TICK` or increase `TICK_INTERVAL_MS`
- Upgrade to paid tier on hosting platform

## 📱 Links

- X (Twitter): [@pixelarenapump](https://x.com/pixelarenapump)

## 📄 License

MIT – use freely.