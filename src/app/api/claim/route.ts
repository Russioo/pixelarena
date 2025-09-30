import { NextResponse } from 'next/server'
import { Connection, Keypair, PublicKey, VersionedTransaction, SystemProgram, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
import axios from 'axios'
import { getLatestPendingWinner, updateWinnerPayout } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const rpc = process.env.SOLANA_RPC_ENDPOINT || process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
    const portal = process.env.PUMPPORTAL_URL || 'https://pumpportal.fun/api/trade-local'
    // Understøt både vores navne og dine Python-navne
    const pubStr = process.env.CLAIMER_PUBLIC_KEY || process.env.PUBLIC_KEY
    const secStr = process.env.CLAIMER_SECRET_KEY_BASE58 || process.env.PRIVATE_KEY

    if (!pubStr || !secStr) {
      return NextResponse.json({ error: 'missing env: set CLAIMER_PUBLIC_KEY/CLAIMER_SECRET_KEY_BASE58 or PUBLIC_KEY/PRIVATE_KEY in .env.local' }, { status: 500 })
    }

    console.log('[Claim] ============================================================')
    console.log('[Claim] PUMP.FUN CREATOR FEE CLAIMER')
    console.log('[Claim] ============================================================')
    console.log('[Claim] Wallet:', `${pubStr.substring(0, 8)}...${pubStr.substring(pubStr.length - 8)}`)

    const connection = new Connection(rpc, 'confirmed')
    const pubkey = new PublicKey(pubStr)
    const keypair = Keypair.fromSecretKey(bs58.decode(secStr))

    // Helper: robust getBalance med fallback til JSON-RPC hvis web3 fetch fejler
    const robustGetBalance = async (account: PublicKey): Promise<number> => {
      try {
        return await connection.getBalance(account, 'confirmed')
      } catch (err) {
        try {
          const payload = { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [account.toBase58(), { commitment: 'confirmed' }] }
          const { data } = await axios.post(rpc, payload, { timeout: 10000, headers: { 'Content-Type': 'application/json' } })
          if (data && data.result && typeof data.result.value === 'number') return data.result.value
          throw new Error('RPC getBalance (axios) invalid response')
        } catch (inner) {
          // Sidste forsøg: processed commitment
          try {
            const payload2 = { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [account.toBase58(), { commitment: 'processed' }] }
            const { data: data2 } = await axios.post(rpc, payload2, { timeout: 10000, headers: { 'Content-Type': 'application/json' } })
            if (data2 && data2.result && typeof data2.result.value === 'number') return data2.result.value
          } catch {}
          throw new Error(`failed to get balance of account ${account.toBase58()}: ${String((inner as Error)?.message || inner)}`)
        }
      }
    }

    // Tjek balance FØR claim
    console.log('[Claim] Tjekker wallet balance FØR claim...')
    const beforeLamports = await robustGetBalance(pubkey)
    console.log('[Claim] Balance foer claim:', (beforeLamports / 1e9).toFixed(9), 'SOL')

    // Claim fees
    console.log('[Claim] Claimer creator fees...')
    
    // Hent prebuildet tx fra PumpPortal (samme som Python script)
    console.log('[Claim] Anmoder om collect transaction fra PumpPortal...')
    const form = new URLSearchParams()
    form.set('publicKey', pubkey.toBase58())
    form.set('action', 'collectCreatorFee')
    form.set('priorityFee', '0.000001')

    const resp = await fetch(portal, {
      method: 'POST',
      body: form
    })

    console.log('[Claim] PumpPortal response status:', resp.status)
    
    // Hvis fejl response (ikke 200), tjek om det er pga. ingen fees
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '')
      console.log('[Claim] ⚠️ PumpPortal fejl response:', errorText)
      
      // Parse JSON fejl hvis muligt
      let errorObj: any = null
      try {
        errorObj = JSON.parse(errorText)
      } catch {}
      
      // Tjek for "no fees to claim" typer fejl
      const errorStr = errorText.toLowerCase()
      if (errorStr.includes('simulation failed') || 
          errorStr.includes('insufficient funds') ||
          errorStr.includes('no fees') ||
          (errorObj && errorObj.error && errorObj.error.toLowerCase().includes('simulation'))) {
        console.log('[Claim] Ingen fees at claime endnu - returnerer 0')
        return NextResponse.json({
          signature: null,
          claimedLamports: 0,
          payoutLamports: 0,
          claimedSOL: 0,
          payoutSOL: 0,
          payoutSignature: null,
          winnerAddress: null,
          message: 'No creator fees available to claim'
        })
      }
      
      return NextResponse.json({ error: `PumpPortal error ${resp.status}`, details: errorText }, { status: 500 })
    }

    // Parse transaction bytes (samme som Python: response.content)
    console.log('[Claim] Parsing transaction bytes...')
    const ab = await resp.arrayBuffer()
    const buf = Buffer.from(ab)

    // Deserialize og sign (PRÆCIS som Python script)
    const tx = VersionedTransaction.deserialize(buf)
    tx.sign([keypair])

    // Send transaction PRÆCIST som Python script - via ren JSON RPC
    console.log('[Claim] Sender transaction til Solana...')
    
    // Serialize til base64 (præcis som Python)
    const serializedTx = Buffer.from(tx.serialize()).toString('base64')
    
    // JSON RPC request (præcis som Python: SendVersionedTransaction)
    const sendPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [
        serializedTx,
        {
          encoding: 'base64',
          preflightCommitment: 'confirmed'
        }
      ]
    }
    
    const sendResponse = await axios.post(rpc, sendPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    })
    
    // Tjek for fejl (præcis som Python)
    if (sendResponse.data.error) {
      console.error('[Claim] Transaction fejl:', JSON.stringify(sendResponse.data.error))
      throw new Error(`Transaction fejl: ${JSON.stringify(sendResponse.data.error)}`)
    }
    
    const signature = sendResponse.data.result
    if (!signature) {
      throw new Error('Ingen transaction signature modtaget')
    }
    
    console.log('[Claim] SUCCESS! Transaction sendt!')
    console.log('[Claim] Signature:', signature)
    console.log('[Claim] Solscan:', `https://solscan.io/tx/${signature}`)
    
    // Vent på confirmation
    console.log('[Claim] Venter på confirmation...')
    await connection.confirmTransaction(signature, 'confirmed')
    console.log('[Claim] ✅ Transaction confirmed!')
    
    // Vent præcis 15 sekunder som Python scriptet for balance opdatering
    console.log('[Claim] Venter 15 sekunder på balance opdatering...')
    await new Promise(r => setTimeout(r, 15000))
    
    // Tjek balance efter claim
    console.log('[Claim] Tjekker wallet balance EFTER claim...')
    const afterLamports = await robustGetBalance(pubkey)
    const diffLamports = Math.max(0, afterLamports - beforeLamports)
    
    // Output som Python scriptet
    console.log('[Claim] ============================================================')
    console.log('[Claim] CLAIM RESULTAT')
    console.log('[Claim] ============================================================')
    console.log('[Claim] Balance FOER claim: ', (beforeLamports / 1e9).toFixed(9), 'SOL')
    console.log('[Claim] Balance EFTER claim:', (afterLamports / 1e9).toFixed(9), 'SOL')
    console.log('[Claim] ------------------------------------------------------------')
    if (diffLamports > 0) {
      console.log('[Claim] Amount Claimed =', (diffLamports / 1e9).toFixed(9), 'SOL')
    } else {
      console.log('[Claim] Amount Claimed = 0 SOL')
    }
    console.log('[Claim] ============================================================')
    const payoutLamports = Math.floor(diffLamports * 0.3) // 30% til vinder

    // Hent den seneste pending vinder fra databasen
    const winner = await getLatestPendingWinner()
    
    let payoutSignature: string | null = null
    let actualPayoutSent = 0 // Track faktisk sendte payout
    
    if (winner && payoutLamports > 0) {
      console.log(`[Claim] Sender ${payoutLamports / 1e9} SOL (30% af ${diffLamports / 1e9} SOL) til vinder: ${winner.address}`)
      
      try {
        // Tjek at der er nok balance til payout + transaction fee (~0.000005 SOL)
        const currentBalance = await robustGetBalance(pubkey)
        const txFeeReserve = 10000 // ~0.00001 SOL reserve til transaction fee
        const maxPayoutPossible = Math.max(0, currentBalance - txFeeReserve)
        
        if (payoutLamports > maxPayoutPossible) {
          console.log(`[Claim] ⚠️ Ikke nok balance til fuld payout. Balance: ${currentBalance / 1e9} SOL, Ønsket payout: ${payoutLamports / 1e9} SOL`)
          console.log(`[Claim] Reducerer payout til ${maxPayoutPossible / 1e9} SOL for at dække transaction fee`)
        }
        
        const actualPayoutLamports = Math.min(payoutLamports, maxPayoutPossible)
        
        if (actualPayoutLamports <= 0) {
          console.log(`[Claim] ⚠️ Ikke nok balance til at sende payout (balance: ${currentBalance / 1e9} SOL). Springer payout over.`)
          return NextResponse.json({
            signature,
            claimedLamports: diffLamports,
            payoutLamports: 0,
            claimedSOL: diffLamports / 1e9,
            payoutSOL: 0,
            payoutSignature: null,
            winnerAddress: winner?.address || null,
            message: 'Claim successful but insufficient balance for payout'
          })
        }
        
        // Send 30% af det claimede beløb til vinderen
        const recipientPubkey = new PublicKey(winner.address)
        
        // Hent recent blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed')
        
        // Lav transfer instruction
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: recipientPubkey,
          lamports: actualPayoutLamports
        })
        
        // Lav transaction
        const transaction = new Transaction().add(transferInstruction)
        transaction.recentBlockhash = blockhash
        transaction.feePayer = keypair.publicKey
        
        // Signer transaction
        transaction.sign(keypair)
        
        // Send transaction
        payoutSignature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        })
        
        // Vent på confirmation
        await connection.confirmTransaction(payoutSignature, 'confirmed')
        
        console.log(`[Claim] ✅ Payout sendt! Signature: ${payoutSignature}`)
        console.log(`[Claim] Sendt ${actualPayoutLamports / 1e9} SOL til vinder`)
        
        // Opdater database med fees og tx signature
        await updateWinnerPayout(winner.id!, actualPayoutLamports / 1e9, payoutSignature)
        
        // Track faktisk sendte beløb
        actualPayoutSent = actualPayoutLamports
        
      } catch (payoutError: any) {
        console.error('[Claim] ❌ Fejl ved payout til vinder:', payoutError)
        // Fortsæt selvom payout fejler - claimen var succesfuld
      }
    } else {
      if (!winner) {
        console.log('[Claim] Ingen pending vinder fundet - skipper payout')
      } else if (payoutLamports === 0) {
        console.log('[Claim] Ingen fees claimet - skipper payout')
      }
    }

    return NextResponse.json({
      signature,
      claimedLamports: diffLamports,
      payoutLamports: actualPayoutSent,
      claimedSOL: diffLamports / 1e9,
      payoutSOL: actualPayoutSent / 1e9,
      payoutSignature,
      winnerAddress: winner?.address || null
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'claim failed' }, { status: 500 })
  }
}


