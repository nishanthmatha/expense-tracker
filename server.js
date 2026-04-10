const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { getServerToken, getClientToken } = require('./auth');
const { createUser } = require('./users');
const { waitForJob } = require('./jobs');
const { getTransactions } = require('./transactions');

const app = express();
app.use(cors()).use(express.json());

// ── POST /api/connect ─────────────────────────────────────────────────────────
// Creates a Basiq user and returns the Consent UI URL to redirect the user to.
// Call this when a user wants to connect their bank.
app.post('/api/connect', async (req, res) => {
    console.log(req.body)
  try {
    const { email, mobile, firstName, lastName } = req.body;
    const userId = await createUser({ email, mobile, firstName, lastName });
    console.log(userId)
    const clientToken = await getClientToken(userId);
    console.log(clientToken)
    const consentUrl = `https://consent.basiq.io/home?token=${clientToken}`;
    res.json({ userId, consentUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/callback ─────────────────────────────────────────────────────────
// Basiq redirects the user back here after they connect their bank.
app.get('/api/callback', (req, res) => {
  const { jobId, state, error } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

  if (error) return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(error)}`);

  let userId, returnTo;
  try {
    const parsed = JSON.parse(decodeURIComponent(state));
    userId  = parsed.userId;
    returnTo = parsed.returnTo || FRONTEND_URL + '/dashboard';
  } catch {
    return res.redirect(`${FRONTEND_URL}/?error=bad_state`);
  }

  res.redirect(`${returnTo}?userId=${userId}&jobId=${jobId}`);
});

// ── GET /api/job/:jobId ───────────────────────────────────────────────────────
// Poll this to check if the bank connection job has completed.
app.get('/api/job/:jobId', async (req, res) => {
  try {
    const result = await waitForJob(req.params.jobId);
    res.json({ status: 'complete', job: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions/:userId ─────────────────────────────────────────────
// Fetch and return transactions for a user, with exclusions applied.
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const data = await getTransactions(req.params.userId, { fromDate, toDate });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/accounts/:userId ─────────────────────────────────────────────────
app.get('/api/accounts/:userId', async (req, res) => {
  try {
    const token = await getServerToken();
    const axios = require('axios');
    const res2 = await axios.get(
      `https://au-api.basiq.io/users/${req.params.userId}/accounts`,
      { headers: { 'Authorization': `Bearer ${token}`, 'basiq-version': '3.0' } }
    );
    res.json(res2.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Server running on port ${process.env.PORT || 3000}`)
);