#!/usr/bin/env node
// Test script: Fetch a Wyze camera event image, convert to Pebble 8-bit format,
// and save as a C header file for static display testing.
//
// Usage: WYZE_EMAIL=... WYZE_PASSWORD=... WYZE_API_KEY=... WYZE_KEY_ID=... node test_camera_image.js

var https = require('https');
var http = require('http');
var url = require('url');
var fs = require('fs');
var jpeg = require('jpeg-js');
var crypto = require('crypto');

// --- Config from env ---
var EMAIL = process.env.WYZE_EMAIL;
var PASSWORD = process.env.WYZE_PASSWORD;
var API_KEY = process.env.WYZE_API_KEY;
var KEY_ID = process.env.WYZE_KEY_ID;

if (!EMAIL || !PASSWORD || !API_KEY || !KEY_ID) {
  console.error('Set WYZE_EMAIL, WYZE_PASSWORD, WYZE_API_KEY, WYZE_KEY_ID');
  process.exit(1);
}

// --- Pebble 8-bit color: 0b11RRGGBB ---
function rgbToPebble8Bit(r, g, b) {
  var rr = (r >> 6) & 0x03;
  var gg = (g >> 6) & 0x03;
  var bb = (b >> 6) & 0x03;
  return 0xC0 | (rr << 4) | (gg << 2) | bb;
}

// --- Simple nearest-neighbor resize ---
function resizeRGBA(srcData, srcW, srcH, dstW, dstH) {
  var dst = Buffer.alloc(dstW * dstH * 4);
  for (var y = 0; y < dstH; y++) {
    var sy = Math.floor(y * srcH / dstH);
    for (var x = 0; x < dstW; x++) {
      var sx = Math.floor(x * srcW / dstW);
      var si = (sy * srcW + sx) * 4;
      var di = (y * dstW + x) * 4;
      dst[di]     = srcData[si];
      dst[di + 1] = srcData[si + 1];
      dst[di + 2] = srcData[si + 2];
      dst[di + 3] = srcData[si + 3];
    }
  }
  return dst;
}

