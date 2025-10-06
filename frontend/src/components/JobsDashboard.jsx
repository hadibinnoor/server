import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trash2, 
  RefreshCw,
  Download,
  Calendar,
  FileVideo
} from 'lucide-react';
import { jobsAPI } from '../services/api';

const JobsDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingJob, setDeletingJob] = useState(null);

  const fetchJobs = async () => {
    try {
      const data = await jobsAPI.getJobs();
      setJobs(data);
      setError('');
    } catch (error) {
      setError('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job? This will remove the job and all associated files.')) {
      return;
    }

    setDeletingJob(jobId);
    try {
      await jobsAPI.deleteJob(jobId);
      setJobs(jobs.filter(job => job.id !== jobId));
    } catch (error) {
      setError('Failed to delete job');
    } finally {
      setDeletingJob(null);
    }
  };

  const handleRetranscode = async (jobId, currentFormat) => {
    const newFormat = currentFormat === '720p' ? '1080p' : '720p';
    try {
      await jobsAPI.updateJob(jobId, newFormat);
      fetchJobs(); // Refresh jobs
    } catch (error) {
      setError('Failed to retranscode job');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">Loading jobs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Transcoding Jobs</h2>
        <button
          onClick={fetchJobs}
          className="btn-secondary"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="card text-center py-12">
          <FileVideo className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload a video to start your first transcoding job.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {job.original_filename}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Job ID: {job.id.substring(0, 8)}...
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Status</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Output Format</p>
                      <p className="text-sm text-gray-900">{job.output_format}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">File Size</p>
                      <p className="text-sm text-gray-900">{formatFileSize(job.file_size)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Duration</p>
                      <p className="text-sm text-gray-900">{formatDuration(job.duration)}</p>
                    </div>
                  </div>

                  {job.status === 'processing' && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    Created: {formatDate(job.created_at)}
                    {job.updated_at !== job.created_at && (
                      <>
                        <span className="mx-2">•</span>
                        Updated: {formatDate(job.updated_at)}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col space-y-2 ml-4">
                  {job.status === 'completed' && job.transcodedDownloadUrl && (
                    <button
                      onClick={async () => {
                        try {
                          // Generate fresh download URL
                          const { downloadUrl } = await jobsAPI.getDownloadUrl(job.id, 'transcoded');
                          window.open(downloadUrl, '_blank');
                        } catch (error) {
                          console.error('Failed to generate download URL:', error);
                          // Fallback to existing URL
                          window.open(job.transcodedDownloadUrl, '_blank');
                        }
                      }}
                      className="btn-secondary text-sm"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </button>
                  )}
                  
                  {job.downloadUrl && (
                    <button
                      onClick={async () => {
                        try {
                          // Generate fresh download URL
                          const { downloadUrl } = await jobsAPI.getDownloadUrl(job.id, 'original');
                          window.open(downloadUrl, '_blank');
                        } catch (error) {
                          console.error('Failed to generate download URL:', error);
                          // Fallback to existing URL
                          window.open(job.downloadUrl, '_blank');
                        }
                      }}
                      className="btn-secondary text-sm"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Original
                    </button>
                  )}
                  
                  {job.status === 'completed' && (
                    <button
                      onClick={() => handleRetranscode(job.id, job.output_format)}
                      className="btn-secondary text-sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retranscode
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    disabled={deletingJob === job.id}
                    className="btn-danger text-sm disabled:opacity-50"
                  >
                    {deletingJob === job.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsDashboard;
