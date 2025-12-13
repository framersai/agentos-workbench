module.exports = {
  root: true,
  env: {
    node: true
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/jsx-runtime",
    "prettier"
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  overrides: [
    {
      files: ["*.cjs"],
      parserOptions: {
        project: null
      }
    },
    {
      files: ["demo-automation/**/*.ts"],
      parserOptions: {
        project: "./demo-automation/tsconfig.json",
        tsconfigRootDir: __dirname
      }
    },
    {
      // Files excluded from tsconfig.json need separate handling
      files: ["src/lib/localAgentRuntime.ts", "src/lib/localWorkflowLibrary.ts"],
      parserOptions: {
        project: null
      }
    }
  ],
  rules: {
    "react/prop-types": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ]
  }
};
