#!/usr/bin/env node
/**
 * test_garage_deep2.js — Follow-up: focused on devicemgmt + alternative approaches
 * 
 * Key finding from deep1: devicemgmt service returned garage capability with null properties
 * P1056 timestamp is Feb 3 2026 — completely stale
 * 
 * ALL TESTS ARE READ-ONLY.
 */

const https = require('https');
const crypto = require('crypto');

const EMAIL    = process.env.WYZE_EMAIL    || '';
const PASSWORD = process.env.WYZE_PASSWORD || '';
const API_KEY  = process.env.WYZE_API_KEY  || '';
const KEY_ID   = process.env.WYZE_KEY_ID   || '';

const WYZE_APP_NAME = 'com.hualai';
const WYZE_APP_VERSION = '2.19.14';
const WYZE_PHONE_ID = 'wyze_developer_api';
const WYZE_SC = 'a626948714654991afd3c0dbd7cdb901';
const WYZE_SV_SET_PROPERTY = '44b6d5640c4d4978baba65c8ab9a6d6e';

function md5(str, key) {
  if (key) return crypto.createHmac('md5', key).update(str).digest('hex');
  return crypto.createHash('md5').update(str).digest('hex');
}

function buildBasePayload(token) {
  return {
    access_token: token, app_name: WYZE_APP_NAME,
    app_ver: WYZE_APP_NAME + '___' + WYZE_APP_VERSION,
    app_version: WYZE_APP_VERSION, phone_id: WYZE_PHONE_ID,
    phone_system_type: '2', sc: WYZE_SC, ts: Date.now()
  };
}

function post(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8', 'Content-Length': Buffer.byteLength(data), ...headers } };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); } catch(e) { resolve({ status: res.statusCode, data: buf }); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

function get(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method: 'GET', headers: headers || {} };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); } catch(e) { resolve({ status: res.statusCode, data: buf }); } });
    });
    req.on('error', reject); req.end();
  });
}

async function authenticate() {
  const hashedPw = md5(md5(md5(PASSWORD)));
  const res = await post('auth-prod.api.wyze.com', '/api/user/login', {
    email: EMAIL, password: hashedPw, nonce: String(Date.now())
  }, { 'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm', 'apikey': API_KEY, 'keyid': KEY_ID, 'User-Agent': 'wyze_android_2.49.0' });
  if (res.data.access_token) { console.log('Auth OK'); return res.data.access_token; }
  console.error('Auth failed'); process.exit(1);
}

const MAC = 'D03F2745AA94';
const MODEL = 'WYZE_CAKP2JFUS';

