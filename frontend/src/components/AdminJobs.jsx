import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AdminJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = Array.isArray(user?.groups) && user.groups.includes('Admins');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await jobsAPI.getAllJobs();
        setJobs(data);
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load jobs');
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


