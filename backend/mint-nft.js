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
  log('INFO', 'Starting comprehensive NFT mint test...');
  
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
    
    // FIXED: Updated endpoint path from /health to /api/health
    const healthResponse = await axios.get(`${backendUrl}/api/health`, { 
      timeout: 5000,
      validateStatus: () => true // Accept any status code
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

  // 3. Prepare test data
  const testEmail = `test-${Date.now()}@example.com`;
  const nftMetadata = {
    name: `Debug NFT #${Date.now()}`,
    description: 'Test NFT for debugging gasless minting system',
    image: 'https://via.placeholder.com/500x500.png?text=Debug+NFT',
    attributes: [
      { trait_type: 'Test Type', value: 'Debug' },
      { trait_type: 'Timestamp', value: new Date().toISOString() }
    ]
  };

  const requestData = {
    email: testEmail,
    nftMetadata: nftMetadata,
    blockchain: 'BASE-SEPOLIA',
    payWithUSDC: false
  };

  log('DEBUG', 'Test request data prepared', requestData);

  // 4. Test NFT minting with detailed error handling
  try {
    log('INFO', 'Sending NFT mint request to backend...');
    
    const startTime = Date.now();
    const response = await axios.post(
      `${backendUrl}/api/nft/mint`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 second timeout for minting
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
      log('SUCCESS', 'NFT Minted Successfully!');
      log('SUCCESS', 'Mint Details', {
        transactionHash: response.data.data.transactionHash,
        nftId: response.data.data.nftId,
        contractAddress: response.data.data.contractAddress,
        walletAddress: response.data.data.walletAddress,
        blockchain: response.data.data.blockchain,
        gasSponsored: response.data.data.gasSponsored
      });
      
      if (response.data.data.transactionHash) {
        log('INFO', 'Block Explorer Links:');
        log('INFO', `BaseScan: https://sepolia.basescan.org/tx/${response.data.data.transactionHash}`);
      }
      
    } else {
      log('ERROR', 'NFT Minting Failed');
      log('ERROR', 'Failure Analysis', {
        httpStatus: response.status,
        success: response.data?.success,
        error: response.data?.error,
        message: response.data?.message
      });
      
      // 7. Deep dive into error details
      if (response.data?.data) {
        log('DEBUG', 'Error Details', response.data.data);
        
        // Check for specific error patterns
        if (response.data.data.stack) {
          log('DEBUG', 'Error Stack Analysis');
          const stack = response.data.data.stack;
          
          if (stack.includes('404')) {
            log('WARN', 'Detected 404 error - likely Circle API endpoint or wallet set issue');
          }
          if (stack.includes('Circle API: Failed to create wallet')) {
            log('WARN', 'Wallet creation failed - check Circle configuration');
          }
          if (stack.includes('Cannot read properties of undefined')) {
            log('WARN', 'Service dependency issue - check service imports and exports');
          }
          if (stack.includes('validation')) {
            log('WARN', 'Request validation failed - check input data format');
          }
          if (stack.includes('userService')) {
            log('WARN', 'User service issue - check database connection and user service implementation');
          }
          
          console.log('\n=== FULL STACK TRACE ===');
          console.log(stack);
          console.log('=== END STACK TRACE ===\n');
        }
      }
    }

  } catch (error) {
    log('ERROR', 'Request failed completely', {
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
      log('ERROR', 'No response received', {
        request: error.request._header?.split('\r\n')[0]
      });
    }
  }

  log('INFO', 'NFT mint test completed');
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

// Run the test
testNFTMinting().then(() => {
  log('SUCCESS', 'Test script completed successfully');
  process.exit(0);
}).catch((error) => {
  log('ERROR', 'Test script failed', { error: error.message });
  process.exit(1);
});
