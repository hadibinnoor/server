const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getDatabase } = require('../database/init');
const s3Service = require('./s3');

function transcodeVideo(jobId, inputS3Url, outputFormat = '720p') {
  return new Promise(async (resolve, reject) => {
    try {
      const db = getDatabase();
      
      // Extract S3 key from URL
      const inputKey = s3Service.extractKeyFromUrl(inputS3Url);
      
      // Generate output S3 key
      const outputKey = s3Service.generateKey(`${jobId}_${outputFormat}.mp4`, 'transcoded');
      
      // Create temporary files for processing in /tmp directory
      const tempDir = os.tmpdir();
      console.log(`Using temporary directory: ${tempDir}`);
      
      // Ensure we're using /tmp for security and statelessness
      if (!tempDir.startsWith('/tmp')) {
        console.warn(`Warning: Temporary directory is not /tmp: ${tempDir}`);
      }
      
      const tempInputPath = path.join(tempDir, `input_${jobId}_${Date.now()}.mp4`);
      const tempOutputPath = path.join(tempDir, `output_${jobId}_${Date.now()}.mp4`);

      db.run('UPDATE jobs SET status = $1 WHERE id = $2', ['processing', jobId]);

      // Download file from S3 to temporary location
      console.log(`Downloading file from S3 for job ${jobId}...`);
      const downloadUrl = await s3Service.getSignedDownloadUrl(inputKey);
      
      // Use ffmpeg to download and process the file
      const command = ffmpeg(downloadUrl)
        .output(tempOutputPath)
        .videoCodec('libx264')
        .audioCodec('aac');

      // Set output format parameters
      switch (outputFormat) {
        case '480p':
          command.size('854x480').videoBitrate('1000k');
          break;
        case '720p':
          command.size('1280x720').videoBitrate('2500k');
          break;
        case '1080p':
          command.size('1920x1080').videoBitrate('5000k');
          break;
        default:
          command.size('1280x720').videoBitrate('2500k');
      }

      command
        .on('start', (commandLine) => {
          console.log(`Started transcoding job ${jobId}: ${commandLine}`);
        })
        .on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          db.run('UPDATE jobs SET progress = $1 WHERE id = $2', [percent, jobId], (err) => {
            if (err) console.error('Progress update error:', err);
          });
          console.log(`Job ${jobId} progress: ${percent}%`);
        })
        .on('end', async () => {
          try {
            console.log(`Transcoding completed for job ${jobId}, uploading to S3...`);
            
            // Read the transcoded file
            const transcodedBuffer = fs.readFileSync(tempOutputPath);
            
            // Upload transcoded file to S3
            const outputS3Url = await s3Service.uploadFile(
              transcodedBuffer,
              outputKey,
              'video/mp4'
            );

            // Update database with S3 URL
            db.run(
              'UPDATE jobs SET status = $1, progress = $2, transcoded_path = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
              ['completed', 100, outputS3Url, jobId],
              (err) => {
                if (err) {
                  console.error('Database update error:', err);
                  reject(err);
                } else {
                  console.log(`Job ${jobId} completed successfully`);
                  resolve(outputS3Url);
                }
              }
            );

            // Clean up temporary files
            cleanupTempFiles(tempInputPath, tempOutputPath);
            
          } catch (uploadError) {
            console.error(`S3 upload error for job ${jobId}:`, uploadError);
            db.run(
              'UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              ['failed', jobId]
            );
            cleanupTempFiles(tempInputPath, tempOutputPath);
            reject(uploadError);
          }
        })
        .on('error', (err) => {
          console.error(`Transcoding error for job ${jobId}:`, err);
          db.run(
            'UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['failed', jobId]
          );
          cleanupTempFiles(tempInputPath, tempOutputPath);
          reject(err);
        })
        .run();

    } catch (error) {
      console.error(`Setup error for job ${jobId}:`, error);
      db.run(
        'UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['failed', jobId]
      );
      reject(error);
    }
  });
}

function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          width: videoStream?.width,
          height: videoStream?.height,
          format: metadata.format.format_name
        });
      }
    });
  });
}

// Helper function to clean up temporary files
function cleanupTempFiles(...filePaths) {
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  });
}

// Alternative function to get video info from S3 URL
async function getVideoInfoFromS3(s3Key) {
  try {
    // Get pre-signed download URL for the S3 key
    const downloadUrl = await s3Service.getSignedDownloadUrl(s3Key);
    
    // Use ffmpeg to download and probe
    return new Promise((resolve, reject) => {
      ffmpeg(downloadUrl)
        .ffprobe((err, metadata) => {
          if (err) {
            console.error('FFprobe error:', err);
            reject(new Error(`Failed to get video info: ${err.message}`));
          } else {
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            resolve({
              duration: metadata.format.duration,
              size: metadata.format.size,
              width: videoStream?.width,
              height: videoStream?.height,
              format: metadata.format.format_name
            });
          }
        });
    });
  } catch (error) {
    console.error('getVideoInfoFromS3 error:', error);
    throw new Error(`Failed to get video info from S3: ${error.message}`);
  }
}

module.exports = { 
  transcodeVideo, 
  getVideoInfo,
  getVideoInfoFromS3 
};