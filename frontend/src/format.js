export const f2 = (x) => Number(x).toFixed(2)
export const sg = (x, d = 2) => (x >= 0 ? '+' : '') + Number(x).toFixed(d)
export const inr = (x) => (x < 0 ? '-' : '') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN')
export const usd = (x) => '$' + Number(x).toLocaleString('en-IN')
