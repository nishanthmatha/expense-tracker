// src/api.js
// All calls to the Express backend (proxied to localhost:3000)

const BASE = 'http://127.0.0.1:3000';  // proxy in package.json handles localhost:3000

export async function connectBank({ email, mobile, firstName, lastName }) {
  const res = await fetch(`${BASE}/api/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, mobile, firstName, lastName })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { userId, consentUrl }
}

export async function pollJob(jobId) {
  const res = await fetch(`${BASE}/api/job/${jobId}`);
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { status: 'complete', job: {...} }
}

export async function fetchTransactions(userId, { fromDate, toDate } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate)   params.set('toDate', toDate);
  const res = await fetch(`${BASE}/api/transactions/${userId}?${params}`);
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { all, included, excluded, summary }
}

export async function fetchAccounts(userId) {
  const res = await fetch(`${BASE}/api/accounts/${userId}`);
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { accounts: [...] }
}

export async function revokeConnection(userId, connectionId) {
  const res = await fetch(`${BASE}/api/connections/${userId}/${connectionId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}
