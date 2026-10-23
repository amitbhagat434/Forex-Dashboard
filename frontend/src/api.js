const json = async (r) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText)
  return r.json()
}
export const getDashboard = (refresh = false) => fetch('/api/dashboard' + (refresh ? '?refresh=true' : '')).then(json)
export const getRemittances = () => fetch('/api/remittances').then(json)
export const addRemittance = (date, amount) =>
  fetch('/api/remittances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, amount }) }).then(json)
export const deleteRemittance = (id) => fetch('/api/remittances/' + id, { method: 'DELETE' }).then(json)

const patch = (url, body) =>
  fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(json)
export const convertRemittance = (id, date, rate) => patch(`/api/remittances/${id}/convert`, { date, rate })
export const reopenRemittance = (id) => patch(`/api/remittances/${id}/reopen`)
export const getRateOn = (date) => fetch('/api/rate?date=' + date).then(json)