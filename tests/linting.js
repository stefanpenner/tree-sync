'use strict';

if (require('os').EOL !== '\n') {
  // don't bother linting, if we are on a platform that isn't using `\n` line endings
  return;
}

const glob = require('glob').sync;
const paths = glob('tests/*').filter(path => !/fixtures/.test(path));

require('mocha-eslint')(paths.concat(['index.js']));
