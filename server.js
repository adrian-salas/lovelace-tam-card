// Simple CORS proxy server for TAM CSV API
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Route to fetch TAM CSV data
app.get('/api/tam-csv', async (req, res) => {
  try {
    console.log('Fetching TAM CSV data...');
    
    const response = await axios.get(
      'https://data.montpellier3m.fr/sites/default/files/ressources/TAM_MMM_TpsReel.csv',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    // Set proper headers for CSV
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    console.log(`✅ Successfully fetched TAM CSV data (${response.data.length} bytes)`);
    res.send(response.data);
  } catch (error) {
    console.error('❌ Error fetching TAM CSV:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch TAM CSV data',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TAM CSV Proxy is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 TAM CSV Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 CSV endpoint: http://localhost:${PORT}/api/tam-csv`);
});
