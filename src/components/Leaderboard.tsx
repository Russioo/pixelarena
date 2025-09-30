import { Holder } from '@/types/game'

interface LeaderboardProps {
  holders: Holder[]
}

export default function Leaderboard({ holders }: LeaderboardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1115', color: '#e5e7eb' }}>
      <div className="leaderboard-header">
        <div style={{ fontWeight: 800, color: '#e5e7eb', letterSpacing: 0.4, fontSize: 15 }}>Leaderboard</div>
      </div>

      <div className="custom-scrollbar leaderboard-scroll">
        {holders.slice(0, 100).map((holder, index) => (
          <div key={holder.address} className="holder-item">
            <div className="holder-left">
              <div className="holder-color" style={{ background: holder.color, boxShadow: `0 0 12px ${holder.color}66` }} />
              <div className="holder-rank">#{index + 1}</div>
              <div className="holder-address">
                {holder.address.substring(0, 6)}…{holder.address.substring(holder.address.length - 4)}
              </div>
            </div>
            <div className="holder-right">
              <div className="holder-pixels">{holder.pixels}px</div>
              <div className="holder-percentage">{holder.percentage.toFixed(2)}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Scrollbar CSS */}
      <style jsx>{`
        .leaderboard-header {
          padding: 14px 18px;
          border-bottom: 1px solid #1f2430;
          background: #0f1115;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .leaderboard-scroll {
          overflow-y: auto;
          padding: 12px 14px;
          flex: 1;
        }

        .holder-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border: 1px solid #1f2430;
          border-radius: 10px;
          margin-bottom: 8px;
          background: #131722;
          transition: all 120ms ease;
        }

        .holder-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .holder-color {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .holder-rank {
          color: #e5e7eb;
          font-weight: 700;
          min-width: 32px;
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-size: 13px;
        }

        .holder-address {
          color: #9aa1ac;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.2px;
          font-size: 12px;
        }

        .holder-right {
          display: flex;
          align-items: baseline;
          gap: 14px;
        }

        .holder-pixels {
          color: #e5e7eb;
          font-weight: 800;
          min-width: 56px;
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-size: 14px;
        }

        .holder-percentage {
          color: #6b7280;
          font-size: 11px;
          min-width: 52px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

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

        /* Responsive Styles */
        @media (max-width: 768px) {
          .leaderboard-header {
            padding: 12px 14px;
          }

          .leaderboard-scroll {
            padding: 10px 12px;
          }

          .holder-item {
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 6px;
          }

          .holder-left {
            gap: 10px;
          }

          .holder-rank {
            min-width: 28px;
            font-size: 12px;
          }

          .holder-address {
            font-size: 11px;
          }

          .holder-right {
            gap: 10px;
          }

          .holder-pixels {
            min-width: 48px;
            font-size: 13px;
          }

          .holder-percentage {
            min-width: 46px;
            font-size: 10px;
          }
        }

        @media (max-width: 480px) {
          .leaderboard-header {
            padding: 10px 12px;
          }

          .leaderboard-scroll {
            padding: 8px 10px;
          }

          .holder-item {
            padding: 8px 10px;
          }

          .holder-left {
            gap: 8px;
          }

          .holder-color {
            width: 8px;
            height: 8px;
          }

          .holder-rank {
            min-width: 24px;
            font-size: 11px;
          }

          .holder-address {
            font-size: 10px;
          }

          .holder-right {
            gap: 8px;
          }

          .holder-pixels {
            min-width: 42px;
            font-size: 12px;
          }

          .holder-percentage {
            min-width: 40px;
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  )
}
