interface GameStatsProps {
  totalPixels: number
  activePlayersCount: number
  roundTimer: string
}

export default function GameStats({ totalPixels, activePlayersCount, roundTimer }: GameStatsProps) {
  return (
    <div className="stats">
      <div className="stat">
        <span className="label">Total Pixels</span>
        <span className="value">{totalPixels}</span>
      </div>
      <div className="stat">
        <span className="label">Active Players</span>
        <span className="value">{activePlayersCount}</span>
      </div>
      <div className="stat">
        <span className="label">Round Time</span>
        <span className="value">{roundTimer}</span>
      </div>
    </div>
  )
}







