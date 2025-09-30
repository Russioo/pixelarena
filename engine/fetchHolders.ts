import 'dotenv/config'

interface TokenHolder {
  address: string
  balance: number
  percentage: number
  pixels: number
  color: string
  tokenAccounts?: number
}

function calculatePixelsForHolder(percentage: number): number {
  const TOTAL_PIXELS = 2500
  const MIN_PIXELS = 1
  const raw = Math.floor((percentage / 100) * TOTAL_PIXELS)
  return Math.max(MIN_PIXELS, raw)
}

function generatePlayerColor(address: string): string {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  const hue = Math.abs(hash % 360)
  const saturation = 70 + (Math.abs(hash) % 20)
  const lightness = 50 + (Math.abs(hash >> 8) % 15)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function generateDistinctPalette(count: number): string[] {
  const palette: string[] = []
  const goldenRatioConjugate = 0.618033988749895
  let hue = Math.random()
  
  for (let i = 0; i < count; i++) {
    hue = (hue + goldenRatioConjugate) % 1.0
    const saturation = 70 + Math.floor(Math.random() * 20)
    const lightness = 50 + Math.floor(Math.random() * 15)
    palette.push(`hsl(${Math.floor(hue * 360)}, ${saturation}%, ${lightness}%)`)
  }
  
  return palette
}

function getRpcUrl(): string {
  const heliusKey = process.env.HELIUS_API_KEY
  if (heliusKey && heliusKey.trim().length > 0) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
  }
  const rpc = process.env.SOLANA_RPC_URL
  return rpc || 'https://api.mainnet-beta.solana.com'
}

async function fetchRealHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    console.log(`[Holders] Fetching real holders for token: ${tokenAddress}`)
    const rpcUrl = getRpcUrl()
    const tokenProgramId = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

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
            commitment: 'confirmed',
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: tokenAddress } }
            ]
          }
        ]
      })
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data: any = await response.json()
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
    const accounts: ParsedAccount[] = (data as any).result || []
    
    console.log(`[Holders] Found ${accounts.length} token accounts`)
    
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

    console.log(`[Holders] Aggregated to ${mapOwnerToBalance.size} unique holders`)

    const holders: TokenHolder[] = Array.from(mapOwnerToBalance.entries()).map(([owner, balance]) => ({
      address: owner,
      balance,
      percentage: 0,
      pixels: 0,
      color: generatePlayerColor(owner),
      tokenAccounts: mapOwnerToAccountCount.get(owner) || 0
    }))

    const total = holders.reduce((s, h) => s + h.balance, 0)
    holders.forEach(h => {
      h.percentage = total > 0 ? (h.balance / total) * 100 : 0
      h.pixels = calculatePixelsForHolder(h.percentage)
    })

    // Filter out whales
    let filtered = holders.filter(h => h.percentage <= 10 && h.balance < 100_000_000)
    console.log(`[Holders] After whale filter: ${filtered.length} holders`)

    // Recompute percentages
    const remainingTotal = filtered.reduce((s, h) => s + h.balance, 0)
    filtered = filtered.map(h => {
      const pct = remainingTotal > 0 ? (h.balance / remainingTotal) * 100 : 0
      return { ...h, percentage: pct, pixels: calculatePixelsForHolder(pct) }
    })

    // Sort and take top 100
    filtered.sort((a, b) => b.balance - a.balance)
    const top = filtered.slice(0, 100)

    const palette = generateDistinctPalette(top.length)
    for (let i = 0; i < top.length; i++) {
      top[i].color = palette[i]
    }

    console.log(`[Holders] Returning top ${top.length} holders`)
    return top
  } catch (error) {
    console.error('[Holders] Error fetching real holders:', error)
    return []
  }
}

export async function fetchHolders(): Promise<TokenHolder[]> {
  const mintAddress = process.env.MINT_ADDRESS
  
  if (!mintAddress || mintAddress.trim().length === 0) {
    console.error('[Holders] ❌ MINT_ADDRESS er ikke konfigureret! Spillet kan ikke starte.')
    throw new Error('MINT_ADDRESS mangler - tilføj den i .env filen')
  }

  console.log(`[Holders] MINT_ADDRESS configured: ${mintAddress}`)
  const realHolders = await fetchRealHolders(mintAddress)
  
  if (realHolders.length === 0) {
    console.error('[Holders] ❌ Kunne ikke hente holders fra blockchain. Check MINT_ADDRESS og RPC forbindelse.')
    throw new Error('Ingen holders fundet - check MINT_ADDRESS og RPC')
  }
  
  console.log(`[Holders] ✅ Successfully fetched ${realHolders.length} real holders`)
  return realHolders
}
