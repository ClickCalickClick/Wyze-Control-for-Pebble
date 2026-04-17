#!/usr/bin/env node
// Quick script to dump scale device data and test scale-specific endpoints
const https = require('https');
const crypto = require('crypto');

const EMAIL = process.env.WYZE_EMAIL;
const PASSWORD = process.env.WYZE_PASSWORD;
const API_KEY = process.env.WYZE_API_KEY;
const KEY_ID = process.env.WYZE_KEY_ID;

const md5 = s => crypto.createHash('md5').update(s).digest('hex');

function post(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8', 'Content-Length': Buffer.byteLength(data), ...headers }
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { resolve(buf); } });
    }).on('error', reject);
  });
}

(async () => {
  // Auth
  const auth = await post('auth-prod.api.wyze.com', '/api/user/login',
    { email: EMAIL, password: md5(md5(md5(PASSWORD))), nonce: String(Date.now()) },
    { 'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm', 'apikey': API_KEY, 'keyid': KEY_ID, 'User-Agent': 'wyze_android_2.49.0' }
  );
  const tok = auth.access_token;
  if (!tok) { console.log('Auth failed', JSON.stringify(auth)); return; }
  console.log('Auth OK');

  const base = {
    access_token: tok, app_name: 'com.hualai', app_ver: 'com.hualai___2.19.14',
    app_version: '2.19.14', phone_id: 'wyze_developer_api', phone_system_type: '2',
    sc: 'a626948714654991afd3c0dbd7cdb901', sv: 'c417b62d72ee44bf933054bdca183e77', ts: Date.now()
  };

  // 1. Get full device list, find scale
  const devRes = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', base);
  const devList = (devRes.data && devRes.data.device_list) || [];
  const scale = devList.find(d => d.product_type === 'WyzeScale');
  
  if (!scale) { console.log('No scale found'); return; }
  
  console.log('\n=== FULL SCALE OBJECT FROM get_object_list ===');
  console.log(JSON.stringify(scale, null, 2));

  // 2. Try get_device_Info
  console.log('\n=== get_device_Info ===');
  const info = await post('api.wyzecam.com', '/app/v2/device/get_device_Info', {
    ...base, sv: '44b6d5640c4d4978baba65c8ab9a6d6e',
    device_mac: scale.mac, device_model: scale.product_model
  });
  console.log(JSON.stringify(info, null, 2));

  // 3. Try get_property_list with target PIDs
  console.log('\n=== get_property_list (with target_pid_list) ===');
  const propRes = await post('api.wyzecam.com', '/app/v2/device/get_property_list', {
    ...base, sv: '44b6d5640c4d4978baba65c8ab9a6d6e',
    device_mac: scale.mac, device_model: scale.product_model,
    target_pid_list: []
  });
  console.log(JSON.stringify(propRes, null, 2));

  // 4. Try Wyze Scale X (S2) API — scale data endpoint
  console.log('\n=== scale user_device_list via platform ===');
  const scaleRes = await post('api.wyzecam.com', '/app/v2/platform/get_user_profile', {
    ...base
  });
  console.log(JSON.stringify(scaleRes, null, 2).substring(0, 1000));

  // 5. Check if scale data is hidden inside the object_list response more broadly
  console.log('\n=== Looking for scale data in full API response ===');
  const fullStr = JSON.stringify(devRes.data);
  // Search for weight-like numbers
  const weightMatch = fullStr.match(/weight|body_fat|bmi|muscle|body_water|measure/gi);
  console.log('Scale-related fields in full response:', weightMatch ? weightMatch.join(', ') : 'NONE');

})().catch(e => console.error(e));
