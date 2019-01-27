module.exports = {
  "env": {
    "node": true,
    "es6": true
  },
  "parserOptions": {
    "ecmaVersion": 2017
  },
  "extends": "eslint:recommended",
  "rules": {
    "indent": [
      2,
      2,
      {
        'SwitchCase': 1
      }
    ],
    "linebreak-style": [
      2,
      "unix"
    ],
    "quotes": [
      2,
      "single"
    ],
    "semi": [
      2,
      "always"
    ],
    "no-var": "warn"
  }
};
