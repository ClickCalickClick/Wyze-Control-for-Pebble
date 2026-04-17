const dns = require('dns');
['api.wyzecam.com', 'developer-api.wyzecam.com', 'wyze-api.com', 'developer-api-gateway.wyzecam.com', 'api.wyzeapi.com'].forEach(h => {
  dns.lookup(h, (err) => {
    if (!err) console.log('Resolved:', h);
  });
});
