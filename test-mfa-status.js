#!/usr/bin/env node

/**
 * MFA Status Test Script
 * 
 * This script tests the MFA status endpoint specifically.
 * Usage: node test-mfa-status.js [ACCESS_TOKEN]
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testMFAStatus(accessToken) {
  console.log('\n📊 Testing MFA Status Endpoint...');
  
  if (!accessToken) {
    console.log('❌ No access token provided');
    console.log('Usage: node test-mfa-status.js [ACCESS_TOKEN]');
    return;
  }
  
  try {
    console.log('Making request to /mfa/status...');
    
    const response = await axios.get(`${BASE_URL}/mfa/status`, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ MFA Status Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.mfaEnabled) {
      console.log('🔒 MFA is ENABLED for this user');
    } else {
      console.log('🔓 MFA is NOT ENABLED for this user');
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ MFA Status error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

async function testWithTestUser() {
  console.log('\n🧪 Testing with test user login...');
  
  try {
    // First login to get a token
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'testuser',
      password: 'password123'
    });
    
    if (loginResponse.data.success && loginResponse.data.accessToken) {
      console.log('✅ Test user login successful');
      return await testMFAStatus(loginResponse.data.accessToken);
    } else {
      console.log('❌ Test user login failed or no access token');
      return null;
    }
  } catch (error) {
    console.error('❌ Test user login error:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 MFA Status Test');
  console.log('==================');
  
  const accessToken = process.argv[2];
  
  if (accessToken) {
    console.log('Using provided access token...');
    await testMFAStatus(accessToken);
  } else {
    console.log('No access token provided, testing with test user...');
    await testWithTestUser();
  }
  
  console.log('\n📋 Instructions:');
  console.log('1. If using test user: MFA endpoints will fail (expected)');
  console.log('2. For real testing: Login with Cognito user and use that token');
  console.log('3. Check server logs for detailed MFA status information');
}

main().catch(console.error);
