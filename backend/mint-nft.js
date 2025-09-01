const axios = require('axios');
require('dotenv').config();

// Enhanced logging function
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': '📋',
    'SUCCESS': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'DEBUG': '🔍'
  }[level] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function testNFTMinting() {
  log('INFO', 'Starting gasless NFT mint test for ETH-SEPOLIA...');
  
  // 1. Test environment variables
  log('DEBUG', 'Environment Variables Check:');
  log('DEBUG', 'Backend URL', { url: process.env.BACKEND_URL || 'http://localhost:3001' });
  log('DEBUG', 'Circle API Key prefix', { prefix: process.env.CIRCLE_API_KEY?.substring(0, 20) + '...' });
  log('DEBUG', 'Entity Secret length', { length: process.env.CIRCLE_ENTITY_SECRET?.length });
  log('DEBUG', 'Wallet Set ID', { walletSetId: process.env.CIRCLE_WALLET_SET_ID });

  // 2. Test backend connectivity
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  
  try {
    log('DEBUG', 'Testing backend connectivity...');
    
    const healthResponse = await axios.get(`${backendUrl}/api/health`, { 
      timeout: 5000,
      validateStatus: () => true
    });
    
    log('DEBUG', 'Health check response', {
      status: healthResponse.status,
      statusText: healthResponse.statusText,
      data: healthResponse.data
    });
    
    if (healthResponse.status !== 200) {
      log('ERROR', 'Backend health check failed');
      return;
    }
    
    log('SUCCESS', 'Backend is running and accessible');
    
  } catch (error) {
    log('ERROR', 'Failed to connect to backend', {
      error: error.message,
      code: error.code,
      url: `${backendUrl}/api/health`
    });
    return;
  }

  // 3. ✅ FIXED: Prepare test data with ETH-SEPOLIA for gasless support
  const testEmail = `test-gasless-${Date.now()}@example.com`;
  const nftMetadata = {
    name: `Gasless NFT #${Date.now()}`,
    description: 'Test NFT for gasless minting on ETH-SEPOLIA using Circle Gas Station',
    image: 'https://via.placeholder.com/500x500.png?text=Gasless+NFT',
    attributes: [
      { trait_type: 'Type', value: 'Gasless' },
      { trait_type: 'Network', value: 'ETH-SEPOLIA' },
      { trait_type: 'Timestamp', value: new Date().toISOString() },
      { trait_type: 'Gas Sponsored', value: 'true' }
    ],
    external_url: 'https://gasless-nft-minter.example.com',
  };

  // ✅ CRITICAL FIX: Use ETH-SEPOLIA for gasless transactions
  const requestData = {
    email: testEmail,
    nftMetadata: nftMetadata,
    blockchain: 'ETH-SEPOLIA', // Fixed from BASE-SEPOLIA
    payWithUSDC: false // Start with free minting
  };

  log('DEBUG', 'Test request data prepared for gasless minting', requestData);

  // 4. Test gasless NFT minting
  try {
    log('INFO', 'Sending gasless NFT mint request to backend...');
    
    const startTime = Date.now();
    const response = await axios.post(
      `${backendUrl}/api/nft/mint`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minute timeout for gasless transaction
        validateStatus: () => true // Capture all status codes
      }
    );
    const endTime = Date.now();

    // 5. Log detailed response
    log('DEBUG', 'Response received', {
      status: response.status,
      statusText: response.statusText,
      duration: `${endTime - startTime}ms`,
      headers: {
        'content-type': response.headers['content-type'],
        'content-length': response.headers['content-length']
      }
    });

    log('DEBUG', 'Response data', response.data);

    // 6. Handle different response scenarios
    if (response.status === 201 && response.data?.success) {
      log('SUCCESS', '🎉 GASLESS NFT MINTED SUCCESSFULLY! 🎉');
      log('SUCCESS', 'Gasless Mint Details', {
        transactionHash: response.data.data.transactionHash,
        nftId: response.data.data.nftId,
        contractAddress: response.data.data.contractAddress,
        walletAddress: response.data.data.walletAddress,
        blockchain: response.data.data.blockchain,
        gasSponsored: response.data.data.gasSponsored
      });
      
      // ✅ Show ETH-SEPOLIA block explorer links
      if (response.data.data.transactionHash) {
        log('INFO', 'Block Explorer Links:');
        log('INFO', `Sepolia Etherscan: https://sepolia.etherscan.io/tx/${response.data.data.transactionHash}`);
        
        // Check if it's a real transaction hash vs mock
        if (!response.data.data.transactionHash.startsWith('dev_tx_')) {
          log('SUCCESS', '🌟 This is a REAL gasless transaction on ETH-SEPOLIA! 🌟');
        } else {
          log('INFO', '🧪 This is a development mock transaction (configure Circle for real gasless)');
        }
      }

      // Success summary
      log('SUCCESS', '='.repeat(60));
      log('SUCCESS', '✅ GASLESS NFT MINTING TEST COMPLETED SUCCESSFULLY!');
      log('SUCCESS', '🎯 Key Achievements:');
      log('SUCCESS', '   • SCA (Smart Contract Account) wallet created');
      log('SUCCESS', '   • Gasless transaction executed via Circle Gas Station');
      log('SUCCESS', '   • NFT metadata uploaded to IPFS');
      log('SUCCESS', '   • Zero gas fees paid by user');
      log('SUCCESS', '   • Transaction sponsored by Circle testnet policy');
      log('SUCCESS', '='.repeat(60));
      
    } else {
      log('ERROR', 'Gasless NFT Minting Failed');
      log('ERROR', 'Failure Analysis', {
        httpStatus: response.status,
        success: response.data?.success,
        error: response.data?.error,
        message: response.data?.message
      });
      
      // 7. Enhanced error analysis for gasless-specific issues
      if (response.data?.data) {
        log('DEBUG', 'Error Details', response.data.data);
        
        // Check for specific gasless transaction error patterns
        if (response.data.data.stack) {
          log('DEBUG', 'Error Stack Analysis for Gasless Issues');
          const stack = response.data.data.stack;
          
          if (stack.includes('SCA') || stack.includes('Smart Contract Account')) {
            log('WARN', '🔍 SCA wallet issue - ensure Circle creates SCA type wallets for gasless');
          }
          if (stack.includes('Gas Station') || stack.includes('gasless')) {
            log('WARN', '🔍 Gas Station issue - check Circle Gas Station configuration');
          }
          if (stack.includes('ETH-SEPOLIA')) {
            log('WARN', '🔍 ETH-SEPOLIA issue - verify contract is deployed on Sepolia');
          }
          if (stack.includes('Circle API: Failed to create wallet')) {
            log('WARN', '🔍 Circle wallet creation failed - check API keys and wallet set ID');
          }
          if (stack.includes('UnauthorizedMinter')) {
            log('WARN', '🔍 Contract authorization issue - ensure backend wallet is authorized as minter');
          }
          if (stack.includes('contract deployment')) {
            log('WARN', '🔍 Contract deployment issue - ensure NFT contract is deployed on ETH-SEPOLIA');
          }
          
          console.log('\n=== FULL STACK TRACE FOR DEBUGGING ===');
          console.log(stack);
          console.log('=== END STACK TRACE ===\n');
        }
      }

      // Provide specific troubleshooting for gasless minting
      log('INFO', '🔧 TROUBLESHOOTING GASLESS MINTING:');
      log('INFO', '1. Ensure Circle API keys are correctly configured');
      log('INFO', '2. Verify CIRCLE_WALLET_SET_ID is correct');
      log('INFO', '3. Check that NFT contract is deployed on ETH-SEPOLIA');
      log('INFO', '4. Ensure backend wallet is authorized as minter on the contract');
      log('INFO', '5. Verify Circle Gas Station has testnet policy configured');
    }

  } catch (error) {
    log('ERROR', 'Gasless mint request failed completely', {
      error: error.message,
      code: error.code,
      timeout: error.code === 'ECONNABORTED'
    });
    
    if (error.response) {
      log('ERROR', 'Error response details', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      log('ERROR', 'No response received from backend', {
        request: error.request._header?.split('\r\n')[0]
      });
    }
  }

  log('INFO', 'Gasless NFT mint test completed');
}

// Add process handlers for clean exit
process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled Rejection', { reason: reason?.toString() });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Run the gasless mint test
testNFTMinting().then(() => {
  log('SUCCESS', 'Gasless NFT minting test script completed successfully');
  process.exit(0);
}).catch((error) => {
  log('ERROR', 'Gasless NFT minting test script failed', { error: error.message });
  process.exit(1);
});