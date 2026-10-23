const items = [
  ['Fed and macro news', 'Headlines on Fed policy, US yields, oil and RBI moves, scored by a sentiment model.',
    'A news source (for example GDELT or NewsAPI) and a scoring model. Not in the notebook yet.'],
  ['Forward rates and curve', 'Market vs model forward rates by tenor, and key changes.',
    'FRED has no forward rates. Needs a forwards feed, or spot plus INR and USD interest rates to estimate them.'],
]
export default function Triggers() {
  return (
    <>
      <div className="top"><h2>Market triggers</h2></div>
      {items.map(([t, d, n]) => (
        <div className="card soon" key={t}>
          <h3>{t} <span className="badge">Not connected</span></h3>
          <div>{d}</div><p className="mut small">Needs: {n}</p>
        </div>
      ))}
    </>
  )
}
