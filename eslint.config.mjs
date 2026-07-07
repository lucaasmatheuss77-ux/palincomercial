import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'public/**',
      'scratch/**',
      'scripts/**',
      'next-env.d.ts',
      '*.js',
      '*.mjs',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
]

export default config
