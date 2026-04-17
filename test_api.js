#!/usr/bin/env node
/**
 * test_light_controls.js — Full device audit & control test for ALL Wyze devices
 *
 * Usage:
 *   WYZE_EMAIL=you@email.com WYZE_PASSWORD=pass WYZE_API_KEY=ak WYZE_KEY_ID=kid node test_light_controls.js
 *
 * Optional env vars:
 *   WYZE_TEST_DEVICE=<mac>      Only test the device with this MAC
 *   WYZE_RUN_CONTROLS=1         Actually send control commands (default: list-only)
 *
 * This script will:
 *   1. Authenticate and get a token
 *   2. Fetch full device list, print EVERY device with full params + property list
 *   3. If WYZE_RUN_CONTROLS=1, test control commands per device type via both endpoints:
 *      a) set_property (flat)
 *      b) run_action_list with set_mesh_property (for mesh devices)
 *   4. Print results summary per device
 */

const https = require('https');
const crypto = require('crypto');

// --- Credentials from env ---
const EMAIL    = process.env.WYZE_EMAIL    || '';
const PASSWORD = process.env.WYZE_PASSWORD || '';
const API_KEY  = process.env.WYZE_API_KEY  || '';
const KEY_ID   = process.env.WYZE_KEY_ID   || '';
const TEST_MAC = process.env.WYZE_TEST_DEVICE || '';
const RUN_CONTROLS = process.env.WYZE_RUN_CONTROLS === '1';

if (!EMAIL || !PASSWORD || !API_KEY || !KEY_ID) {
  console.error('Missing credentials. Set WYZE_EMAIL, WYZE_PASSWORD, WYZE_API_KEY, WYZE_KEY_ID');
  process.exit(1);
}

// --- Wyze constants ---
const WYZE_APP_NAME = 'com.hualai';
const WYZE_APP_VERSION = '2.19.14';
const WYZE_PHONE_ID = 'wyze_developer_api';
const WYZE_SC = 'a626948714654991afd3c0dbd7cdb901';
const WYZE_SV_DEVICE_LIST = 'c417b62d72ee44bf933054bdca183e77';
const WYZE_SV_SET_PROPERTY = '44b6d5640c4d4978baba65c8ab9a6d6e';

