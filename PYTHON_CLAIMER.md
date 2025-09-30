# Python Fee Claimer

Dette projekt bruger et Python-script til at claime creator fees fra Pump.fun.

## Installation

Installer Python dependencies:

```bash
pip install -r requirements.txt
```

## Environment Variables

Sæt følgende i din `.env` eller `.env.local` fil:

```bash
CLAIMER_PUBLIC_KEY=your-wallet-public-key-here
CLAIMER_SECRET_KEY_BASE58=your-wallet-secret-key-base58-here
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
```

## Brug

### Option 1: Manuel kørsel
Kør Python-scriptet direkte:

```bash
python claim_creator_fees.py
```

### Option 2: Via API (Automatisk)
Python-scriptet bliver automatisk kaldt når du bruger claim API endpoint:

```bash
POST /api/claim
```

Game engine kalder automatisk dette endpoint efter hver runde.

## Output

Python-scriptet viser:
- Wallet balance FØR og EFTER claim
- Transaction signature
- Link til Solscan
- Præcis amount claimet i SOL

Eksempel:
```
============================================================
PUMP.FUN CREATOR FEE CLAIMER
============================================================
Tidspunkt: 2025-09-30 15:30:45
Wallet: Fqp8ajMz...A1yejV

Tjekker wallet balance FØR claim...
Balance foer claim: 0.123456789 SOL

Claimer creator fees...

SUCCESS! Transaction sendt!
Signature: 5Kj7x...
Solscan: https://solscan.io/tx/5Kj7x...

============================================================
CLAIM RESULTAT
============================================================
Balance FOER claim:  0.123456789 SOL
Balance EFTER claim: 0.145678901 SOL
------------------------------------------------------------

Amount Claimed = 0.022222112 SOL
============================================================
```

## Dependencies

- `requests` - HTTP requests til PumpPortal og Solana RPC
- `solders` - Solana Python library til transaction signing

## Fejlfinding

Hvis du får fejl:

1. **"FEJL: Du skal sætte CLAIMER_PUBLIC_KEY..."**
   - Tjek at environment variables er sat i `.env`

2. **"Python script exited with code..."**
   - Tjek at Python dependencies er installeret: `pip install -r requirements.txt`
   - Tjek at Python er tilgængelig i PATH

3. **"Transaction fejl"**
   - Tjek at wallet har nok SOL til transaction fees
   - Tjek at der er fees at claime (kræver at nogen har købt din token)

