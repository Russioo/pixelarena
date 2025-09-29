import { WinnerHistoryEntry } from '@/types/game'

interface RecentWinnersProps {
  winners: WinnerHistoryEntry[]
}

const explorerUrl = (sig: string) => `https://solscan.io/tx/${sig}`

export default function RecentWinners({ winners }: RecentWinnersProps) {
  return (
    <div className="recent-winners">
      <h3 className="section-title"><span className="icon" aria-hidden>◇</span> Recent Winners</h3>
      <table className="winners-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Winner</th>
            <th>Fees (SOL)</th>
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          {winners.length === 0 && (
            <tr>
              <td colSpan={4} style={{ opacity: 0.7 }}>No rounds yet</td>
            </tr>
          )}
          {winners.map((w) => {
            const short = `${w.address.substring(0, 6)}...${w.address.substring(w.address.length - 4)}`
            return (
              <tr key={`${w.round}-${w.txSignature}`}>
                <td>#{w.round}</td>
                <td><span className="winner-dot" style={{ background: w.color }} />{short}</td>
                <td>{w.fees.toFixed(4)}</td>
                <td>
                  <a className="tx-link" href={explorerUrl(w.txSignature)} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}



