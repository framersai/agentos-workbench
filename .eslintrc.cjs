module.exports = {
  root: true,
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
    project: ["./tsconfig.json"]
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  rules: {
    "react/prop-types": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off"
  }
};
