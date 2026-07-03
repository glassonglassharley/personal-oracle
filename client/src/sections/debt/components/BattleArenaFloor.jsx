import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const BattleArenaFloor = forwardRef((_, ref) => {
  const canvasRef = useRef(null)
  const stateRef = useRef({ pulse: 0, pulseColor: [0, 245, 255], t: 0 })

  useImperativeHandle(ref, () => ({
    pulse(color = 'cyan') {
      stateRef.current.pulse = 1.0
      stateRef.current.pulseColor = color === 'red' ? [255, 0, 60] : color === 'gold' ? [201, 168, 76] : [0, 245, 255]
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function draw(timestamp) {
      const s = stateRef.current
      s.t = timestamp
      if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - 0.016)

      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const vpX = W / 2
      const vpY = H * 0.55  // lower vanishing point — floor perspective

      const [pr, pg, pb] = s.pulseColor
      const baseA = 0.07 + s.pulse * 0.18
      const baseColor = s.pulse > 0.1
        ? `rgba(${pr},${pg},${pb},`
        : 'rgba(0,245,255,'

      // Radial lines from VP to bottom edge
      const numR = 26
      for (let i = 0; i <= numR; i++) {
        const x = (i / numR) * W
        const wave = Math.sin(timestamp * 0.0008 + i * 0.4) * 0.015
        ctx.strokeStyle = baseColor + (baseA + wave) + ')'
        ctx.lineWidth = i === 0 || i === numR ? 1.5 : 0.8
        ctx.beginPath()
        ctx.moveTo(vpX, vpY)
        ctx.lineTo(x, H)
        ctx.stroke()
      }

      // Horizontal perspective lines — floor grid
      const numH = 16
      for (let i = 1; i <= numH; i++) {
        const t = i / numH
        const y = vpY + (H - vpY) * t
        const lx = vpX + (0 - vpX) * t
        const rx = vpX + (W - vpX) * t

        const intensity = t * 0.22 + 0.018 + s.pulse * 0.25 * t
        ctx.strokeStyle = baseColor + intensity + ')'
        ctx.lineWidth = t > 0.85 ? 1.5 : t > 0.6 ? 1 : 0.7
        ctx.beginPath()
        ctx.moveTo(lx, y)
        ctx.lineTo(rx, y)
        ctx.stroke()
      }

      // Ceiling/top fade lines (very faint — Arc Raiders atmosphere)
      const numT = 8
      for (let i = 0; i <= numT; i++) {
        const x = (i / numT) * W
        ctx.strokeStyle = `rgba(0,245,255,${0.02 + s.pulse * 0.03})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(vpX, vpY)
        ctx.lineTo(x, 0)
        ctx.stroke()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="battle-arena-canvas" />
})

BattleArenaFloor.displayName = 'BattleArenaFloor'
export default BattleArenaFloor
