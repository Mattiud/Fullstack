export default {
  testEnvironment: '<rootDir>/jest.environment.cjs',
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.{js,jsx}'],
  clearMocks: true,
  // Las pruebas que escriben formularios extensos tardan varios segundos cuando las
  // suites corren en paralelo; el límite de 5 s por defecto las hacía fallar por carga.
  testTimeout: 15000,
};
