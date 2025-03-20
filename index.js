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

// Path to the bark executable - pointing to the root directory
const barkPath = './bark';

// Helper function to execute bark commands
function executeBark(command) {
  return new Promise((resolve, reject) => {
    exec(`${barkPath} ${command}`, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

// Helper function to check if a wallet exists
function checkWalletExists() {
  // Ark stores wallet data in ~/.bark directory
  const homedir = require('os').homedir();
  const barkDir = path.join(homedir, '.bark');
  return fs.existsSync(barkDir);
}

// Initialize wallet if it doesn't exist
function initializeWallet(callback) {
  // Use the ASP server specified in the documentation
  const aspServer = "ark.signet.2nd.dev";
  // Use the esplora server specified in the documentation
  const esploraUrl = "esplora.signet.2nd.dev";
  
  exec(`${barkPath} create --signet --asp=${aspServer} --esplora=${esploraUrl}`, (error, stdout, stderr) => {
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
    const homedir = require('os').homedir();
    const barkDir = path.join(homedir, '.bark');
    
    if (fs.existsSync(barkDir)) {
      // Use rimraf or fs.rm with recursive option to delete directory
      try {
        // For Node.js >= 14.14.0
        if (fs.rmSync) {
          fs.rmSync(barkDir, { recursive: true, force: true });
        } else {
          // For older Node.js versions
          const rimraf = require('rimraf');
          rimraf.sync(barkDir);
        }
        console.log('Wallet deleted successfully.');
        resolve(true);
      } catch (error) {
        console.error('Error deleting wallet:', error);
        reject(error);
      }
    } else {
      console.log('No wallet to delete.');
      resolve(false);
    }
  });
}

// API Endpoints
app.get('/api/balance', async (req, res) => {
  try {
    const output = await executeBark('balance');
    // Extract the JSON part from the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const balanceJson = JSON.parse(jsonMatch[0]);
      res.json(balanceJson);
    } else {
      res.status(500).json({ error: 'Failed to parse balance output' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vtxo-pubkey', async (req, res) => {
  try {
    const output = await executeBark('vtxo-pubkey');
    const pubkey = output.trim().split('\n').pop();
    res.json({ pubkey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vtxos', async (req, res) => {
  try {
    const output = await executeBark('vtxos');
    // Extract the JSON array part from the output
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const vtxosJson = JSON.parse(jsonMatch[0]);
      res.json(vtxosJson);
    } else {
      res.status(500).json({ error: 'Failed to parse VTXOs output' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
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

app.post('/api/send', async (req, res) => {
  try {
    const { destination, amount, comment } = req.body;
    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    let command = `send ${destination}`;
    
    // Add 'sat' denomination to amount if provided
    if (amount) command += ` ${amount}sat`;
    if (comment) command += ` "${comment}"`;

    const output = await executeBark(command);
    res.json({ success: true, message: 'Payment sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint to initialize or check wallet status
app.get('/api/wallet-status', (req, res) => {
  const walletExists = checkWalletExists();
  if (walletExists) {
    res.json({ status: 'ready', message: 'Wallet is ready to use.' });
  } else {
    initializeWallet((success) => {
      if (success) {
        res.json({ status: 'initialized', message: 'Wallet was initialized successfully.' });
      } else {
        res.status(500).json({ status: 'error', message: 'Failed to initialize wallet.' });
      }
    });
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