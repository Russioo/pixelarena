import requests
from solders.transaction import VersionedTransaction
from solders.keypair import Keypair
from solders.commitment_config import CommitmentLevel
from solders.rpc.requests import SendVersionedTransaction
from solders.rpc.config import RpcSendTransactionConfig
import json
import time
from datetime import datetime
import os
import sys

# ========== CONFIGURATION ==========
PUBLIC_KEY = os.getenv("CLAIMER_PUBLIC_KEY")
PRIVATE_KEY = os.getenv("CLAIMER_SECRET_KEY_BASE58")
RPC_ENDPOINT = os.getenv("SOLANA_RPC_ENDPOINT") or "https://api.mainnet-beta.solana.com"
# ===================================

def get_wallet_balance(public_key):
    """Hent wallet balance i SOL"""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBalance",
        "params": [public_key]
    }
    
    response = requests.post(
        RPC_ENDPOINT,
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload)
    )
    
    result = response.json()
    if 'result' in result:
        lamports = result['result']['value']
        sol = lamports / 1e9
        return sol
    return 0

def claim_creator_fees():
    """Claim creator fees og vis alle details"""
    
    print("\n" + "="*60)
    print("PUMP.FUN CREATOR FEE CLAIMER")
    print("="*60)
    print(f"Tidspunkt: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Wallet: {PUBLIC_KEY[:8]}...{PUBLIC_KEY[-8:]}")
    
    # Tjek balance FOR claim
    print("\nTjekker wallet balance FØR claim...")
    balance_before = get_wallet_balance(PUBLIC_KEY)
    print(f"Balance foer claim: {balance_before:.9f} SOL")
    
    # Claim fees
    print("\nClaimer creator fees...")
    try:
        # Trin 1: Faa transaction fra PumpPortal
        response = requests.post(
            url="https://pumpportal.fun/api/trade-local",
            data={
                "publicKey": PUBLIC_KEY,
                "action": "collectCreatorFee",
                "priorityFee": 0.000001,
            }
        )
        
        if response.status_code != 200:
            print(f"FEJL fra PumpPortal: {response.status_code}")
            print(response.text)
            return
        
        # Trin 2: Signer med private key
        keypair = Keypair.from_base58_string(PRIVATE_KEY)
        tx = VersionedTransaction(
            VersionedTransaction.from_bytes(response.content).message, 
            [keypair]
        )
        
        # Trin 3: Send transaction
        commitment = CommitmentLevel.Confirmed
        config = RpcSendTransactionConfig(preflight_commitment=commitment)
        
        response = requests.post(
            url=RPC_ENDPOINT,
            headers={"Content-Type": "application/json"},
            data=SendVersionedTransaction(tx, config).to_json()
        )
        
        result = response.json()
        
        if 'error' in result:
            print(f"Transaction fejl: {result['error']}")
            return
        
        tx_signature = result.get('result')
        
        if not tx_signature:
            print("Ingen transaction signature modtaget")
            return
        
        print(f"\nSUCCESS! Transaction sendt!")
        print(f"Signature: {tx_signature}")
        print(f"Solscan: https://solscan.io/tx/{tx_signature}")
        
        # Vent paa at transaction bliver confirmed
        print("\nVenter paa confirmation (15 sekunder)...")
        time.sleep(15)
        
        # Tjek balance EFTER claim
        print("\nTjekker wallet balance EFTER claim...")
        balance_after = get_wallet_balance(PUBLIC_KEY)
        
        # Beregn forskellen
        difference = balance_after - balance_before
        
        # Resultat
        print("\n" + "="*60)
        print("CLAIM RESULTAT")
        print("="*60)
        print(f"Balance FOER claim:  {balance_before:.9f} SOL")
        print(f"Balance EFTER claim: {balance_after:.9f} SOL")
        print("-" * 60)
        
        claimed_amount = max(0, difference)
        
        if difference > 0:
            print(f"\nAmount Claimed = {difference:.9f} SOL")
        elif difference < 0:
            print(f"\nAmount Claimed = 0 SOL")
            print(f"(Transaction fee: {abs(difference):.9f} SOL)")
        else:
            print(f"\nAmount Claimed = 0 SOL")
        
        print("="*60 + "\n")
        
        # Output JSON result til stdout for Node.js
        result = {
            "success": True,
            "signature": tx_signature,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "claimed_sol": claimed_amount,
            "claimed_lamports": int(claimed_amount * 1e9)
        }
        print("JSON_RESULT:" + json.dumps(result))
        return result
        
    except Exception as e:
        print(f"\nFEJL: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Output fejl som JSON
        error_result = {
            "success": False,
            "error": str(e)
        }
        print("JSON_RESULT:" + json.dumps(error_result))
        return error_result

if __name__ == "__main__":
    # Tjek at keys er sat
    if not PUBLIC_KEY or not PRIVATE_KEY:
        print("FEJL: Du skal sætte CLAIMER_PUBLIC_KEY og CLAIMER_SECRET_KEY_BASE58 i .env filen!")
    elif not RPC_ENDPOINT:
        print("FEJL: Du skal sætte SOLANA_RPC_ENDPOINT i .env filen!")
    else:
        claim_creator_fees()

