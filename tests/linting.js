'use strict';

let glob = require('glob').sync;

let paths = glob('tests/*').filter(function(path) {
  return !/fixtures/.test(path);
});

paths = paths.concat([
  'index.js'
]);

require('mocha-eslint')(paths);
