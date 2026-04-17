#!/usr/bin/env node
/**
 * test_garage_stream.js — Try camera stream endpoint + local device_request + olive API
 * 
 * From wyzeapy source:
 * - get_streams uses WEB_SIGNING_SECRET = "gbJojEBViLklgwyyDikx5ztSvKBXI5oU" 
 *   and WEB_APP_ID = "strv_e7f78e9e7738dc50"
 * - get_iot_prop uses OLIVE_APP_ID = "9319141212m2ik" and OLIVE_SIGNING_SECRET = "wyze_app_secret_key_132"
 * - Local device_request at http://{ip}:88/device_request
 * 
 * ALL TESTS ARE READ-ONLY. NO GARAGE CONTROL.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');

const EMAIL    = process.env.WYZE_EMAIL    || '';
const PASSWORD = process.env.WYZE_PASSWORD || '';
const API_KEY  = process.env.WYZE_API_KEY  || '';
const KEY_ID   = process.env.WYZE_KEY_ID   || '';

const GARAGE_MAC   = 'D03F2745AA94';
const GARAGE_MODEL = 'WYZE_CAKP2JFUS';
const GARAGE_IP    = '192.168.86.26';

// From wyzeapy const.py
const WEB_SIGNING_SECRET = 'gbJojEBViLklgwyyDikx5ztSvKBXI5oU';
const WEB_APP_ID = 'strv_e7f78e9e7738dc50';
const WEB_APP_INFO = 'wyze_web_2.3.1';
const OLIVE_SIGNING_SECRET = 'wyze_app_secret_key_132';
const OLIVE_APP_ID = '9319141212m2ik';
const APP_INFO = 'wyze_android_2.19.14';

function md5(str, key) {
  if (key) return crypto.createHmac('md5', key).update(str).digest('hex');
  return crypto.createHash('md5').update(str).digest('hex');
}

function oliveCreateSignature(payload, accessToken) {
  // Exact replica of wyzeapy crypto.py olive_create_signature
  let body;
  if (typeof payload === 'object') {
    body = Object.keys(payload).sort().map(k => k + '=' + payload[k]).join('&');
  } else {
    body = payload;
  }
  const accessKey = accessToken + OLIVE_SIGNING_SECRET;
  const secret = crypto.createHash('md5').update(accessKey).digest('hex');
  return crypto.createHmac('md5', secret).update(body).digest('hex');
}

function webCreateSignature(payload, accessToken) {
  // Exact replica of wyzeapy crypto.py web_create_signature
  let body;
  if (typeof payload === 'object') {
    body = Object.keys(payload).sort().map(k => k + '=' + payload[k]).join('&');
  } else {
    body = payload;
  }
  const accessKey = accessToken + WEB_SIGNING_SECRET;
  const secret = crypto.createHash('md5').update(accessKey).digest('hex');
  return crypto.createHmac('md5', secret).update(body).digest('hex');
}

function post(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname, port: 443, path, method: 'POST',
      headers: Object.assign({'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}, headers || {})
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          try { buf = zlib.gunzipSync(buf); } catch(e) { /* not actually gzipped */ }
        } else if (encoding === 'deflate') {
          try { buf = zlib.inflateSync(buf); } catch(e) {}
        }
        const str = buf.toString();
        try { resolve(JSON.parse(str)); } catch(e) { resolve({raw: str}); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function get(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, port: 443, path, method: 'GET', headers: headers || {} };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          try { buf = zlib.gunzipSync(buf); } catch(e) {}
        } else if (encoding === 'deflate') {
          try { buf = zlib.inflateSync(buf); } catch(e) {}
        }
        const str = buf.toString();
        try { resolve(JSON.parse(str)); } catch(e) { resolve({raw: str}); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(hostname, port, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = { hostname, port, path, method: 'POST', timeout: timeoutMs || 5000,
      headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({raw: d}); }
      });
    });
    req.on('error', e => resolve({error: e.message}));
    req.on('timeout', () => { req.destroy(); resolve({error: 'timeout'}); });
    req.write(data); req.end();
  });
}

