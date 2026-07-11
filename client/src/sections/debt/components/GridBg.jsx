import { useEffect, useRef } from 'react'

export default function GridBg() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function draw() {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const vpX = W / 2
      const vpY = H * 0.28

      const styles = getComputedStyle(canvas)
      ctx.strokeStyle = styles.getPropertyValue('--grid-line').trim() || 'rgba(255, 0, 60, 0.07)'
      ctx.lineWidth = 1

      // Radial lines from vanishing point to bottom edge
      const numRadial = 22
      for (let i = 0; i <= numRadial; i++) {
        const x = (i / numRadial) * W
        ctx.beginPath()
        ctx.moveTo(vpX, vpY)
        ctx.lineTo(x, H)
        ctx.stroke()
      }

      // Horizontal grid lines that follow the perspective
      const numH = 18
      for (let i = 1; i <= numH; i++) {
        const t = i / numH
        const y = vpY + (H - vpY) * t
        const lx = vpX + (0 - vpX) * t
        const rx = vpX + (W - vpX) * t

        ctx.globalAlpha = t * 0.25 + 0.02
        ctx.beginPath()
        ctx.moveTo(lx, y)
        ctx.lineTo(rx, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      draw()
    }

    resize()
    window.addEventListener('resize', resize)
    const observer = new MutationObserver(draw)
    observer.observe(canvas.closest('.debt-app') || document.body, { attributes: true, attributeFilter: ['class'] })
    return () => {
      window.removeEventListener('resize', resize)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="grid-canvas" />
}
