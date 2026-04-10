// ─── users.js ─────────────────────────────────────────────────────────────────
const axios = require('axios');
const { getServerToken } = require('./auth');

async function createUser({ email, mobile, firstName, lastName }) {
  const token = await getServerToken();
  const response = await axios.post(
    'https://au-api.basiq.io/users',
    { email, mobile, firstName, lastName },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'basiq-version': '3.0'
      }
    }
  );
  return response.data.id; // Store this userId in your database
}

module.exports = { createUser };


// ─── jobs.js ──────────────────────────────────────────────────────────────────
const { getServerToken: _gst } = require('./auth');
const _axios = require('axios');

async function waitForJob(jobId, { timeout = 60000, interval = 2000 } = {}) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const token = await _gst();
    const res = await _axios.get(
      `https://au-api.basiq.io/jobs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'basiq-version': '3.0'
        }
      }
    );

    const steps = res.data.steps;
    const allDone = steps.every(s => s.status === 'success' || s.status === 'failed');
    const anyFailed = steps.some(s => s.status === 'failed');

    if (allDone) {
      if (anyFailed) throw new Error(`Job failed: ${JSON.stringify(steps)}`);
      return res.data;
    }

    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error('Job timed out after 60 seconds');
}

module.exports = { waitForJob };


// ─── transactions.js ──────────────────────────────────────────────────────────
const { getServerToken: gst } = require('./auth');
const ax = require('axios');
const path = require('path');

function loadConfig() {
  // Hot-reload config on each call so you can update exclusions without restart
  const configPath = path.resolve(__dirname, 'exclusions.config.json');
  delete require.cache[require.resolve(configPath)];
  return require(configPath);
}

function isExcluded(description, exclusions) {
  return exclusions.some(rule =>
    description.toLowerCase().includes(rule.toLowerCase())
  );
}

async function getTransactions(userId, { fromDate, toDate, limit = 500 } = {}) {
  const token = await gst();
  const config = loadConfig();
  const exclusions = config.exclusions || [];

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'basiq-version': '3.0'
  };

  // Build CDR filter query
  let filter = '';
  if (fromDate) filter += `transaction.postDate.gteq(${fromDate})`;
  if (fromDate && toDate) filter += ',';
  if (toDate) filter += `transaction.postDate.lteq(${toDate})`;

  const params = new URLSearchParams({ limit });
  if (filter) params.set('filter', filter);

  const res = await ax.get(
    `https://au-api.basiq.io/users/${userId}/transactions?${params}`,
    { headers }
  );

  const allTransactions = (res.data.data || []).map(tx => ({
    id:          tx.id,
    date:        tx.postDate,
    description: tx.description,
    amount:      parseFloat(tx.amount),
    currency:    tx.currency || 'AUD',
    account:     tx.account,
    institution: tx.institution,
    category:    tx.subClass?.title ?? tx.class?.title ?? 'Other',
    merchant:    tx.merchant?.businessName ?? null,
    status:      tx.status,
    excluded:    isExcluded(tx.description, exclusions)
  }));

  return {
    all:      allTransactions,
    included: allTransactions.filter(t => !t.excluded),
    excluded: allTransactions.filter(t => t.excluded),
    summary: {
      total:         allTransactions.length,
      excludedCount: allTransactions.filter(t => t.excluded).length,
      totalExpenses: allTransactions
        .filter(t => !t.excluded && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0)
    }
  };
}

async function getAccounts(userId) {
  const token = await gst();
  const res = await ax.get(
    `https://au-api.basiq.io/users/${userId}/accounts`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'basiq-version': '3.0'
      }
    }
  );
  return res.data.data || [];
}

async function revokeConnection(userId, connectionId) {
  const token = await gst();
  await ax.delete(
    `https://au-api.basiq.io/users/${userId}/connections/${connectionId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'basiq-version': '3.0'
      }
    }
  );
}

module.exports = { getTransactions, getAccounts, revokeConnection };


// ─── server.js ────────────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { getServerToken, getClientToken } = require('./auth');
const { createUser } = require('./users');
const { waitForJob } = require('./jobs');
const { getTransactions, getAccounts, revokeConnection } = require('./transactions');

const app = express();
app.use(cors()).use(express.json());

// POST /api/connect
// Creates a Basiq user and returns the Consent UI URL.
// Your frontend should redirect the user to consentUrl.
app.post('/api/connect', async (req, res) => {
  try {
    const { email, mobile, firstName, lastName } = req.body;
    const userId = await createUser({ email, mobile, firstName, lastName });
    const clientToken = await getClientToken(userId);
    const consentUrl = `https://consent.basiq.io/home?token=${clientToken}`;
    res.json({ userId, consentUrl });
  } catch (err) {
    console.error('Connect error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/callback
// Basiq redirects here after user connects. Configure this URL in your Basiq dashboard.
app.get('/api/callback', (req, res) => {
  const { userId, jobId, error } = req.query;
  if (error) return res.redirect(`http://localhost:3001/?error=${encodeURIComponent(error)}`);
  res.redirect(`http://localhost:3001/dashboard?userId=${userId}&jobId=${jobId}`);
});

// GET /api/job/:jobId
// Poll until the bank data retrieval job completes (3 steps: auth → accounts → transactions)
app.get('/api/job/:jobId', async (req, res) => {
  try {
    const result = await waitForJob(req.params.jobId);
    res.json({ status: 'complete', job: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/:userId?fromDate=2026-01-01&toDate=2026-04-09
// Returns all transactions, plus separate included/excluded arrays.
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const data = await getTransactions(req.params.userId, { fromDate, toDate });
    res.json(data);
  } catch (err) {
    console.error('Transactions error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accounts/:userId
app.get('/api/accounts/:userId', async (req, res) => {
  try {
    const accounts = await getAccounts(req.params.userId);
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/connections/:userId/:connectionId
// Revokes a bank connection (user withdrawal of consent)
app.delete('/api/connections/:userId/:connectionId', async (req, res) => {
  try {
    await revokeConnection(req.params.userId, req.params.connectionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Basiq backend running on http://localhost:${PORT}`));
