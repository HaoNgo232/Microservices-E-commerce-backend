const sharedConfig = require('./jest.config');

module.exports = {
  ...sharedConfig,
  displayName: 'unit',
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: [
    ...sharedConfig.testPathIgnorePatterns,
    '/test/', // Ignore E2E test folders
    '.e2e-spec.ts',
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'apps/**/src/**/*.ts',
    'libs/**/!(*.spec).ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/test/**',
    '!**/generated/**',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    // Exclude Gateway controllers (covered by E2E tests)
    '!apps/gateway/src/**/*.controller.ts',
  ],
};
