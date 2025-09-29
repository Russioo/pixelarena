interface GameControlsProps {
  tokenAddress: string
  setTokenAddress: (address: string) => void
  gameRunning: boolean
  onStartGame: () => void
  onPauseGame: () => void
  onResetGame: () => void
}

export default function GameControls({ 
  tokenAddress, 
  setTokenAddress, 
  gameRunning, 
  onStartGame, 
  onPauseGame, 
  onResetGame 
}: GameControlsProps) {
  return (
    <div className="game-controls">
      <button 
        className="btn-primary" 
        onClick={onStartGame}
        disabled={gameRunning}
      >
        <span className="icon" aria-hidden>▶</span> {gameRunning ? 'Game Running' : 'Start Game'}
      </button>
      
      <button 
        className="btn-secondary" 
        onClick={onPauseGame}
        disabled={!gameRunning}
      >
        <span className="icon" aria-hidden>⏸</span> {gameRunning ? 'Pause' : 'Resume'}
      </button>
      
      <button 
        className="btn-danger" 
        onClick={onResetGame}
      >
        <span className="icon" aria-hidden>↺</span> Reset
      </button>
      
      <input
        type="text"
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        placeholder="Enter token address"
        className="token-input"
        disabled={gameRunning}
      />
    </div>
  )
}







