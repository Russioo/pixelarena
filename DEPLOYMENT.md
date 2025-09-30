# Deployment Guide - Docker + Vercel

Dette projekt kører med en delt game engine i Docker, der streamer til alle brugere via Vercel frontend.

## Arkitektur

1. **Docker Container** - Kører game engine serveren (Express på port 8080)
2. **Vercel** - Kører Next.js frontend der proxy'er til Docker serveren
3. **SSE Stream** - Alle brugere modtager samme game state via Server-Sent Events

## Step 1: Deploy Docker Container

Du skal deploye Docker containeren til en cloud service. Her er nogle anbefalinger:

### Option A: Render.com (Anbefalet - Gratis tier)

1. Gå til [render.com](https://render.com) og log ind
2. Klik "New +" → "Web Service"
3. Connect dit GitHub repository
4. Konfiguration:
   - **Name**: `vibecodingcoin-engine`
   - **Environment**: `Docker`
   - **Instance Type**: `Free` (eller `Starter` for bedre performance)
   - **Health Check Path**: `/api/round/state`
5. Klik "Create Web Service"
6. Kopier URL'en (f.eks. `https://vibecodingcoin-engine.onrender.com`)

### Option B: Railway.app

1. Gå til [railway.app](https://railway.app) og log ind
2. Klik "New Project" → "Deploy from GitHub repo"
3. Vælg dit repository
4. Railway detecterer automatisk Dockerfile
5. Tilføj environment variables hvis nødvendigt:
   - `PORT=8080`
   - `FIGHTS_PER_TICK=1200`
   - `TICK_INTERVAL_MS=15`
6. Deploy og kopier den genererede URL

### Option C: Fly.io

1. Installer Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Log ind: `fly auth login`
3. Launch app: `fly launch`
4. Deploy: `fly deploy`

### Option D: Din egen server (VPS)

```bash
# På din server
git clone <din-repo>
cd vibecodingcoin

# Byg og kør Docker container
docker-compose up -d

# Container kører nu på port 8080
# Sørg for at åbne porten i din firewall
```

## Step 2: Konfigurer Vercel

1. Gå til dit Vercel project dashboard
2. Gå til "Settings" → "Environment Variables"
3. Tilføj følgende variable:
   - **Key**: `ENGINE_URL`
   - **Value**: URL fra Step 1 (f.eks. `https://vibecodingcoin-engine.onrender.com`)
   - **Environments**: Vælg "Production", "Preview", og "Development"
4. Klik "Save"

## Step 3: Redeploy Vercel

```bash
# Trigger redeploy via terminal
vercel --prod

# Eller via Vercel dashboard
# Gå til "Deployments" tab og klik "Redeploy"
```

## Test Setup

1. Åben din Vercel URL i browser
2. Åben i flere tabs eller forskellige browsere
3. Alle brugere skulle nu se det samme spil state
4. Pixel kampe synkroniseres på tværs af alle clients

## Lokal Test (Med Docker)

```bash
# Start Docker engine lokalt
docker-compose up

# I en anden terminal, start Next.js med ENGINE_URL
ENGINE_URL=http://localhost:8080 npm run dev

# Åben http://localhost:3000
```

## Monitoring

### Docker Container

- **Render**: Dashboard viser logs og metrics
- **Railway**: Se logs i project dashboard
- **Docker Compose**: `docker-compose logs -f game-engine`

### Health Check Endpoint

```bash
curl https://din-engine-url.com/api/round/state
```

## Troubleshooting

### "Failed to connect to game engine"

1. Tjek at Docker containeren kører
2. Verificer ENGINE_URL er korrekt sat i Vercel
3. Test engine URL direkte: `curl https://din-engine-url.com/api/round/state`

### Stream ikke opdaterer

1. Tjek at `/api/stream` endpoint virker: `curl https://din-engine-url.com/api/stream`
2. Verificer CORS er enabled i Docker serveren (allerede konfigureret)
3. Tjek browser console for fejl

### Docker container crasher

1. Tjek logs: `docker logs <container-id>`
2. Reducer `FIGHTS_PER_TICK` hvis CPU er for høj
3. Øg `TICK_INTERVAL_MS` for at reducere CPU load

## Performance Tuning

### Environment Variables

```bash
# I din Docker deployment, tilpas disse:
FIGHTS_PER_TICK=1200  # Antal pixel kampe per tick (lavere = hurtigere server)
TICK_INTERVAL_MS=15   # Millisekunder mellem ticks (højere = mindre CPU)
```

### Anbefalet Configuration

- **Free tier**: `FIGHTS_PER_TICK=800`, `TICK_INTERVAL_MS=20`
- **Paid tier**: `FIGHTS_PER_TICK=1200`, `TICK_INTERVAL_MS=15`
- **High performance**: `FIGHTS_PER_TICK=2000`, `TICK_INTERVAL_MS=10`

## Sikkerhed

Docker serveren accepterer alle connections (CORS enabled). For produktion:

1. Overvej at tilføje API key validation
2. Rate limiting på endpoints
3. Brug HTTPS (automatisk på Render/Railway/Fly)

## Costs

- **Render Free**: Gratis, men går i sleep efter 15 min inaktivitet
- **Render Starter**: $7/måned, altid aktiv
- **Railway**: Pay-as-you-go, ~$5-10/måned for small app
- **Fly.io**: Free tier med begrænsninger
- **Vercel**: Gratis for frontend

## Support

Hvis du har problemer, tjek:
1. Docker container logs
2. Vercel function logs
3. Browser developer console
