const https = require('https');

// --- Replace these with your actual credentials ---
// Note: If the Wyze endpoint you have requires email/password, fill them below.
const KEY_ID = process.env.WYZE_KEY_ID || 'YOUR_KEY_ID';
const API_KEY = process.env.WYZE_API_KEY || 'YOUR_API_KEY';
const EMAIL = process.env.WYZE_EMAIL || 'YOUR_EMAIL@example.com';
const PASSWORD = process.env.WYZE_PASSWORD || 'YOUR_PASSWORD';
const DO_TOGGLE = process.env.WYZE_DO_TOGGLE === '1';

const WYZE_APP_NAME = 'com.hualai';
const WYZE_APP_VERSION = '2.19.14';
const WYZE_PHONE_ID = 'wyze_developer_api';
const WYZE_SC = 'a626948714654991afd3c0dbd7cdb901';
const WYZE_SV_DEVICE_LIST = 'c417b62d72ee44bf933054bdca183e77';
const WYZE_SV_SET_PROPERTY = '44b6d5640c4d4978baba65c8ab9a6d6e';
// ----------------------------------------------------

/**
 * Currently, there are two primary Wyze API architectures:
 * 1. The old client auth (requires email, password, and public constants). (auth-prod.api.wyze.com)
 * 2. The newer OpenAPI platform.
 * 
 * Your index.js was attempting to use `api.wyze.com`, which currently doesn't resolve in DNS.
 * This test script tries a few known endpoints so you can verify what works.
 */

// We will attempt a POST to auth-prod.api.wyze.com which requires all 4 pieces of data.
function testWyzeAuthProd() {
  console.log("Testing auth-prod.api.wyze.com/api/user/login...");
  const nonce = String(Date.now());
  
  // Wyze auth requires triple-MD5 + nonce.
  const tripleMd5Password = require('crypto')
    .createHash('md5').update(
      require('crypto').createHash('md5').update(
        require('crypto').createHash('md5').update(PASSWORD).digest('hex')
      ).digest('hex')
    ).digest('hex');

  const postData = JSON.stringify({
    email: EMAIL,
    password: tripleMd5Password,
    nonce: nonce
  });

  const req = https.request({
    hostname: 'auth-prod.api.wyze.com',
    path: '/api/user/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm',
      'apikey': API_KEY,
      'keyid': KEY_ID,
      'User-Agent': 'wyze_android_2.49.0',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('--- auth-prod.api.wyze.com Response ---');
      console.log(`Status: ${res.statusCode}`);
      try {
        var parsed = JSON.parse(data);
        console.log(JSON.stringify(parsed, null, 2));
        console.log('has_access_token:', !!parsed.access_token);
        console.log('has_mfa_options:', !!(parsed.mfa_options && parsed.mfa_options.length));
        if (parsed.access_token) {
          testWyzeDeviceList(parsed.access_token);
        }
      } catch(e) {
        console.log(data);
      }
      console.log('----------------------------------------\n');
    });
  });

  req.on('error', (e) => console.log("Request failed:", e.message));
  req.write(postData);
  req.end();
}

function buildWyzeBasePayload(token) {
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

function testWyzeDeviceList(token) {
  console.log('Testing api.wyzecam.com/app/v2/home_page/get_object_list...');
  var payload = buildWyzeBasePayload(token);
  payload.sv = WYZE_SV_DEVICE_LIST;

  const postData = JSON.stringify(payload);
  const req = https.request({
    hostname: 'api.wyzecam.com',
    path: '/app/v2/home_page/get_object_list',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('--- api.wyzecam.com device list response ---');
      console.log(`Status: ${res.statusCode}`);
      try {
        var parsed = JSON.parse(data);
        var devices = (parsed.data && parsed.data.device_list) || [];
        console.log('code:', parsed.code, 'msg:', parsed.msg, 'device_count:', devices.length);
        if (devices.length) {
          var sample = devices[0];
          console.log('sample_device:', sample.nickname, sample.product_model, sample.mac);
        }
        if (DO_TOGGLE && devices.length) {
          testWyzeToggle(token, devices[0]);
        }
      } catch (e) {
        console.log(data);
      }
      console.log('---------------------------------------------\n');
    });
  });
  req.on('error', (e) => console.log('Device list request failed:', e.message));
  req.write(postData);
  req.end();
}

function testWyzeToggle(token, device) {
  console.log('Testing api.wyzecam.com/app/v2/device/set_property...');
  var payload = buildWyzeBasePayload(token);
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = device.mac;
  payload.device_model = device.product_model;
  payload.pid = 'P3';
  payload.pvalue = '1';

  const postData = JSON.stringify(payload);
  const req = https.request({
    hostname: 'api.wyzecam.com',
    path: '/app/v2/device/set_property',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('--- api.wyzecam.com toggle response ---');
      console.log(`Status: ${res.statusCode}`);
      try {
        var parsed = JSON.parse(data);
        console.log('code:', parsed.code, 'msg:', parsed.msg);
      } catch (e) {
        console.log(data);
      }
      console.log('---------------------------------------\n');
    });
  });
  req.on('error', (e) => console.log('Toggle request failed:', e.message));
  req.write(postData);
  req.end();
}

testWyzeAuthProd();
