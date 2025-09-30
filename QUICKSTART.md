# ⚡ Quick Start - Få det til at virke på 5 minutter

## 🎯 Mål
Alle brugere skal se PRÆCIS det samme spil - som en fodboldkamp på TV.

## 🚀 Deploy i 3 Steps (5 minutter)

### Step 1: Deploy Docker Engine (2 min)

**Vælg én af disse:**

#### A) Render.com (Anbefalet - Nemmest)
1. Gå til https://render.com
2. Log ind med GitHub
3. Klik "New +" → "Web Service"
4. Connect dette repository
5. Render ser `render.yaml` og konfigurerer automatisk! 🎉
6. Klik "Create Web Service"
7. Vent ~2 min mens den deployer
8. **Kopier URL'en** (f.eks. `https://vibecodingcoin-engine.onrender.com`)

#### B) Railway.app (Også nem)
1. Gå til https://railway.app
2. Klik "Start a New Project" → "Deploy from GitHub repo"
3. Vælg dette repository
4. Railway ser `railway.json` og deployer automatisk!
5. **Kopier URL'en** fra "Settings" → "Domains"

#### C) Fly.io (For erfarne)
```bash
fly launch
fly deploy
```

### Step 2: Konfigurer Vercel (1 min)

1. Gå til dit Vercel project dashboard
2. Klik "Settings" → "Environment Variables"
3. Tilføj ny variable:
   ```
   Key:   ENGINE_URL
   Value: https://din-url-fra-step-1.onrender.com
   ```
4. Vælg "Production", "Preview", og "Development"
5. Klik "Save"

### Step 3: Redeploy (1 min)

**Option A: Via Terminal**
```bash
vercel --prod
```

**Option B: Via Vercel Dashboard**
- Gå til "Deployments" tab
- Klik "..." på nyeste deployment
- Klik "Redeploy"

### ✅ Test det!

Åbn din Vercel URL i **3 forskellige browsere/tabs** samtidigt.

**Du skulle se:**
- ✅ Alle viser SAMME loading screen
- ✅ Alle viser SAMME "Taking snapshot" popup (med SAMME nedtælling)
- ✅ Alle viser SAMME pixel fights (samme farver, samme positioner)
- ✅ Alle viser SAMME vinder
- ✅ Alle viser popups på SAMME tid

**Hvis én browser viser noget andet** → ENGINE_URL er ikke sat korrekt i Vercel.

---

## 🧪 Test Lokalt Først (Valgfrit)

Vil du teste før deployment?

### Terminal 1: Start Docker
```bash
docker-compose up
```

### Terminal 2: Start Next.js med ENGINE_URL
```bash
# Windows PowerShell
$env:ENGINE_URL="http://localhost:8080"; npm run dev

# Windows CMD
set ENGINE_URL=http://localhost:8080 && npm run dev

# Mac/Linux
ENGINE_URL=http://localhost:8080 npm run dev
```

### Test synkronisering
Åbn `http://localhost:3000` i 3 tabs → alle skulle se det samme!

---

## 📊 Forventet Flow

Når det virker korrekt:

```
1. User åbner site
   ↓
2. "Loading from server..." (kort)
   ↓
3. "Claiming fee pool..." (~1 sek) ← ALLE SER DETTE SAMTIDIGT
   ↓
4. "Taking snapshot..." (5 sek) ← ALLE SER SAMME NEDTÆLLING
   ↓
5. "Round starting" (3 sek) ← SYNKRONT
   ↓
6. Pixel battles begynder ← ALLE SER SAMME PIXELS FIGHT
   ↓
7. Leaderboard opdateres ← SYNKRONT
   ↓
8. "Winner!" popup ← ALLE SER SAMME VINDER
   ↓
9. Ny runde starter automatisk (10 sek)
   ↓
   (tilbage til step 3)
```

---

## 🔧 Troubleshooting

### "Failed to connect to game engine"
**Problem**: Docker server er nede eller ENGINE_URL er forkert

**Fix**:
1. Test Docker URL: `curl https://din-engine-url.com/api/round/state`
2. Skulle returnere JSON med game state
3. Hvis ikke, tjek Docker server logs i Render/Railway dashboard

### "Forskellige tabs viser forskellige ting"
**Problem**: ENGINE_URL er ikke sat i Vercel

**Fix**:
1. Gå til Vercel → Settings → Environment Variables
2. Tjek at ENGINE_URL er der
3. Hvis ja, redeploy projektet

### "Stream opdaterer ikke"
**Problem**: SSE connection fejler

**Fix**:
```bash
# Test stream direkte
curl -N https://din-engine-url.com/api/stream

# Skulle vise SSE events:
: connected
data: {"type":"phase",...}
```

### "Docker container crasher"
**Problem**: Muligvis for høj CPU brug

**Fix i Render/Railway**:
1. Gå til Environment Variables
2. Sæt `FIGHTS_PER_TICK` til `800` (lavere = mindre CPU)
3. Sæt `TICK_INTERVAL_MS` til `20` (højere = mindre CPU)
4. Redeploy

---

## 💰 Costs

- **Render Free**: $0/måned (går i sleep efter 15 min inaktivitet)
- **Render Starter**: $7/måned (altid aktiv, anbefalet)
- **Railway**: ~$5-10/måned (pay-as-you-go)
- **Vercel**: $0/måned (gratis tier er nok)

**Anbefaling**: Start med Render Free for test, upgrade til Starter ($7) for produktion.

---

## 🎉 Success!

Hvis alt ovenstående virker, har du nu:
- ✅ Centraliseret game engine i Docker
- ✅ Alle brugere ser det samme spil
- ✅ Auto-restarter mellem runder
- ✅ Skalerer til 1000+ samtidige brugere

**Send URL'en til dine venner og test det!** 🚀

Detaljeret info: Se [DEPLOYMENT.md](./DEPLOYMENT.md)
Test guide: Se [TEST-SYNC.md](./TEST-SYNC.md)
