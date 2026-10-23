export const Kpi = ({ label, value, tone }) => (
  <div className="kpi"><span>{label}</span><b className={tone}>{value}</b></div>
)
export const Pill = ({ action }) => <span className={`pill ${action}`}>{action}</span>
export const Legend = ({ items }) => (
  <div className="leg">{items.map(([c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}</div>
)
export const Table = ({ head, rows }) => (
  <div className="scroll"><table>
    <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
  </table></div>
)
