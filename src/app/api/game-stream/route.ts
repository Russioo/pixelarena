import { NextRequest } from 'next/server'
import { addClient, getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial snapshot fra engine
      try {
        const s = getCurrentState()
        const initial = { type: 'snapshot', tick: s.tick, startMs: s.startMs, roundId: s.roundId, pixels: s.pixels, holders: s.holders }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`))
      } catch {}

      // Abonner på serverens SSE via gameEngine
      const remove = addClient((chunk) => controller.enqueue(chunk))
      controller.enqueue(encoder.encode('retry: 2000\n\n'))
      return () => { try { remove() } catch {} }
    }
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}
