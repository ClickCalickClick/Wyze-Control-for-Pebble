#!/usr/bin/env node
/**
 * test_garage_deep.js — Exhaustive garage door state detection
 * 
 * Tries EVERY possible approach to read real-time garage door state.
 * ALL TESTS ARE READ-ONLY. No open/close commands are sent.
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
const WYZE_SV_DEVICE_LIST = 'c417b62d72ee44bf933054bdca183e77';
const WYZE_SV_SET_PROPERTY = '44b6d5640c4d4978baba65c8ab9a6d6e';

// Olive/platform service constants
const OLIVE_APP_ID = '9319141212m2ik';
const OLIVE_SIGNING_SECRET = 'wyze_app_secret_key_132';

// Earth service constants  
const EARTH_APP_ID = 'earp_9b66f89647d35e43';

// Known ExServiceClient salts
const SALTS = {
  '9319141212m2ik': 'wyze_app_secret_key_132',
  'venp_4c30f812828de875': 'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq',
};

function md5(str, key) {
  if (key) return crypto.createHmac('md5', key).update(str).digest('hex');
  return crypto.createHash('md5').update(str).digest('hex');
}

function buildBasePayload(token) {
  return {
    access_token: token,
    app_name: WYZE_APP_NAME,
    app_ver: WYZE_APP_NAME + '___' + WYZE_APP_VERSION,
    app_version: WYZE_APP_VERSION,
    phone_id: WYZE_PHONE_ID,
    phone_system_type: '2',
    sc: WYZE_SC,
    ts: Date.now()
  };
}

function httpRequest(method, hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname, path, method,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        ...headers
      }
    };
    if (method === 'POST') opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function post(hostname, path, body, headers) {
  return httpRequest('POST', hostname, path, body, headers);
}

function get(hostname, path, headers) {
  return httpRequest('GET', hostname, path, null, headers);
}

// Olive-style signature for platform services
function oliveSign(params, token) {
  // Sort params alphabetically, build key=value string
  const keys = Object.keys(params).sort();
  const sortedStr = keys.map(k => k + '=' + params[k]).join('&');
  const secret = md5(token + OLIVE_SIGNING_SECRET);
  return md5(sortedStr, secret);
}

// ExServiceClient-style signing (same as scale service)
function exServiceSign(params, token, signingSecret) {
  const keys = Object.keys(params).sort();
  const sortedStr = keys.map(k => k + '=' + params[k]).join('&');
  const secret = md5(token + signingSecret);
  return md5(sortedStr, secret);
}

async function authenticate() {
  console.log('=== Authenticating ===');
  const hashedPw = md5(md5(md5(PASSWORD)));
  const res = await post('auth-prod.api.wyze.com', '/api/user/login', {
    email: EMAIL, password: hashedPw, nonce: String(Date.now())
  }, {
    'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm',
    'apikey': API_KEY, 'keyid': KEY_ID,
    'User-Agent': 'wyze_android_2.49.0'
  });
  if (res.data.access_token) { console.log('Auth OK'); return res.data.access_token; }
  console.error('Auth failed:', JSON.stringify(res.data, null, 2));
  process.exit(1);
}

async function getDevices(token) {
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_DEVICE_LIST;
  const res = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', payload);
  if (res.data.code != 1 && res.data.msg !== 'SUCCESS') { console.error('Device list failed'); process.exit(1); }
  return res.data.data.device_list || [];
}

// ============================================================
// APPROACH 1: Event list for garage cam
// ============================================================
async function testEventList(token, mac) {
  console.log('\n=== APPROACH 1: Event List ===');
  const now = Date.now();
  const payload = {
    ...buildBasePayload(token),
    sv: '782ced6909a44d92a1f70d582bbe88be',
    device_mac_list: [mac],
    device_mac: '',
    event_type: '',
    count: 20,
    order_by: 2,
    begin_time: now - (24 * 60 * 60 * 1000), // last 24 hours
    end_time: now,
    event_value_list: ['1', '13', '10', '12'],
    event_tag_list: [],
  };
  const res = await post('api.wyzecam.com', '/app/v2/device/get_event_list', payload);
  if (res.data.code == 1 && res.data.data && res.data.data.event_list) {
    const events = res.data.data.event_list;
    console.log(`  Found ${events.length} events in last 24h for ${mac}`);
    for (const e of events.slice(0, 10)) {
      const ts = new Date(e.event_ts).toLocaleString();
      console.log(`    [${ts}] cat=${e.event_category} val=${e.event_value} tag=${JSON.stringify(e.tag_list || [])}`);
      if (e.event_params) {
        console.log(`      params: ${JSON.stringify(e.event_params)}`);
      }
    }
  } else {
    console.log('  Failed or empty:', res.data.msg || res.data.code);
  }
}

// ============================================================
// APPROACH 2: get_property_list with specific target_pid_list
// ============================================================
async function testTargetedPropertyList(token, mac, model) {
  console.log('\n=== APPROACH 2: Targeted get_property_list (P1056 only) ===');
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = mac;
  payload.device_model = model;
  payload.target_pid_list = ['P1056'];
  const res = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
  if (res.data.code == 1 && res.data.data && res.data.data.property_list) {
    for (const p of res.data.data.property_list) {
      console.log(`  ${p.pid} = ${p.value} (ts: ${p.ts || 'none'})`);
    }
  } else {
    console.log('  Failed:', res.data.msg);
  }
}

// ============================================================
// APPROACH 3: Earth service get_iot_prop
// ============================================================
async function testEarthService(token, mac) {
  console.log('\n=== APPROACH 3: Earth Service (get_iot_prop) ===');
  
  // Try different possible signing secrets
  const possibleSecrets = [
    'wyze_app_secret_key_132',  // same as scale
    'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq',  // venp secret
    'GbRruaU3JlJrFnTuOVEaWBukeJSvApKz', // common wyze secret
  ];
  
  // Try different key names for garage state
  const keyLists = [
    'P1056',
    'P1056,P3,P5',
    'switch_state',
    'iot-state,iot-power',
    'open_close_state',
    'door_state',
    'garage_state',
    'accessory_switch',
    'dongle_switch',
  ];
  
  for (const secret of possibleSecrets) {
    console.log(`  Trying secret: ${secret.substring(0, 15)}...`);
    for (const keys of keyLists) {
      const params = {
        did: mac,
        keys: keys,
        nonce: String(Date.now()),
      };
      const sortedKeys = Object.keys(params).sort();
      const sortedStr = sortedKeys.map(k => k + '=' + params[k]).join('&');
      const qs = sortedKeys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
      const encodedSecret = md5(token + secret);
      const signature2 = md5(sortedStr, encodedSecret);
      const requestId = md5(md5(String(params.nonce)));
      
      try {
        const res = await get('wyze-earth-service.wyzecam.com',
          '/plugin/earth/get_iot_prop?' + qs,
          {
            'access_token': token,
            'requestid': requestId,
            'appid': EARTH_APP_ID,
            'appinfo': 'wyze_android_' + WYZE_APP_VERSION,
            'phoneid': WYZE_PHONE_ID,
            'User-Agent': 'wyze_android_' + WYZE_APP_VERSION,
            'signature2': signature2,
          }
        );
        if (res.data && res.data.code !== '1000' && res.data.code !== 1000 && res.status !== 401) {
          console.log(`    keys=${keys} → code=${res.data.code} msg=${res.data.msg}`);
          if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data)}`);
          if (res.data.code == 1 || res.data.code === '1') {
            console.log('    ✅ SUCCESS! Data:', JSON.stringify(res.data, null, 2));
            return; // Found what works
          }
        }
      } catch (e) {
        // Skip network errors silently
      }
    }
    // If we got any non-auth-error, this secret might be right
    break; // Try first secret fully, then move on
  }
  
  // Also try with Olive signing style (different signature approach)
  console.log('  Trying Olive-style signing...');
  for (const keys of keyLists.slice(0, 4)) {
    const params = {
      did: mac,
      keys: keys,
      nonce: String(Date.now()),
    };
    const signature = oliveSign(params, token);
    const qs = Object.keys(params).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    
    try {
      const res = await get('wyze-earth-service.wyzecam.com',
        '/plugin/earth/get_iot_prop?' + qs,
        {
          'access_token': token,
          'requestid': md5(md5(String(params.nonce))),
          'appid': OLIVE_APP_ID,
          'appinfo': 'wyze_android_' + WYZE_APP_VERSION,
          'phoneid': WYZE_PHONE_ID,
          'signature2': signature,
        }
      );
      const code = res.data && (res.data.code || res.data.Code);
      console.log(`    Olive keys=${keys} → code=${code} msg=${res.data.msg || res.data.Msg}`);
      if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data)}`);
    } catch (e) { /* skip */ }
  }
}

