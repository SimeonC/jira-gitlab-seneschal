const fs = require('fs-extra');
const path = require('path');

fs.writeFileSync(
  path.resolve('node_modules/react-dev-utils/clearConsole.js'),
  'module.exports = function(){}'
);
