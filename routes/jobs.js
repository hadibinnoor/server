const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { getDatabase } = require('../database/init');
const { transcodeVideo, getVideoInfoFromS3 } = require('../services/transcoder');
const s3Service = require('../services/s3');

const router = express.Router();
// Helper: resolve numeric user_id from username (creates user if missing)
async function getOrCreateUserId(username) {
  const db = getDatabase();
  // Try find existing
  const user = await new Promise((resolve) => {
    db.get('SELECT id FROM users WHERE username = $1', [username], (err, row) => {
      if (err) return resolve(null);
      resolve(row || null);
    });
  });
  if (user && user.id !== undefined && user.id !== null) return user.id;

  // Create if not exists (use random password hash as placeholder)
  const randomPass = bcrypt.hashSync(Math.random().toString(36).slice(2), 10);
  await new Promise((resolve) => {
    db.run('INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING', [username, randomPass], () => resolve());
  });
  const created = await new Promise((resolve) => {
    db.get('SELECT id FROM users WHERE username = $1', [username], (err, row) => {
      if (err) return resolve(null);
      resolve(row || null);
    });
  });
  return created?.id;
}

// File type validation helper
function validateVideoFile(filename, mimetype) {
  const allowedTypes = /mp4|avi|mov|mkv|webm/;
  const extname = allowedTypes.test(path.extname(filename).toLowerCase());
  const mimetypeValid = allowedTypes.test(mimetype);
  
  return extname && mimetypeValid;
}

// Step 1: Generate pre-signed URL for upload
router.post('/upload-url', authenticateToken, async (req, res) => {
  try {
    // Check if S3 is configured
    if (!s3Service.isS3Configured()) {
      return res.status(503).json({ 
        error: 'S3 service not configured. Please configure AWS credentials to enable file uploads.',
        s3Required: true
      });
    }

    const { filename, contentType, outputFormat = '720p' } = req.body;

    // Validate file type
    if (!validateVideoFile(filename, contentType)) {
      return res.status(400).json({ error: 'Only video files are allowed (MP4, AVI, MOV, MKV, WebM)' });
    }

    const jobId = uuidv4();
    
    // Generate unique S3 key for the original video
    const s3Key = s3Service.generateKey(filename, 'videos');
    
    // Generate pre-signed URL for upload
    const uploadUrl = await s3Service.getSignedUploadUrl(s3Key, contentType);
    
    // Resolve numeric user id for jobs table
    const userId = await getOrCreateUserId(req.user.username);
    const db = getDatabase();
    const s3Url = `s3://${s3Service.bucketName}/${s3Key}`;
    
    db.run(
      `INSERT INTO jobs (id, user_id, original_filename, file_path, output_format, status) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [jobId, userId, filename, s3Url, outputFormat, 'uploading'],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          jobId,
          uploadUrl,
          s3Key,
          message: 'Upload URL generated successfully'
        });
      }
    );
  } catch (error) {
    console.error('Upload URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL: ' + error.message });
  }
});

// Step 2: Confirm upload completion and start transcoding
router.post('/upload-complete', authenticateToken, async (req, res) => {
  try {
    // Check if S3 is configured
    if (!s3Service.isS3Configured()) {
      return res.status(503).json({ 
        error: 'S3 service not configured. Please configure AWS credentials.',
        s3Required: true
      });
    }

    const { jobId, s3Key } = req.body;
    
    console.log('Upload complete request:', { jobId, s3Key, userId: req.user.username });

    if (!jobId || !s3Key) {
      console.log('Missing required fields:', { jobId: !!jobId, s3Key: !!s3Key });
      return res.status(400).json({ error: 'Job ID and S3 key are required' });
    }

    const db = getDatabase();
    const userId = await getOrCreateUserId(req.user.username);
    
    // Verify job exists and belongs to user
    console.log('Querying job:', { jobId, userId: req.user.username });
    db.get(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [jobId, userId],
      async (err, job) => {
        if (err) {
          console.error('Database query error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        console.log('Job found:', job);
        if (!job) {
          console.log('Job not found in database');
          return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'uploading') {
          return res.status(400).json({ error: 'Job is not in uploading state' });
        }

        try {
          // Verify file exists in S3
          const fileExists = await s3Service.fileExists(s3Key);
          if (!fileExists) {
            return res.status(400).json({ error: 'File not found in S3' });
          }

          // Get video info from S3
          const videoInfo = await getVideoInfoFromS3(s3Key);

          // Update job with video info and start transcoding
          db.run(
            'UPDATE jobs SET status = $1, file_size = $2, duration = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            ['processing', videoInfo.size, videoInfo.duration, jobId],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Start transcoding
              const s3Url = `s3://${process.env.S3_BUCKET_NAME}/${s3Key}`;
              transcodeVideo(jobId, s3Url, job.output_format)
                .catch(error => console.error('Transcoding failed:', error));

              res.json({
                jobId,
                message: 'Upload confirmed, transcoding started',
                videoInfo
              });
            }
          );
        } catch (error) {
          console.error('Upload confirmation error:', error);
          
          // Provide more specific error messages
          if (error.message.includes('Failed to get video info')) {
            res.status(400).json({ error: 'Invalid video file format or corrupted file' });
          } else if (error.message.includes('S3')) {
            res.status(503).json({ error: 'S3 service error: ' + error.message });
          } else {
            res.status(500).json({ error: 'Failed to confirm upload: ' + error.message });
          }
        }
      }
    );
  } catch (error) {
    console.error('Upload complete error:', error);
    res.status(500).json({ error: 'Upload confirmation failed' });
  }
});

