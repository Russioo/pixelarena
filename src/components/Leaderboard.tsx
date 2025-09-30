import { Holder } from '@/types/game'

interface LeaderboardProps {
  holders: Holder[]
}

export default function Leaderboard({ holders }: LeaderboardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1115', color: '#e5e7eb' }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #1f2430',
        background: '#0f1115',
        position: 'sticky', top: 0, zIndex: 1
      }}>
        <div style={{ fontWeight: 800, color: '#e5e7eb', letterSpacing: 0.4, fontSize: 15 }}>Top Holders</div>
      </div>

      <div className="custom-scrollbar" style={{ overflowY: 'auto', padding: '12px 14px', flex: 1 }}>
        {holders.slice(0, 100).map((holder, index) => (
          <div
            key={holder.address}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', border: '1px solid #1f2430', borderRadius: 10,
              marginBottom: 8, background: '#131722',
              transition: 'all 120ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: holder.color, boxShadow: `0 0 12px ${holder.color}66` }} />
              <div style={{ color: '#e5e7eb', fontWeight: 700, minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>#{index + 1}</div>
              <div style={{ color: '#9aa1ac', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: 0.2, fontSize: 12 }}>
                {holder.address.substring(0, 6)}…{holder.address.substring(holder.address.length - 4)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div style={{ color: '#e5e7eb', fontWeight: 800, minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{holder.pixels}px</div>
              <div style={{ color: '#6b7280', fontSize: 11, minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{holder.percentage.toFixed(2)}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Scrollbar CSS */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f1115;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f2430;
          border-radius: 10px;
          border: 2px solid #0f1115;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2a2f3d;
        }
      `}</style>
    </div>
  )
}
