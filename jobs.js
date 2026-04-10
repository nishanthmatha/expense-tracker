// jobs.js
// Polls the Basiq jobs endpoint until all three steps complete:
//   1. verify-credentials
//   2. retrieve-accounts
//   3. retrieve-transactions
//
// Usage:
//   const { waitForJob } = require('./jobs');
//   const result = await waitForJob(jobId);

const axios = require('axios');
const { getServerToken } = require('./auth');

/**
 * Poll a Basiq job until all steps succeed or one fails.
 *
 * @param {string} jobId       - Job ID returned from the Basiq callback URL
 * @param {object} [opts]
 * @param {number} [opts.timeout=80000]   - Max wait in ms (default 80s)
 * @param {number} [opts.interval=2000]   - Poll interval in ms (default 2s)
 * @returns {Promise<object>}  - Final job object from the API
 */
async function waitForJob(jobId, { timeout = 80000, interval = 2000 } = {}) {
  if (!jobId) throw new Error('jobId is required');

  const start = Date.now();
  let lastSteps = null;

  while (Date.now() - start < timeout) {
    const token = await getServerToken();

    const res = await axios.get(
      `https://au-api.basiq.io/jobs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'basiq-version': '3.0'
        }
      }
    );

    const job = res.data;
    const steps = job.steps || [];
    lastSteps = steps;

    const allDone    = steps.every(s => s.status === 'success' || s.status === 'failed');
    const anyFailed  = steps.some(s => s.status === 'failed');

    if (allDone) {
      if (anyFailed) {
        const failedStep = steps.find(s => s.status === 'failed');
        throw new Error(
          `Job step "${failedStep?.title || 'unknown'}" failed: ` +
          (failedStep?.result?.title || 'Check Basiq dashboard for details')
        );
      }
      return job; // All steps succeeded
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Timed out — include last known step statuses to help debug
  const stepSummary = lastSteps
    ? lastSteps.map(s => `${s.title}: ${s.status}`).join(', ')
    : 'no steps returned';

  throw new Error(`Job timed out after ${timeout / 1000}s. Last status: [${stepSummary}]`);
}

/**
 * Fetch the raw job object without polling (single snapshot).
 *
 * @param {string} jobId
 * @returns {Promise<object>}
 */
async function getJobStatus(jobId) {
  const token = await getServerToken();

  const res = await axios.get(
    `https://au-api.basiq.io/jobs/${jobId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'basiq-version': '3.0'
      }
    }
  );

  return res.data;
}

module.exports = { waitForJob, getJobStatus };
