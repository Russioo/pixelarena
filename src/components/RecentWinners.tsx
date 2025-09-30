import { WinnerHistoryEntry } from '@/types/game'

interface RecentWinnersProps {
  winners: WinnerHistoryEntry[]
}

const explorerUrl = (sig: string) => `https://solscan.io/tx/${sig}`

export default function RecentWinners({ winners }: RecentWinnersProps) {
  return (
    <div className="recent-winners-container">
      <div className="recent-winners-header">
        <div className="header-title">Recent Winners</div>
      </div>

      <div className="winners-scroll">
        {winners.length === 0 ? (
          <div className="no-winners">
            <div className="no-winners-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="no-winners-text">No winners yet</div>
          </div>
        ) : (
          winners.slice(0, 10).map((w) => {
            const short = `${w.address.substring(0, 6)}...${w.address.substring(w.address.length - 4)}`
            const payoutSOL = (w.fees * 0.3).toFixed(4) // 30% payout
            
            return (
              <div key={`${w.round}-${w.txSignature}`} className="winner-card">
                <div className="winner-card-header">
                  <div className="winner-round">Round #{w.round}</div>
                  <div 
                    className="winner-color-dot" 
                    style={{ background: w.color, boxShadow: `0 0 12px ${w.color}66` }}
                  />
                </div>
                
                <div className="winner-address">{short}</div>
                
                <div className="winner-amount">
                  <div className="amount-label">Won</div>
                  <div className="amount-value">{payoutSOL} SOL</div>
                </div>
                
                <a 
                  href={explorerUrl(w.txSignature)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="winner-tx-link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  View TX
                </a>
              </div>
            )
          })
        )}
      </div>

      <style jsx>{`
        .recent-winners-container {
          background: #0f1115;
          border: 1px solid #1f2430;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .recent-winners-header {
          padding: 14px 18px;
          border-bottom: 1px solid #1f2430;
          background: #0f1115;
        }

        .header-title {
          font-weight: 800;
          color: #e5e7eb;
          letter-spacing: 0.4px;
          font-size: 15px;
        }

        .winners-scroll {
          display: flex;
          gap: 12px;
          padding: 16px;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .winners-scroll::-webkit-scrollbar {
          height: 8px;
        }

        .winners-scroll::-webkit-scrollbar-track {
          background: #0f1115;
          border-radius: 10px;
        }

        .winners-scroll::-webkit-scrollbar-thumb {
          background: #1f2430;
          border-radius: 10px;
        }

        .winners-scroll::-webkit-scrollbar-thumb:hover {
          background: #2a2f3d;
        }

        .no-winners {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          width: 100%;
          color: #6b7280;
        }

        .no-winners-icon {
          margin-bottom: 8px;
          opacity: 0.5;
        }

        .no-winners-text {
          font-size: 14px;
        }

        .winner-card {
          background: #131722;
          border: 1px solid #1f2430;
          border-radius: 12px;
          padding: 14px;
          min-width: 220px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 150ms ease;
        }

        .winner-card:hover {
          border-color: #2a2f3d;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .winner-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .winner-round {
          font-size: 12px;
          font-weight: 700;
          color: #9aa1ac;
          font-variant-numeric: tabular-nums;
        }

        .winner-color-dot {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .winner-address {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 13px;
          color: #e5e7eb;
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        .winner-amount {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .amount-label {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .amount-value {
          font-size: 16px;
          font-weight: 800;
          color: #10b981;
          font-variant-numeric: tabular-nums;
        }

        .winner-tx-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #1f2430;
          border: 1px solid #2a2f3d;
          border-radius: 8px;
          color: #60a5fa;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          transition: all 120ms ease;
        }

        .winner-tx-link:hover {
          background: #2a2f3d;
          border-color: #60a5fa;
          color: #93c5fd;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .winners-scroll {
            padding: 12px;
            gap: 10px;
          }

          .winner-card {
            min-width: 200px;
            padding: 12px;
          }

          .winner-round {
            font-size: 11px;
          }

          .winner-address {
            font-size: 12px;
          }

          .amount-value {
            font-size: 15px;
          }
        }

        @media (max-width: 480px) {
          .recent-winners-header {
            padding: 12px 14px;
          }

          .header-title {
            font-size: 14px;
          }

          .winners-scroll {
            padding: 10px;
            gap: 8px;
          }

          .winner-card {
            min-width: 180px;
            padding: 10px;
            gap: 8px;
          }

          .winner-color-dot {
            width: 10px;
            height: 10px;
          }

          .amount-value {
            font-size: 14px;
          }

          .winner-tx-link {
            font-size: 11px;
            padding: 5px 8px;
          }
        }
      `}</style>
    </div>
  )
}



