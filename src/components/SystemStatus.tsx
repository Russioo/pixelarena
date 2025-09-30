'use client'

import { useState, useEffect } from 'react'

interface StatusItemProps {
  label: string
  status: boolean | null
  checkingText?: string
}

function StatusItem({ label, status, checkingText = 'Checking...' }: StatusItemProps) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '6px 10px',
      background: '#1a1d24',
      borderRadius: 6,
      marginBottom: 6
    }}>
      <span style={{ fontSize: 12, color: '#9aa1ac', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {status === null ? (
          <>
            <div style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: '#60a5fa',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <span style={{ fontSize: 11, color: '#60a5fa' }}>{checkingText}</span>
          </>
        ) : status ? (
          <>
            <div style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: '#10b981'
            }} />
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Active</span>
          </>
        ) : (
          <>
            <div style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: '#ef4444'
            }} />
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Offline</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function SystemStatus() {
  const [engineStatus, setEngineStatus] = useState<boolean | null>(null)
  const [realPlayers, setRealPlayers] = useState<boolean | null>(null)
  const [mintConfigured, setMintConfigured] = useState<boolean | null>(null)
  const [rpcConfigured, setRpcConfigured] = useState<boolean | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Check game engine status
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/round/state', { cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        
        // Engine status
        setEngineStatus(!!data)
        
        // Real players check (if holders have real Solana addresses vs test HOLDER_000)
        if (data?.holders && Array.isArray(data.holders) && data.holders.length > 0) {
          const firstHolder = data.holders[0]
          const isRealAddress = firstHolder.address && !firstHolder.address.startsWith('HOLDER_')
          setRealPlayers(isRealAddress)
        } else {
          setRealPlayers(false)
        }
        
        // Mint address configured
        const mintAddress = process.env.NEXT_PUBLIC_MINT_ADDRESS
        setMintConfigured(!!(mintAddress && mintAddress.length > 20))
        
        // RPC configured (if we have real players, RPC is likely configured)
        setRpcConfigured(!!(data?.holders && data.holders.length > 0))
        
      } catch (error) {
        setEngineStatus(false)
        setRealPlayers(false)
        setMintConfigured(false)
        setRpcConfigured(false)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30000) // Re-check every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 100,
      background: '#0f1115',
      border: '1px solid #1f2430',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      minWidth: 240,
      maxWidth: 280
    }}>
      {/* Header - Clickable to expand/collapse */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '10px 12px',
          background: '#1a1d24',
          borderBottom: isExpanded ? '1px solid #1f2430' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="#60a5fa" strokeWidth="2" />
            <path d="M12 8v4l3 3" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', letterSpacing: 0.3 }}>
            System Status
          </span>
        </div>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ 
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease'
          }}
        >
          <path d="M6 9l6 6 6-6" stroke="#9aa1ac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Status Items - Expandable */}
      {isExpanded && (
        <div style={{ padding: 10 }}>
          <StatusItem 
            label="Game Engine" 
            status={engineStatus}
            checkingText="Connecting..."
          />
          <StatusItem 
            label="Real Players" 
            status={realPlayers}
            checkingText="Detecting..."
          />
          <StatusItem 
            label="Mint Address" 
            status={mintConfigured}
            checkingText="Checking..."
          />
          <StatusItem 
            label="RPC Connection" 
            status={rpcConfigured}
            checkingText="Testing..."
          />
          
          {/* Summary text */}
          <div style={{ 
            marginTop: 8, 
            padding: '6px 8px', 
            background: '#1a1d24',
            borderRadius: 6,
            fontSize: 10,
            color: '#6b7280',
            textAlign: 'center'
          }}>
            {engineStatus === false ? (
              <span style={{ color: '#ef4444' }}>⚠️ Engine Offline</span>
            ) : engineStatus && realPlayers ? (
              <span style={{ color: '#10b981' }}>✓ Production Mode</span>
            ) : engineStatus && !realPlayers ? (
              <span style={{ color: '#f59e0b' }}>⚡ Test Mode (Mock Data)</span>
            ) : (
              <span>Initializing...</span>
            )}
          </div>
        </div>
      )}

      {/* Pulse animation for loading state */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
