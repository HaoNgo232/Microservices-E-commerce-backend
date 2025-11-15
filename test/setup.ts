/**
 * Global Test Setup
 * Runs before all tests to ensure proper environment configuration
 */

// Verify we're in test environment
if (process.env.NODE_ENV !== 'test') {
  console.warn('  Warning: NODE_ENV is not set to "test"');
}

// Verify test database URLs are loaded
const requiredEnvVars = [
  'DATABASE_URL_USER',
  'DATABASE_URL_PRODUCT',
  'DATABASE_URL_CART',
  'DATABASE_URL_ORDER',
  'DATABASE_URL_PAYMENT',
  'DATABASE_URL_AR',
  'DATABASE_URL_REPORT',
  'JWT_SECRET_KEY',
];

const missingVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Make sure .env.test is properly configured.',
  );
}

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
global.beforeAll(() => {
  // Setup logic if needed
});

global.afterAll(async () => {
  // Cleanup logic if needed
  await new Promise(resolve => setTimeout(resolve, 500));
});
