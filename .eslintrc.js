module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'react-native/no-unused-styles': 2,
    'react-native/sort-styles': 0,
    'react-native/no-inline-styles': 1,
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      extends: [
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-misused-promises': 'warn',
        '@typescript-eslint/await-thenable': 'warn',
        '@typescript-eslint/strict-boolean-expressions': [
          'warn',
          {
            allowNullableBoolean: true,
            allowNullableString: true,
            allowNullableNumber: true,
            allowNullableObject: true,
          },
        ],
        // `void expr` (including as a concise arrow body, e.g.
        // `onPress={() => void save()}`) is the idiomatic way to satisfy
        // no-floating-promises for intentionally unawaited promises, which
        // conflicts with the base config's blanket ban on `void`.
        'no-void': 'off',
      },
    },
    {
      // react-navigation's ParamList generics require an object-literal
      // `type` alias (not `interface`) to satisfy their implicit index
      // signature constraint — https://reactnavigation.org/docs/typescript
      files: ['src/navigation/*.ts', 'src/navigation/*.tsx'],
      rules: {
        '@typescript-eslint/consistent-type-definitions': 'off',
      },
    },
    {
      // @react-native-firebase/messaging is an optional peer dependency
      // (see .env.example): a static `import` would be resolved by Metro at
      // bundle time and fail hard when the package or native config is
      // absent, whereas a synchronous `require()` inside try/catch can be
      // caught and swapped for a no-op adapter, and is intercepted cleanly
      // by jest.mock() in tests.
      files: ['src/services/firebaseMessaging.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
