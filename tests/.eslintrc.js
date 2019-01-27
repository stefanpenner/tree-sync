module.exports = {
  env: {
    mocha: true,
    node: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2017
  },
  rules: {
    // JSHint "expr", disabled due to chai expect assertions
    'no-unused-expressions': 0,

    // JSHint "unused"
    'no-unused-vars': 0,

    'no-var': 'warn'
  }
};
