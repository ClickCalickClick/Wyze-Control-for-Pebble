#!/usr/bin/env node
// Test the Wyze Scale microservice (wyze-scale-service.wyzecam.com)
// Replicates the HMAC signing from the Python SDK's ExServiceClient/RequestVerifier
const https = require('https');
const crypto = require('crypto');

const EMAIL = process.env.WYZE_EMAIL;
const PASSWORD = process.env.WYZE_PASSWORD;
const API_KEY = process.env.WYZE_API_KEY;
const KEY_ID = process.env.WYZE_KEY_ID;

const SIGNING_SECRET = 'wyze_app_secret_key_132';
const APP_ID = '9319141212m2ik';
const APP_VERSION = '2.19.14';

const md5 = s => crypto.createHash('md5').update(typeof s === 'number' ? String(s) : s).digest('hex');

function hmacMd5(secret, data) {
  return crypto.createHmac('md5', secret).update(data).digest('hex');
}

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

function getRequest(hostname, path, params, headers = {}) {
  return new Promise((resolve, reject) => {
    const qs = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
    const fullPath = path + '?' + qs;
    const opts = {
      hostname, path: fullPath, method: 'GET',
      headers: { 'Accept-Encoding': 'identity', ...headers }
    };
    console.log('  GET https://' + hostname + fullPath);
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { resolve(buf); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// Build signed headers for the scale service (ExServiceClient pattern)
function buildScaleHeaders(token, nonce, sortedParamStr) {
  // request_id = md5(md5(str(nonce)))
  const requestId = md5(md5(String(nonce)));
  
  // signature2 = HMAC-MD5(md5(access_token + signing_secret), sorted_param_string)
  const encodedSecret = md5(token + SIGNING_SECRET);
  const signature2 = hmacMd5(encodedSecret, sortedParamStr);
  
  return {
    'access_token': token,
    'requestid': requestId,
    'appid': APP_ID,
    'appinfo': 'wyze_android_' + APP_VERSION,
    'phoneid': 'wyze_developer_api',
    'User-Agent': 'wyze_android_' + APP_VERSION,
    'signature2': signature2,
  };
}

function scaleGet(token, path, extraParams) {
  const nonce = Date.now();
  const params = Object.assign({}, extraParams || {}, { nonce: nonce });
  const sortedParamStr = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
  const headers = buildScaleHeaders(token, nonce, sortedParamStr);
  return getRequest('wyze-scale-service.wyzecam.com', path, params, headers);
}

function scalePost(token, path, jsonBody) {
  const nonce = Date.now();
  const body = Object.assign({}, jsonBody || {}, { nonce: String(nonce) });
  // For POST, signature is over the JSON body string (no spaces)
  const bodyStr = JSON.stringify(body).replace(/ /g, '');
  const requestId = md5(md5(String(nonce)));
  const encodedSecret = md5(token + SIGNING_SECRET);
  const signature2 = hmacMd5(encodedSecret, bodyStr);
  
  return post('wyze-scale-service.wyzecam.com', path, body, {
    'access_token': token,
    'requestid': requestId,
    'appid': APP_ID,
    'appinfo': 'wyze_android_' + APP_VERSION,
    'phoneid': 'wyze_developer_api',
    'User-Agent': 'wyze_android_' + APP_VERSION,
    'signature2': signature2,
  });
}

(async () => {
  // Auth
  console.log('=== Authenticating ===');
  const auth = await post('auth-prod.api.wyze.com', '/api/user/login',
    { email: EMAIL, password: md5(md5(md5(PASSWORD))), nonce: String(Date.now()) },
    { 'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm', 'apikey': API_KEY, 'keyid': KEY_ID, 'User-Agent': 'wyze_android_2.49.0' }
  );
  const tok = auth.access_token;
  if (!tok) { console.log('Auth failed:', JSON.stringify(auth).substring(0, 500)); return; }
  console.log('Auth OK, token:', tok.substring(0, 20) + '...');

  // Find scale device
  const base = {
    access_token: tok, app_name: 'com.hualai', app_ver: 'com.hualai___2.19.14',
    app_version: '2.19.14', phone_id: 'wyze_developer_api', phone_system_type: '2',
    sc: 'a626948714654991afd3c0dbd7cdb901', sv: 'c417b62d72ee44bf933054bdca183e77', ts: Date.now()
  };
  const devRes = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', base);
  const devList = (devRes.data && devRes.data.device_list) || [];
  const scale = devList.find(d => d.product_type === 'WyzeScale');
  if (!scale) { console.log('No scale found!'); return; }
  console.log('Found scale:', scale.nickname, '(' + scale.mac + ')');

  // Test 1: get_latest_record (no user_id)
  console.log('\n=== Test 1: get_latest_record (no user_id) ===');
  const r1 = await scaleGet(tok, '/plugin/scale/get_latest_record', {});
  console.log(JSON.stringify(r1, null, 2).substring(0, 2000));

  // Test 2: get_device_setting
  console.log('\n=== Test 2: get_device_setting ===');
  const r2 = await scaleGet(tok, '/plugin/scale/get_device_setting', { device_id: scale.mac });
  console.log(JSON.stringify(r2, null, 2).substring(0, 2000));

  // Test 3: get_device_member
  console.log('\n=== Test 3: get_device_member ===');
  const r3 = await scaleGet(tok, '/plugin/scale/get_device_member', { device_id: scale.mac });
  console.log(JSON.stringify(r3, null, 2).substring(0, 2000));

  // Test 4: get_user_profile
  console.log('\n=== Test 4: get_user_profile ===');
  const r4 = await scaleGet(tok, '/app/v2/platform/get_user_profile', {});
  console.log(JSON.stringify(r4, null, 2).substring(0, 2000));

  // Test 5: get_family_member
  console.log('\n=== Test 5: get_family_member ===');
  const r5 = await scaleGet(tok, '/plugin/scale/get_family_member', { device_id: scale.mac });
  console.log(JSON.stringify(r5, null, 2).substring(0, 2000));

  // Test 6: If we got a family_member_id, try get_latest_record with it
  // Also try with device_id
  console.log('\n=== Test 6: get_latest_record (with device_id) ===');
  const r6 = await scaleGet(tok, '/plugin/scale/get_latest_record', { device_id: scale.mac });
  console.log(JSON.stringify(r6, null, 2).substring(0, 2000));

  // Test 7: get_record_range (all time)
  console.log('\n=== Test 7: get_record_range (all time) ===');
  const r7 = await scaleGet(tok, '/plugin/scale/get_record_range', {
    start_time: '0',
    end_time: String(Math.floor(Date.now() / 1000))
  });
  console.log(JSON.stringify(r7, null, 2).substring(0, 2000));

  // Test 8: get_goal_weight 
  console.log('\n=== Test 8: get_goal_weight ===');
  const r8 = await scaleGet(tok, '/plugin/scale/get_goal_weight', {});
  console.log(JSON.stringify(r8, null, 2).substring(0, 2000));

})().catch(e => console.error('Fatal:', e));
