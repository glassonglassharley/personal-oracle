import { useEffect, useRef } from 'react'

const COLORS = ['#ff003c', '#c9a84c', '#ffffff', '#ff6680', '#ffd700']

export default function Confetti() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')

    const particles = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.3,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 8 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotVel: (Math.random() - 0.5) * 0.15,
      alpha: 1,
    }))

    let animId
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let anyAlive = false

      particles.forEach(p => {
        if (p.alpha <= 0) return
        anyAlive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.rotation += p.rotVel
        if (p.y > canvas.height * 0.7) p.alpha -= 0.02
        if (p.alpha < 0) p.alpha = 0

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 4
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      })

      if (anyAlive) animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas ref={ref} className="confetti-canvas" />
}
