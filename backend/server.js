const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth'); // ← Add this

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes); // ← Add this

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ZoneConquer backend running on http://localhost:${PORT}`);
});

