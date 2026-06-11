require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS: allow your GitHub Pages domain and localhost ──
const allowedOrigins = [
  'https://machoayomide.github.io',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (chrome extension, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    // Also allow chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

// ── Serve the GigMaster dashboard as static files ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GigMaster API', version: '1.0.0' });
});

// ── Claude proxy endpoint ──
app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const { system, messages, max_tokens, tools } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const body = {
      model:      'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 1500,
      messages,
    };

    if (system)  body.system = system;
    if (tools)   body.tools  = tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    return res.json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// ── 404 ──
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`GigMaster backend running on port ${PORT}`);
});
