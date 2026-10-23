import { useCallback, useEffect, useState } from 'react'
import { getDashboard } from './api.js'
import Signals from './pages/Signals.jsx'
import Remittances from './pages/Remittances.jsx'
import Performance from './pages/Performance.jsx'
import Triggers from './pages/Triggers.jsx'

const PAGES = { Signals, Remittances, Performance, 'Market triggers': Triggers }

export default function App() {
  const [page, setPage] = useState('Signals')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (refresh = false) => {
    setBusy(true); setError('')
    try { setData(await getDashboard(refresh)) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const Page = PAGES[page]
  return (
    <div className="app">
      <nav>
        <div className="logo"><i />Narsipur Forex Dashboard</div>
        {Object.keys(PAGES).map((p) => (
          <button key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{p}</button>
        ))}
        <div className="side-foot">
          <button className="ghost" onClick={() => load(true)} disabled={busy}>{busy ? 'Updating...' : 'Refresh rates'}</button>
          {data && <small>{data.isDemo ? 'Demo data. ' : ''}Updated {data.generatedAt}</small>}
        </div>
      </nav>
      <main>
        {error && <div className="card err">Could not load data: {error}. Check that the API is running on port 8000.</div>}
        {!data && !error && <p className="mut">Loading rates...</p>}
        {data && <Page data={data} onChange={() => load()} />}
      </main>
    </div>
  )
}
