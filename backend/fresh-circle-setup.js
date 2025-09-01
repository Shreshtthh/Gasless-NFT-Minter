const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const crypto = require('crypto');

async function setupCircle() {
  // Generate fresh entity secret
  const entitySecret = crypto.randomBytes(32).toString('hex');
  
  const config = {
    apiKey: 'TEST_API_KEY:a484ee181f96cd13ccccf997a1e17274:bd66947540f6541f2f0639ab759a63f5',
    entitySecret: entitySecret,
  };

  try {
    console.log('1. Initializing Circle client...');
    const client = initiateDeveloperControlledWalletsClient(config);
    
    console.log('2. Creating wallet set...');
    const walletSetResponse = await client.createWalletSet({
      name: "Gasless NFT Wallet Set",
    });
    
    console.log('✅ SUCCESS! Update your .env with:');
    console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
    console.log(`CIRCLE_WALLET_SET_ID=${walletSetResponse.data?.walletSet?.id}`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
  }
}

setupCircle();
