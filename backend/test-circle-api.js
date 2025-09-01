// test-circle-api.js
const axios = require('axios');
require('dotenv').config();

async function testCircleAPI() {
  try {
    console.log('🔍 Testing Circle API key...');
    
    const response = await axios.get(
      'https://api-sandbox.circle.com/v1/configuration',
      {
        headers: {
          'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      console.log('✅ Circle API key is VALID and responding');
      console.log('✅ Master Wallet ID:', response.data.data?.payments?.masterWalletId || 'Available');
      return true;
    }
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('❌ Circle API key is INVALID or malformed');
      console.log('❌ Check your CIRCLE_API_KEY format: TEST_API_KEY:...');
    } else if (error.response?.status === 403) {
      console.log('❌ Circle API key lacks permissions');
    } else {
      console.log('❌ Circle API error:', error.message);
    }
    return false;
  }
}

testCircleAPI();
