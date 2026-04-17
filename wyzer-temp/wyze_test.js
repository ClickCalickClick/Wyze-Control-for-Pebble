const https = require('https');

const KEY_ID = '9b544aa2-6fa6-4982-ad62-4e1c93fcc019';
const API_KEY = 'МЫHsfKu1q8BDIIERNhbqqnJjb5NdjqD9IVpa2U4IPKbj45GD2W19JWFcQFE'; // Or exactly what user provided

const postOptions = {
  hostname: 'auth-prod.api.wyze.com',
  path: '/api/user/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ', // Public unofficial app API key (sometimes required by backend)
    'apikey': API_KEY,
    'keyid': KEY_ID,
    'User-Agent': 'wyzer-api/1.0.0'
  }
};

const req = https.request(postOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Login Response:', res.statusCode, data);
  });
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify({ 
  email: 'YOUR_EMAIL', 
  password: 'YOUR_PASSWORD' // Hashed MD5 password usually, or plain depends on api wrapper
}));
req.end();
