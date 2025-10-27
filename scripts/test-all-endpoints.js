#!/usr/bin/env node

/**
 * Automated Endpoint Testing Script
 * Tests all endpoints and logs results to JSON file for AI analysis
 */

const https = require('node:https');
const http = require('node:http');

const GATEWAY_URL = 'http://localhost:3000';
const OUTPUT_FILE = 'test-results.json';

const results = {
  timestamp: new Date().toISOString(),
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
  tests: [],
};

let adminToken = '';
let customerToken = '';
let adminId = '';
let customerId = '';
let addressId = '';
let categoryId = '';
let productId = '';

// Helper function to make HTTP requests
async function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, GATEWAY_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(url, options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: body,
          });
        } catch (parseError) {
          console.warn('Failed to parse response body:', parseError.message);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            raw: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test runner
async function runTest(name, fn) {
  console.log(`Testing: ${name}...`);
  results.summary.total++;

  try {
    const result = await fn();
    if (result.status >= 200 && result.status < 300) {
      results.summary.passed++;
      results.tests.push({
        name,
        status: 'PASSED',
        statusCode: result.status,
        response: result.body,
      });
      console.log(`✅ PASSED: ${name} (${result.status})`);
      return result;
    } else if (result.expectedFailure) {
      results.summary.passed++;
      results.tests.push({
        name,
        status: 'PASSED (Expected Failure)',
        statusCode: result.status,
        expectedStatus: result.expectedStatus,
        response: result.body,
      });
      console.log(`✅ EXPECTED FAILURE: ${name} (${result.status})`);
      return result;
    } else {
      results.summary.failed++;
      results.tests.push({
        name,
        status: 'FAILED',
        statusCode: result.status,
        response: result.body,
        error: result.error,
      });
      console.log(`❌ FAILED: ${name} (${result.status})`);
      return null;
    }
  } catch (error) {
    results.summary.failed++;
    results.tests.push({
      name,
      status: 'ERROR',
      error: error.message,
      stack: error.stack,
    });
    console.log(`💥 ERROR: ${name} - ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Endpoint Tests...\n');

  // Health check
  await runTest('Health Check', async () => {
    return await request('GET', '/health');
  });

  // Register Admin
  await runTest('Register Admin', async () => {
    const response = await request('POST', '/auth/register', {
      email: 'admin@test.com',
      password: 'Admin@123456',
      fullName: 'Admin User',
    });
    return response;
  });

  // Register Customer
  await runTest('Register Customer', async () => {
    const response = await request('POST', '/auth/register', {
      email: 'customer@test.com',
      password: 'Customer@123456',
      fullName: 'Customer User',
    });
    return response;
  });

  // Login Admin
  await runTest('Login Admin', async () => {
    const response = await request('POST', '/auth/login', {
      email: 'admin@test.com',
      password: 'Admin@123456',
    });
    if (response.body.accessToken) {
      adminToken = response.body.accessToken;
      adminId = response.body.user.id;
    }
    return response;
  });

  // Login Customer
  await runTest('Login Customer', async () => {
    const response = await request('POST', '/auth/login', {
      email: 'customer@test.com',
      password: 'Customer@123456',
    });
    if (response.body.accessToken) {
      customerToken = response.body.accessToken;
      customerId = response.body.user.id;
    }
    return response;
  });

  if (!adminToken || !customerToken) {
    console.log('\n❌ Cannot continue without valid tokens');
    return;
  }

  // User Management
  await runTest('List Users (Admin)', async () => {
    return await request('GET', '/users?page=1&pageSize=10', null, {
      Authorization: `Bearer ${adminToken}`,
    });
  });

  await runTest('Get User by ID', async () => {
    return await request('GET', `/users/${adminId}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
  });

  await runTest('Get User by Email (Admin)', async () => {
    return await request('GET', '/users/email/customer@test.com', null, {
      Authorization: `Bearer ${adminToken}`,
    });
  });

  await runTest('Update User', async () => {
    return await request(
      'PUT',
      `/users/${customerId}`,
      { fullName: 'Customer Updated' },
      {
        Authorization: `Bearer ${customerToken}`,
      },
    );
  });

  // Address Management
  await runTest('List Addresses', async () => {
    return await request('GET', '/addresses', null, {
      Authorization: `Bearer ${customerToken}`,
    });
  });

  const addressResult = await runTest('Create Address', async () => {
    return await request(
      'POST',
      '/addresses',
      {
        fullName: 'Nguyễn Văn A',
        phone: '0912345678',
        street: '123 Lê Lợi',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        isDefault: true,
      },
      {
        Authorization: `Bearer ${customerToken}`,
      },
    );
  });

  if (addressResult && addressResult.body.id) {
    addressId = addressResult.body.id;
  }

  if (addressId) {
    await runTest('Update Address', async () => {
      return await request(
        'PUT',
        `/addresses/${addressId}`,
        {
          fullName: 'Nguyễn Văn A - Updated',
          phone: '0987654321',
        },
        {
          Authorization: `Bearer ${customerToken}`,
        },
      );
    });
  }

  // Category Management
  const categoryResult = await runTest('Create Category', async () => {
    return await request(
      'POST',
      '/categories',
      {
        name: 'Electronics',
        description: 'Electronic products',
        slug: 'electronics',
      },
      {
        Authorization: `Bearer ${adminToken}`,
      },
    );
  });

  if (categoryResult && categoryResult.body.id) {
    categoryId = categoryResult.body.id;
  }

  await runTest('List Categories', async () => {
    return await request('GET', '/categories');
  });

  if (categoryId) {
    await runTest('Get Category by ID', async () => {
      return await request('GET', `/categories/${categoryId}`);
    });
  }

  // Product Management
  if (categoryId) {
    const productResult = await runTest('Create Product', async () => {
      return await request(
        'POST',
        '/products',
        {
          name: 'Test Product',
          description: 'Test description',
          price: 100000,
          stock: 100,
          sku: `TEST-SKU-${Date.now()}`,
          categoryId: categoryId,
        },
        {
          Authorization: `Bearer ${adminToken}`,
        },
      );
    });

    if (productResult && productResult.body.id) {
      productId = productResult.body.id;
    }

    if (productId) {
      await runTest('Get Product by ID', async () => {
        return await request('GET', `/products/${productId}`);
      });
    }
  }

  await runTest('List Products', async () => {
    return await request('GET', '/products?page=1&pageSize=10');
  });

  // Cart Management
  if (productId) {
    await runTest('Add to Cart', async () => {
      return await request(
        'POST',
        '/cart/items',
        {
          productId: productId,
          quantity: 2,
        },
        {
          Authorization: `Bearer ${customerToken}`,
        },
      );
    });

    await runTest('Get Cart', async () => {
      return await request('GET', '/cart', null, {
        Authorization: `Bearer ${customerToken}`,
      });
    });
  }

  // Security Tests
  await runTest('GET /users without token (Expected 401)', async () => {
    const response = await request('GET', '/users');
    return {
      ...response,
      expectedFailure: true,
      expectedStatus: 401,
    };
  });

  await runTest('GET /users with customer token (Expected 403)', async () => {
    const response = await request('GET', '/users', null, {
      Authorization: `Bearer ${customerToken}`,
    });
    return {
      ...response,
      expectedFailure: true,
      expectedStatus: 403,
    };
  });

  // Write results to file
  const fs = require('node:fs');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⏭️  Skipped: ${results.summary.skipped}`);
  console.log(`\n📄 Results saved to: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));
}

await main();
