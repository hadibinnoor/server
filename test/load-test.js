const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function loginUser(username, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

async function uploadVideo(token, videoBuffer, filename, outputFormat = '720p') {
  try {
    const formData = new FormData();
    formData.append('video', videoBuffer, filename);
    formData.append('outputFormat', outputFormat);

    const response = await fetch(`${API_BASE}/jobs/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Upload successful: ${data.jobId}`);
    return data.jobId;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

async function checkJobStatus(token, jobId) {
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    const job = await response.json();
    return job;
  } catch (error) {
    console.error('Status check error:', error);
    return null;
  }
}

async function runLoadTest() {
  console.log('🚀 Starting video transcoding load test...');
  console.log(`API URL: ${API_BASE}`);
  
  const token = await loginUser('admin', 'admin123');
  if (!token) {
    console.error('❌ Failed to login');
    return;
  }
  
  console.log('✓ Login successful');

  console.log('\n📹 Creating test video files...');
  
  const fs = require('fs');
  const path = require('path');
  
  // Use real video file if available, otherwise create fake content
  const testVideoPath = './test-video.mp4'; // Put your test video here
  const testVideos = [];
  const formats = ['480p', '720p', '1080p'];
  
  let videoBuffer;
  if (fs.existsSync(testVideoPath)) {
    console.log(`Using real video file: ${testVideoPath}`);
    videoBuffer = fs.readFileSync(testVideoPath);
  } else {
    console.log('Using fake video data - upload will fail but demonstrates API calls');
    videoBuffer = Buffer.from('fake video content for testing'.repeat(10000)); // Larger buffer
  }
  
  for (let i = 0; i < 3; i++) {
    testVideos.push({ 
      buffer: videoBuffer, 
      filename: `test-video-${i}.mp4`,
      format: formats[i] 
    });
  }

  console.log(`✓ Created ${testVideos.length} test video files`);
  
  console.log('\n🔄 Starting parallel uploads...');
  const uploadPromises = testVideos.map((video, index) => {
    return uploadVideo(token, video.buffer, video.filename, video.format);
  });

  const jobIds = await Promise.all(uploadPromises);
  const validJobIds = jobIds.filter(id => id !== null);
  
  if (validJobIds.length === 0) {
    console.error('❌ No uploads succeeded');
    return;
  }

  console.log(`\n✓ ${validJobIds.length} uploads started successfully`);
  console.log('📊 Monitoring job progress...');

  let completedJobs = 0;
  const startTime = Date.now();

  const monitorInterval = setInterval(async () => {
    const statusPromises = validJobIds.map(jobId => checkJobStatus(token, jobId));
    const statuses = await Promise.all(statusPromises);
    
    let processing = 0;
    let completed = 0;
    let failed = 0;

    statuses.forEach((job, index) => {
      if (!job) return;
      
      const jobId = validJobIds[index];
      const shortId = jobId.substring(0, 8);
      
      switch (job.status) {
        case 'processing':
          processing++;
          console.log(`⏳ ${shortId}: ${job.progress}% (${job.output_format})`);
          break;
        case 'completed':
          if (!job._logged) {
            completed++;
            console.log(`✅ ${shortId}: Completed in ${((Date.now() - new Date(job.created_at).getTime()) / 1000).toFixed(1)}s`);
            job._logged = true;
            completedJobs++;
          }
          break;
        case 'failed':
          failed++;
          console.log(`❌ ${shortId}: Failed`);
          break;
        default:
          console.log(`⌛ ${shortId}: ${job.status}`);
      }
    });

    if (completedJobs === validJobIds.length || Date.now() - startTime > 600000) {
      clearInterval(monitorInterval);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n🎉 Load test completed in ${totalTime}s`);
      console.log(`📈 Results: ${completedJobs} completed, ${failed} failed`);
      
      if (completedJobs > 0) {
        console.log('✅ CPU-intensive transcoding process successfully demonstrated');
      }
    }
  }, 5000);
}

if (require.main === module) {
  (async () => {
    const { default: fetch } = await import('node-fetch');
    const FormData = require('form-data');
    
    // Make fetch global
    global.fetch = fetch;
    global.FormData = FormData;
    
    runLoadTest().catch(console.error);
  })();
}

module.exports = { runLoadTest };