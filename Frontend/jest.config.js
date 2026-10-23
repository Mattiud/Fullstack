export default {
  testEnvironment: '<rootDir>/jest.environment.cjs',
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.{js,jsx}'],
  clearMocks: true,
};
