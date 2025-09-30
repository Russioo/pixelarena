import { NextResponse } from 'next/server'
import { Connection, Keypair, PublicKey, VersionedTransaction, SystemProgram, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
import axios from 'axios'
import { getLatestPendingWinner, updateWinnerPayout } from '@/lib/supabase'
import { spawn } from 'child_process'
import * as path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper function til at køre Python script
async function runPythonClaim(): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'claim_creator_fees.py')
    // Brug python3 (Alpine Linux) eller python (Windows)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    const python = spawn(pythonCmd, [pythonScript])
    
    let stdout = ''
    let stderr = ''
    
    python.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('[Python]', output)
      stdout += output
    })
    
    python.stderr.on('data', (data) => {
      const error = data.toString()
      console.error('[Python Error]', error)
      stderr += error
    })
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`))
        return
      }
      
      // Parse JSON result fra Python output
      const jsonMatch = stdout.match(/JSON_RESULT:(.+)/)
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[1])
          resolve(result)
        } catch (e) {
          reject(new Error('Failed to parse Python JSON output'))
        }
      } else {
        reject(new Error('No JSON result found in Python output'))
      }
    })
  })
}

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
    console.log('[Claim] BRUGER PYTHON SCRIPT TIL AT CLAIME FEES')
    console.log('[Claim] ============================================================')

    // Kør Python claim script
    const pythonResult = await runPythonClaim()
    
    if (!pythonResult.success) {
      return NextResponse.json({ error: pythonResult.error }, { status: 500 })
    }

    const connection = new Connection(rpc, 'confirmed')
    const pubkey = new PublicKey(pubStr)
    const keypair = Keypair.fromSecretKey(bs58.decode(secStr))
    
    const signature = pythonResult.signature
    const diffLamports = pythonResult.claimed_lamports

    // Python scriptet har allerede claimet fees!
    console.log('[Claim] ✅ Python script har claimet:', pythonResult.claimed_sol, 'SOL')
    console.log('[Claim] Signature:', signature)
    console.log('[Claim] Solscan:', `https://solscan.io/tx/${signature}`)
    
    const payoutLamports = Math.floor(diffLamports * 1.0) // 100% til vinder - hele fee poolen

    // Hent den seneste pending vinder fra databasen
    const winner = await getLatestPendingWinner()
    
    let payoutSignature: string | null = null
    let actualPayoutSent = 0 // Track faktisk sendte payout
    
    if (winner && payoutLamports > 0) {
      console.log(`[Claim] Sender ${payoutLamports / 1e9} SOL (100% af ${diffLamports / 1e9} SOL) til vinder: ${winner.address}`)
      
      try {
        // Tjek at der er nok balance til payout + transaction fee (~0.000005 SOL)
        const currentBalance = await connection.getBalance(pubkey, 'confirmed')
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


