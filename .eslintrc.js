module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint", "import", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "import/no-cycle": "error",
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "src/**/domain/**",
            from: ["src/**/infrastructure/**", "src/**/application/**"],
            message:
              "Domain layer cannot import from Infrastructure or Application layers.",
          },
          {
            target: "src/**/application/**",
            from: ["src/**/infrastructure/**"],
            message:
              "Application layer cannot import from Infrastructure layer.",
          },
        ],
      },
    ],
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["**/*.spec.ts", "**/*.pbt.spec.ts", "**/*.integration.spec.ts", "test/e2e/**/*.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
  ignorePatterns: ["dist/", "node_modules/", "coverage/"],
};