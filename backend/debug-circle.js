// debug-circle-fixed.js
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
require('dotenv').config();

async function debugCircle() {
  console.log('🔍 Debugging Circle configuration...');
  
  console.log('API Key prefix:', process.env.CIRCLE_API_KEY?.substring(0, 20) + '...');
  console.log('Entity Secret length:', process.env.CIRCLE_ENTITY_SECRET?.length);
  console.log('Wallet Set ID:', process.env.CIRCLE_WALLET_SET_ID);
  
  const config = {
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  };

  try {
    console.log('1. Initializing Circle client...');
    const client = initiateDeveloperControlledWalletsClient(config);
    
    console.log('2. Testing wallet creation...');
    const createWalletResponse = await client.createWallets({
      count: 1,
      blockchains: ['ETH-SEPOLIA'], // Changed from 'ETH' to 'ETH-SEPOLIA'
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
    });
    
    console.log('✅ Test wallet created successfully!');
    console.log('Wallet ID:', createWalletResponse.data?.wallets?.[0]?.id);
    console.log('Wallet Address:', createWalletResponse.data?.wallets?.[0]?.address);
    
  } catch (error) {
    console.error('❌ Circle debug failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugCircle();
