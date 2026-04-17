const dns = require('dns');
const hosts = [
  'api.wyze.com',
  'openapi.wyze.com',
  'api.wyzecam.com',
  'openapi.wyzecam.com',
  'developer.wyzecam.com',
  'developer-api.wyzecam.com',
  'auth-prod.api.wyze.com'
];
hosts.forEach(h => dns.lookup(h, (err, address) => console.log(h, err ? 'FAIL' : address)));
