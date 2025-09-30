# 🪙 Pixel Arena – VibeCoding Coin Pixel Battle

En enkel pixel-battle, hvor de største holders af din Solana PumpFun coin kæmper om brættet – bygget med Next.js og TypeScript.

### Hvordan fungerer det?
- **Top holders** hentes (fx top 100) via Helius/RPC.
- **Pixels fordeles** proportionalt efter holdings (alle får mindst 1 pixel).
- **Kampe** kører løbende; nabo-pixels duellerer og skifter ejer ved sejr.
- **Runder** slutter, når én holder dominerer brættet – vinderen annonceres.
- **Centraliseret spil** – Alle brugere ser det samme via Docker engine + SSE stream

## 🚀 Quick Start

### Lokal Udvikling (uden Docker)
1. Installer dependencies:
   ```bash
   npm install
   ```
2. Opret environment-fil:
   ```bash
   cp env.example .env.local
   ```
   Tilføj i `.env.local`:
   ```
   HELIUS_API_KEY=din-api-key
   ```
3. Start udviklingsserveren:
   ```bash
   npm run dev
   ```
4. Åbn: `http://localhost:3000`

### Lokal Test med Docker
1. Start Docker engine:
   ```bash
   docker-compose up
   ```
2. I en anden terminal, start Next.js:
   ```bash
   ENGINE_URL=http://localhost:8080 npm run dev
   ```
3. Åbn flere browser tabs på `http://localhost:3000` - alle ser samme spil!

## 🐳 Production Deployment (Docker + Vercel)

For at alle brugere skal se det samme spil, skal du deploye med denne arkitektur:

```
┌─────────────┐
│   Brugere   │ ←─── Se samme spil state
└──────┬──────┘
       │ HTTP/SSE
┌──────▼──────┐
│   Vercel    │ ←─── Frontend (Next.js)
│  (Frontend) │
└──────┬──────┘
       │ Proxy
┌──────▼──────┐
│   Docker    │ ←─── Game Engine (centraliseret)
│  Container  │      Kører på Render/Railway/VPS
└─────────────┘
```

### Step 1: Deploy Docker Engine

Vælg en af disse services:

**Option A: Render.com (Anbefalet)**
1. Gå til [render.com](https://render.com)
2. Opret ny "Web Service" fra dette repo
3. Vælg "Docker" environment
4. Deploy! Kopier din URL (f.eks. `https://din-app.onrender.com`)

**Option B: Railway.app**
1. Gå til [railway.app](https://railway.app)
2. Deploy fra GitHub repo
3. Railway detecterer automatisk Dockerfile
4. Kopier genereret URL

**Option C: Din egen server**
```bash
docker-compose up -d
# Husk at åbne port 8080 i firewall
```

### Step 2: Konfigurer Vercel

1. Gå til Vercel project → Settings → Environment Variables
2. Tilføj:
   - **Key**: `ENGINE_URL`
   - **Value**: Din Docker URL fra Step 1
   - **Environments**: Production, Preview, Development
3. Redeploy: `vercel --prod`

### Step 3: Test

Åbn din Vercel URL i flere browsere/tabs - alle skulle se det samme spil! 🎉

📖 **Detaljeret guide**: Se [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📁 Struktur

```
.
├── engine/
│   └── server.ts          # Docker game engine (Express + SSE)
├── src/
│   ├── app/
│   │   ├── api/           # Next.js API routes (proxy til Docker)
│   │   └── page.tsx       # Frontend
│   ├── components/        # UI komponenter
│   └── server/
│       └── gameEngine.ts  # Delt game logic
├── Dockerfile             # Docker container setup
├── docker-compose.yml     # Lokal Docker test
└── DEPLOYMENT.md          # Fuld deployment guide
```

## 🛠 Scripts

- `npm run dev` – udvikling (lokal engine)
- `npm run build` – build til produktion
- `npm run start` – kør production build
- `npm run engine` – kør Docker engine lokalt
- `docker-compose up` – start Docker container

## 🔧 Configuration

Environment variables (`.env.local` eller Vercel):

```bash
# Game Engine URL (til Vercel deployment)
ENGINE_URL=https://din-docker-server.com

# Solana
HELIUS_API_KEY=din-api-key
NEXT_PUBLIC_MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump

# Docker Engine (optional tuning)
FIGHTS_PER_TICK=1200      # Antal kampe per tick
TICK_INTERVAL_MS=15       # MS mellem ticks
```

## 🔍 Troubleshooting

**"Failed to connect to game engine"**
- Tjek at Docker container kører
- Verificer ENGINE_URL er korrekt i Vercel
- Test: `curl https://din-engine-url.com/api/round/state`

**Stream opdaterer ikke**
- Åbn browser console for fejl
- Tjek Docker logs: `docker-compose logs -f`

**Performance issues**
- Reducer `FIGHTS_PER_TICK` eller øg `TICK_INTERVAL_MS`
- Upgrade til paid tier på hosting platform

## 📱 Links

- X (Twitter): [@pixelarenapump](https://x.com/pixelarenapump)

## 📄 Licens

MIT – brug frit.