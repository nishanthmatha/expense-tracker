const axios = require('axios');
const { getServerToken } = require('./auth');
const config = require('./exclusions.config.json');

function isExcluded(description) {
  return config.exclusions.some(rule =>
    description.toLowerCase().includes(rule.toLowerCase())
  );
}

async function getTransactions(userId, { fromDate, toDate, limit = 500 } = {}) {
  const token = await getServerToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'basiq-version': '3.0'
  };

  // Build filter query
  let filter = '';
  if (fromDate) filter += `transaction.postDate.gteq(${fromDate})`;
  if (fromDate && toDate) filter += ',';
  if (toDate)   filter += `transaction.postDate.lteq(${toDate})`;

  const params = new URLSearchParams({ limit });
  if (filter) params.set('filter', filter);

  const res = await axios.get(
    `https://au-api.basiq.io/users/${userId}/transactions?${params}`,
    { headers }
  );

  // The API response includes enriched data: merchant, category, subCategory
  const allTransactions = res.data.data.map(tx => ({
    id:           tx.id,
    date:         tx.postDate,
    description:  tx.description,
    amount:       parseFloat(tx.amount),
    currency:     tx.currency,
    account:      tx.account,
    institution:  tx.institution,
    category:     tx.subClass?.title ?? 'Other',
    merchant:     tx.merchant?.businessName ?? null,
    excluded:     isExcluded(tx.description)
  }));

  return {
    all: allTransactions,
    included: allTransactions.filter(t => !t.excluded),
    excluded: allTransactions.filter(t => t.excluded)
  };
}

module.exports = { getTransactions };