function md5(str) {
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

function post(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================
// Step 1: Auth
// ============================================================
async function authenticate() {
  console.log('=== STEP 1: Authenticating ===');
  const hashedPw = md5(md5(md5(PASSWORD)));
  const nonce = String(Date.now());

  const res = await post('auth-prod.api.wyze.com', '/api/user/login', {
    email: EMAIL,
    password: hashedPw,
    nonce: nonce
  }, {
    'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm',
    'apikey': API_KEY,
    'keyid': KEY_ID,
    'User-Agent': 'wyze_android_2.49.0'
  });

  if (res.data.access_token) {
    console.log('Auth OK — token received');
    return res.data.access_token;
  }
  if (res.data.mfa_options) {
    console.error('MFA required:', res.data.mfa_options);
    process.exit(1);
  }
  console.error('Auth failed:', JSON.stringify(res.data, null, 2));
  process.exit(1);
}

// ============================================================
// Step 2: Get all devices, filter lights
// ============================================================
async function getDevices(token) {
  console.log('\n=== STEP 2: Fetching device list ===');
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_DEVICE_LIST;
  const res = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', payload);
  if (res.data.code != 1 && res.data.msg !== 'SUCCESS') {
    console.error('Device list failed:', res.data.msg, 'code:', res.data.code);
    process.exit(1);
  }
  return res.data.data.device_list || [];
}

// ============================================================
// Step 3: Get property list for a device
// ============================================================
async function getPropertyList(token, mac, model) {
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = mac;
  payload.device_model = model;
  const res = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
  if ((res.data.code == 1 || res.data.msg === 'SUCCESS') && res.data.data && res.data.data.property_list) {
    return res.data.data.property_list;
  }
  return null;
}

// ============================================================
// Step 4a: set_property (flat call)
// ============================================================
async function testSetProperty(token, mac, model, pid, pvalue, label) {
  console.log(`  [set_property] ${label}: pid=${pid} pvalue=${pvalue}`);
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = mac;
  payload.device_model = model;
  payload.pid = pid;
  payload.pvalue = String(pvalue);
  const res = await post('api.wyzecam.com', '/app/v2/device/set_property', payload);
  const ok = (res.data.code == 1 || res.data.msg === 'SUCCESS');
  console.log(`    → code=${res.data.code} msg=${res.data.msg} ${ok ? '✅' : '❌'}`);
  return ok;
}

// ============================================================
// Step 4b: run_action_list with set_mesh_property
// ============================================================
async function testRunActionList(token, mac, model, pid, pvalue, label) {
  console.log(`  [run_action_list/set_mesh_property] ${label}: pid=${pid} pvalue=${pvalue}`);
  const plist = [{ pid: pid, pvalue: String(pvalue) }];
  // SDK always includes P3=1 (turn on) when setting non-power properties
  if (pid !== 'P3') {
    plist.push({ pid: 'P3', pvalue: '1' });
  }
  const payload = buildBasePayload(token);
  payload.action_list = [{
    instance_id: mac,
    action_params: { list: [{ mac: mac, plist: plist }] },
    provider_key: model,
    action_key: 'set_mesh_property'
  }];
  const res = await post('api.wyzecam.com', '/app/v2/auto/run_action_list', payload);
  const ok = (res.data.code == 1 || res.data.msg === 'SUCCESS');
  console.log(`    → code=${res.data.code} msg=${res.data.msg} ${ok ? '✅' : '❌'}`);
  return ok;
}

// ============================================================
// Control tests per device type
// ============================================================
function getControlTests(productType) {
  // Common power toggle for all device types
  const powerTests = [
    { pid: 'P3', pvalue: '1', label: 'Power ON' },
    { pid: 'P3', pvalue: '0', label: 'Power OFF' },
    { pid: 'P3', pvalue: '1', label: 'Power ON (restore)' },
  ];

  switch (productType) {
    case 'MeshLight':
    case 'Light':
      return [
        ...powerTests,
        { pid: 'P1501', pvalue: '50',   label: 'Brightness 50%' },
        { pid: 'P1501', pvalue: '100',  label: 'Brightness 100%' },
        { pid: 'P1502', pvalue: '2700', label: 'Color Temp 2700K (Soft White)' },
        { pid: 'P1502', pvalue: '6500', label: 'Color Temp 6500K (Cool White)' },
        { pid: 'P1507', pvalue: 'ff0000', label: 'Color Red (ff0000)' },
        { pid: 'P1507', pvalue: '00ff00', label: 'Color Green (00ff00)' },
        { pid: 'P1507', pvalue: '0000ff', label: 'Color Blue (0000ff)' },
      ];

    case 'Plug':
    case 'OutdoorPlug':
      return powerTests;

    case 'Switch':
      return powerTests;

    case 'Camera':
      return [
        // Camera siren and flood light (if available)
        { pid: 'P1049', pvalue: '1', label: 'Camera Siren ON' },
        { pid: 'P1049', pvalue: '0', label: 'Camera Siren OFF' },
        { pid: 'P1056', pvalue: '1', label: 'Camera Flood Light ON' },
        { pid: 'P1056', pvalue: '0', label: 'Camera Flood Light OFF' },
      ];

    case 'Lock':
      // Locks use a different API (openapi/lock/v1/control) — just test power PID
      return powerTests;

    case 'GarageDoor':
    case 'GDC':
      return powerTests;

    case 'WyzeScale':
    case 'S1':
      // Scales are read-only; no control PIDs
      return [];

    default:
      return powerTests;
  }
}

// ============================================================
// Main
// ============================================================

// --- Camera-specific: test get_event_list ---
async function testCameraEvents(token, mac, model, nickname) {
  console.log(`\n  📷 CAMERA EVENT TEST: ${nickname}`);
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = mac;
  payload.device_model = model;
  payload.count = 1;
  payload.order_by = 2; // most recent first
  payload.begin_time = String(Date.now() - 7 * 24 * 3600 * 1000); // last 7 days
  payload.end_time = String(Date.now());
  payload.event_value_list = [];
  payload.event_tag_list = [];
  try {
    const res = await post('api.wyzecam.com', '/app/v2/device/get_event_list', payload);
    if (res.data.code == 1 && res.data.data && res.data.data.event_list) {
      const events = res.data.data.event_list;
      console.log(`    Events returned: ${events.length}`);
      if (events.length > 0) {
        const ev = events[0];
        console.log(`    Latest event:`);
        console.log(`      event_id:   ${ev.event_id || 'n/a'}`);
        console.log(`      event_type: ${ev.event_type || ev.tag_list || 'n/a'}`);
        console.log(`      event_ts:   ${ev.event_ts || ev.event_time || 'n/a'}`);
        const url = ev.file_url || ev.url || '';
        console.log(`      image_url:  ${url ? url.substring(0, 80) + '...' : '(none)'}`);
        // Check for tags/AI detection info
        if (ev.tag_list) console.log(`      tag_list:   ${JSON.stringify(ev.tag_list)}`);
        if (ev.file_list) console.log(`      file_list:  ${JSON.stringify(ev.file_list).substring(0, 200)}`);
      }
    } else {
      console.log(`    ⚠️  get_event_list: code=${res.data.code} msg=${res.data.msg}`);
    }
  } catch (e) {
    console.log(`    ❌ Error: ${e.message}`);
  }
}

// --- Scale-specific: test multiple data endpoints ---
async function testScaleData(token, mac, model, nickname) {
  console.log(`\n  ⚖️  SCALE DATA TEST: ${nickname}`);
  
  // Test 1: Standard get_property_list
  console.log(`  [1] get_property_list:`);
  const props = await getPropertyList(token, mac, model);
  if (props && props.length > 0) {
    console.log(`    Properties (${props.length}):`);
    props.forEach(p => console.log(`      ${p.pid} = ${p.value}`));
  } else {
    console.log(`    ⚠️  No properties returned`);
  }
  
  // Test 2: Scale-specific endpoint (user_id from token)  
  console.log(`  [2] wyze-scale-service get_latest_records:`);
  try {
    const payload2 = {
      access_token: token,
      app_name: WYZE_APP_NAME,
      app_ver: WYZE_APP_NAME + '___' + WYZE_APP_VERSION,
      app_version: WYZE_APP_VERSION,
      phone_id: WYZE_PHONE_ID,
      phone_system_type: '2',
      sc: WYZE_SC,
      sv: WYZE_SV_SET_PROPERTY,
      ts: Date.now(),
      device_mac: mac,
      device_model: model,
      count: 1
    };
    const res2 = await post('api.wyzecam.com', '/app/v2/device/get_device_Info', payload2);
    console.log(`    get_device_Info code: ${res2.data.code} msg: ${res2.data.msg}`);
    if (res2.data.data) {
      const info = res2.data.data;
      console.log(`    nickname: ${info.nickname}`);
      console.log(`    conn_state: ${info.conn_state}`);
      console.log(`    product_type: ${info.product_type}`);
      const dp = info.device_params || {};
      console.log(`    device_params keys: ${Object.keys(dp).join(', ')}`);
      Object.keys(dp).forEach(k => {
        const val = typeof dp[k] === 'object' ? JSON.stringify(dp[k]) : dp[k];
        console.log(`      ${k} = ${val}`);
      });
    }
  } catch (e) {
    console.log(`    ❌ Error: ${e.message}`);
  }

  // Test 3: Try the scale plugin endpoint with proper payload
  console.log(`  [3] Direct scale API endpoint search:`);
  try {
    const payload3 = buildBasePayload(token);
    payload3.sv = WYZE_SV_SET_PROPERTY;
    payload3.device_mac = mac;
    payload3.device_model = model;
    payload3.target_pid_list = ['P1','P2','P3','P4','P5'];
    const res3 = await post('api.wyzecam.com', '/app/v2/device_list/get_property_list', payload3);
    console.log(`    device_list/get_property_list: code=${res3.data.code} msg=${res3.data.msg}`);
    if (res3.data.data) {
      console.log(`    Data: ${JSON.stringify(res3.data.data).substring(0, 500)}`);
    }
  } catch (e) {
    console.log(`    ❌ Error: ${e.message}`);
  }
}

// --- Garage door detection: look for GDC accessories on cameras ---
function checkGarageDoorAccessories(allDevices) {
  console.log(`\n🔍 GARAGE DOOR DETECTION`);
  console.log(`  Searching for 'GarageDoor', 'GDC', or garage-related product types...`);
  
  let found = false;
  allDevices.forEach(d => {
    const pt = (d.product_type || '').toLowerCase();
    const pm = (d.product_model || '').toLowerCase();
    const nn = (d.nickname || '').toLowerCase();
    if (pt.includes('garage') || pm.includes('gdc') || nn.includes('garage') || pt === 'garagedoor') {
      console.log(`  ✅ Found garage device: "${d.nickname}" (${d.product_type}/${d.product_model}) MAC=${d.mac}`);
      found = true;
    }
  });
  
  if (!found) {
    console.log(`  ❌ No device with product_type 'GarageDoor' or 'GDC' found in device list.`);
    console.log(`  Checking cameras for garage door controller accessories...`);
    
    allDevices.filter(d => (d.product_type || '') === 'Camera').forEach(cam => {
      const dp = cam.device_params || {};
      const dpStr = JSON.stringify(dp).toLowerCase();
      if (dpStr.includes('garage') || dpStr.includes('gdc')) {
        console.log(`  ✅ Camera "${cam.nickname}" has garage-related device_params`);
        found = true;
      }
      // Check for child devices / accessories
      if (cam.device_list) {
        console.log(`  Camera "${cam.nickname}" has child devices: ${JSON.stringify(cam.device_list)}`);
      }
    });
  }
  
  if (!found) {
    console.log(`  ℹ️  No garage door controller found. User may not have one, or it may use a different API path.`);
    console.log(`  Known Wyze Garage Door models: WYZEGDC, GW_GDC1`);
  }
}

async function main() {
  const token = await authenticate();
  const allDevices = await getDevices(token);

  console.log(`\nTotal devices: ${allDevices.length}`);

  // --- Print device type summary ---
  console.log('\n=== DEVICE TYPE SUMMARY ===');
  const typeCounts = {};
  allDevices.forEach(d => {
    const key = `${d.product_type} (${d.product_model})`;
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });
  Object.keys(typeCounts).sort().forEach(k => {
    console.log(`  ${k}: ${typeCounts[k]}`);
  });

  // --- Detailed audit for EVERY device ---
  console.log('\n=== FULL DEVICE AUDIT ===');
  for (let i = 0; i < allDevices.length; i++) {
    const dev = allDevices[i];
    if (TEST_MAC && dev.mac !== TEST_MAC) continue;

    const dp = dev.device_params || {};
    const online = (dev.conn_state === 1 || dev.conn_state === '1');

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  [${i + 1}/${allDevices.length}] ${dev.nickname}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`  MAC:            ${dev.mac}`);
    console.log(`  Model:          ${dev.product_model}`);
    console.log(`  product_type:   ${dev.product_type}`);
    console.log(`  conn_state:     ${dev.conn_state} ${online ? '(online)' : '(offline)'}`);

    // Print all device_params
    const dpKeys = Object.keys(dp);
    if (dpKeys.length > 0) {
      console.log(`  device_params (${dpKeys.length} keys):`);
      dpKeys.forEach(k => {
        const val = typeof dp[k] === 'object' ? JSON.stringify(dp[k]) : dp[k];
        console.log(`    ${k} = ${val}`);
      });
    } else {
      console.log(`  device_params: (empty)`);
    }

    // Fetch live property list
    console.log(`  Fetching property list...`);
    const props = await getPropertyList(token, dev.mac, dev.product_model);
    if (props) {
      console.log(`  Properties (${props.length}):`);
      props.forEach(p => {
        console.log(`    ${p.pid} = ${p.value} (ts=${p.ts})`);
      });
    } else {
      console.log(`  ⚠️  get_property_list returned no data`);
    }

    // --- Control tests ---
    const tests = getControlTests(dev.product_type);
    if (RUN_CONTROLS && online && tests.length > 0) {
      console.log(`\n  --- CONTROL TESTS ---`);
      const isMesh = dev.product_type === 'MeshLight';

      const results = [];
      for (const t of tests) {
        const spOk = await testSetProperty(token, dev.mac, dev.product_model, t.pid, t.pvalue, t.label);
        await new Promise(r => setTimeout(r, 500));

        let ralOk = null;
        if (isMesh) {
          ralOk = await testRunActionList(token, dev.mac, dev.product_model, t.pid, t.pvalue, t.label);
          await new Promise(r => setTimeout(r, 500));
        }

        results.push({ label: t.label, pid: t.pid, set_property: spOk, run_action_list: ralOk });
      }

      console.log(`\n  --- RESULTS: ${dev.nickname} (${dev.product_type}/${dev.product_model}) ---`);
      const header = '  ' + 'Test'.padEnd(35) + 'PID'.padEnd(8) + 'set_property'.padEnd(15);
      console.log(header + (isMesh ? 'run_action_list' : ''));
      console.log('  ' + '─'.repeat(isMesh ? 70 : 55));
      results.forEach(r => {
        let line = '  ' +
          r.label.padEnd(35) +
          r.pid.padEnd(8) +
          (r.set_property ? '✅' : '❌').padEnd(15);
        if (isMesh) {
          line += (r.run_action_list ? '✅' : '❌');
        }
        console.log(line);
      });
    } else if (!RUN_CONTROLS && tests.length > 0) {
      console.log(`  (Set WYZE_RUN_CONTROLS=1 to test control commands)`);
    } else if (!online) {
      console.log(`  ⚠️  Device offline — skipping control tests`);
    } else {
      console.log(`  (No control tests for ${dev.product_type})`);
    }
  }

  // ============================================================
  // CATEGORY-SPECIFIC DEEP TESTS
  // ============================================================
  console.log(`\n${'═'.repeat(60)}`);
  console.log('=== CATEGORY-SPECIFIC TESTS ===');
  console.log(`${'═'.repeat(60)}`);

  // --- Camera event tests (pick first online camera) ---
  const cameras = allDevices.filter(d => d.product_type === 'Camera' && (d.conn_state == 1));
  if (cameras.length > 0) {
    // Test up to 2 cameras
    for (const cam of cameras.slice(0, 2)) {
      await testCameraEvents(token, cam.mac, cam.product_model, cam.nickname);
    }
  } else {
    console.log('\n  📷 No online cameras to test events.');
  }

  // --- Scale data tests ---
  const scales = allDevices.filter(d => d.product_type === 'WyzeScale');
  if (scales.length > 0) {
    for (const scale of scales) {
      await testScaleData(token, scale.mac, scale.product_model, scale.nickname);
    }
  } else {
    console.log('\n  ⚖️  No scales found.');
  }

  // --- Garage door detection ---
  checkGarageDoorAccessories(allDevices);

  // --- Lock summary ---
  const locks = allDevices.filter(d => d.product_type === 'Lock');
  if (locks.length > 0) {
    console.log(`\n🔒 LOCKS (${locks.length})`);
    console.log(`  All locks are Bluetooth (YD_BT1) — cloud control unsupported.`);
    locks.forEach(l => {
      const dp = l.device_params || {};
      console.log(`  - ${l.nickname}: conn=${l.conn_state}, switch_state=${dp.switch_state}, lock_state=${dp.lock_state || dp.power_switch || 'n/a'}`);
    });
  }

  // --- Plug/Switch Summary ---
  const plugsSwitches = allDevices.filter(d => ['Plug', 'OutdoorPlug', 'Switch'].includes(d.product_type));
  if (plugsSwitches.length > 0) {
    console.log(`\n🔌 PLUGS/SWITCHES (${plugsSwitches.length})`);
    plugsSwitches.forEach(ps => {
      const dp = ps.device_params || {};
      console.log(`  - ${ps.nickname}: type=${ps.product_type}/${ps.product_model}, online=${ps.conn_state == 1}, state=${dp.switch_state || dp.power_switch || 'n/a'}`);
    });
    console.log(`  API: Power toggle via set_property pid=P3 pvalue=0/1 (same as lights)`);
  } else {
    console.log('\n  🔌 No plugs or switches found.');
  }

  // --- Other devices ---
  const others = allDevices.filter(d => !['MeshLight','Light','Camera','Lock','Plug','OutdoorPlug','Switch','WyzeScale','GarageDoor'].includes(d.product_type));
  if (others.length > 0) {
    console.log(`\n📦 OTHER DEVICES (${others.length})`);
    others.forEach(o => {
      console.log(`  - ${o.nickname}: type=${o.product_type}/${o.product_model}, online=${o.conn_state == 1}`);
    });
    console.log(`  ℹ️  No actions needed for these devices at this time.`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('=== DONE ===');
  console.log('Review the output above. For each device:');
  console.log('  - Check which PIDs exist in the property list');
  console.log('  - If WYZE_RUN_CONTROLS=1, check which endpoint truly works');
  console.log('  - API may return code=1 but silently ignore the command');
  console.log('  - Observe the physical device to confirm actual changes');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
