interface WinnerOverlayProps {
  visible: boolean
  address: string
  fees: number
  color: string
  onRestart?: () => void
}

export default function WinnerOverlay({ visible, address, fees, color, onRestart }: WinnerOverlayProps) {
  if (!visible) return null
  const short = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  return (
    <div className="overlay-backdrop" onClick={onRestart}>
      <div className="overlay-card" style={{ borderColor: color }}>
        <div className="overlay-title">Winner</div>
        <div className="overlay-body">
          <div className="winner-address" style={{ color }}>{short}</div>
          <div className="winner-fees">Fees: {fees.toFixed(4)} SOL</div>
          <div className="overlay-sub">Restarting shortly...</div>
          <button className="btn-primary overlay-btn" onClick={onRestart}><span className="icon" aria-hidden>↻</span> Restart now</button>
        </div>
      </div>
    </div>
  )
}









