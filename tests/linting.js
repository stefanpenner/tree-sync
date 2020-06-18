'use strict';

const glob = require('glob').sync;
const paths = glob('tests/*').filter(path => !/fixtures/.test(path));

require('mocha-eslint')(paths.concat(['index.js']));
