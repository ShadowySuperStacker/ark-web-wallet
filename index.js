const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Path to the bark executable - pointing to the root directory
const barkPath = path.join(__dirname, 'bark');

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

// Start the server
app.listen(port, () => {
  console.log(`Ark Wallet server running on http://localhost:${port}`);
}); 