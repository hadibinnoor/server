import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AdminJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = Array.isArray(user?.groups) && user.groups.includes('Admins');
  
  // Debug logging
  console.log('AdminJobs - user object:', user);
  console.log('AdminJobs - groups:', user?.groups);
  console.log('AdminJobs - isAdmin:', isAdmin);

  useEffect(() => {
    const load = async () => {
      try {
        // Debug: check what tokens are available
        const accessToken = localStorage.getItem('accessToken');
        const idToken = localStorage.getItem('idToken');
        console.log('AdminJobs - tokens available:', {
          hasAccessToken: !!accessToken,
          hasIdToken: !!idToken,
          accessTokenPreview: accessToken ? accessToken.substring(0, 50) + '...' : 'none',
          idTokenPreview: idToken ? idToken.substring(0, 50) + '...' : 'none'
        });
        
        // Now that groups are working, try the API call
        console.log('AdminJobs - attempting getAllJobs call');
        const data = await jobsAPI.getAllJobs();
        setJobs(data);
      } catch (e) {
        console.error('AdminJobs - error loading jobs:', e);
        const errorMessage = e.response?.data?.error || e.message || 'Failed to load jobs';
        console.log('AdminJobs - error details:', {
          status: e.response?.status,
          error: errorMessage,
          url: e.config?.url
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-md bg-yellow-50 p-4">
          <p className="text-yellow-800 text-sm">You do not have admin access.</p>
          <p className="text-yellow-700 text-xs mt-2">
            Debug: User groups = {JSON.stringify(user?.groups)} | 
            IsAdmin = {isAdmin.toString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">All Jobs (Admin)</h1>
      {loading && <p className="text-gray-600">Loading...</p>}
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      {!loading && !error && (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Format</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-2 text-sm text-gray-900 font-mono">{job.id}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{job.user_id}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{job.original_filename}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{job.output_format}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{job.status}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{new Date(job.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminJobs;


