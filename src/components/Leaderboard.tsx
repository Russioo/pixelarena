import { Holder } from '@/types/game'

interface LeaderboardProps {
  holders: Holder[]
}

export default function Leaderboard({ holders }: LeaderboardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1115', color: '#e5e7eb' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1f2430',
        background: '#0f1115',
        position: 'sticky', top: 0, zIndex: 1
      }}>
        <div style={{ fontWeight: 800, color: '#e5e7eb', letterSpacing: 0.3 }}>Top Holders</div>
      </div>

      <div style={{ overflowY: 'auto', padding: '10px 12px', flex: 1 }}>
        {holders.slice(0, 100).map((holder, index) => (
          <div
            key={holder.address}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', border: '1px solid #1f2430', borderRadius: 10,
              marginBottom: 8, background: '#131722',
              willChange: 'transform',
              contain: 'layout paint',
              transition: 'transform 120ms ease, opacity 120ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: holder.color, boxShadow: `0 0 10px ${holder.color}55` }} />
              <div style={{ color: '#e5e7eb', fontWeight: 700, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{index + 1}</div>
              <div style={{ color: '#9aa1ac', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: 0.2 }}>
                {holder.address.substring(0, 6)}…{holder.address.substring(holder.address.length - 6)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div style={{ color: '#e5e7eb', fontWeight: 800, minWidth: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{holder.pixels}px</div>
              <div style={{ color: '#9aa1ac', fontSize: 12, minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{holder.percentage.toFixed(2)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
