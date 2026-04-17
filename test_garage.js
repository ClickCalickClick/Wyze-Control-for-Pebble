#!/usr/bin/env node
/**
 * test_garage.js — Test Wyze Garage Door status reading
 *
 * Usage:
 *   WYZE_EMAIL=... WYZE_PASSWORD=... WYZE_API_KEY=... WYZE_KEY_ID=... node test_garage.js
 *
 * This script will:
 *   1. Authenticate
 *   2. Find cameras with dongle_product_model == "HL_CGDC" (garage door controller)
 *   3. Read property P1056 (ACCESSORY) to determine open/closed status
 *   4. Also try run_action with "garage_door_trigger" (DRY RUN — does NOT execute)
 *
 * Status interpretation for P1056 on HL_CGDC cameras:
 *   "1" = garage door OPEN
 *   "0" = garage door CLOSED (by app)
 *   "2" = garage door CLOSED (by automation / smart platform)
 */

const https = require('https');
const crypto = require('crypto');

const EMAIL    = process.env.WYZE_EMAIL    || '';
const PASSWORD = process.env.WYZE_PASSWORD || '';
const API_KEY  = process.env.WYZE_API_KEY  || '';
const KEY_ID   = process.env.WYZE_KEY_ID   || '';

if (!EMAIL || !PASSWORD || !API_KEY || !KEY_ID) {
  console.error('Missing credentials. Set WYZE_EMAIL, WYZE_PASSWORD, WYZE_API_KEY, WYZE_KEY_ID');
  process.exit(1);
}

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
// Auth
// ============================================================
async function authenticate() {
  console.log('=== Authenticating ===');
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
    console.log('Auth OK');
    return res.data.access_token;
  }
  console.error('Auth failed:', JSON.stringify(res.data, null, 2));
  process.exit(1);
}

// ============================================================
// Get all devices
// ============================================================
async function getDevices(token) {
  console.log('\n=== Fetching device list ===');
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_DEVICE_LIST;
  const res = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', payload);
  if (res.data.code != 1 && res.data.msg !== 'SUCCESS') {
    console.error('Device list failed:', res.data.msg);
    process.exit(1);
  }
  return res.data.data.device_list || [];
}

// ============================================================
// Get property list for a device
// ============================================================
async function getPropertyList(token, mac, model) {
  const payload = buildBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = mac;
  payload.device_model = model;
  payload.target_pid_list = [];
  const res = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
  if ((res.data.code == 1 || res.data.msg === 'SUCCESS') && res.data.data && res.data.data.property_list) {
    return res.data.data.property_list;
  }
  return null;
}

// ============================================================
// Get device info (may have fresher data)
// ============================================================
async function getDeviceInfo(token, mac, model) {
  const payload = buildBasePayload(token);
  payload.sv = 'c86fa16fc99d4d6580f82ef3b942e586';
  payload.device_mac = mac;
  payload.device_model = model;
  const res = await post('api.wyzecam.com', '/app/v2/device/get_device_Info', payload);
  return res.data;
}

// ============================================================
// Main
// ============================================================
async function main() {
  const token = await authenticate();
  const devices = await getDevices(token);

  console.log(`\nTotal devices: ${devices.length}`);

  // Find cameras with garage door controller
  const garageCams = [];
  for (const d of devices) {
    const dongle = d.device_params && d.device_params.dongle_product_model;
    if (dongle) {
      console.log(`  ${d.nickname} (${d.product_model}) — dongle_product_model: ${dongle}`);
    }
    if (dongle === 'HL_CGDC') {
      garageCams.push(d);
    }
  }

  if (garageCams.length === 0) {
    console.log('\n❌ No cameras with garage door controller (HL_CGDC) found.');
    console.log('\nListing all cameras with their device_params for debugging:');
    for (const d of devices) {
      if (d.product_type === 'Camera') {
        console.log(`\n  Camera: ${d.nickname} (${d.product_model}) MAC: ${d.mac}`);
        console.log(`  device_params:`, JSON.stringify(d.device_params, null, 4));
      }
    }
    return;
  }

  console.log(`\n=== Found ${garageCams.length} garage door camera(s) ===`);

  for (const cam of garageCams) {
    console.log(`\n--- ${cam.nickname} ---`);
    console.log(`  MAC: ${cam.mac}`);
    console.log(`  Model: ${cam.product_model}`);
    console.log(`  dongle_product_model: ${cam.device_params.dongle_product_model}`);

    // Dump ALL device_params to look for garage state fields
    console.log('\n  === device_params (from get_object_list) ===');
    const params = cam.device_params;
    const interestingKeys = Object.keys(params).sort();
    for (const k of interestingKeys) {
      const v = params[k];
      if (typeof v === 'object') {
        console.log(`    ${k}: ${JSON.stringify(v)}`);
      } else {
        console.log(`    ${k}: ${v}`);
      }
    }

    // Get property list
    console.log('\n  === get_property_list ===');
    const props = await getPropertyList(token, cam.mac, cam.product_model);
    if (!props) {
      console.log('  ❌ Failed to get property list');
    } else {
      // Only show interesting properties
      for (const p of props) {
        const label = {
          'P1': 'NOTIFICATION',
          'P3': 'ON/OFF',
          'P5': 'AVAILABLE',
          'P1047': 'MOTION_DETECTION',
          'P1049': 'CAMERA_SIREN',
          'P1056': '*** ACCESSORY (GARAGE) ***',
          'P1301': 'CONTACT_STATE?',
          'P2001': 'DOOR_OPEN?',
        }[p.pid] || '';
        if (label || p.pid === 'P1056' || p.pid === 'P2001' || p.pid === 'P1301') {
          console.log(`    ${p.pid} = ${p.value}  ${label}`);
        }
      }

      const accessoryProp = props.find(p => p.pid === 'P1056');
      if (accessoryProp) {
        console.log(`\n  🚪 P1056 (ACCESSORY) = ${accessoryProp.value}`);
      }
    }

    // Get device info
    console.log('\n  === get_device_Info ===');
    const info = await getDeviceInfo(token, cam.mac, cam.product_model);
    if (info && info.data) {
      const d = info.data;
      // Print property_list from device info if present
      if (d.property_list) {
        console.log('  property_list from device_info:');
        for (const p of d.property_list) {
          console.log(`    ${p.pid} = ${p.value}`);
        }
      }
      // Print device_params if present
      if (d.device_params) {
        console.log('  device_params from device_info:');
        for (const k of Object.keys(d.device_params).sort()) {
          console.log(`    ${k}: ${d.device_params[k]}`);
        }
      }
      // Print any other interesting top-level fields
      for (const k of Object.keys(d)) {
        if (!['property_list', 'device_params', 'enr', 'parent_device_enr', 'firmware_ver'].includes(k)) {
          const v = d[k];
          if (typeof v !== 'object') {
            console.log(`    ${k}: ${v}`);
          }
        }
      }
    } else {
      console.log('  Response:', JSON.stringify(info, null, 2));
    }

    console.log('\n  ℹ️  Control: run_action with action_key="garage_door_trigger" (NOT executed)');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
