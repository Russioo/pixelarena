import { NextResponse } from 'next/server'
import { isRunning, setOnWinner, startServerFlow, getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let initialized = false

async function autostartIfNeeded() {
  if (!initialized) {
    initialized = true
    // Auto-start ny runde når den forrige slutter
    setOnWinner(() => {
      try {
        // Start fuldt serverstyret flow igen
        startServerFlow()
      } catch {}
    })
  }
  const s = getCurrentState()
  // Start kun hvis vi er i idle (dvs. intet flow kører)
  if (!isRunning() && s.phase === 'idle') startServerFlow()
}

function defaultHolders() {
  // Minimal mock hvis ingen rigtige holders gives: 100 spillere med 25 pixels hver
  const total = 100
  const base = 25
  return Array.from({ length: total }, (_, i) => ({
    address: `HOLDER_${i.toString().padStart(3,'0')}`,
    balance: 1,
    percentage: 1,
    pixels: base,
    color: `hsl(${Math.round((i * 360) / total)}, 80%, 50%)`
  }))
}

export async function GET() {
  try {
    await autostartIfNeeded()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to ensure round' }, { status: 500 })
  }
}


