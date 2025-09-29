import { NextRequest, NextResponse } from 'next/server'

interface TokenHolder {
  address: string
  balance: number
  percentage: number
  pixels: number
  color: string
}

function generatePlayerColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  const saturation = 70 + (Math.abs(hash) % 30)
  const lightness = 45 + (Math.abs(hash) % 20)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function calculatePixelsForHolder(percentage: number, totalPixels: number = 2500): number {
  const minPixelsPerHolder = 1
  const remainingPixels = totalPixels - (100 * minPixelsPerHolder)
  const extraPixels = Math.floor((percentage / 100) * remainingPixels)
  return minPixelsPerHolder + extraPixels
}

function generateDistinctPalette(count: number): string[] {
  // Generate visually distinct colors by spacing hues and enforcing min RGB distance
  const palette: string[] = []

  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    s /= 100; l /= 100
    const k = (n: number) => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))]
  }
  const dist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
    // Weighted RGB distance (approx. perceptual)
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
    return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db)
  }

  const minDistance = 80 // tune for separation
  const baseSats = [76, 84]
  const baseLights = [48, 60, 40]

  for (let i = 0; i < count; i++) {
    let hue = Math.round((i * 360) / count)
    let sat = baseSats[i % baseSats.length]
    let light = baseLights[i % baseLights.length]

    // Try to avoid near-duplicates by nudging hue if too close
    let attempts = 0
    while (attempts < 12) {
      const [r, g, b] = hslToRgb(hue, sat, light)
      let ok = true
      for (let j = 0; j < palette.length; j++) {
        const match = /hsl\((\d+), (\d+)%?, (\d+)%?\)/.exec(palette[j])
        if (!match) continue
        const [hr, sr, lr] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
        const [rr, gr, br] = hslToRgb(hr, sr, lr)
        if (dist(r, g, b, rr, gr, br) < minDistance) { ok = false; break }
      }
      if (ok) { palette.push(`hsl(${hue}, ${sat}%, ${light}%)`); break }
      hue = (hue + 13) % 360
      attempts++
    }
    if (attempts >= 12) palette.push(`hsl(${hue}, ${sat}%, ${light}%)`)
  }
  return palette
}

function getRpcUrl(): string {
  const heliusKey = process.env.HELIUS_API_KEY
  if (heliusKey && heliusKey.trim().length > 0) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
  }
  const rpc = process.env.SOLANA_RPC_URL
  return rpc && rpc.trim().length > 0 ? rpc : 'https://api.mainnet-beta.solana.com'
}

async function fetchHeliusHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    const rpcUrl = getRpcUrl()
    const tokenProgramId = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

    // Fetch ALL token accounts for the mint using program filter, then aggregate by owner
    // EXACTLY mirroring the Python approach (jsonParsed + dataSize & memcmp on mint at offset 0)
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'holders-request',
        method: 'getProgramAccounts',
        params: [
          tokenProgramId,
          {
            // Keep encoding & filters identical to the Python example
            commitment: 'confirmed',
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: tokenAddress } } // token account layout: mint at offset 0
            ]
          }
        ]
      })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)

    type ParsedAccount = {
      pubkey: string
      account: {
        data: {
          parsed: {
            info: {
              owner: string
              tokenAmount: { uiAmount: number | null }
            }
          }
        }
      }
    }

    const mapOwnerToBalance = new Map<string, number>()
    const mapOwnerToAccountCount = new Map<string, number>()
    const accounts: ParsedAccount[] = data.result || []
    for (const acc of accounts) {
      const info = acc?.account?.data?.parsed?.info
      if (!info) continue
      const owner = info.owner
      const amt = typeof info.tokenAmount?.uiAmount === 'number' ? info.tokenAmount.uiAmount : 0
      if (amt && amt > 0) {
        mapOwnerToBalance.set(owner, (mapOwnerToBalance.get(owner) || 0) + amt)
        mapOwnerToAccountCount.set(owner, (mapOwnerToAccountCount.get(owner) || 0) + 1)
      }
    }

    // Build holder list from aggregated balances
    const holders: TokenHolder[] = Array.from(mapOwnerToBalance.entries()).map(([owner, balance]) => ({
      address: owner,
      balance,
      percentage: 0,
      pixels: 0,
      color: generatePlayerColor(owner),
      tokenAccounts: mapOwnerToAccountCount.get(owner) || 0
    }))

    // Compute percentages from total over all owners captured
    const total = holders.reduce((s, h) => s + h.balance, 0)
    holders.forEach(h => {
      h.percentage = total > 0 ? (h.balance / total) * 100 : 0
      h.pixels = calculatePixelsForHolder(h.percentage)
    })

    // Filter out whales: >10% or >= 100,000,000 tokens
    let filtered = holders.filter(h => h.percentage <= 10 && h.balance < 100_000_000)

    // Recompute percentages and pixels relative to remaining set to keep fairness
    const remainingTotal = filtered.reduce((s, h) => s + h.balance, 0)
    filtered = filtered.map(h => {
      const pct = remainingTotal > 0 ? (h.balance / remainingTotal) * 100 : 0
      return { ...h, percentage: pct, pixels: calculatePixelsForHolder(pct) }
    })

    // Sort and take top 100 of filtered list
    filtered.sort((a, b) => b.balance - a.balance)
    const top = filtered.slice(0, 100)

    // Assign a distinct color palette to avoid similar colors
    const palette = generateDistinctPalette(top.length)
    for (let i = 0; i < top.length; i++) {
      top[i].color = palette[i]
    }
    return top
  } catch (error) {
    console.error('Error fetching holders from RPC:', error)
    return generateMockHolders()
  }
}

function generateMockAddress(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789'
  let address = ''
  for (let i = 0; i < 44; i++) address += chars.charAt(Math.floor(Math.random() * chars.length))
  return address
}

function generateMockHolders(): TokenHolder[] {
  console.log('Genererer mock holder data...')
  const mockHolders: TokenHolder[] = []
  const totalSupply = 1000000000
  for (let i = 0; i < 100; i++) {
    const baseBalance = Math.pow(0.95, i) * (totalSupply * 0.1)
    const randomFactor = 0.8 + Math.random() * 0.4
    const balance = baseBalance * randomFactor
    const holder: TokenHolder = {
      address: generateMockAddress(),
      balance,
      percentage: (balance / totalSupply) * 100,
      pixels: 0,
      color: generatePlayerColor(`holder_${i}`)
    }
    holder.pixels = calculatePixelsForHolder(holder.percentage)
    mockHolders.push(holder)
  }
  return mockHolders.sort((a, b) => b.balance - a.balance)
}

export async function POST(request: NextRequest) {
  try {
    let tokenAddress: string | undefined
    try {
      const body = await request.json()
      tokenAddress = body?.tokenAddress
    } catch (_) {
      tokenAddress = undefined
    }

    // Default to env-provided mint if none supplied by client
    if (!tokenAddress || tokenAddress.trim().length === 0) {
      tokenAddress = process.env.MINT_ADDRESS || process.env.NEXT_PUBLIC_MINT_ADDRESS
    }
    if (!tokenAddress || tokenAddress.trim().length === 0) {
      return NextResponse.json({ error: 'Token address is required (set MINT_ADDRESS in env or pass in body)' }, { status: 400 })
    }

    const holders = await fetchHeliusHolders(tokenAddress)
    return NextResponse.json({ success: true, holders, count: holders.length })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