// Get all jobs with download URLs (cached)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { cacheGet, cacheSet } = require('../services/cache');
    const userId = await getOrCreateUserId(req.user.username);
    const cacheKey = `jobs:list:${req.user.username}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const db = getDatabase();
    db.all(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
      async (err, jobs) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        try {
          const s3Ready = await s3Service.isS3Configured();
          if (!s3Ready) {
            await cacheSet(cacheKey, jobs, 45);
            return res.json(jobs);
          }

          // Add download URLs for each job (best-effort)
          const jobsWithUrls = await Promise.all(
            jobs.map(async (job) => {
              try {
                const originalKey = s3Service.extractKeyFromUrl(job.file_path);
                const downloadUrl = await s3Service.getSignedDownloadUrl(originalKey);
                
                let transcodedDownloadUrl = null;
                if (job.transcoded_path) {
                  const transcodedKey = s3Service.extractKeyFromUrl(job.transcoded_path);
                  transcodedDownloadUrl = await s3Service.getSignedDownloadUrl(transcodedKey);
                }

                return { ...job, downloadUrl, transcodedDownloadUrl };
              } catch (error) {
                console.error('Error generating download URLs for job:', job.id, error);
                return job;
              }
            })
          );

          await cacheSet(cacheKey, jobsWithUrls, 45);
          res.json(jobsWithUrls);
        } catch (genErr) {
          console.error('Jobs URL generation error:', genErr);
          // Return plain jobs if URL generation fails
          await cacheSet(cacheKey, jobs, 45);
          res.json(jobs);
        }
      }
    );
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Admin-only: list all jobs across users (must be before parameterized routes)
router.get('/all', authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    db.all('SELECT * FROM jobs ORDER BY created_at DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  } catch (error) {
    console.error('Admin list jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch all jobs' });
  }
});

// Get specific job with download URLs (cached)
router.get('/:jobId', authenticateToken, async (req, res) => {
  try {
    const { cacheGet, cacheSet } = require('../services/cache');
    const userId = await getOrCreateUserId(req.user.username);
    const cacheKey = `jobs:item:${req.params.jobId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const db = getDatabase();
    db.get(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [req.params.jobId, userId],
      async (err, job) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        try {
          // Add download URLs
          const originalKey = s3Service.extractKeyFromUrl(job.file_path);
          const downloadUrl = await s3Service.getSignedDownloadUrl(originalKey);
          
          let transcodedDownloadUrl = null;
          if (job.transcoded_path) {
            const transcodedKey = s3Service.extractKeyFromUrl(job.transcoded_path);
            transcodedDownloadUrl = await s3Service.getSignedDownloadUrl(transcodedKey);
          }

          const payload = { ...job, downloadUrl, transcodedDownloadUrl };
          await cacheSet(cacheKey, payload, 30);
          res.json(payload);
        } catch (urlError) {
          console.error('Error generating download URLs:', urlError);
          res.json(job);
        }
      }
    );
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Generate new download URL for a specific file
router.post('/:jobId/download-url', authenticateToken, async (req, res) => {
  try {
    const { fileType = 'original' } = req.body; // 'original' or 'transcoded'
    
    const db = getDatabase();
    db.get(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [req.params.jobId, req.user.username],
      async (err, job) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        try {
          let s3Key, downloadUrl;
          
          if (fileType === 'transcoded' && job.transcoded_path) {
            s3Key = s3Service.extractKeyFromUrl(job.transcoded_path);
            downloadUrl = await s3Service.getSignedDownloadUrl(s3Key);
          } else {
            s3Key = s3Service.extractKeyFromUrl(job.file_path);
            downloadUrl = await s3Service.getSignedDownloadUrl(s3Key);
          }

          res.json({
            downloadUrl,
            expiresIn: 3600, // 1 hour
            fileType
          });
        } catch (urlError) {
          console.error('Error generating download URL:', urlError);
          res.status(500).json({ error: 'Failed to generate download URL' });
        }
      }
    );
  } catch (error) {
    console.error('Generate download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// Update job (retranscode)
router.put('/:jobId', authenticateToken, (req, res) => {
  const { outputFormat } = req.body;
  const db = getDatabase();
  
  (async () => {
    const userId = await getOrCreateUserId(req.user.username);
    db.get(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [req.params.jobId, userId],
      (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (job.status === 'processing') {
        return res.status(400).json({ error: 'Cannot update job while processing' });
      }

      db.run(
        'UPDATE jobs SET output_format = $1, status = $2, progress = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [outputFormat, 'pending', req.params.jobId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Invalidate cache
          const { cacheDel } = require('../services/cache');
          cacheDel(`jobs:item:${req.params.jobId}`);
          cacheDel(`jobs:list:${req.user.username}`);

          // Retranscode using S3 URL
          transcodeVideo(req.params.jobId, job.file_path, outputFormat)
            .catch(error => console.error('Retranscoding failed:', error));

          res.json({ message: 'Job updated, retranscoding started', jobId: req.params.jobId });
        }
      );
    });
  })();
});

// Delete job and files from S3
router.delete('/:jobId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = await getOrCreateUserId(req.user.username);
    
    db.get(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [req.params.jobId, userId],
      async (err, job) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        try {
          // Delete original file from S3
          const originalKey = s3Service.extractKeyFromUrl(job.file_path);
          await s3Service.deleteFile(originalKey);

          // Delete transcoded file from S3 if it exists
          if (job.transcoded_path) {
            const transcodedKey = s3Service.extractKeyFromUrl(job.transcoded_path);
            await s3Service.deleteFile(transcodedKey);
          }
        } catch (s3Error) {
          console.error('S3 deletion error:', s3Error);
          // Continue with database deletion even if S3 deletion fails
        }

        // Delete job from database
        db.run('DELETE FROM jobs WHERE id = $1', [req.params.jobId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          const { cacheDel } = require('../services/cache');
          cacheDel(`jobs:item:${req.params.jobId}`);
          cacheDel(`jobs:list:${req.user.username}`);
          res.json({ message: 'Job deleted successfully' });
        });
      }
    );
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

module.exports = router;