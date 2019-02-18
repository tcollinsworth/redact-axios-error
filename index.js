// eslint-disable-next-line no-global-assign
require = require('esm')(module/* , options */)
// use the following for es6
// module.exports = require('./lib/redact-error') // es6
// user the following for es5
module.exports = require('./dist/redact-error') // es5
