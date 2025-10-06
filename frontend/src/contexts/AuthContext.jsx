import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    
    if (accessToken && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      
      if (response.success) {
        // Store Cognito tokens
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('idToken', response.idToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        
        // Get user info from ID token
        const userInfo = await authAPI.getUserInfo();
        
        localStorage.setItem('user', JSON.stringify(userInfo));
        setUser(userInfo);
        
        return { success: true };
      } else if (response.requiresMFA) {
        // Return MFA challenge info
        console.log('AuthContext - MFA Challenge data:', {
          hasSession: !!response.session,
          sessionLength: response.session?.length,
          sessionPreview: response.session?.substring(0, 50) + '...',
          challengeName: response.challengeName
        });
        return { 
          success: false, 
          requiresMFA: true,
          session: response.session,
          challengeName: response.challengeName,
          message: response.message 
        };
      } else {
        return { success: false, error: response.message || 'Login failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
