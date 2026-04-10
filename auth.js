const axios = require('axios');
require('dotenv').config();

let tokenCache = { token: null, expiresAt: 0 };

async function getServerToken() {
  // Return cached token if still valid (with 5-min buffer)
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.token;
  }

  const response = await axios.post(
    'https://au-api.basiq.io/token',
    new URLSearchParams({ scope: 'SERVER_ACCESS' }),
    {
      headers: {
        "Authorization": `Basic ${process.env.BASIQ_API_KEY}`,
        "Accept": "application/json",
        "basiq-version": "3.0",
        "Content-Type": "application/x-www-form-urlencoded"
      },
    }
  );

  tokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in * 1000)
  };

  return tokenCache.token;
}

// CLIENT_ACCESS token — bound to a userId for use in the browser Consent UI
async function getClientToken(userId) {
  const response = await axios.post(
    'https://au-api.basiq.io/token',
    new URLSearchParams({
      scope: 'CLIENT_ACCESS',
      userId: userId
    }),
    {
      headers: {
        'Authorization': `Basic ${process.env.BASIQ_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'basiq-version': '3.0'
      }
    }
  );
  return response.data.access_token;
}

module.exports = { getServerToken, getClientToken };