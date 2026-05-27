module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/api/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/apps/api/tsconfig.test.json'
      }
    ]
  },
  moduleNameMapper: {
    '^@krazyverse/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@krazyverse/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@/(.*)$': '<rootDir>/apps/api/src/$1'
  }
};
