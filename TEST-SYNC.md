# 🧪 Test at ALLE ser det samme

Denne guide viser hvordan du verificerer at løsningen virker - alle brugere ser samme "broadcast".

## Test Lokalt med Docker

### Step 1: Start Docker serveren
```bash
docker-compose up
```

Du skulle se:
```
game-engine_1  | Engine listening on :8080
```

### Step 2: Start Vercel frontend (i ny terminal)
```bash
ENGINE_URL=http://localhost:8080 npm run dev
```

### Step 3: Åbn FLERE browsere/tabs
Åbn disse URLs samtidigt:
- `http://localhost:3000` (Chrome)
- `http://localhost:3000` (Firefox) 
- `http://localhost:3000` (Incognito)
- `http://localhost:3000` (Din telefon hvis på samme netværk)

### Step 4: Verificer synkronisering

✅ **Alle skulle se:**
1. **Samme loading screen** → forsvinder samtidigt
2. **Samme "Claiming fee pool" popup** (1 sekund)
3. **Samme "Taking snapshot" popup** (5 sekunder nedtælling - SYNKRONT)
4. **Samme "Round starting" popup** (3 sekunder - SYNKRONT)
5. **Samme pixels fighting** - nøjagtigt samme farver på samme positions
6. **Samme Round Timer** - tæller op synkront
7. **Samme leaderboard** opdateringer
8. **Samme vinder popup** når spillet slutter

### Step 5: Test opdateringer
Refresh EN browser tab - den skulle:
- Vise samme game state som de andre
- Synkronisere med samme round
- Hvis der er en popup aktiv, skulle den samme popup vises

## Test i Produktion (Efter deployment)

### Efter du har deployed:

1. **Deploy Docker til Render/Railway** (Step 1 i README.md)
2. **Tilføj ENGINE_URL til Vercel** (Step 2 i README.md)
3. **Test med venner:**
   - Send din Vercel URL til 3-5 venner
   - Alle åbner samtidigt
   - ALLE skulle se præcis det samme spil
   - Popups vises for ALLE på samme tid
   - Nedtællinger er synkrone

## Debug: Verificer stream forbindelse

### Test Docker stream direkte:
```bash
curl -N http://localhost:8080/api/stream
```

Du skulle se SSE events:
```
: connected

data: {"type":"phase","phase":"claim","endsAt":1234567890}

data: {"type":"snapshot","tick":0,"pixels":[...],...}
```

### Test Vercel proxy:
```bash
curl -N http://localhost:3000/api/stream
```

Skulle give SAMME output som ovenstående.

### Test state endpoint:
```bash
curl http://localhost:8080/api/round/state
```

Response:
```json
{
  "running": true,
  "tick": 42,
  "phase": "running",
  "roundId": 1,
  ...
}
```

## Troubleshooting

### "Jeg ser forskellige ting i forskellige tabs"
❌ Problem: ENGINE_URL er ikke sat korrekt
✅ Fix: 
```bash
# Sørg for ENGINE_URL er sat når du starter Next.js
ENGINE_URL=http://localhost:8080 npm run dev
```

Eller tilføj til `.env.local`:
```
ENGINE_URL=http://localhost:8080
```

### "Stream forbinder ikke"
❌ Problem: Docker server kører ikke
✅ Fix:
```bash
docker-compose up
# Vent til du ser "Engine listening on :8080"
```

### "Popups vises på forskellige tidspunkter"
❌ Problem: Hver client kører sin egen engine (ENGINE_URL ikke sat)
✅ Fix: Se første troubleshooting punkt

## Forventet Oplevelse

Når det virker korrekt:

```
Browser 1:  ┌─────────┐ "Round starting 3..."
Browser 2:  ┌─────────┐ "Round starting 3..."  ← SAMME TID
Browser 3:  ┌─────────┐ "Round starting 3..."

↓ Efter 3 sekunder (SAMTIDIGT)

Browser 1:  [████░░██] Pixel fights
Browser 2:  [████░░██] Samme pixels  ← NØJAGTIGT SAMME
Browser 3:  [████░░██] Samme farver

↓ Efter X tid (SAMTIDIGT)

Browser 1:  🏆 Winner: HOLDER_042
Browser 2:  🏆 Winner: HOLDER_042    ← SAMME VINDER
Browser 3:  🏆 Winner: HOLDER_042
```

## Success Kriterier

✅ Alle browsere viser samme pixels på samme position
✅ Alle popups vises på samme tid
✅ Nedtællinger synkroniserer perfekt (±1 sekund)
✅ Samme vinder vises for alle
✅ Round timer er synkron
✅ Refresh en browser → viser samme state som de andre
✅ Ny bruger joiner → ser samme ongoing game

Hvis ALLE ovenstående er ✅, virker systemet perfekt! 🎉
