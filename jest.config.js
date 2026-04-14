/**
 * Jest Configuration
 */

export default {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {},
  globals: {
    chrome: {
      runtime: {},
      storage: {
        local: {}
      },
      tabs: {},
      sidePanel: {}
    }
  },
  setupFiles: ['<rootDir>/tests/setup.js']
};
