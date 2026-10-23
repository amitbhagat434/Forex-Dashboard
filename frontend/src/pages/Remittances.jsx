import { useEffect, useState } from 'react'
import { Kpi, Pill, Table } from '../components/Ui.jsx'
import { f2, usd } from '../format.js'
import { getRemittances, addRemittance, deleteRemittance, convertRemittance, reopenRemittance, getRateOn } from '../api.js'

export default function Remittances({ data, onChange }) {
  const [list, setList] = useState([])
  const [date, setDate] = useState(data.today.date)
  const [amount, setAmount] = useState('')
  const [conv, setConv] = useState(null) // { id, date, rate } while marking a remittance as converted
  const [err, setErr] = useState('')
  const [rateNote, setRateNote] = useState('')
  useEffect(() => { getRemittances().then(setList).catch((e) => setErr(e.message)) }, [])

  const run = async (fn) => {
    setErr('')
    try { setList(await fn()); onChange(); return true } catch (e) { setErr(e.message); return false }
  }
  const signal = (r) => data.openTranches.find((o) => o.remitDate === r.date && o.usd === r.amount)
  const pickDate = (d) => {
    setConv((c) => ({ ...c, date: d }))
    if (!d) return
    setRateNote('Looking up the rate...')
    getRateOn(d)
      .then((r) => {
        setConv((c) => (c && c.date === d ? { ...c, rate: String(r.rate) } : c))
        setRateNote(r.rateDate === d ? `Market rate on ${d}.` : `No rate published for ${d}. Using ${r.rateDate}.`)
      })
      .catch((e) => setRateNote(e.message))
  }
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0)
  const totalUsd = sum(list, (r) => r.amount)
  const convertedUsd = sum(list.filter((r) => r.status === 'converted'), (r) => r.amount)
  const openUsd = totalUsd - convertedUsd

  const statusCell = (r) => {
    if (r.status === 'converted')
      return <span className="pill Converted">Converted at {f2(r.convertedRate)} on {r.convertedDate}</span>
    const s = signal(r)
    return s ? <Pill action={s.action} /> : <span className="mut">Outside 30-day window</span>
  }
  const actionCell = (r) =>
    r.status === 'converted' ? (
      <button className="link mutl" onClick={() => run(() => reopenRemittance(r.id))}>Reopen</button>
    ) : (
      <>
        <button className="link go" onClick={() => { setConv({ id: r.id, date: data.today.date, rate: String(data.today.spot) }); setRateNote(`Market rate on ${data.today.date}.`) }}>Mark converted</button>
        <button className="link" onClick={() => run(() => deleteRemittance(r.id))}>Delete</button>
      </>
    )

  return (
    <>
      <div className="top"><h2>Remittances</h2></div>
      {list.length > 0 && (
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <Kpi label="Total USD added" value={usd(totalUsd)} />
          <Kpi label="Not yet converted (USD)" value={usd(openUsd)} />
          <Kpi label="Converted (USD)" value={usd(convertedUsd)} />
        </div>
      )}
      {data.assumedSchedule && (
        <div className="card note">No remittances saved yet. Performance currently assumes $100,000 on the first of each month since June 2016.</div>
      )}
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (amount > 0) run(() => addRemittance(date, +amount)).then(() => setAmount('')) }}>
        <h3>Add a remittance</h3>
        <div className="row">
          <input type="date" value={date} max={data.today.date} onChange={(e) => setDate(e.target.value)} aria-label="Received date" />
          <input type="number" min="1" placeholder="USD amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="USD amount" />
          <button className="btn" type="submit">Add remittance</button>
        </div>
      </form>
      {conv && (
        <form className="card note" onSubmit={(e) => { e.preventDefault(); run(() => convertRemittance(conv.id, conv.date, +conv.rate)).then((ok) => ok && setConv(null)) }}>
          <h3>Mark as converted</h3>
          <div className="row">
            <input type="date" value={conv.date} max={data.today.date} onChange={(e) => pickDate(e.target.value)} aria-label="Conversion date" />
            <input type="number" step="0.0001" min="1" value={conv.rate} onChange={(e) => setConv({ ...conv, rate: e.target.value })} aria-label="Rate you got" />
            <button className="btn" type="submit">Save conversion</button>
            <button className="btn" type="button" style={{ background: 'var(--mut)' }} onClick={() => setConv(null)}>Cancel</button>
          </div>
          <p className="mut small">{rateNote} You can overwrite the rate with the one your bank gave you. It leaves Signals and stays in Performance.</p>
        </form>
      )}
      {err && <p className="dn small">{err}</p>}
      <div className="card">
        <h3>Saved remittances</h3>
        {list.length === 0 ? <p className="mut">None yet. Add your first one above.</p> : (
          <Table head={['Received', 'USD', 'Status', '']}
            rows={[...list].reverse().map((r) => [r.date, usd(r.amount), statusCell(r), actionCell(r)])} />
        )}
      </div>
    </>
  )
}