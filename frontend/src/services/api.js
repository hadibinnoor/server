import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Respect explicitly provided Authorization header
    if (!config.headers.Authorization && !config.headers.authorization) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat 401 as an auth failure for critical endpoints. Don't auto-logout on group fetch or jobs failures
    if (error.response?.status === 401 && 
        !error.config?.url?.includes('/user-groups') && 
        !error.config?.url?.includes('/jobs/all')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: async (username, email, password) => {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  },

  confirmEmail: async (username, confirmationCode) => {
    const response = await api.post('/auth/confirm', { username, confirmationCode });
    return response.data;
  },

  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  getUserInfo: async () => {
    // Use ID token to get groups claim
    const idToken = localStorage.getItem('idToken');
    const response = await api.get('/auth/user', {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined
    });
    return response.data;
  },

  // Get user groups from backend (fallback when token doesn't contain groups)
  getUserGroups: async () => {
    // Use ID token for group fetching
    const idToken = localStorage.getItem('idToken');
    console.log('getUserGroups - using ID token:', idToken ? idToken.substring(0, 50) + '...' : 'none');
    
    const response = await api.get('/auth/user-groups', {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined
    });
    return response.data;
  },
};

export const jobsAPI = {
  // Step 1: Get pre-signed URL for upload
  getUploadUrl: async (filename, contentType, outputFormat = '720p') => {
    const response = await api.post('/jobs/upload-url', { 
      filename, 
      contentType, 
      outputFormat 
    });
    return response.data;
  },

  // Step 2: Upload file directly to S3 using pre-signed URL
  uploadToS3: async (file, uploadUrl) => {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!response.ok) {
        // Get more detailed error info
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = response.statusText;
        }
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      // If CORS error, provide helpful message
      if (error.message.includes('CORS') || error.message.includes('blocked') || error.message.includes('Access-Control-Allow-Origin')) {
        throw new Error('CORS Error: Please configure CORS on your S3 bucket. Go to AWS S3 Console → n11521775-bucket → Permissions → CORS → Add the configuration provided in the console.');
      }
      throw error;
    }
  },

  // Step 3: Confirm upload completion
  confirmUpload: async (jobId, s3Key) => {
    const response = await api.post('/jobs/upload-complete', { 
      jobId, 
      s3Key 
    });
    return response.data;
  },

  // Complete upload workflow
  uploadVideo: async (file, outputFormat = '720p') => {
    try {
      // Step 1: Get pre-signed URL
      const { jobId, uploadUrl, s3Key } = await jobsAPI.getUploadUrl(
        file.name, 
        file.type, 
        outputFormat
      );

      // Step 2: Upload to S3
      await jobsAPI.uploadToS3(file, uploadUrl);

      // Step 3: Confirm upload
      const result = await jobsAPI.confirmUpload(jobId, s3Key);
      
      return {
        jobId,
        message: 'Video upload successful, transcoding started',
        originalFile: file.name,
        outputFormat,
        ...result
      };
    } catch (error) {
      // Check if it's an S3 configuration error
      if (error.response?.status === 503 && error.response?.data?.s3Required) {
        throw new Error('S3 service is not configured. Please contact the administrator to enable file uploads.');
      }
      
      // Check if it's a CORS error
      if (error.message.includes('CORS') || error.message.includes('blocked') || error.message.includes('Access-Control-Allow-Origin')) {
        throw new Error('CORS Error: Please configure CORS on your S3 bucket. Go to AWS S3 Console → n11521775-bucket → Permissions → CORS → Add the configuration provided in the console.');
      }
      
      // Check if it's a file not found error (upload didn't complete)
      if (error.response?.status === 400 && error.response?.data?.error?.includes('File not found in S3')) {
        throw new Error('Upload failed: File was not uploaded to S3. This may be due to CORS configuration issues.');
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }
  },

  getJobs: async () => {
    const response = await api.get('/jobs');
    return response.data;
  },

  getJob: async (jobId) => {
    const response = await api.get(`/jobs/${jobId}`);
    return response.data;
  },

  // Generate new download URL
  getDownloadUrl: async (jobId, fileType = 'original') => {
    const response = await api.post(`/jobs/${jobId}/download-url`, { fileType });
    return response.data;
  },

  updateJob: async (jobId, outputFormat) => {
    const response = await api.put(`/jobs/${jobId}`, { outputFormat });
    return response.data;
  },

  deleteJob: async (jobId) => {
    const response = await api.delete(`/jobs/${jobId}`);
    return response.data;
  },

  // Admin: get all jobs (requires Admins group)
  getAllJobs: async () => {
    // Use access token for jobs endpoint (backend middleware expects access token)
    const accessToken = localStorage.getItem('accessToken');
    console.log('getAllJobs - using access token:', accessToken ? accessToken.substring(0, 50) + '...' : 'none');
    
    const response = await api.get('/jobs/all', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
    });
    return response.data;
  }
};

export const healthAPI = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
