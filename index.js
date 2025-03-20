const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Determine the correct path to bark executable for the current environment
function getBarkPath() {
  const bark = process.platform === 'win32' ? 'bark.exe' : 'bark';
  
  // First check if bark is in the current directory
  const localPath = path.join(__dirname, bark);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  
  // If not found, use the system-wide 'bark' assuming it's in the PATH
  return bark;
}

// Helper function to execute bark commands
function executeBark(command, args = []) {
  return new Promise((resolve, reject) => {
    const barkPath = getBarkPath();
    const fullCmd = [barkPath, command, ...args].join(' ');
    
    console.log(`Executing: ${fullCmd}`);
    
    exec(fullCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing '${fullCmd}':`, error);
        console.error(`stderr: ${stderr}`);
        reject(new Error(stderr || error.message));
        return;
      }
      
      console.log(`stdout: ${stdout}`);
      if (stderr) console.log(`stderr: ${stderr}`);
      
      resolve(stdout);
    });
  });
}

// Helper function to check if a wallet exists
function checkWalletExists() {
  try {
    const barkPath = getBarkPath();
    // Execute a simple command to check if wallet exists
    exec(`${barkPath} vtxo-pubkey`, { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Initialize wallet if it doesn't exist
function initializeWallet(callback) {
  // Use the ASP server specified in the documentation
  const aspServer = "ark.signet.2nd.dev";
  // Use the esplora server specified in the documentation
  const esploraUrl = "esplora.signet.2nd.dev";
  
  exec(`${getBarkPath()} create --signet --asp=${aspServer} --esplora=${esploraUrl}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error initializing wallet: ${error.message}`);
      console.error(`Stderr: ${stderr}`);
      callback(false);
      return;
    }
    console.log(`Wallet initialized: ${stdout}`);
    callback(true);
  });
}

// Check wallet status before starting the server
function checkServerPrerequisites(callback) {
  if (!checkWalletExists()) {
    console.log('No wallet found. Initializing a new wallet...');
    initializeWallet((success) => {
      if (success) {
        console.log('Wallet initialized successfully.');
        callback(true);
      } else {
        console.error('Failed to initialize wallet. Server may not function correctly.');
        callback(false);
      }
    });
  } else {
    console.log('Existing wallet found.');
    callback(true);
  }
}

// Helper function to delete wallet
function deleteWallet() {
  return new Promise((resolve, reject) => {
    const dataDir = process.env.BARK_DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.bark');
    
    // Delete the wallet directory
    if (fs.existsSync(dataDir)) {
      console.log(`Deleting wallet directory: ${dataDir}`);
      fs.rmdirSync(dataDir, { recursive: true });
      console.log('Wallet directory deleted successfully');
      resolve(true);
    } else {
      console.log('Wallet directory not found');
      resolve(false);
    }
  });
}

// Helper function to get the current block height
async function getCurrentBlockHeight() {
  try {
    // Gebruik het 'sync' commando om de meest recente blokhoogte te krijgen
    const output = await executeBark('sync');
    const heightMatch = output.match(/Current block height: (\d+)/);
    if (heightMatch) {
      return parseInt(heightMatch[1]);
    }
    return 0;
  } catch (error) {
    console.error('Error getting current block height:', error);
    return 0;
  }
}

// API Endpoints
app.get('/api/balance', async (req, res) => {
  try {
    const output = await executeBark('balance');
    
    // Try to parse the JSON directly first
    try {
      // Look for JSON object in the output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const balanceData = JSON.parse(jsonMatch[0]);
        res.json({
          total: balanceData.offchain_sat + balanceData.onchain_sat + (balanceData.pending_exit_sat || 0),
          offchain_sat: balanceData.offchain_sat || 0,
          onchain_sat: balanceData.onchain_sat || 0,
          pending_exit_sat: balanceData.pending_exit_sat || 0
        });
        return;
      }
    } catch (jsonError) {
      console.log('Could not parse JSON directly, falling back to regex parsing');
    }
    
    // Fallback to regex parsing if JSON parsing fails
    const totalMatch = output.match(/Total:\s+([\d,]+)/);
    const offchainMatch = output.match(/Offchain:\s+([\d,]+)/);
    const onchainMatch = output.match(/Onchain:\s+([\d,]+)/);
    const pendingMatch = output.match(/Pending exit:\s+([\d,]+)/);
    
    const offchain_sat = offchainMatch ? parseInt(offchainMatch[1].replace(/,/g, '')) : 0;
    const onchain_sat = onchainMatch ? parseInt(onchainMatch[1].replace(/,/g, '')) : 0;
    const pending_exit_sat = pendingMatch ? parseInt(pendingMatch[1].replace(/,/g, '')) : 0;
    const total = offchain_sat + onchain_sat + pending_exit_sat;
    
    res.json({ total, offchain_sat, onchain_sat, pending_exit_sat });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: 'Failed to get balance', details: error.message });
  }
});

app.get('/api/vtxo-pubkey', async (req, res) => {
  try {
    const output = await executeBark('vtxo-pubkey');
    res.json({ pubkey: output.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vtxos', async (req, res) => {
  try {
    // Eerst de huidige blokhoogte ophalen
    const currentHeight = await getCurrentBlockHeight();
    
    const output = await executeBark('vtxos');
    
    // Try to parse JSON directly first
    try {
      // Look for JSON array in the output
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const vtxosData = JSON.parse(jsonMatch[0]);
        
        // Map to our expected format
        const vtxos = vtxosData.map(vtxo => ({
          id: vtxo.id,
          amount: vtxo.amount_sat,
          type: vtxo.vtxo_type,
          expiry: vtxo.expiry_height
        }));
        
        res.json({ current_height: currentHeight, vtxos });
        return;
      }
    } catch (jsonError) {
      console.log('Could not parse VTXO JSON directly, falling back to regex parsing:', jsonError);
    }
    
    // Fallback to regex parsing if JSON parsing fails
    const vtxos = [];
    const vtxoRegex = /VTXO (\w+(?:-\w+)*), amount: ([\d,]+), type: (\w+), expiry(?:_height)?: (\d+)/g;
    
    let match;
    while ((match = vtxoRegex.exec(output)) !== null) {
      vtxos.push({
        id: match[1],
        amount: parseInt(match[2].replace(/,/g, '')),
        type: match[3],
        expiry: parseInt(match[4])
      });
    }
    
    res.json({ current_height: currentHeight, vtxos });
  } catch (error) {
    console.error('Error getting VTXOs:', error);
    res.status(500).json({ error: 'Failed to get VTXOs', details: error.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const output = await executeBark('refresh --all');
    res.json({ success: true, message: 'VTXOs refreshed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to refresh VTXOs in a round
app.post('/api/refresh-vtxos', async (req, res) => {
  try {
    const output = await executeBark('refresh');
    console.log('Refresh output:', output);
    res.json({ success: true, message: 'VTXOs refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing VTXOs:', error);
    res.status(500).json({ error: 'Failed to refresh VTXOs', details: error.message });
  }
});

// Send payment to a recipient
app.post('/api/send', async (req, res) => {
  try {
    // Zorg ervoor dat we hier zowel 'recipient' als oudere 'destination' parameter ondersteunen
    const recipient = req.body.recipient || req.body.destination;
    const { amount, comment } = req.body;
    
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient is required' });
    }
    
    // Build the command with arguments
    let args = [`${recipient}`];
    
    // If it's a Lightning invoice, we don't need to specify amount
    const isLightningInvoice = recipient.toLowerCase().startsWith('lnbc');
    
    if (!isLightningInvoice && !amount) {
      return res.status(400).json({ error: 'Amount is required for non-Lightning invoice payments' });
    }
    
    if (amount) {
      args.push(`${amount}sat`);
    }
    
    if (comment) {
      args.push(`-c "${comment}"`);
    }
    
    try {
      const output = await executeBark('send', args);
      console.log('Payment output:', output);
      
      res.json({ 
        success: true, 
        message: 'Payment sent successfully',
        details: output
      });
    } catch (error) {
      // Check if the error message actually indicates success
      // (bark sometimes returns error code even though payment succeeds)
      const errorMsg = error.message || '';
      
      if (
        errorMsg.includes('Payment sent') || 
        errorMsg.includes('Bolt11 payment succeeded') || 
        errorMsg.includes('Payment preimage received') ||
        errorMsg.includes('Adding change VTXO')
      ) {
        console.log('Payment sent successfully despite error code');
        res.json({ 
          success: true, 
          message: 'Payment sent successfully',
          details: errorMsg
        });
      } else {
        throw error; // Re-throw the error for the outer catch to handle
      }
    }
  } catch (error) {
    console.error('Error sending payment:', error);
    res.status(500).json({ error: 'Failed to send payment', details: error.message });
  }
});

// Check wallet status
app.get('/api/wallet-status', async (req, res) => {
  try {
    // Try to access vtxo-pubkey to check if wallet exists
    try {
      await executeBark('vtxo-pubkey');
      res.json({ initialized: true });
    } catch (error) {
      // If there's an error, assume the wallet doesn't exist yet
      res.json({ initialized: false });
    }
  } catch (error) {
    console.error('Error checking wallet status:', error);
    res.status(500).json({ error: 'Failed to check wallet status', details: error.message });
  }
});

// Initialize wallet
app.post('/api/init-wallet', async (req, res) => {
  try {
    // It's often better to use init with -s (signet flag) for testing
    const output = await executeBark('init', ['-s']);
    console.log('Init output:', output);
    res.json({ success: true, message: 'Wallet initialized successfully' });
  } catch (error) {
    console.error('Error initializing wallet:', error);
    res.status(500).json({ error: 'Failed to initialize wallet', details: error.message });
  }
});

// Add endpoint to delete wallet
app.post('/api/delete-wallet', async (req, res) => {
  try {
    const success = await deleteWallet();
    if (success) {
      res.json({ status: 'deleted', message: 'Wallet was deleted successfully.' });
    } else {
      res.json({ status: 'not_found', message: 'No wallet found to delete.' });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete wallet.', error: error.message });
  }
});

// Endpoint to board (move onchain funds to Ark)
app.post('/api/board', async (req, res) => {
  try {
    const { amount } = req.body;
    const args = [];
    
    if (amount) {
      args.push(`"${amount}"`);
    } else {
      args.push('--all');
    }
    
    const output = await executeBark('board', args);
    console.log('Board output:', output);
    
    res.json({ 
      success: true, 
      message: 'Successfully boarded funds to Ark',
      details: output 
    });
  } catch (error) {
    console.error('Error boarding funds:', error);
    res.status(500).json({ error: 'Failed to board funds', details: error.message });
  }
});

// Endpoint to check onchain balance
app.get('/api/onchain-balance', async (req, res) => {
  try {
    const output = await executeBark('onchain', ['balance']);
    
    // Try to parse the output to get the balance
    const balanceMatch = output.match(/Total:\s+([\d,]+)/);
    const balance = balanceMatch ? parseInt(balanceMatch[1].replace(/,/g, '')) : 0;
    
    res.json({ 
      balance,
      details: output 
    });
  } catch (error) {
    console.error('Error getting onchain balance:', error);
    res.status(500).json({ error: 'Failed to get onchain balance', details: error.message });
  }
});

// Endpoint to get onchain address
app.get('/api/onchain-address', async (req, res) => {
  try {
    const output = await executeBark('onchain', ['address']);
    
    // Try to parse the JSON output that bark returns
    try {
      // Parse the JSON object in the output
      const jsonData = JSON.parse(output);
      res.json({ 
        address: jsonData.address,
        details: output 
      });
    } catch (jsonError) {
      // Fallback to just using the string if JSON parsing fails
      const address = output.trim();
      res.json({ 
        address,
        details: output 
      });
    }
  } catch (error) {
    console.error('Error getting onchain address:', error);
    res.status(500).json({ error: 'Failed to get onchain address', details: error.message });
  }
});

// Endpoint to initiate unilateral exit
app.post('/api/exit', async (req, res) => {
  try {
    const { vtxoId, exitAll } = req.body;
    const args = ['--wait'];
    
    if (exitAll) {
      args.push('--all');
    } else if (vtxoId) {
      args.push('--vtxos', vtxoId);
    } else {
      return res.status(400).json({ error: 'Must specify either vtxoId or exitAll' });
    }
    
    // We can't wait for the full exit process to complete as it takes 1-2 hours
    // So we'll respond quickly and let the process continue in the background
    // In a production app, we would use websockets to update the UI as the exit progresses
    
    // Start the exit process
    executeBark('exit', args).then(output => {
      console.log('Exit completed successfully:', output);
    }).catch(error => {
      console.error('Error during exit process:', error);
    });
    
    res.json({ 
      success: true, 
      message: 'Unilateral exit process started. This will take 1-2 hours to complete.',
      warning: 'The process will continue in the background. Check your terminal for progress.'
    });
  } catch (error) {
    console.error('Error starting unilateral exit:', error);
    res.status(500).json({ error: 'Failed to start unilateral exit', details: error.message });
  }
});

// Start the server after checking prerequisites
checkServerPrerequisites((ready) => {
  // Try different ports if the default is in use
  function tryPort(portToTry) {
    const server = app.listen(portToTry, () => {
      console.log(`Ark wallet interface running at http://localhost:${portToTry}`);
      if (!ready) {
        console.warn('Warning: Server started but wallet initialization failed. Some functions may not work.');
      }
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${portToTry} is in use, trying another port...`);
        if (portToTry < 3003) {
          tryPort(portToTry + 1);
        } else {
          console.error('All alternative ports are in use. Please close some applications and try again.');
          process.exit(1);
        }
      } else {
        console.error('Error starting server:', err);
        process.exit(1);
      }
    });
  }
  
  // Start with the default port
  tryPort(port);
}); 