async function main() {
  const token = await authenticate();

  // ============================================================
  // TEST A: devicemgmt with EMPTY capabilities (discover what exists)
  // ============================================================
  console.log('\n=== TEST A: devicemgmt - empty capabilities (discover) ===');
  let res = await post('devicemgmt-service-beta.wyze.com',
    '/device-management/api/device-property/get_iot_prop',
    {
      capabilities: [],
      nonce: Date.now(),
      targetInfo: { id: MAC, productModel: MODEL, type: "DEVICE" },
    },
    { 'authorization': token }
  );
  console.log('  Response:', JSON.stringify(res.data, null, 2));

  // ============================================================
  // TEST B: devicemgmt with garage capability, various property names
  // ============================================================
  console.log('\n=== TEST B: devicemgmt - garage capability variations ===');
  const garagePropertySets = [
    // Try without specifying properties (let server return what it has)
    { name: "garage" },
    { name: "garage", properties: {} },
    // Known floodlight pattern
    { name: "garage", properties: { "on": null } },
    { name: "garage", properties: { "switch": null } },
    { name: "garage", properties: { "status": null, "is-open": null, "position": null } },
    // Dongle-related
    { name: "dongle", properties: { "state": null, "switch": null, "status": null } },
    // Accessory with specific props
    { name: "accessory", properties: { "on": null, "state": null, "status": null, "switch": null, "open": null } },
  ];

  for (const cap of garagePropertySets) {
    res = await post('devicemgmt-service-beta.wyze.com',
      '/device-management/api/device-property/get_iot_prop',
      {
        capabilities: [cap],
        nonce: Date.now(),
        targetInfo: { id: MAC, productModel: MODEL, type: "DEVICE" },
      },
      { 'authorization': token }
    );
    const data = res.data.data;
    if (data && data.capabilities) {
      for (const c of data.capabilities) {
        const hasData = c.properties && Object.values(c.properties).some(v => v !== null);
        const marker = hasData ? '✅' : '⬜';
        console.log(`  ${marker} cap=${JSON.stringify(cap).substring(0,60)} → ${JSON.stringify(c.properties)}`);
      }
    } else {
      console.log(`  ❌ cap=${JSON.stringify(cap).substring(0,60)} → ${res.data.code}: ${res.data.msg || JSON.stringify(res.data).substring(0,100)}`);
    }
  }

  // ============================================================
  // TEST C: devicemgmt with ALL known capability names from wyzeapy
  // ============================================================
  console.log('\n=== TEST C: devicemgmt - all known capabilities ===');
  res = await post('devicemgmt-service-beta.wyze.com',
    '/device-management/api/device-property/get_iot_prop',
    {
      capabilities: [
        { name: "camera", properties: { "motion-detect-recording": null } },
        { name: "iot-device", properties: { "iot-state": null, "iot-power": null, "push-switch": null } },
        { name: "floodlight", properties: { "on": null } },
        { name: "spotlight", properties: { "on": null } },
        { name: "siren", properties: { "state": null } },
        { name: "garage", properties: { "on": null, "state": null, "door-state": null, "switch": null, "open": null, "close": null, "trigger": null } },
        { name: "accessory", properties: { "on": null, "state": null, "switch": null, "type": null } },
        { name: "dongle", properties: { "on": null, "state": null, "switch": null, "model": null } },
      ],
      nonce: Date.now(),
      targetInfo: { id: MAC, productModel: MODEL, type: "DEVICE" },
    },
    { 'authorization': token }
  );
  if (res.data.data && res.data.data.capabilities) {
    for (const c of res.data.data.capabilities) {
      const hasData = c.properties && Object.values(c.properties).some(v => v !== null);
      const marker = hasData ? '✅' : '⬜';
      console.log(`  ${marker} ${c.name}: ${JSON.stringify(c.properties)}`);
    }
  }

  // ============================================================
  // TEST D: devicemgmt run_action — query actions (READ-ONLY)
  // ============================================================
  console.log('\n=== TEST D: devicemgmt - list available actions ===');
  // Try getting device capabilities/info through a different endpoint
  const mgmtEndpoints = [
    '/device-management/api/device/get_device_info',
    '/device-management/api/device/get_device_capability',
    '/device-management/api/device-property/get_iot_capabilities',
  ];
  for (const ep of mgmtEndpoints) {
    res = await post('devicemgmt-service-beta.wyze.com', ep,
      {
        nonce: Date.now(),
        targetInfo: { id: MAC, productModel: MODEL, type: "DEVICE" },
      },
      { 'authorization': token }
    );
    console.log(`  ${ep.split('/').pop()}: code=${res.data.code} → ${JSON.stringify(res.data).substring(0, 200)}`);
  }

  // ============================================================
  // TEST E: run_action with read-only actions
  // ============================================================
  console.log('\n=== TEST E: run_action — read-only query actions ===');
  const readActions = [
    'get_garage_status',
    'garage_door_status', 
    'get_dongle_status',
    'get_accessory_state',
    'get_door_state',
  ];
  for (const action of readActions) {
    const payload = buildBasePayload(token);
    payload.sv = WYZE_SV_SET_PROPERTY;
    payload.provider_key = MODEL;
    payload.instance_id = MAC;
    payload.action_key = action;
    payload.action_params = {};
    payload.custom_string = '';
    res = await post('api.wyzecam.com', '/app/v2/auto/run_action', payload);
    console.log(`  ${action}: code=${res.data.code} msg=${res.data.msg}`);
    if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data)}`);
  }

  // ============================================================
  // TEST F: set_property to READ P1056 (set_property on same pid reads fresh)
  // Actually, try get_property endpoint with fresh sv
  // ============================================================
  console.log('\n=== TEST F: get_property_list with different sv values ===');
  const svValues = [
    '9d74946e652647e9b6c9d59326aef104', // from wyzeapy
    WYZE_SV_SET_PROPERTY,
    'c86fa16fc99d4d6580f82ef3b942e586', // device info sv
    '011a6b4d80ef4f12b4b73e4ce8d0c2b7',
    'e87de39944394d6c934e36a7b1e0aff7',
  ];
  for (const sv of svValues) {
    const payload = buildBasePayload(token);
    payload.sv = sv;
    payload.device_mac = MAC;
    payload.device_model = MODEL;
    payload.target_pid_list = ['P1056'];
    res = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
    if (res.data.code == 1 && res.data.data && res.data.data.property_list) {
      const p = res.data.data.property_list.find(x => x.pid === 'P1056');
      console.log(`  sv=${sv.substring(0,12)}... P1056=${p ? p.value : 'not found'} ts=${p ? p.ts : ''}`);
    } else {
      console.log(`  sv=${sv.substring(0,12)}... code=${res.data.code}`);
    }
  }

  // ============================================================
  // TEST G: P1056 timestamp analysis
  // ============================================================
  console.log('\n=== TEST G: P1056 timestamp analysis ===');
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = MAC;
  payload.device_model = MODEL;
  payload.target_pid_list = [];
  res = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
  if (res.data.code == 1 && res.data.data) {
    const props = res.data.data.property_list;
    console.log('  All properties with timestamps:');
    for (const p of props) {
      if (p.ts) {
        const d = new Date(p.ts);
        console.log(`    ${p.pid} = ${p.value}  ts=${p.ts} (${d.toLocaleDateString()} ${d.toLocaleTimeString()})`);
      }
    }
  }

  // ============================================================
  // TEST H: Earth service — try different APP_IDs from wyze SDK
  // The problem might be wrong APP_ID, not wrong secret
  // ============================================================
  console.log('\n=== TEST H: Earth service with all known APP_ID/secret combos ===');
  const combos = [
    { appId: '9319141212m2ik', secret: 'wyze_app_secret_key_132' },
    { appId: 'venp_4c30f812828de875', secret: 'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq' },
    { appId: 'earp_9b66f89647d35e43', secret: 'wyze_app_secret_key_132' },
    { appId: 'earp_9b66f89647d35e43', secret: 'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq' },
    { appId: 'earp_9b66f89647d35e43', secret: 'GbRruaU3JlJrFnTuOVEaWBukeJSvApKz' },
    { appId: 'earp_9b66f89647d35e43', secret: 'WMXHYf79Nr5gIlt3r0r7p9Tc' },
  ];
  
  for (const { appId, secret } of combos) {
    const params = { did: MAC, keys: 'P1056', nonce: String(Date.now()) };
    const sortedStr = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
    const qs = Object.keys(params).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const encodedSecret = md5(token + secret);
    const sig = md5(sortedStr, encodedSecret);
    
    try {
      res = await get('wyze-earth-service.wyzecam.com', '/plugin/earth/get_iot_prop?' + qs, {
        'access_token': token, 'requestid': md5(md5(String(params.nonce))),
        'appid': appId, 'appinfo': 'wyze_android_' + WYZE_APP_VERSION,
        'phoneid': WYZE_PHONE_ID, 'signature2': sig,
      });
      console.log(`  appId=${appId.substring(0,20)}... secret=${secret.substring(0,15)}... → code=${res.data.code} ${res.data.msg || ''}`);
      if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data)}`);
    } catch(e) { console.log(`  ERROR: ${e.message}`); }
  }

  // ============================================================
  // TEST I: Try the Wyze app's more modern API endpoints
  // ============================================================
  console.log('\n=== TEST I: Modern app endpoints ===');
  
  // app.wyzecam.com/app/v4 style
  const modernEndpoints = [
    { host: 'app.wyzecam.com', path: '/app/v4/device/get-property-list' },
    { host: 'api.wyzecam.com', path: '/app/v2/device/get_acc_status' },
    { host: 'api.wyzecam.com', path: '/app/v2/device/get_dongle_status' },
  ];
  
  for (const ep of modernEndpoints) {
    const payload2 = buildBasePayload(token);
    payload2.device_mac = MAC;
    payload2.device_model = MODEL;
    payload2.sv = WYZE_SV_SET_PROPERTY;
    try {
      res = await post(ep.host, ep.path, payload2);
      console.log(`  ${ep.path}: code=${res.data.code || res.data.Code} msg=${res.data.msg || ''}`);
      if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data).substring(0, 200)}`);
    } catch(e) { console.log(`  ${ep.path}: ERROR ${e.message}`); }
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