// ============================================================
// APPROACH 4: Olive Platform service get_iot_prop
// ============================================================
async function testOlivePlatformService(token, mac) {
  console.log('\n=== APPROACH 4: Olive Platform Service ===');
  const keyLists = ['P1056', 'P1056,P3,P5,P1301', 'switch_state,open_close_state'];
  
  for (const keys of keyLists) {
    const params = {
      did: mac,
      keys: keys,
      nonce: String(Date.now()),
    };
    const signature = oliveSign(params, token);
    const qs = Object.keys(params).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    
    try {
      const res = await get('wyze-platform-service.wyzecam.com',
        '/app/v2/platform/get_iot_prop?' + qs,
        {
          'Accept-Encoding': 'gzip',
          'User-Agent': 'myapp',
          'appid': OLIVE_APP_ID,
          'appinfo': 'wyze_android_' + WYZE_APP_VERSION,
          'phoneid': WYZE_PHONE_ID,
          'access_token': token,
          'signature2': signature,
        }
      );
      console.log(`  keys=${keys} → code=${res.data.code} msg=${res.data.msg}`);
      if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data)}`);
    } catch (e) {
      console.log(`  keys=${keys} → ERROR: ${e.message}`);
    }
  }
}

// ============================================================
// APPROACH 5: Check for sub-devices / dongle devices
// ============================================================
async function testSubDevices(token, mac, allDevices) {
  console.log('\n=== APPROACH 5: Sub-devices / Related devices ===');
  
  // Check if any device has this camera as parent
  for (const d of allDevices) {
    if (d.parent_device_mac === mac || (d.device_params && d.device_params.parent_device_mac === mac)) {
      console.log(`  Found sub-device: ${d.nickname} (${d.product_model}) MAC: ${d.mac}`);
      console.log(`    product_type: ${d.product_type}`);
      console.log(`    device_params: ${JSON.stringify(d.device_params, null, 4)}`);
    }
  }
  
  // Also check if any device has MAC that starts with/contains garage cam MAC
  for (const d of allDevices) {
    if (d.mac !== mac && (d.mac.includes(mac.substring(0, 8)) || (d.nickname && d.nickname.toLowerCase().includes('garage')))) {
      console.log(`  Possibly related: ${d.nickname} (${d.product_model}) MAC: ${d.mac} type: ${d.product_type}`);
    }
  }
  
  // Try earth service get_sub_device
  console.log('  Trying Earth service get_sub_device...');
  for (const secret of ['wyze_app_secret_key_132', 'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq']) {
    const params = {
      did: mac,
      nonce: String(Date.now()),
    };
    const sortedStr = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
    const qs = Object.keys(params).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const encodedSecret = md5(token + secret);
    const signature2 = md5(sortedStr, encodedSecret);
    
    try {
      const res = await get('wyze-earth-service.wyzecam.com',
        '/plugin/earth/get_sub_device?' + qs,
        {
          'access_token': token,
          'requestid': md5(md5(String(params.nonce))),
          'appid': EARTH_APP_ID,
          'appinfo': 'wyze_android_' + WYZE_APP_VERSION,
          'phoneid': WYZE_PHONE_ID,
          'signature2': signature2,
        }
      );
      console.log(`  get_sub_device (secret=${secret.substring(0,15)}...) → code=${res.data.code} msg=${res.data.msg}`);
      if (res.data.data) console.log(`    data: ${JSON.stringify(res.data.data, null, 2)}`);
    } catch (e) { /* skip */ }
  }
}

// ============================================================
// APPROACH 6: devicemgmt service
// ============================================================
async function testDeviceMgmt(token, mac, model) {
  console.log('\n=== APPROACH 6: Device Management Service ===');
  const payload = {
    capabilities: [
      { name: "iot-device", properties: ["iot-state", "iot-power"] },
      { name: "garage", properties: ["state", "open", "door-state"] },
      { name: "accessory", properties: ["state", "switch"] },
    ],
    nonce: Date.now(),
    targetInfo: {
      id: mac,
      productModel: model,
      type: "DEVICE",
    },
  };
  
  try {
    const res = await post('devicemgmt-service-beta.wyze.com',
      '/device-management/api/device-property/get_iot_prop',
      payload,
      { 'authorization': token }
    );
    console.log(`  code=${res.data.code} msg=${res.data.msg}`);
    if (res.data.data) {
      console.log('  data:', JSON.stringify(res.data.data, null, 2));
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

// ============================================================
// APPROACH 7: get_device_property_list via Wyze API (different endpoint)
// ============================================================
async function testGetDevicePropertyList(token, mac, model) {
  console.log('\n=== APPROACH 7: Various property endpoints ===');
  
  // Try /app/v2/device/get_property
  const pids = ['P1056', 'P1301', 'P2001'];
  for (const pid of pids) {
    const payload = buildBasePayload(token);
    payload.sv = WYZE_SV_SET_PROPERTY;
    payload.device_mac = mac;
    payload.device_model = model;
    payload.pid = pid;
    const res = await post('api.wyzecam.com', '/app/v2/device/get_property', payload);
    if (res.data.code == 1) {
      console.log(`  get_property ${pid}: ${JSON.stringify(res.data.data)}`);
    } else {
      console.log(`  get_property ${pid}: code=${res.data.code} msg=${res.data.msg}`);
    }
  }
}

// ============================================================
// APPROACH 8: Check get_event_list with all event types
// ============================================================
async function testAllEvents(token, mac) {
  console.log('\n=== APPROACH 8: Broad event search ===');
  const now = Date.now();
  
  // Try with no filter to get ALL events
  const payload = {
    ...buildBasePayload(token),
    sv: '782ced6909a44d92a1f70d582bbe88be',
    device_mac_list: [],
    device_mac: mac,
    event_type: '',
    count: 20,
    order_by: 2,
    begin_time: now - (24 * 60 * 60 * 1000),
    end_time: now,
    event_value_list: [],  // no filter
    event_tag_list: [],
  };
  
  const res = await post('api.wyzecam.com', '/app/v2/device/get_event_list', payload);
  if (res.data.code == 1 && res.data.data && res.data.data.event_list) {
    const events = res.data.data.event_list;
    console.log(`  Found ${events.length} total events for MAC ${mac}`);
    for (const e of events.slice(0, 10)) {
      const ts = new Date(e.event_ts).toLocaleString();
      console.log(`    [${ts}] cat=${e.event_category} val=${e.event_value} mac=${e.device_mac} model=${e.device_model}`);
      if (e.tag_list && e.tag_list.length > 0) {
        console.log(`      tags: ${JSON.stringify(e.tag_list)}`);
      }
    }
  } else {
    console.log('  Result:', res.data.code, res.data.msg);
  }
}

// ============================================================
// APPROACH 9: Wyze app v3/v4 endpoints
// ============================================================
async function testV3Endpoints(token, mac, model) {
  console.log('\n=== APPROACH 9: v3/v4 API endpoints ===');
  
  // Try /app/v3/device/get_iot_device_property
  let payload = {
    ...buildBasePayload(token),
    device_mac: mac,
    device_model: model,
    sv: WYZE_SV_SET_PROPERTY,
  };
  
  let res = await post('api.wyzecam.com', '/app/v3/device/get_device_info', payload);
  console.log(`  v3/get_device_info: code=${res.data.code} msg=${res.data.msg}`);
  if (res.data.data) {
    // Look for any garage-related fields
    const data = res.data.data;
    if (data.property_list) {
      const p1056 = data.property_list.find(p => p.pid === 'P1056');
      if (p1056) console.log(`    P1056 = ${p1056.value} (ts: ${p1056.ts})`);
    }
    if (data.device_params) {
      const dp = data.device_params;
      console.log(`    dongle_switch: ${dp.dongle_switch}`);
      console.log(`    accessory_switch: ${dp.accessory_switch}`);
      console.log(`    open_close_state: ${dp.open_close_state}`);
      console.log(`    door_state: ${dp.door_state}`);
      // Print ALL params we haven't seen before
      for (const k of Object.keys(dp).sort()) {
        if (!['dongle_switch', 'accessory_switch', 'camera_thumbnails', 'p2p_id', 'ssid', 'ip', 'public_ip'].includes(k)) {
          console.log(`    ${k}: ${dp[k]}`);
        }
      }
    }
  }
}

// ============================================================
// APPROACH 10: Check device_params from fresh get_object_list
// focusing on open_close_state and any field that could be garage
// ============================================================
async function testFreshDeviceParams(token) {
  console.log('\n=== APPROACH 10: Fresh device list with all device_params ===');
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_DEVICE_LIST;
  const res = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', payload);
  if (res.data.code != 1) return;
  
  const devices = res.data.data.device_list || [];
  for (const d of devices) {
    if (d.device_params && d.device_params.dongle_product_model === 'HL_CGDC') {
      console.log(`  ${d.nickname} — ALL raw device_params:`);
      const params = d.device_params;
      for (const k of Object.keys(params).sort()) {
        const v = params[k];
        if (typeof v === 'object') {
          console.log(`    ${k}: ${JSON.stringify(v).substring(0, 100)}`);
        } else {
          console.log(`    ${k}: ${v}`);
        }
      }
      
      // Also check for any top-level fields we might have missed
      console.log('  Top-level device fields:');
      for (const k of Object.keys(d).sort()) {
        if (k !== 'device_params' && typeof d[k] !== 'object') {
          console.log(`    ${k}: ${d[k]}`);
        }
      }
      
      // Check raw_device_params or any other nested objects
      for (const k of Object.keys(d).sort()) {
        if (typeof d[k] === 'object' && k !== 'device_params') {
          console.log(`  ${k}:`, JSON.stringify(d[k]).substring(0, 200));
        }
      }
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const token = await authenticate();
  const devices = await getDevices(token);
  
  // Find garage cam
  let garageCam = null;
  for (const d of devices) {
    if (d.device_params && d.device_params.dongle_product_model === 'HL_CGDC') {
      garageCam = d;
      break;
    }
  }
  
  if (!garageCam) {
    console.log('No garage cam found');
    process.exit(1);
  }
  
  const mac = garageCam.mac;
  const model = garageCam.product_model;
  console.log(`\nGarage Cam: ${garageCam.nickname} (${model}) MAC: ${mac}`);
  console.log('Door state: USER SAYS CURRENTLY CLOSED');
  
  await testEventList(token, mac);
  await testTargetedPropertyList(token, mac, model);
  await testEarthService(token, mac);
  await testOlivePlatformService(token, mac);
  await testSubDevices(token, mac, devices);
  await testDeviceMgmt(token, mac, model);
  await testGetDevicePropertyList(token, mac, model);
  await testAllEvents(token, mac);
  await testV3Endpoints(token, mac, model);
  await testFreshDeviceParams(token);
  
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
