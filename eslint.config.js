import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
    pnpm: false,
    rules: {
      'no-console': 'warn',
    },
  },
)
