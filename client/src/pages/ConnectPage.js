// src/pages/ConnectPage.js
import React, { useState } from 'react';
import { connectBank } from '../api';
import styles from './ConnectPage.module.css';

const ACCOUNT_TYPES = [
  { id: 'own', label: '🏢 My Own Business Account' },
  { id: 'friend', label: "👤 Friend's Account (with consent)" }
];

export default function ConnectPage() {
  const [accountType, setAccountType] = useState('own');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', mobile: '' });
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const urlError = new URLSearchParams(window.location.search).get('error');

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleConnect(e) {
    e.preventDefault();
    if (accountType === 'friend' && !consentChecked) {
      setError('You must confirm your friend has given explicit consent before proceeding.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { userId, consentUrl } = await connectBank(form);
      // Store userId so the callback page can find it
      localStorage.setItem('basiq_pending_userId', userId);
      localStorage.setItem('basiq_account_label',
        accountType === 'own' ? 'My Account' : `${form.firstName}'s Account`
      );
      // Redirect to Basiq's hosted Consent UI — user logs in at their own bank
      window.location.href = consentUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🏦</div>
        <h1 className={styles.title}>Connect Your Bank</h1>
        <p className={styles.subtitle}>
          Securely connect via Australian Open Banking (CDR).<br />
          You'll be redirected to your bank to authenticate — we never see your credentials.
        </p>

        {urlError && (
          <div className={styles.errorBox}>
            ⚠️ Bank connection failed: {decodeURIComponent(urlError)}. Please try again.
          </div>
        )}

        {/* Account type selector */}
        <div className={styles.typeRow}>
          {ACCOUNT_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${styles.typeBtn} ${accountType === t.id ? styles.typeBtnActive : ''}`}
              onClick={() => { setAccountType(t.id); setConsentChecked(false); setError(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Friend consent warning */}
        {accountType === 'friend' && (
          <div className={styles.consentWarning}>
            <h3>⚖️ Legal Consent Required</h3>
            <p>
              Under the <strong>Australian Privacy Act 1988</strong> and CDR rules, you must obtain
              explicit informed consent before accessing another person's financial data.
            </p>
            <ul>
              <li>✅ Your friend must understand what data is being shared and why</li>
              <li>✅ They must open the bank consent page themselves and log in directly</li>
              <li>✅ They can revoke access at any time via their bank's CDR dashboard</li>
              <li>✅ Data is used solely for expense tracking — no other purpose</li>
              <li>❌ Never enter their banking credentials on their behalf</li>
            </ul>
            <label className={styles.consentCheck}>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
              />
              <span>
                I confirm my friend has given explicit verbal or written consent, understands
                what data will be shared, and will authenticate at their bank themselves.
              </span>
            </label>
          </div>
        )}

        {/* Connection form */}
        <form className={styles.form} onSubmit={handleConnect}>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>{accountType === 'friend' ? "Friend's First Name" : 'First Name'}</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="Jane"
                required
              />
            </div>
            <div className={styles.field}>
              <label>{accountType === 'friend' ? "Friend's Last Name" : 'Last Name'}</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Smith"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>{accountType === 'friend' ? "Friend's Email" : 'Email'}</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              required
            />
            {accountType === 'friend' && (
              <span className={styles.fieldHint}>
                Basiq sends consent confirmation to this email address.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label>Mobile (optional, for MFA)</label>
            <input
              name="mobile"
              type="tel"
              value={form.mobile}
              onChange={handleChange}
              placeholder="+61 400 000 000"
            />
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || (accountType === 'friend' && !consentChecked)}
          >
            {loading ? (
              <><span className={styles.spinner} /> Connecting…</>
            ) : (
              '🔗 Connect to Bank via Open Banking'
            )}
          </button>
        </form>

        <div className={styles.securityNote}>
          🔒 Powered by Basiq · ACCC-accredited ADR · Australian CDR Open Banking
        </div>
      </div>
    </div>
  );
}