function httpGet(hostname, port, path, timeoutMs) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, port, path, method: 'GET', timeout: timeoutMs || 5000 };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({raw: d}); }
      });
    });
    req.on('error', e => resolve({error: e.message}));
    req.on('timeout', () => { req.destroy(); resolve({error: 'timeout'}); });
    req.end();
  });
}

async function login() {
  const hashedPw = md5(md5(md5(PASSWORD)));
  const resp = await post('auth-prod.api.wyze.com', '/api/user/login',
    { email: EMAIL, password: hashedPw, nonce: String(Date.now()) },
    { 'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm', 'apikey': API_KEY, 'keyid': KEY_ID, 'User-Agent': 'wyze_android_2.49.0' });
  if (resp && resp.access_token) return resp.access_token;
  if (resp && resp.data && resp.data.access_token) return resp.data.access_token;
  console.log('Login resp:', JSON.stringify(resp).slice(0,500));
  throw new Error('Login failed');
}

async function main() {
  console.log('=== test_garage_stream.js ===');
  console.log('Logging in...');
  const token = await login();
  console.log('Token:', token.slice(0,20) + '...');
  console.log('');

  // ===== TEST A: Camera get-streams endpoint =====
  // This returns properties including iot-device::iot-state and iot-device::iot-power
  // Maybe it also returns garage-related properties!
  console.log('===== TEST A: Camera get-streams (WebRTC endpoint) =====');
  try {
    const streamsPayload = {
      device_list: [{
        device_id: GARAGE_MAC,
        device_model: GARAGE_MODEL,
        provider: 'webrtc',
        parameters: { use_trickle: true }
      }],
      nonce: String(Date.now())
    };
    const payloadStr = JSON.stringify(streamsPayload);
    const sig = webCreateSignature(payloadStr, token);
    const headers = {
      'Accept-Encoding': 'gzip',
      'appId': WEB_APP_ID,
      'appInfo': WEB_APP_INFO,
      'access_token': token,
      'Authorization': token,
      'signature2': sig,
      'requestid': String(Date.now() % 100000)
    };
    const resp = await post('app.wyzecam.com', '/app/v4/camera/get-streams', streamsPayload, headers);
    console.log('Response code:', resp.code, 'msg:', resp.msg);
    if (resp.data) {
      if (Array.isArray(resp.data)) {
        resp.data.forEach((item, i) => {
          console.log(`  Stream ${i}: device_id=${item.device_id}`);
          if (item.property) {
            console.log('  Properties:', JSON.stringify(item.property));
          }
          if (item.params) {
            console.log('  Params keys:', Object.keys(item.params));
          }
        });
      } else {
        console.log('  Data:', JSON.stringify(resp.data).slice(0, 500));
      }
    } else {
      console.log('  Full resp:', JSON.stringify(resp).slice(0, 500));
    }
  } catch (e) { console.log('  Error:', e.message); }
  console.log('');

  // ===== TEST B: Olive get_iot_prop for garage-related keys =====
  // From wyzeapy: _get_iot_prop uses OLIVE_APP_ID + olive signature
  // Keys we know from devicemgmt: "garage::door-state", "garage::state", "garage::open"
  console.log('===== TEST B: Olive get_iot_prop (wyze platform service) =====');
  const iotKeys = [
    'garage.door-state,garage.state,garage.open',
    'iot-device.iot-state,iot-device.iot-power',
    'P1056',
    'accessory',
    'garage_door_state',
  ];
  for (const keys of iotKeys) {
    try {
      const nonce = Date.now();
      const payload = { keys: keys, did: GARAGE_MAC, nonce: nonce };
      const sig = oliveCreateSignature(payload, token);
      const headers = {
        'Accept-Encoding': 'gzip',
        'User-Agent': 'myapp',
        'appid': OLIVE_APP_ID,
        'appinfo': APP_INFO,
        'phoneid': 'wyze_developer_api',
        'access_token': token,
        'signature2': sig
      };
      const queryStr = Object.keys(payload).sort().map(k => k + '=' + encodeURIComponent(payload[k])).join('&');
      const resp = await get('wyze-platform-service.wyzecam.com', '/app/v2/platform/get_iot_prop?' + queryStr, headers);
      console.log(`  keys="${keys}": code=${resp.code} msg=${resp.msg}`);
      if (resp.data) console.log('    data:', JSON.stringify(resp.data).slice(0, 300));
    } catch (e) { console.log(`  keys="${keys}": Error: ${e.message}`); }
  }
  console.log('');

  // ===== TEST C: Earth service get_iot_prop with olive credentials =====
  console.log('===== TEST C: Earth service with olive signing =====');
  try {
    const nonce = Date.now();
    const payload = { keys: 'P1056', did: GARAGE_MAC, nonce: nonce };
    const sig = oliveCreateSignature(payload, token);
    const headers = {
      'Accept-Encoding': 'gzip',
      'User-Agent': 'myapp',
      'appid': OLIVE_APP_ID,
      'appinfo': APP_INFO,
      'phoneid': 'wyze_developer_api',
      'access_token': token,
      'signature2': sig
    };
    const queryStr = Object.keys(payload).sort().map(k => k + '=' + encodeURIComponent(payload[k])).join('&');
    
    // Try both earth service endpoints
    const urls = [
      '/plugin/earth/v1/device/get_iot_prop',
      '/app/v2/earth/get_iot_prop',
      '/plugin/earth/v1/device/property/get',
    ];
    for (const url of urls) {
      const resp = await get('wyze-earth-service.wyzecam.com', url + '?' + queryStr, headers);
      console.log(`  ${url}: code=${resp.code} msg=${resp.msg}`);
      if (resp.data) console.log('    data:', JSON.stringify(resp.data).slice(0, 200));
    }
  } catch (e) { console.log('  Error:', e.message); }
  console.log('');

  // ===== TEST D: Local device_request (HTTP on camera's local IP) =====
  console.log('===== TEST D: Local device_request at', GARAGE_IP + ':88 =====');
  const localRequests = [
    { request: 'get_status' },
    { request: 'get_device_info' },
    { request: 'get_device_state' },
    { request: 'get_accessory_state' },
    { request: 'ipc_dispatch', content: { command: '10054' } },  // Common Wyze IPC command
  ];
  for (const body of localRequests) {
    try {
      console.log(`  Trying ${body.request || body.content?.command}...`);
      const resp = await httpPost(GARAGE_IP, 88, '/device_request', body, 5000);
      if (resp.error) {
        console.log(`    Error: ${resp.error}`);
      } else {
        console.log(`    Response: ${JSON.stringify(resp).slice(0, 300)}`);
      }
    } catch (e) { console.log(`    Error: ${e.message}`); }
  }
  // Also try GET endpoints
  const getEndpoints = ['/', '/device_request', '/cgi-bin/hi3510/param.cgi?cmd=getdevinfo'];
  for (const ep of getEndpoints) {
    try {
      console.log(`  GET ${ep}...`);
      const resp = await httpGet(GARAGE_IP, 88, ep, 5000);
      if (resp.error) {
        console.log(`    Error: ${resp.error}`);
      } else {
        console.log(`    Response: ${JSON.stringify(resp).slice(0, 300)}`);
      }
    } catch (e) { console.log(`    Error: ${e.message}`); }
  }
  console.log('');

  // ===== TEST E: devicemgmt get_iot_prop with GARAGE capability =====
  // Before we used generic capabilities. Let's try exact format from wyzeapy
  console.log('===== TEST E: devicemgmt get_iot_prop with specific garage caps =====');
  const capSets = [
    // Match exact format from wyzeapy payload_factory with garage-only
    [{ iid: 10, name: 'garage', properties: ['door-state', 'state', 'open'] }],
    // Just garage with sensor-state
    [{ iid: 10, name: 'garage', properties: ['door-state', 'state', 'open', 'sensor-state'] }],
    // iot-device + garage together (as returned naturally by devicemgmt)
    [
      { iid: 1, name: 'iot-device', properties: ['iot-state', 'iot-power'] },
      { iid: 10, name: 'garage', properties: ['door-state', 'state', 'open'] }
    ],
    // Try with different iids for garage
    [{ iid: 5, name: 'garage', properties: ['door-state', 'state', 'open'] }],
    [{ iid: 6, name: 'garage', properties: ['door-state', 'state', 'open'] }],
    [{ iid: 11, name: 'garage', properties: ['door-state', 'state', 'open'] }],
  ];
  for (const caps of capSets) {
    try {
      const payload = {
        capabilities: caps,
        nonce: Date.now(),
        targetInfo: { id: GARAGE_MAC, productModel: GARAGE_MODEL, type: 'DEVICE' }
      };
      const resp = await post('devicemgmt-service-beta.wyze.com',
        '/device-management/api/device-property/get_iot_prop',
        payload,
        { authorization: token });
      const capsResp = resp.data?.capabilities || [];
      console.log(`  caps[0]={iid:${caps[0].iid},name:${caps[0].name}}: code=${resp.code}`);
      if (capsResp.length > 0) {
        capsResp.forEach(c => {
          console.log(`    ${c.name}: ${JSON.stringify(c.properties)}`);
        });
      } else if (resp.data) {
        console.log('    data:', JSON.stringify(resp.data).slice(0, 200));
      } else {
        console.log('    resp:', JSON.stringify(resp).slice(0, 200));
      }
    } catch (e) { console.log('    Error:', e.message); }
  }
  console.log('');

  // ===== TEST F: devicemgmt run_action for garage status =====
  // From wyzeapy: _run_action_devicemgmt uses capabilities with functions
  console.log('===== TEST F: devicemgmt run_action with garage queries =====');
  const actions = [
    // Like power "wakeup" but for garage
    { capabilities: [{ functions: [{ in: {}, name: 'get-state' }], name: 'garage' }],
      nonce: Date.now(),
      targetInfo: { id: GARAGE_MAC, productModel: GARAGE_MODEL, type: 'DEVICE' },
      transactionId: '0a5b20591fedd4du1b93f90743ba0csd' },
    { capabilities: [{ functions: [{ in: {}, name: 'status' }], name: 'garage' }],
      nonce: Date.now(),
      targetInfo: { id: GARAGE_MAC, productModel: GARAGE_MODEL, type: 'DEVICE' },
      transactionId: '0a5b20591fedd4du1b93f90743ba0csd' },
  ];
  for (const action of actions) {
    try {
      const resp = await post('devicemgmt-service-beta.wyze.com',
        '/device-management/api/action/run_action',
        action,
        { authorization: token });
      console.log(`  ${action.capabilities[0].functions[0].name}: code=${resp.code} msg=${resp.msg || resp.message}`);
      if (resp.data) console.log('    data:', JSON.stringify(resp.data).slice(0, 300));
    } catch (e) { console.log('    Error:', e.message); }
  }
  console.log('');

  // ===== TEST G: Check ALL properties with recent timestamps =====
  // P1050 had timestamp from April 1 — what is it?
  console.log('===== TEST G: Full property list with focus on recent timestamps =====');
  try {
    const payload = Object.assign(buildBasePayload(token), {
      sv: '9d74946e652647e9b6c9d59326aef104',
      device_mac: GARAGE_MAC, device_model: GARAGE_MODEL,
      target_pid_list: []
    });
    const resp = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
    if (resp.data?.property_list) {
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      // Show all properties sorted by timestamp (newest first)
      const sorted = resp.data.property_list
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      console.log('  All properties sorted by timestamp (newest first):');
      sorted.forEach(p => {
        const age = now - (p.ts || 0);
        const ageStr = age < 60000 ? `${(age/1000).toFixed(0)}s ago` :
                       age < 3600000 ? `${(age/60000).toFixed(0)}m ago` :
                       age < 86400000 ? `${(age/3600000).toFixed(1)}h ago` :
                       `${(age/86400000).toFixed(1)}d ago`;
        const recent = age < oneWeek ? ' <<< RECENT' : '';
        console.log(`    P${p.pid}: value="${p.value}" ts=${p.ts} (${ageStr})${recent}`);
      });
    }
  } catch (e) { console.log('  Error:', e.message); }
  console.log('');

  // ===== TEST H: Wyze App API v4 endpoints =====
  console.log('===== TEST H: Wyze App v4/v3 camera endpoints =====');
  const appEndpoints = [
    { path: '/app/v4/camera/get_device_detail', body: { device_id: GARAGE_MAC, device_model: GARAGE_MODEL } },
    { path: '/app/v3/device/timer_rule_list', body: { device_mac: GARAGE_MAC, device_model: GARAGE_MODEL } },
    { path: '/app/v2/device/get_acc_props', body: { device_mac: GARAGE_MAC, device_model: GARAGE_MODEL, dongle_model: 'HL_CGDC' } },
    { path: '/app/v2/device/get_sub_device', body: { device_mac: GARAGE_MAC } },
  ];
  for (const ep of appEndpoints) {
    try {
      const payload = Object.assign(buildBasePayload(token), ep.body);
      if (!payload.sv) payload.sv = '9d74946e652647e9b6c9d59326aef104';
      const resp = await post('api.wyzecam.com', ep.path, payload);
      console.log(`  ${ep.path}: code=${resp.code} msg=${resp.msg}`);
      if (resp.data) console.log('    data:', JSON.stringify(resp.data).slice(0, 300));
    } catch (e) { console.log(`  ${ep.path}: Error: ${e.message}`); }
  }
  console.log('');

  // ===== TEST I: Try forcing a property refresh =====
  // What if we read P1056 with a targeted PID list?
  console.log('===== TEST I: Targeted P1056 read with different approaches =====');
  try {
    // Try get_property with single PID
    const payload = Object.assign(buildBasePayload(token), {
      sv: '9d74946e652647e9b6c9d59326aef104',
      device_mac: GARAGE_MAC, device_model: GARAGE_MODEL,
      target_pid_list: ['P1056']
    });
    const resp = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
    console.log('  Targeted P1056:', JSON.stringify(resp.data?.property_list));
  } catch (e) { console.log('  Error:', e.message); }
  // Try with device_get_property (singular)
  try {
    const payload = Object.assign(buildBasePayload(token), {
      sv: '9d74946e652647e9b6c9d59326aef104',
      device_mac: GARAGE_MAC, device_model: GARAGE_MODEL,
      pid: 'P1056'
    });
    const resp = await post('api.wyzecam.com', '/app/v2/device/get_property', payload);
    console.log('  get_property P1056: code=' + resp.code + ' data:', JSON.stringify(resp.data).slice(0, 200));
  } catch (e) { console.log('  Error:', e.message); }
  console.log('');

  console.log('=== DONE ===');
}

function buildBasePayload(token) {
  return {
    access_token: token, app_name: 'com.hualai',
    app_ver: 'com.hualai___2.19.14', app_version: '2.19.14',
    phone_id: 'wyze_developer_api', phone_system_type: '2',
    sc: 'a626948714654991afd3c0dbd7cdb901', ts: Date.now()
  };
}

main().catch(e => console.error('FATAL:', e));