// --- MD5 helper ---
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// --- HTTP helpers ---
function httpsPost(urlStr, headers, body) {
  return new Promise(function(resolve, reject) {
    var parsed = url.parse(urlStr);
    var options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.path,
      method: 'POST',
      headers: headers
    };
    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(urlStr, accessToken) {
  return new Promise(function(resolve, reject) {
    var parsed = url.parse(urlStr);
    var mod = parsed.protocol === 'https:' ? https : http;
    var headers = { 'User-Agent': 'wyze_android_2.49.0' };
    if (accessToken) {
      headers['Authorization'] = accessToken;
      headers['access_token'] = accessToken;
    }
    var options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: 'GET',
      headers: headers
    };
    var req = mod.request(options, function(res) {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, accessToken).then(resolve, reject);
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // 1. Authenticate
  console.log('Authenticating...');
  var hashedPassword = md5(md5(md5(PASSWORD)));
  var nonce = String(Date.now());

  var authRes = await httpsPost('https://auth-prod.api.wyze.com/api/user/login', {
    'Content-Type': 'application/json',
    'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm',
    'apikey': API_KEY,
    'keyid': KEY_ID,
    'User-Agent': 'wyze_android_2.49.0'
  }, JSON.stringify({ email: EMAIL, password: hashedPassword, nonce: nonce }));

  var authJson = JSON.parse(authRes.body);
  if (!authJson.access_token) {
    console.error('Auth failed:', authRes.body.substring(0, 200));
    process.exit(1);
  }
  var token = authJson.access_token;
  console.log('Auth success.');

  // 2. Get device list to find a camera
  console.log('Fetching devices...');
  var devRes = await httpsPost('https://api.wyzecam.com/app/v2/home_page/get_object_list', {
    'Content-Type': 'application/json;charset=utf-8'
  }, JSON.stringify({
    access_token: token,
    app_name: 'com.hualai',
    app_ver: 'com.hualai___2.19.14',
    app_version: '2.19.14',
    phone_id: 'wyze_developer_api',
    phone_system_type: '2',
    sc: 'a626948714654991afd3c0dbd7cdb901',
    sv: 'c417b62d72ee44bf933054bdca183e77',
    ts: Date.now()
  }));

  var devJson = JSON.parse(devRes.body);
  if (devJson.code !== '1' && devJson.code !== 1) {
    console.error('Device list failed:', devRes.body.substring(0, 200));
    process.exit(1);
  }

  // Find an online camera
  var cameras = (devJson.data.device_list || []).filter(function(d) {
    return d.product_type === 'Camera';
  });
  if (cameras.length === 0) {
    console.error('No cameras found');
    process.exit(1);
  }
  
  // Try each camera until we find one with events
  var cam = null;
  var event = null;
  for (var ci = 0; ci < cameras.length; ci++) {
    cam = cameras[ci];
    var isOnline = cam.device_params && cam.device_params.power_switch === 1;
    console.log('  Camera ' + ci + ': ' + cam.nickname + ' (online=' + isOnline + ', mac=' + cam.mac + ')');
  }
  
  for (var ci = 0; ci < cameras.length; ci++) {
    cam = cameras[ci];
    console.log('Trying camera: ' + cam.nickname + '...');
    
    var evtRes = await httpsPost('https://api.wyzecam.com/app/v2/device/get_event_list', {
      'Content-Type': 'application/json;charset=utf-8'
    }, JSON.stringify({
      access_token: token,
      app_name: 'com.hualai',
      app_ver: 'com.hualai___2.19.14',
      app_version: '2.19.14',
      phone_id: 'wyze_developer_api',
      phone_system_type: '2',
      sc: 'a626948714654991afd3c0dbd7cdb901',
      sv: '44b6d5640c4d4978baba65c8ab9a6d6e',
      ts: Date.now(),
      device_mac: cam.mac,
      device_model: cam.product_model,
      count: 1,
      order_by: 2,
      begin_time: String(Date.now() - 30 * 24 * 3600 * 1000),
      end_time: String(Date.now())
    }));

    var evtJson = JSON.parse(evtRes.body);
    if (evtJson.code == 1 && evtJson.data && evtJson.data.event_list && evtJson.data.event_list.length > 0) {
      event = evtJson.data.event_list[0];
      console.log('  Found event!');
      break;
    } else {
      console.log('  No events for ' + cam.nickname);
    }
  }
  
  if (!event) {
    console.error('No camera with events found');
    process.exit(1);
  }
  var imageUrl = event.file_url || event.url || '';
  if (!imageUrl && event.file_list && event.file_list.length > 0) {
    imageUrl = event.file_list[0].url || '';
  }
  if (!imageUrl) {
    console.error('No image URL in event');
    console.error('Event keys:', Object.keys(event).join(', '));
    process.exit(1);
  }
  console.log('Full image URL: ' + imageUrl);
  console.log('Event keys: ' + Object.keys(event).join(', '));
  if (event.file_list && event.file_list.length > 0) {
    console.log('file_list[0] keys: ' + Object.keys(event.file_list[0]).join(', '));
    console.log('file_list[0]: ' + JSON.stringify(event.file_list[0]).substring(0, 500));
  }

  // 4. Download the image (try multiple methods)
  console.log('Downloading image...');
  
  // Method 1: Direct GET (URL has embedded auth tokens)
  var imgRes = await httpGet(imageUrl, null);
  if (imgRes.status === 401 || imgRes.status === 403) {
    console.log('Direct download returned ' + imgRes.status + ', trying with access_token header...');
    // Method 2: With access_token header
    imgRes = await httpGet(imageUrl, token);
  }
  if (imgRes.status === 401 || imgRes.status === 403) {
    console.log('Still ' + imgRes.status + ', trying with access_token query param...');
    // Method 3: Append access_token to URL
    var separator = imageUrl.indexOf('?') >= 0 ? '&' : '?';
    imgRes = await httpGet(imageUrl + separator + 'access_token=' + token, null);
  }
  if (imgRes.status === 401 || imgRes.status === 403) {
    // Method 4: Use Wyze resource signing endpoint
    console.log('Trying Wyze resource signing...');
    var signRes = await httpsPost('https://api.wyzecam.com/app/v2/auto/sign_url', {
      'Content-Type': 'application/json;charset=utf-8'
    }, JSON.stringify({
      access_token: token,
      app_name: 'com.hualai',
      app_ver: 'com.hualai___2.19.14',
      app_version: '2.19.14',
      phone_id: 'wyze_developer_api',
      phone_system_type: '2',
      sc: 'a626948714654991afd3c0dbd7cdb901',
      ts: Date.now(),
      url: imageUrl
    }));
    console.log('Sign response: ' + signRes.body.substring(0, 300));
    try {
      var signJson = JSON.parse(signRes.body);
      if (signJson.data && signJson.data.url) {
        imgRes = await httpGet(signJson.data.url, null);
      }
    } catch(e) {}
  }
  if (imgRes.status === 401 || imgRes.status === 403) {
    // Try using ai_url from file_list if available
    if (event.file_list && event.file_list[0] && event.file_list[0].ai_url) {
      console.log('Trying ai_url...');
      imgRes = await httpGet(event.file_list[0].ai_url, null);
    }
  }
  if (imgRes.status !== 200) {
    console.error('Image download failed: HTTP ' + imgRes.status);
    process.exit(1);
  }
  console.log('Downloaded ' + imgRes.body.length + ' bytes');

  // Save raw JPEG for reference
  fs.writeFileSync('test_camera_raw.jpg', imgRes.body);
  console.log('Saved raw JPEG as test_camera_raw.jpg');

  // 5. Decode JPEG
  var decoded;
  try {
    decoded = jpeg.decode(imgRes.body, { useTArray: true });
  } catch (e) {
    console.error('JPEG decode failed:', e.message);
    process.exit(1);
  }
  console.log('Decoded: ' + decoded.width + 'x' + decoded.height);

  // 6. Resize to 144x84 (Pebble basalt camera area)
  var TARGET_W = 144;
  var TARGET_H = 84;
  var resized = resizeRGBA(decoded.data, decoded.width, decoded.height, TARGET_W, TARGET_H);
  console.log('Resized to ' + TARGET_W + 'x' + TARGET_H);

  // 7. Convert to Pebble 8-bit format
  var pebbleData = Buffer.alloc(TARGET_W * TARGET_H);
  for (var i = 0; i < TARGET_W * TARGET_H; i++) {
    var r = resized[i * 4];
    var g = resized[i * 4 + 1];
    var b = resized[i * 4 + 2];
    pebbleData[i] = rgbToPebble8Bit(r, g, b);
  }
  console.log('Converted to Pebble 8-bit: ' + pebbleData.length + ' bytes');

  // 8. Write C header file
  var lines = [];
  lines.push('// Auto-generated test camera image — ' + TARGET_W + 'x' + TARGET_H + ' Pebble 8-bit');
  lines.push('// Source: ' + cam.nickname);
  lines.push('#pragma once');
  lines.push('');
  lines.push('#define TEST_IMG_WIDTH ' + TARGET_W);
  lines.push('#define TEST_IMG_HEIGHT ' + TARGET_H);
  lines.push('#define TEST_IMG_SIZE ' + pebbleData.length);
  lines.push('');
  lines.push('static const uint8_t TEST_IMG_DATA[' + pebbleData.length + '] = {');

  // Write rows
  for (var y = 0; y < TARGET_H; y++) {
    var rowHex = [];
    for (var x = 0; x < TARGET_W; x++) {
      rowHex.push('0x' + ('0' + pebbleData[y * TARGET_W + x].toString(16)).slice(-2));
    }
    lines.push('  ' + rowHex.join(',') + (y < TARGET_H - 1 ? ',' : ''));
  }
  lines.push('};');

  var headerPath = 'src/c/test_camera_data.h';
  fs.writeFileSync(headerPath, lines.join('\n') + '\n');
  console.log('Wrote ' + headerPath + ' (' + pebbleData.length + ' bytes of image data)');
  console.log('Done! Now embed in window_camera.c and build.');
}

main().catch(function(e) {
  console.error('Error:', e);
  process.exit(1);
});
