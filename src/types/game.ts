export interface Holder {
  address: string
  balance: number
  percentage: number
  pixels: number
  color: string
  tokenAccounts?: number
}

export interface Pixel {
  index: number
  owner: number | null
  position: { x: number; y: number }
  color: string
}

export interface GameState {
  totalPixels: number
  holders: Holder[]
  pixels: Pixel[]
  gameRunning: boolean
  roundStartTime: number | null
  currentRound: number
  feesPool: number
  activePlayersCount: number
  recentWinners: WinnerHistoryEntry[]
}

export interface WinnerHistoryEntry {
  round: number
  address: string
  fees: number
  txSignature: string
  color: string
  pixels: number
}

