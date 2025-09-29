"use client"

import { useEffect, useRef, useMemo } from 'react'
import { Pixel } from '@/types/game'

interface BattlefieldProps {
  pixels: Pixel[]
  leaderColor?: string
}

export default function Battlefield({ pixels, leaderColor }: BattlefieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const width = 800
  const height = 800

  const gridSize = useMemo(() => {
    if (!pixels.length) return { w: 50, h: 50 }
    let maxX = 0
    let maxY = 0
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] && pixels[i].position) {
        if (pixels[i].position.x > maxX) maxX = pixels[i].position.x
        if (pixels[i].position.y > maxY) maxY = pixels[i].position.y
      }
    }
    return { w: maxX + 1, h: maxY + 1 }
  }, [pixels])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellW = width / gridSize.w
    const cellH = height / gridSize.h

    // draw background once
    ctx.clearRect(0, 0, width, height)

    // draw pixels
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i]
      if (!p || !p.position) continue
      ctx.fillStyle = p.color
      const x = Math.floor(p.position.x * cellW)
      const y = Math.floor(p.position.y * cellH)
      ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH))
    }
  }, [pixels, gridSize])

  const style = leaderColor
    ? { boxShadow: `rgba(0, 0, 0, 0.3) 0px 12px 24px, rgba(255, 255, 255, 0.05) 0px 0px 0px 1px, ${leaderColor}55 0px 0px 40px, ${leaderColor}55 0px 0px 30px` }
    : undefined

  return (
    <canvas
      id="battleCanvas"
      ref={canvasRef}
      className="battle-canvas"
      width={width}
      height={height}
      style={style}
    />
  )
}
