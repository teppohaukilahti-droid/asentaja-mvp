import { useEffect, useRef } from 'react'
import { Eraser } from 'lucide-react'

export default function SignatureCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = '#1e2a5a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e: React.PointerEvent) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    hasInk.current = true
  }

  function up() {
    if (!drawing.current) return
    drawing.current = false
    if (hasInk.current) onChange(canvasRef.current!.toDataURL('image/png'))
  }

  function clear() {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const rect = c.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    hasInk.current = false
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 160, touchAction: 'none' }}
        className="bg-white rounded-xl border-2 border-dashed border-gray-500"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      />
      <button type="button" onClick={clear} className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
        <Eraser className="w-3.5 h-3.5" /> Tyhjennä allekirjoitus
      </button>
    </div>
  )
}
