require('dotenv').config({ path: '../.env' });
console.log('[server] DATABASE_URL in server.js =', process.env.DATABASE_URL);

const express = require('express');
const session = require('express-session');  
const cors = require('cors');
const { router: authRouter } = require('./routes/auth');
const userRoutes = require('./routes/user');
const territoryRoutes = require('./routes/territories');
const friendsRoutes = require('./routes/friends'); 
const gamificationRoutes = require('./routes/gamification'); // Import gamification routes
const app = express();
//  tiny logger to see every request
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.url}`);
  next();
});

const PORT = 3000;


app.use(cors({
    origin: true, 
    credentials: true  
  }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'zoneconquer-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));




app.use('/api/auth', authRouter);             // auth
app.use('/api/user', userRoutes);             // user
app.use('/api/territories', territoryRoutes); // map
app.use('/api/friends', friendsRoutes);       // friends
app.use('/api/gamification', gamificationRoutes); // gamification

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