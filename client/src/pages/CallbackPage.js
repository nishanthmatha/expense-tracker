// src/pages/CallbackPage.js
// Basiq redirects here after the user connects their bank.
// We poll the job endpoint until data is ready, then go to the dashboard.

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pollJob } from '../api';
import styles from './CallbackPage.module.css';

const STEPS = [
  { key: 'verify-credentials', label: 'Verifying bank credentials' },
  { key: 'retrieve-accounts',  label: 'Retrieving accounts' },
  { key: 'retrieve-transactions', label: 'Fetching transactions' }
];

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get('userId') || localStorage.getItem('basiq_pending_userId');
  const jobId  = searchParams.get('jobId');
  const error  = searchParams.get('error');

  const [stepStatus, setStepStatus] = useState({ 0: 'pending', 1: 'pending', 2: 'pending' });
  const [errorMsg, setErrorMsg] = useState(error ? decodeURIComponent(error) : null);
  const [dots, setDots] = useState('');

  // Animated dots for loading text
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (errorMsg || !jobId || !userId) return;

    let cancelled = false;
    const MAX_POLLS = 40; // 40 × 2s = 80s max
    let polls = 0;

    async function poll() {
      try {
        const data = await pollJob(jobId);

        if (!cancelled && data.job?.steps) {
          const newStatus = {};
          data.job.steps.forEach((s, i) => { newStatus[i] = s.status; });
          setStepStatus(newStatus);
        }

        // Navigate to dashboard once complete
        if (!cancelled) {
          localStorage.setItem('basiq_user_id', userId);
          const label = localStorage.getItem('basiq_account_label') || 'My Account';
          navigate(`/dashboard?userId=${userId}&label=${encodeURIComponent(label)}`);
        }
      } catch (err) {
        polls++;
        if (polls < MAX_POLLS && !cancelled) {
          setTimeout(poll, 2000);
        } else if (!cancelled) {
          setErrorMsg(err.message || 'Job timed out. Please reconnect.');
        }
      }
    }

    // Start polling after a brief pause
    const timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId, userId, errorMsg, navigate]);

  if (errorMsg) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.icon}>❌</div>
          <h2>Connection Failed</h2>
          <p className={styles.errText}>{errorMsg}</p>
          <button className={styles.btn} onClick={() => navigate('/')}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>🔄</div>
        <h2>Connecting your bank{dots}</h2>
        <p className={styles.sub}>
          Securely retrieving your financial data via Open Banking (CDR)
        </p>

        <div className={styles.steps}>
          {STEPS.map((step, i) => {
            const status = stepStatus[i] || 'pending';
            return (
              <div key={step.key} className={`${styles.step} ${styles[status]}`}>
                <div className={styles.stepIcon}>
                  {status === 'success' ? '✓'
                    : status === 'failed' ? '✗'
                    : status === 'in-progress' ? <span className={styles.spin} />
                    : '○'}
                </div>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        <p className={styles.note}>
          This usually takes 5–15 seconds. Do not close this tab.
        </p>
      </div>
    </div>
  );
}
