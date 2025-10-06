import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

const MFASetup = ({ onClose, onMFAEnabled }) => {
  const [step, setStep] = useState(1); // 1: Setup, 2: Verify
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const setupMFA = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/mfa/setup');
      setQrCodeUrl(response.data.qrCodeUrl);
      setSecretCode(response.data.secretCode);
      setStep(2);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/mfa/verify-setup', { totpCode });
      alert('MFA has been successfully enabled!');
      await checkMFAStatus(); // Refresh local status
      onMFAEnabled && onMFAEnabled(); // Notify parent
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to verify MFA');
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    if (!window.confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/mfa/disable');
      alert('MFA has been disabled');
      await checkMFAStatus();
      onMFAEnabled && onMFAEnabled(); // Notify parent to refresh
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  if (mfaStatus?.mfaEnabled) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">MFA Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="text-center">
            <div className="mb-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✓ MFA Enabled
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Multi-factor authentication is currently enabled for your account.
            </p>
            <button
              onClick={disableMFA}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable MFA'}
            </button>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {step === 1 ? 'Setup MFA' : 'Verify MFA'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {step === 1 && (
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Secure Your Account
              </h3>
              <p className="text-gray-600 mb-6">
                Add an extra layer of security to your account with multi-factor authentication.
              </p>
            </div>
            <button
              onClick={setupMFA}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Setup MFA'}
            </button>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Scan QR Code
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <QRCodeSVG value={qrCodeUrl} size={200} />
                </div>
              )}
              <div className="mt-4 p-3 bg-gray-100 rounded-md">
                <p className="text-xs text-gray-600 mb-1">Manual entry code:</p>
                <code className="text-sm font-mono break-all">{secretCode}</code>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit code from your app:
              </label>
              <input
                type="text"
                id="totpCode"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono"
                placeholder="000000"
                maxLength="6"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={verifyMFA}
                disabled={loading || totpCode.length !== 6}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MFASetup;
