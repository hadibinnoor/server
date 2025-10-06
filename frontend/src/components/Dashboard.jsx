import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Upload, BarChart3, Settings, Shield, ShieldCheck } from 'lucide-react';
import VideoUpload from './VideoUpload';
import JobsDashboard from './JobsDashboard';
import MFASetup from './MFASetup';
import api from '../services/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaStatus, setMfaStatus] = useState(null);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const response = await api.get('/mfa/status');
      setMfaStatus(response.data);
    } catch (error) {
      console.error('Failed to check MFA status:', error);
    }
  };

  const handleUploadSuccess = (result) => {
    setUploadSuccess(result);
    setActiveTab('jobs');
    // Clear success message after 5 seconds
    setTimeout(() => setUploadSuccess(null), 5000);
  };

  const tabs = [
    { id: 'upload', label: 'Upload Video', icon: Upload },
    { id: 'jobs', label: 'My Jobs', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Video Transcoding Platform
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user?.username}</span>
              </span>
              <button
                onClick={() => setShowMFASetup(true)}
                className={`btn-secondary ${mfaStatus?.mfaEnabled ? 'text-green-600 border-green-300 hover:bg-green-50' : ''} ${mfaStatus?.isTestUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={
                  mfaStatus?.isTestUser 
                    ? 'MFA not available for test user' 
                    : mfaStatus?.mfaEnabled 
                      ? 'MFA Enabled - Click to manage' 
                      : 'Setup Multi-Factor Authentication'
                }
                disabled={mfaStatus?.isTestUser}
              >
                {mfaStatus?.mfaEnabled ? (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                {mfaStatus?.isTestUser 
                  ? 'MFA (Test User)' 
                  : mfaStatus?.mfaEnabled 
                    ? 'MFA Enabled' 
                    : 'Setup MFA'
                }
              </button>
              <button
                onClick={logout}
                className="btn-secondary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 inline mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Success Message */}
      {uploadSuccess && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Upload Successful!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Job ID: {uploadSuccess.jobId}</p>
                  <p>Output Format: {uploadSuccess.outputFormat}</p>
                  <p>Transcoding has started. Check the Jobs tab for progress.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' && <VideoUpload onUploadSuccess={handleUploadSuccess} />}
        {activeTab === 'jobs' && <JobsDashboard />}
      </main>

      {/* MFA Setup Modal */}
      {showMFASetup && !mfaStatus?.isTestUser && (
        <MFASetup
          onClose={() => setShowMFASetup(false)}
          onMFAEnabled={() => {
            setShowMFASetup(false);
            checkMFAStatus(); // Refresh MFA status
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
