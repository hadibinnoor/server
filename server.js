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

app.listen(PORT, () => {
  console.log(`Video transcoding server running on port ${PORT}`);
});