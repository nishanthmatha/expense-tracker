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