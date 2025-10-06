require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const mfaRoutes = require('./routes/mfa');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Removed express.static('uploads') - all files are served from S3

initDatabase();

app.use('/auth', authRoutes);
app.use('/jobs', jobRoutes);
app.use('/mfa', mfaRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend (single-EC2 setup): serve Vite build from frontend/dist
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// SPA fallback: send index.html for non-API routes
app.get(/^(?!\/(auth|jobs|mfa|health)\b).*/, (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Video transcoding server running on port ${PORT}`);
});