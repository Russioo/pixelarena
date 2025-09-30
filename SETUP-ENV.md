# 🔧 Environment Variables Setup Guide

Denne guide viser præcis hvilke env vars du skal bruge i forskellige scenarios.

---

## 📋 Quick Reference

| Variabel | Hvor bruges den? | Påkrævet? |
|----------|------------------|-----------|
| `ENGINE_URL` | Vercel + Lokal (hvis Docker) | Vercel: ✅ / Lokal: Valgfri |
| `HELIUS_API_KEY` | Docker/Render (rigtige holders) | ✅ For produktion |
| `MINT_ADDRESS` | Docker/Render (token address) | ✅ For produktion |
| `NEXT_PUBLIC_MINT_ADDRESS` | Frontend (synlig token) | ✅ Alle steder |
| `SOLANA_RPC_URL` | Docker/Render (backup RPC) | Valgfri |
| `PORT` | Docker | Valgfri (default: 8080) |
| `FIGHTS_PER_TICK` | Docker | Valgfri (default: 1200) |
| `TICK_INTERVAL_MS` | Docker | Valgfri (default: 15) |

---

## 🎯 Scenario 1: Lokal Udvikling (Test Mode)

**Brug case**: Udvikle UI, test uden rigtige blockchain data

### `.env.local`:
```bash
# Lad ENGINE_URL være tom eller fjern den helt
# ENGINE_URL=

# Kun denne er påkrævet
NEXT_PUBLIC_MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump
```

### Kør:
```bash
npm run dev
```

### Resultat:
- ⚡ Kører med 100 test-spillere (HOLDER_000, HOLDER_001, etc.)
- ❌ IKKE synkroniseret mellem brugere
- ✅ Hurtigt til UI udvikling

---

## 🐳 Scenario 2: Lokal Docker (Rigtige Holders)

**Brug case**: Test hele stacken lokalt med rigtige data

### Terminal 1 - Start Docker:
```bash
docker-compose up
```

### `.env.local`:
```bash
# Peg på lokal Docker
ENGINE_URL=http://localhost:8080

# Påkrævet for rigtige holders
HELIUS_API_KEY=f6a7a308-bef3-4a31-a38e-6ccd0d82f0de
MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump
NEXT_PUBLIC_MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump

# Valgfri
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PORT=8080
FIGHTS_PER_TICK=1200
TICK_INTERVAL_MS=15
```

### Terminal 2 - Start Next.js:
```bash
npm run dev
```

### Resultat:
- ✅ Rigtige Solana holders
- ✅ Synkroniseret mellem alle browsere
- ✅ Test hele stacken lokalt

---

## 🚀 Scenario 3: Test mod Render Server (Anbefalet!)

**Brug case**: Test produktion setup lokalt

### `.env.local`:
```bash
# Peg på din deployed Render server
ENGINE_URL=https://vibecodingcoin-engine.onrender.com

# Frontend token
NEXT_PUBLIC_MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump
```

### Kør:
```bash
npm run dev
```

### Resultat:
- ✅ Rigtige holders fra Render
- ✅ Synkroniseret globalt
- ✅ Tester præcis produktion setup

---

## 🌐 Scenario 4: Vercel Production

**Brug case**: Live deployment

### Vercel Environment Variables:

Gå til Vercel Dashboard → Settings → Environment Variables

```bash
ENGINE_URL=https://vibecodingcoin-engine.onrender.com
NEXT_PUBLIC_MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump
```

### Resultat:
- ✅ Produktion klar
- ✅ Alle brugere ser det samme
- ✅ Rigtige holders

---

## 🐳 Scenario 5: Render/Railway Docker Server

**Brug case**: Game engine deployment

### Render Environment Variables:

Gå til Render Dashboard → Environment

```bash
HELIUS_API_KEY=f6a7a308-bef3-4a31-a38e-6ccd0d82f0de
MINT_ADDRESS=DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Valgfri performance tuning
PORT=8080
FIGHTS_PER_TICK=1200
TICK_INTERVAL_MS=15
```

### Resultat:
- ✅ Henter top 100 rigtige holders
- ✅ Broadcaster til alle clients
- ✅ Auto-restarter mellem runder

---

## 🔑 Hvor får du værdierne?

### `HELIUS_API_KEY`
1. Gå til https://helius.dev
2. Sign up (gratis tier er nok!)
3. Create new project
4. Kopiér API key

### `MINT_ADDRESS`
- Din Solana token mint address
- Eksempel: `DfPFV3Lt3818H9sHfM2aiuV5zqWM7oztQ8sSbapump`
- Find den på Solscan eller Birdeye

### `ENGINE_URL`
- **Lokal Docker**: `http://localhost:8080`
- **Render**: Kopier fra Render dashboard (f.eks. `https://xxx.onrender.com`)
- **Railway**: Kopier fra Railway dashboard

---

## ⚙️ Performance Tuning

### Docker Engine (Render/Railway):

```bash
# For FREE tier (begrænset CPU)
FIGHTS_PER_TICK=800
TICK_INTERVAL_MS=20

# For STARTER tier ($7/måned)
FIGHTS_PER_TICK=1200
TICK_INTERVAL_MS=15

# For HIGH PERFORMANCE
FIGHTS_PER_TICK=2000
TICK_INTERVAL_MS=10
```

**Højere FIGHTS_PER_TICK** = Hurtigere spil, mere CPU
**Lavere TICK_INTERVAL_MS** = Mere smooth, mere CPU

---

## 🧪 Test Din Setup

### Verificer lokal setup:
```bash
# Start server
npm run dev

# Åbn browser
# Gå til nederste højre hjørne - "System Status"
```

**Du skulle se:**
- 🟢 Game Engine: Active
- 🟢 Real Players: Active (hvis ENGINE_URL + HELIUS set)
- 🟢 Mint Address: Active
- 🟢 RPC Connection: Active

### Test synkronisering:
Åbn `http://localhost:3000` i 3 forskellige tabs/browsere
→ Alle skulle vise **SAMME** pixels og popups!

---

## 📝 Quick Setup

### Step 1: Kopiér env template
```bash
cp env.example .env.local
```

### Step 2: Vælg scenario (se ovenfor)

### Step 3: Udfyld værdier

### Step 4: Start!
```bash
npm run dev
```

---

## ❓ Common Issues

### "Real Players: Offline"
→ HELIUS_API_KEY eller MINT_ADDRESS ikke sat i Docker/Render

### "Game Engine: Offline"  
→ ENGINE_URL forkert eller Docker server er nede

### "Forskellige tabs viser forskelligt"
→ ENGINE_URL ikke sat - hver tab kører sin egen simulation

---

## 📧 Hjælp

Hvis du sidder fast, tjek:
1. Browser console for fejl
2. Docker/Render logs
3. System Status indicator (nederste højre hjørne)

**Alt grønt = alt virker!** ✅
