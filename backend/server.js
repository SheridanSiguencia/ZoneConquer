require('dotenv').config({ path: '../.env' });

const express = require('express');
const session = require('express-session');  
const cors = require('cors');
const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/user');
const territoryRoutes = require('./routes/territories'); 

const app = express();
const PORT = 3000;

// ✅ MIDDLEWARE ORDER MATTERS!
app.use(cors({
    origin: true,  // Allows all origins (or specify your Expo app URL)
    credentials: true  // ← THIS IS CRITICAL for sessions to work!
  }));
app.use(express.json());

// ✅ SESSION MIDDLEWARE MUST COME BEFORE ROUTES
app.use(session({
  secret: process.env.SESSION_SECRET || 'zoneconquer-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ✅ THEN YOUR ROUTES (after session middleware)
app.use('/api/auth', authRoutes);             // auth
app.use('/api/user', userRoutes);             // user
app.use('/api/territories', territoryRoutes); // map

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ZoneConquer backend running on http://localhost:${PORT}`);
});