import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          // Ignora erros de tipos para módulos 'use server' / 'use client'
          // que dependem de Next.js runtime
          skipLibCheck: true,
        },
      },
    ],
  },
  // Ignora arquivos que usam 'use server' ou 'use client' (dependem do runtime Next.js)
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  // Suprime logs de módulos não-suportados em ambiente node
  modulePathIgnorePatterns: ['/.next/'],
  collectCoverageFrom: [
    'src/components/avatar-utils.ts',
    'src/lib/pipeline-assistant-contracts.ts',
  ],
  coverageReporters: ['text', 'lcov'],
}

export default config
