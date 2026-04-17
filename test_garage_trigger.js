#!/usr/bin/env node
/**
 * test_garage_trigger.js — Tests garage_door_trigger via run_action
 * 
 * WARNING: This WILL physically move the garage door!
 * 
 * Test plan:
 *   1. Read P1056 before trigger
 *   2. Send run_action with action_key "garage_door_trigger"
 *   3. Wait 15 seconds for door to move and property to update
 *   4. Read P1056 after trigger
 *   5. Report state change
 */

const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');

const EMAIL    = process.env.WYZE_EMAIL    || '';
const PASSWORD = process.env.WYZE_PASSWORD || '';
const API_KEY  = process.env.WYZE_API_KEY  || '';
const KEY_ID   = process.env.WYZE_KEY_ID   || '';

const MAC   = 'D03F2745AA94';
const MODEL = 'WYZE_CAKP2JFUS';

const WYZE_SC = 'a626948714654991afd3c0dbd7cdb901';

function md5(str, key) {
  if (key) return crypto.createHmac('md5', key).update(str).digest('hex');
  return crypto.createHash('md5').update(str).digest('hex');
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
        if (res.headers['content-encoding'] === 'gzip') {
          try { buf = zlib.gunzipSync(buf); } catch(e) {}
        }
        const str = buf.toString();
        try { resolve(JSON.parse(str)); } catch(e) { resolve({raw: str}); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function buildBase(token) {
  return {
    access_token: token, app_name: 'com.hualai',
    app_ver: 'com.hualai___2.19.14', app_version: '2.19.14',
    phone_id: 'wyze_developer_api', phone_system_type: '2',
    sc: WYZE_SC, ts: Date.now()
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function authenticate() {
  const hashedPw = md5(md5(md5(PASSWORD)));
  const res = await post('auth-prod.api.wyze.com', '/api/user/login',
    { email: EMAIL, password: hashedPw, nonce: String(Date.now()) },
    { 'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm', 'apikey': API_KEY, 'keyid': KEY_ID, 'User-Agent': 'wyze_android_2.49.0' });
  if (res.access_token) return res.access_token;
  if (res.data?.access_token) return res.data.access_token;
  console.error('Auth failed:', JSON.stringify(res).slice(0,300));
  process.exit(1);
}

async function getP1056(token) {
  const payload = Object.assign(buildBase(token), {
    sv: '9d74946e652647e9b6c9d59326aef104',
    device_mac: MAC, device_model: MODEL,
    target_pid_list: ['P1056']
  });
  const resp = await post('api.wyzecam.com', '/app/v2/device/get_property_list', payload);
  const prop = resp.data?.property_list?.find(p => p.pid === 'P1056');
  return prop || null;
}

async function runAction(token, actionKey) {
  const payload = Object.assign(buildBase(token), {
    sv: '9d74946e652647e9b6c9d59326aef104',
    provider_key: MODEL,
    instance_id: MAC,
    action_key: actionKey,
    action_params: {},
    custom_string: ''
  });
  return await post('api.wyzecam.com', '/app/v2/auto/run_action', payload);
}

async function main() {
  console.log('=== GARAGE DOOR TRIGGER TEST ===');
  console.log('WARNING: This will physically move the garage door!\n');

  const token = await authenticate();
  console.log('Auth OK\n');

  // Step 1: Read P1056 before
  console.log('--- STEP 1: Read P1056 BEFORE trigger ---');
  const before = await getP1056(token);
  console.log('  P1056 value:', before?.value, '  ts:', before?.ts);
  const beforeTs = before?.ts || 0;
  const beforeVal = before?.value;
  console.log('  Interpretation:', beforeVal === '1' ? 'OPEN' : beforeVal === '0' ? 'CLOSED (via app)' : beforeVal === '2' ? 'CLOSED (via automation)' : 'UNKNOWN');
  console.log('');

  // Step 2: Trigger garage_door_trigger
  console.log('--- STEP 2: Sending garage_door_trigger ---');
  const triggerResp = await runAction(token, 'garage_door_trigger');
  console.log('  Response code:', triggerResp.code, 'msg:', triggerResp.msg);
  console.log('  Data:', JSON.stringify(triggerResp.data));
  console.log('');

  // Step 3: Wait for door to move and clouds to update
  console.log('--- STEP 3: Waiting 20 seconds for door movement + cloud update ---');
  for (let i = 1; i <= 4; i++) {
    await sleep(5000);
    console.log(`  ${i * 5}s elapsed...`);
    const check = await getP1056(token);
    console.log(`    P1056 value: ${check?.value}  ts: ${check?.ts}  changed: ${check?.ts !== beforeTs}`);
  }
  console.log('');

  // Step 4: Final read
  console.log('--- STEP 4: Final P1056 read ---');
  const after = await getP1056(token);
  console.log('  P1056 value:', after?.value, '  ts:', after?.ts);
  console.log('  Interpretation:', after?.value === '1' ? 'OPEN' : after?.value === '0' ? 'CLOSED (via app)' : after?.value === '2' ? 'CLOSED (via automation)' : 'UNKNOWN');
  console.log('');

  // Summary
  console.log('=== SUMMARY ===');
  console.log('  Before: P1056=' + beforeVal + ' ts=' + beforeTs);
  console.log('  After:  P1056=' + after?.value + ' ts=' + after?.ts);
  console.log('  Value changed:', beforeVal !== after?.value);
  console.log('  Timestamp changed:', beforeTs !== after?.ts);
  if (after?.ts > beforeTs) {
    console.log('  P1056 WAS UPDATED by the trigger!');
  } else {
    console.log('  P1056 was NOT updated (timestamp unchanged).');
  }
  console.log('=== DONE ===');
}

main().catch(e => console.error('FATAL:', e));
