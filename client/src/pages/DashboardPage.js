// src/pages/DashboardPage.js
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import { fetchTransactions, fetchAccounts, revokeConnection } from '../api';
import styles from './DashboardPage.module.css';

const COLORS = ['#6c63ff','#00d4aa','#ffd166','#ff6b6b','#c77dff','#48cae4','#f4a261','#2ec4b6'];

const fmt = (n) => '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function KPICard({ label, value, sub, color }) {
  return (
    <div className={styles.kpiCard} style={{ '--accent-color': color }}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get('userId') || localStorage.getItem('basiq_user_id');
  const label  = searchParams.get('label') || 'My Account';

  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showExcluded, setShowExcluded] = useState('hide'); // hide | show | only
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Exclusion editor
  const [localExclusions, setLocalExclusions] = useState([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [showExclusionPanel, setShowExclusionPanel] = useState(false);

  // Tab
  const [tab, setTab] = useState('overview'); // overview | transactions | accounts

  const load = useCallback(async () => {
    if (!userId) { navigate('/'); return; }
    setLoading(true);
    setError(null);
    try {
      const [txData, accData] = await Promise.all([
        fetchTransactions(userId, { fromDate, toDate }),
        fetchAccounts(userId)
      ]);
      setTransactions(txData.all || []);
      setAccounts(accData.accounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, fromDate, toDate, navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const displayedTxns = transactions
    .filter(t => {
      if (showExcluded === 'hide' && t.excluded) return false;
      if (showExcluded === 'only' && !t.excluded) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && t.category !== catFilter) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const includedExpenses = transactions.filter(t => !t.excluded && t.amount < 0);
  const categories = [...new Set(transactions.map(t => t.category))].filter(Boolean);

  const totalExpenses = includedExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const excludedCount = transactions.filter(t => t.excluded).length;
  const largest = includedExpenses.sort((a, b) => a.amount - b.amount)[0];
  const avg = includedExpenses.length ? totalExpenses / includedExpenses.length : 0;

  // Monthly chart data
  const monthly = {};
  includedExpenses.forEach(t => {
    const m = t.date?.slice(0, 7);
    if (m) monthly[m] = (monthly[m] || 0) + Math.abs(t.amount);
  });
  const monthlyData = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }),
      amount
    }));

  // Category pie data
  const catTotals = {};
  includedExpenses.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
  });
  const pieData = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  // ── Exclusion management ───────────────────────────────────────────────────
  // NOTE: local exclusions here update the config file via a backend endpoint
  // you'd add — for this demo we just track them locally and note the pattern.
  function addExclusion() {
    const val = newExclusion.trim();
    if (val && !localExclusions.includes(val)) {
      setLocalExclusions(ex => [...ex, val]);
      setNewExclusion('');
    }
  }

  async function handleRevoke(connectionId) {
    if (!window.confirm('Revoke this bank connection? This will stop data sharing.')) return;
    try {
      await revokeConnection(userId, connectionId);
      load();
    } catch (err) {
      alert('Error revoking: ' + err.message);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!userId) return null;

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingSpinner} />
        <p>Loading your bank data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingPage}>
        <p style={{ color: 'var(--accent3)' }}>Error: {error}</p>
        <button className={styles.btnPrimary} onClick={load} style={{ marginTop: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.layout}>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>🏦 Expense Tracker</div>

        <nav className={styles.nav}>
          {['overview', 'transactions', 'accounts'].map(t => (
            <button
              key={t}
              className={`${styles.navItem} ${tab === t ? styles.navActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' ? '📊' : t === 'transactions' ? '📋' : '🏦'}
              &nbsp; {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarSection}>Connected As</div>
        <div className={styles.accountPill}>{label}</div>

        <button
          className={styles.addAccountBtn}
          onClick={() => navigate('/')}
        >
          + Add Account
        </button>

        <div className={styles.sidebarSection} style={{ marginTop: 'auto' }}>Filters</div>

        <div className={styles.sidebarFilters}>
          <label className={styles.filterLabel}>From</label>
          <input type="date" className={styles.filterInput}
            value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <label className={styles.filterLabel}>To</label>
          <input type="date" className={styles.filterInput}
            value={toDate} onChange={e => setToDate(e.target.value)} />
          <button className={styles.btnGhost} style={{ marginTop: 6 }} onClick={load}>
            Apply
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>
              {tab === 'overview' ? 'Overview' : tab === 'transactions' ? 'Transactions' : 'Connected Accounts'}
            </h1>
            <p className={styles.pageSub}>{transactions.length} transactions loaded · {excludedCount} excluded by config</p>
          </div>
          <button className={styles.btnPrimary} onClick={load}>↻ Refresh</button>
        </div>

        {/* ════ OVERVIEW TAB ════ */}
        {tab === 'overview' && (
          <>
            {/* KPI row */}
            <div className={styles.kpiRow}>
              <KPICard label="Total Expenses" value={fmt(totalExpenses)} sub={`${includedExpenses.length} transactions`} color="#6c63ff" />
              <KPICard label="Largest Expense" value={largest ? fmt(largest.amount) : '$0'} sub={largest?.merchant || largest?.description?.slice(0,22) || '—'} color="#ff6b6b" />
              <KPICard label="Avg per Transaction" value={fmt(avg)} sub="Included expenses only" color="#00d4aa" />
              <KPICard label="Excluded" value={excludedCount} sub="Matched config rules" color="#ffd166" />
            </div>

            {/* Charts */}
            <div className={styles.chartsRow}>
              <div className={styles.chartCard}>
                <h3>Monthly Spend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#8b90b0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b90b0', fontSize: 11 }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" name="Expenses" fill="#6c63ff" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.chartCard}>
                <h3>By Category</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#8b90b0' }}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={styles.emptyChart}>No expense data</div>
                )}
              </div>
            </div>

            {/* Trend line */}
            {monthlyData.length > 1 && (
              <div className={styles.chartCard} style={{ marginBottom: 0 }}>
                <h3>Spend Trend</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#8b90b0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b90b0', fontSize: 11 }} tickFormatter={v => '$' + (v/1000).toFixed(1)+'k'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="amount" name="Expenses" stroke="#00d4aa" strokeWidth={2} dot={{ fill: '#00d4aa' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* ════ TRANSACTIONS TAB ════ */}
        {tab === 'transactions' && (
          <>
            {/* Exclusion panel toggle */}
            <div className={styles.exclusionBar}>
              <button
                className={styles.btnGhost}
                onClick={() => setShowExclusionPanel(p => !p)}
              >
                🚫 Exclusion Rules ({localExclusions.length} local)
              </button>

              {showExclusionPanel && (
                <div className={styles.exclusionPanel}>
                  <p className={styles.exclusionNote}>
                    Global exclusion rules live in <code>exclusions.config.json</code> on the server.
                    Local overrides here apply to your current session and show you how exclusions
                    would affect the data before committing to the config file.
                  </p>
                  <div className={styles.exclusionTags}>
                    {localExclusions.map((ex, i) => (
                      <span key={i} className={styles.tag}>
                        {ex}
                        <button onClick={() => setLocalExclusions(l => l.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className={styles.exclusionAdd}>
                    <input
                      className={styles.filterInput}
                      value={newExclusion}
                      onChange={e => setNewExclusion(e.target.value)}
                      placeholder='Add keyword (e.g. "Salary")'
                      onKeyDown={e => e.key === 'Enter' && addExclusion()}
                    />
                    <button className={styles.btnPrimary} onClick={addExclusion}>Add</button>
                  </div>
                </div>
              )}
            </div>

            {/* Table filters */}
            <div className={styles.tableFilters}>
              <input
                className={styles.searchInput}
                placeholder="Search description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className={styles.filterInput}
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <select
                className={styles.filterInput}
                value={showExcluded}
                onChange={e => setShowExcluded(e.target.value)}
              >
                <option value="hide">Hide Excluded</option>
                <option value="show">Show All</option>
                <option value="only">Only Excluded</option>
              </select>
            </div>

            {/* Transaction table */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTxns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyRow}>No transactions match current filters</td>
                    </tr>
                  ) : displayedTxns.map(t => (
                    <tr key={t.id} className={t.excluded ? styles.excludedRow : ''}>
                      <td className={styles.dateCell}>{t.date?.slice(0, 10)}</td>
                      <td>
                        {t.description}
                        {t.excluded && <span className={styles.excludedBadge}>excluded</span>}
                      </td>
                      <td className={styles.mutedCell}>{t.merchant || '—'}</td>
                      <td>
                        <span
                          className={styles.catBadge}
                          style={{
                            background: COLORS[categories.indexOf(t.category) % COLORS.length] + '22',
                            color: COLORS[categories.indexOf(t.category) % COLORS.length]
                          }}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td className={t.amount < 0 ? styles.amountNeg : styles.amountPos}>
                        {t.amount < 0 ? '-' : '+'}{fmt(t.amount)}
                      </td>
                      <td className={styles.mutedCell}>{t.status || 'posted'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.tableCount}>{displayedTxns.length} transactions shown</p>
          </>
        )}

        {/* ════ ACCOUNTS TAB ════ */}
        {tab === 'accounts' && (
          <div className={styles.accountsGrid}>
            {accounts.length === 0 ? (
              <div className={styles.emptyChart} style={{ gridColumn: '1/-1', padding: 40 }}>
                No accounts found. <button className={styles.btnPrimary} onClick={() => navigate('/')}>Connect a bank</button>
              </div>
            ) : accounts.map(acc => (
              <div key={acc.id} className={styles.accountCard}>
                <div className={styles.accountIcon}>🏦</div>
                <div className={styles.accountName}>{acc.name || acc.displayName}</div>
                <div className={styles.accountNo}>{acc.accountNo || acc.maskedNumber}</div>
                <div className={styles.accountType}>{acc.class?.product || acc.productName || 'Account'}</div>
                <div className={styles.accountBalance}>
                  <span className={styles.balanceLabel}>Balance</span>
                  <span className={styles.balanceValue}>
                    {fmt(parseFloat(acc.balance || acc.balances?.currentBalance || 0))}
                  </span>
                </div>
                {acc.availableFunds && (
                  <div className={styles.accountBalance}>
                    <span className={styles.balanceLabel}>Available</span>
                    <span>{fmt(parseFloat(acc.availableFunds || acc.balances?.availableBalance || 0))}</span>
                  </div>
                )}
                {acc.connection && (
                  <button
                    className={styles.revokeBtn}
                    onClick={() => handleRevoke(acc.connection)}
                  >
                    Revoke Access
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
