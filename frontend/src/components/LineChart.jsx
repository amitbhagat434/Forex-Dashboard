import { useEffect, useRef, useState } from 'react'

// series: [{ values: number|null[], color, dashed }]   labels: [[index, text], ...]
export default function LineChart({ series, labels = [], dot, height = 220, decimals = 1, label }) {
  const box = useRef(null)
  const [W, setW] = useState(600)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const L = 58, R = 18, T = 12, B = 28, H = height
  const n = Math.max(...series.map((s) => s.values.length))
  const all = series.flatMap((s) => s.values).filter((v) => v != null)
  const mn = Math.min(...all), mx = Math.max(...all)
  const pad = (mx - mn) * 0.08 || 1
  const lo = mn - pad, hi = mx + pad
  const X = (i) => L + (i * (W - L - R)) / Math.max(n - 1, 1)
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B)
  const fmt = (v) => v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  return (
    <div ref={box} style={{ width: '100%' }}>
      <svg width={W} height={H} role="img" aria-label={label} style={{ display: 'block' }}>
        {[0, 1, 2, 3].map((k) => {
          const v = hi - (k * (hi - lo)) / 3
          return (
            <g key={k}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" />
              <text x={L - 8} y={Y(v) + 4} fontSize="11" fill="var(--mut)" textAnchor="end">{fmt(v)}</text>
            </g>
          )
        })}
        {series.map((s, k) => (
          <polyline key={k} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.dashed ? '4 4' : undefined}
            points={s.values.map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`)).filter(Boolean).join(' ')} />
        ))}
        {dot && <circle cx={X(dot.index)} cy={Y(series[0].values[dot.index])} r="4" fill={dot.color} stroke="var(--card)" strokeWidth="2" />}
        {labels.map(([i, t]) => (
          <text key={i} x={X(i)} y={H - 8} fontSize="11" fill="var(--mut)" textAnchor={i === 0 ? 'start' : 'end'}>{t}</text>
        ))}
      </svg>
    </div>
  )
}