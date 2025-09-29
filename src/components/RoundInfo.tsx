interface RoundInfoProps {
  currentRound: number
  feesPool: number
}

export default function RoundInfo({ currentRound, feesPool }: RoundInfoProps) {
  return (
    <div className="round-info game-info">
      <h3 className="section-title"><span className="icon" aria-hidden>▣</span> Round Info</h3>
      <p>Current round: <span>{currentRound}</span></p>
      <p>Fees Pool: <span>{feesPool.toFixed(4)} SOL</span></p>
    </div>
  )
}



