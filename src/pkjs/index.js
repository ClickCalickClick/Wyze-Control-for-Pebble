var Clay = require('@rebble/clay');
var createClayConfig = require('./config');
var clay = new Clay(createClayConfig(''), null, { autoHandleEvents: false });
var md5 = require('./md5.js');

var SETTINGS = {};
var deviceList = [];
var wyzeToken = null;

var WYZE_APP_NAME = 'com.hualai';
var WYZE_APP_VERSION = '2.19.14';
var WYZE_PHONE_ID = 'wyze_developer_api';
var WYZE_SC = 'a626948714654991afd3c0dbd7cdb901';
var WYZE_SV_DEVICE_LIST = 'c417b62d72ee44bf933054bdca183e77';
var WYZE_SV_SET_PROPERTY = '44b6d5640c4d4978baba65c8ab9a6d6e';
var WYZE_SV_REFRESH_TOKEN = 'd91914dd28b7492ab9dd17f7707d35a3';

// iOS-style params required for camera event image URLs (from docker-wyze-bridge)
var WYZE_CAM_SC = '9f275790cab94a72bd206c8876429f3c';
var WYZE_CAM_SV_EVENT_LIST = '782ced6909a44d92a1f70d582bbe88be';
var WYZE_CAM_APP_NAME = 'com.hualai.WyzeCam';
var WYZE_CAM_APP_VERSION = '2.50.6.9';
var WYZE_CAM_USER_AGENT = 'Wyze/2.50.6.9 (iPhone; iOS 17.0; Scale/3.00)';
var CAM_CHUNK_SIZE = 1500;
var CAM_TARGET_W = 144;
var CAM_TARGET_H = 84;

var jpegDecode = require('jpeg-js').decode;

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function buildWyzeBasePayload() {
  return {
    access_token: wyzeToken,
    app_name: WYZE_APP_NAME,
    app_ver: WYZE_APP_NAME + '___' + WYZE_APP_VERSION,
    app_version: WYZE_APP_VERSION,
    phone_id: WYZE_PHONE_ID,
    phone_system_type: '2',
    sc: WYZE_SC,
    ts: Date.now()
  };
}

function buildCameraPayload() {
  return {
    access_token: wyzeToken,
    app_name: WYZE_CAM_APP_NAME,
    app_ver: WYZE_CAM_APP_NAME + '___' + WYZE_CAM_APP_VERSION,
    app_version: WYZE_CAM_APP_VERSION,
    phone_id: generateUUID(),
    phone_system_type: '1',
    sc: WYZE_CAM_SC,
    ts: Date.now()
  };
}

function setAuthStatus(status, message) {
  localStorage.setItem('wyze_auth_status', status || 'none');
  if (message) {
    localStorage.setItem('wyze_auth_message', message);
  } else {
    localStorage.removeItem('wyze_auth_message');
  }
  localStorage.setItem('wyze_auth_updated_at', String(Date.now()));
}

function buildAuthStatusHtml() {
  var hasToken = !!localStorage.getItem('wyze_access_token');
  var status = localStorage.getItem('wyze_auth_status') || 'none';
  var message = localStorage.getItem('wyze_auth_message') || '';

  if (hasToken && status !== 'error') {
    return "<div style='background:#d4edda; color:#155724; padding:10px; border-radius:5px;'><b>Token status:</b> Saved on this phone.<br>You do not need to re-enter your password unless the token expires.</div>";
  }

  if (status === 'error') {
    return "<div style='background:#f8d7da; color:#721c24; padding:10px; border-radius:5px;'><b>Token status:</b> Last auth failed.<br>" + message + "</div>";
  }

  if (status === 'pending') {
    return "<div style='background:#fff3cd; color:#856404; padding:10px; border-radius:5px;'><b>Token status:</b> Authenticating with Wyze...</div>";
  }

  return "<div style='background:#fff3cd; color:#856404; padding:10px; border-radius:5px;'><b>Token status:</b> Not found.<br>Enter credentials and save to create a token.</div>";
}

function rebuildClay() {
  clay = new Clay(createClayConfig(buildAuthStatusHtml()), null, { autoHandleEvents: false });
}

function syncSettingsFromClayStorage() {
  var parsed;
  try {
    var rawSettings = localStorage.getItem('clay-settings');
    parsed = rawSettings ? JSON.parse(rawSettings) : {};
  } catch (error) {
    console.log("Failed to read Clay storage: " + error);
    return;
  }
  SETTINGS = parsed;
}

// ------------------------------------------------------------------
// Security: Token Exchange & Forget Pattern
// 1. Sends raw password once to get long-lasting auth tokens.
// 2. Immediately deletes the raw password from localStorage so Clay 
//    settings don't persist incredibly sensitive data on the phone.
// ------------------------------------------------------------------
// Tell the watch our auth state: 0=no auth, 1=authed/loading
function sendAuthStatusToWatch(status) {
  Pebble.sendAppMessage({ "AuthStatus": status }, null, function() {
    console.log('Failed to send AuthStatus to watch');
  });
}

// authenticateWyze now takes an optional rawPassword parameter (already wiped from storage).
// On app launch (ready event), pass null — it will use the cached token.
function authenticateWyze(rawPassword, callback) {
  // Support legacy 1-arg calls: authenticateWyze(callback)
  if (typeof rawPassword === 'function') {
    callback = rawPassword;
    rawPassword = null;
  }
  
  if (!SETTINGS.WyzeKeyID || !SETTINGS.WyzeAPIKey) {
    console.log('Missing WyzeKeyID or WyzeAPIKey.');
    if (!localStorage.getItem('wyze_access_token')) {
      setAuthStatus('error', 'API Key and Key ID are required.');
      sendAuthStatusToWatch(0);
    }
    if (callback) callback();
    return;
  }
  
  var cachedAccessToken = localStorage.getItem('wyze_access_token');
  
  if (SETTINGS.WyzeEmail && rawPassword) {
    console.log('Exchanging credentials for token...');
    setAuthStatus('pending', 'Authenticating with Wyze...');
    
    var hashedPassword = md5(md5(md5(rawPassword)));
    var nonce = String(Date.now());
    
    var req = new XMLHttpRequest();
    req.open('POST', 'https://auth-prod.api.wyze.com/api/user/login', true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.setRequestHeader('x-api-key', 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm');
    req.setRequestHeader('apikey', SETTINGS.WyzeAPIKey);
    req.setRequestHeader('keyid', SETTINGS.WyzeKeyID);
    req.setRequestHeader('User-Agent', 'wyze_android_2.49.0');
    
    req.onload = function() {
      if (req.readyState === 4 && req.status === 200) {
        try {
          var res = JSON.parse(req.responseText);
          if (res.access_token) {
            console.log('Auth success — token received.');
            wyzeToken = res.access_token;
            localStorage.setItem('wyze_access_token', res.access_token);
            localStorage.setItem('wyze_refresh_token', res.refresh_token);
            setAuthStatus('success', 'Token created and stored successfully.');
            if (callback) callback();
          } else if (res.mfa_options && res.mfa_options.length) {
            console.log('MFA challenge returned.');
            setAuthStatus('error', 'MFA challenge required. Not yet supported.');
          } else {
            console.log('No access_token in response.');
            setAuthStatus('error', 'Token not present in Wyze response.');
          }
        } catch (e) {
          console.log('Login parse error:', e);
          setAuthStatus('error', 'Could not parse login response.');
        }
      } else {
        console.log('Wyze login failed:', req.status);
        var failureMessage = 'Login failed (HTTP ' + req.status + ').';
        try {
          var errorRes = JSON.parse(req.responseText);
          if (errorRes && (errorRes.description || errorRes.msg)) {
            failureMessage += ' ' + (errorRes.description || errorRes.msg);
          }
        } catch (parseErr) {}
        setAuthStatus('error', failureMessage);
      }
    };
    req.onerror = function() {
      setAuthStatus('error', 'Network error contacting Wyze.');
    };
    req.send(JSON.stringify({
      email: SETTINGS.WyzeEmail,
      password: hashedPassword,
      nonce: nonce
    }));
    
  } else if (cachedAccessToken) {
    console.log('Using cached Wyze token.');
    wyzeToken = cachedAccessToken;
    // Only update status if not already showing success
    if (localStorage.getItem('wyze_auth_status') !== 'success') {
      setAuthStatus('success', 'Using saved token.');
    }
    if (callback) callback();
  } else {
    console.log('No password provided and no cached token.');
    setAuthStatus('error', 'Enter email and password to authenticate.');
    sendAuthStatusToWatch(0);
  }
}

// Map Wyze product_type to watch type index
var PRODUCT_TYPE_MAP = {
  'MeshLight': { index: 0, name: 'Light' },
  'Light':     { index: 0, name: 'Light' },
  'Plug':      { index: 1, name: 'Plug' },
  'OutdoorPlug': { index: 1, name: 'Plug' },
  'Switch':    { index: 2, name: 'Switch' },
  'Camera':    { index: 3, name: 'Camera' },
  'Lock':      { index: 4, name: 'Lock' },
  'GarageDoor': { index: 5, name: 'Garage' },
  'WyzeScale': { index: 6, name: 'Scale' }
};

function processDevices(devices) {
  deviceList = [];
  
  for (var i = 0; i < devices.length; i++) {
    var dev = devices[i];
    var pt = dev.product_type || '';
    var mapped = PRODUCT_TYPE_MAP[pt] || { index: 99, name: pt || 'Other' };
    
    var dp = dev.device_params || {};
    var isPowerOn = 0;
    if (dp.switch_state === 1 || dp.power_switch === 1) isPowerOn = 1;
    
    var isOnline = (dev.conn_state === 1 || dev.conn_state === '1') ? 1 : 0;
    
    // Scales don't have power switches; use connection state instead
    if (pt === 'WyzeScale') isPowerOn = isOnline;
    
    // Detect garage door controller dongle attached to camera
    var hasGarage = (dp.dongle_product_model === 'HL_CGDC') ? 1 : 0;
    
    deviceList.push({
      id: i,
      mac: dev.mac,
      model: dev.product_model,
      name: dev.nickname || 'Wyze Device',
      productType: pt,
      typeIndex: mapped.index,
      typeName: mapped.name,
      state: isPowerOn,
      online: isOnline,
      hasGarage: hasGarage
    });
  }
  
  sendDeviceBatchToWatch();
}

function sendDeviceBatchToWatch() {
  Pebble.sendAppMessage({
    "DeviceCount": deviceList.length
  }, function() {
    sendNextDevice(0);
  }, function(e) {
    console.log("Failed to send count:", e);
  });
}

function sendNextDevice(index) {
  if (index >= deviceList.length) {
    console.log("All devices sent to watch!");
    return;
  }
  
  var d = deviceList[index];
  var payload = {
    "DeviceIndex": index,
    "DeviceName": d.name.substring(0, 31),
    "DeviceTypeIndex": d.typeIndex,
    "DeviceType": d.typeName,
    "DeviceState": d.state,
    "DeviceOnline": d.online,
    "DeviceHasGarage": d.hasGarage || 0
  };
  
  Pebble.sendAppMessage(payload, function(e) {
    setTimeout(function() { sendNextDevice(index + 1); }, 50);
  }, function(e) {
    setTimeout(function() { sendNextDevice(index); }, 1500);
  });
}

function fetchDevices() {
  if (!wyzeToken) return;
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/home_page/get_object_list', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        console.log('Device list response: code=' + json.code + ' msg=' + json.msg);
        if (json.code === 1 || json.msg === 'SUCCESS') {
          processDevices((json.data && json.data.device_list) || []);
        } else {
          setAuthStatus('error', 'Device list error (code ' + json.code + '): ' + (json.msg || 'Unknown'));
          sendAuthStatusToWatch(2); // Clear any "Refreshing..." state
        }
      } catch(e) {
        console.log("Device fetch error: ", e);
        sendAuthStatusToWatch(2);
      }
    } else if (req.readyState === 4 && (req.status === 401 || (req.status === 200 && tryParseCode(req.responseText) === 2001))) {
      // Token expired — try refresh before giving up
      console.log('Token expired, attempting refresh...');
      refreshWyzeToken(function(ok) {
        if (ok) {
          fetchDevices();
        } else {
          setAuthStatus('error', 'Token expired. Refresh failed — re-enter password.');
          sendAuthStatusToWatch(0);
        }
      });
    } else if (req.readyState === 4) {
      console.log('Device fetch HTTP error: ' + req.status);
      sendAuthStatusToWatch(2);
    }
  };
  var payload = buildWyzeBasePayload();
  payload.sv = WYZE_SV_DEVICE_LIST;
  req.send(JSON.stringify(payload));
}

function tryParseCode(text) {
  try { return JSON.parse(text).code; } catch(e) { return null; }
}

function refreshWyzeToken(callback) {
  var refreshToken = localStorage.getItem('wyze_refresh_token');
  if (!refreshToken) {
    console.log('No refresh token available.');
    localStorage.removeItem('wyze_access_token');
    wyzeToken = null;
    if (callback) callback(false);
    return;
  }
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/user/refresh_token', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        if (json.code === 1 && json.data && json.data.access_token) {
          console.log('Token refreshed successfully.');
          wyzeToken = json.data.access_token;
          localStorage.setItem('wyze_access_token', json.data.access_token);
          if (json.data.refresh_token) {
            localStorage.setItem('wyze_refresh_token', json.data.refresh_token);
          }
          setAuthStatus('success', 'Token refreshed.');
          if (callback) callback(true);
          return;
        }
      } catch(e) {
        console.log('Refresh parse error:', e);
      }
    }
    // Refresh failed — clear tokens
    console.log('Refresh token request failed.');
    localStorage.removeItem('wyze_access_token');
    localStorage.removeItem('wyze_refresh_token');
    wyzeToken = null;
    if (callback) callback(false);
  };
  req.onerror = function() {
    localStorage.removeItem('wyze_access_token');
    localStorage.removeItem('wyze_refresh_token');
    wyzeToken = null;
    if (callback) callback(false);
  };
  var payload = buildWyzeBasePayload();
  payload.sv = WYZE_SV_REFRESH_TOKEN;
  payload.refresh_token = refreshToken;
  req.send(JSON.stringify(payload));
}

function toggleDevice(id) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/device/set_property', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
       try {
         var json = JSON.parse(req.responseText);
         if (json.code == 1 || json.msg === 'SUCCESS') {
           console.log('Toggle success for device ' + id);
           dev.state = dev.state === 1 ? 0 : 1;
           Pebble.sendAppMessage({
             "DeviceIndex": id,
             "DeviceState": dev.state
           });
           setTimeout(function() { fetchDevices(); }, 2000);
         } else {
           console.log('Toggle failed: code=' + json.code + ' msg=' + json.msg);
           Pebble.sendAppMessage({ "DeviceIndex": id, "DeviceState": dev.state });
         }
       } catch (e) {
         console.log("Toggle parse error", e);
         Pebble.sendAppMessage({ "DeviceIndex": id, "DeviceState": dev.state });
       }
    } else {
      console.log("Toggle HTTP error: " + req.status);
      Pebble.sendAppMessage({ "DeviceIndex": id, "DeviceState": dev.state });
    }
  };
  req.onerror = function() {
    console.log("Toggle network error");
    Pebble.sendAppMessage({ "DeviceIndex": id, "DeviceState": dev.state });
  };
  var payload = buildWyzeBasePayload();
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = dev.mac;
  payload.device_model = dev.model;
  payload.pid = 'P3';
  payload.pvalue = dev.state === 1 ? '0' : '1';
  req.send(JSON.stringify(payload));
}

// Advanced property control (brightness, color temp, hue)
// actionType: 1=power, 2=brightness, 3=color
// actionValue: brightness % or color index
function setDeviceProperty(id, actionType, actionValue) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;

  var pid, pvalue;
  if (actionType === 1) {
    // Power toggle — reuse existing logic
    toggleDevice(id);
    return;
  } else if (actionType === 2) {
    // Brightness: P1501, value is percentage string
    pid = 'P1501';
    pvalue = String(actionValue);
  } else if (actionType === 3) {
    // Color: index maps to color temp or hex RGB color
    // 0=Soft White (2700K), 1=Cool White (6500K), 2=Red, 3=Green, 4=Blue
    if (actionValue <= 1) {
      pid = 'P1502'; // Color temperature
      pvalue = actionValue === 0 ? '2700' : '6500';
    } else {
      pid = 'P1507'; // Color as hex RGB string
      var colorMap = ['', '', 'ff0000', '00ff00', '0000ff']; // 2=Red, 3=Green, 4=Blue
      pvalue = colorMap[actionValue];
    }
  } else {
    console.log('Unknown actionType: ' + actionType);
    return;
  }

  console.log('Setting property for device ' + id + ': pid=' + pid + ' pvalue=' + pvalue);
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/device/set_property', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        if (json.code == 1 || json.msg === 'SUCCESS') {
          console.log('Property set success: pid=' + pid);
        } else {
          console.log('Property set failed: code=' + json.code + ' msg=' + json.msg);
        }
      } catch (e) {
        console.log('Property set parse error', e);
      }
    }
    // Refresh device list to sync true state
    setTimeout(function() { fetchDevices(); }, 2000);
  };
  req.onerror = function() {
    console.log('Property set network error');
  };
  var payload = buildWyzeBasePayload();
  payload.sv = WYZE_SV_SET_PROPERTY;
  payload.device_mac = dev.mac;
  payload.device_model = dev.model;
  payload.pid = pid;
  payload.pvalue = pvalue;
  req.send(JSON.stringify(payload));
}

// Garage door control: blind toggle via run_action
function garageControl(id, actionValue) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  console.log('Garage toggle device ' + id + ': ' + dev.name);
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/auto/run_action', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        console.log('Garage trigger result: code=' + json.code);
        if (json.code === 1 || json.msg === 'SUCCESS') {
          // Toggle local state (blind toggle — no real-time state available)
          dev.state = dev.state === 1 ? 0 : 1;
          Pebble.sendAppMessage({
            "DeviceIndex": id,
            "DeviceState": dev.state
          });
        }
      } catch (e) {
        console.log('Garage trigger parse error:', e);
      }
    }
  };
  req.onerror = function() {
    console.log('Garage trigger network error');
  };
  var payload = buildWyzeBasePayload();
  payload.sv = '9d74946e652647e9b6c9d59326aef104';
  payload.provider_key = dev.model;
  payload.instance_id = dev.mac;
  payload.action_key = 'garage_door_trigger';
  payload.action_params = {};
  payload.custom_string = '';
  req.send(JSON.stringify(payload));
}

// Shortcuts
var shortcutList = [];

function fetchShortcuts() {
  if (!wyzeToken) return;
  console.log('Fetching shortcuts...');
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/auto/run_action_list', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        if (json.code === 1 && json.data && json.data.action_list) {
          shortcutList = [];
          var actions = json.data.action_list;
          for (var i = 0; i < actions.length && i < 20; i++) {
            shortcutList.push({
              id: i,
              key: actions[i].action_key || '',
              name: actions[i].action_name || ('Shortcut ' + (i + 1))
            });
          }
          sendShortcutsToWatch();
        } else {
          console.log('Shortcuts response: code=' + json.code);
          Pebble.sendAppMessage({"ShortcutCount": 0});
        }
      } catch (e) {
        console.log('Shortcuts parse error:', e);
        Pebble.sendAppMessage({"ShortcutCount": 0});
      }
    }
  };
  req.onerror = function() {
    console.log('Shortcuts fetch error');
  };
  var payload = buildWyzeBasePayload();
  req.send(JSON.stringify(payload));
}

function sendShortcutsToWatch() {
  Pebble.sendAppMessage({"ShortcutCount": shortcutList.length}, function() {
    sendNextShortcut(0);
  });
}

function sendNextShortcut(index) {
  if (index >= shortcutList.length) return;
  var s = shortcutList[index];
  Pebble.sendAppMessage({
    "ShortcutIndex": index,
    "ShortcutName": s.name.substring(0, 31)
  }, function() {
    setTimeout(function() { sendNextShortcut(index + 1); }, 50);
  }, function() {
    setTimeout(function() { sendNextShortcut(index); }, 1500);
  });
}

function triggerShortcut(id) {
  if (id < 0 || id >= shortcutList.length || !wyzeToken) return;
  var sc = shortcutList[id];
  console.log('Triggering shortcut: ' + sc.name + ' (key=' + sc.key + ')');
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/auto/run_action', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        console.log('Shortcut trigger result: code=' + json.code);
      } catch (e) {
        console.log('Shortcut trigger parse error');
      }
    }
  };
  var payload = buildWyzeBasePayload();
  payload.action_key = sc.key;
  req.send(JSON.stringify(payload));
}

// Scale data via wyze-scale-service.wyzecam.com
// Uses HMAC-MD5 signed requests (ExServiceClient pattern)
var SCALE_SIGNING_SECRET = 'wyze_app_secret_key_132';
var SCALE_APP_ID = '9319141212m2ik';

function scaleServiceGet(path, params, callback) {
  var nonce = Date.now();
  if (!params) params = {};
  params.nonce = nonce;
  // Sort params and build query string
  var keys = Object.keys(params).sort();
  var sortedStr = '';
  var qs = '';
  for (var i = 0; i < keys.length; i++) {
    if (i > 0) { sortedStr += '&'; qs += '&'; }
    sortedStr += keys[i] + '=' + params[keys[i]];
    qs += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(params[keys[i]]);
  }
  // signature2 = HMAC-MD5(md5(token + secret), sorted_param_string)
  var encodedSecret = md5(wyzeToken + SCALE_SIGNING_SECRET);
  var signature2 = md5(sortedStr, encodedSecret);
  var requestId = md5(md5(String(nonce)));

  var req = new XMLHttpRequest();
  req.open('GET', 'https://wyze-scale-service.wyzecam.com' + path + '?' + qs, true);
  req.setRequestHeader('access_token', wyzeToken);
  req.setRequestHeader('requestid', requestId);
  req.setRequestHeader('appid', SCALE_APP_ID);
  req.setRequestHeader('appinfo', 'wyze_android_' + WYZE_APP_VERSION);
  req.setRequestHeader('phoneid', WYZE_PHONE_ID);
  req.setRequestHeader('User-Agent', 'wyze_android_' + WYZE_APP_VERSION);
  req.setRequestHeader('signature2', signature2);
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try { callback(null, JSON.parse(req.responseText)); }
      catch (e) { callback(e); }
    } else { callback(new Error('HTTP ' + req.status)); }
  };
  req.onerror = function() { callback(new Error('Network error')); };
  req.send();
}

function fetchScaleData(id) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  console.log('Fetching scale data for ' + dev.name);

  // First get device settings (for unit preference)
  scaleServiceGet('/plugin/scale/get_device_setting', { device_id: dev.mac }, function(err, settingsRes) {
    var unit = 'kg';
    if (!err && settingsRes && settingsRes.code == 1 && settingsRes.data) {
      unit = settingsRes.data.unit || 'kg';
    }

    // Then get latest measurement record
    scaleServiceGet('/plugin/scale/get_latest_record', {}, function(err2, res) {
      if (err2 || !res || res.code != 1 || !res.data || res.data.length === 0) {
        console.log('Scale data error:', err2 || (res && res.message) || 'No data');
        Pebble.sendAppMessage({"ScaleWeight": "No data"});
        return;
      }

      var rec = res.data[0]; // Most recent record
      // Convert weight from kg if user's unit is lb
      var weightVal = rec.weight;
      var weightStr;
      if (unit === 'lb') {
        weightStr = (weightVal * 2.20462).toFixed(1) + ' lb';
      } else {
        weightStr = weightVal.toFixed(1) + ' kg';
      }

      var ts = rec.measure_ts;
      var dateStr = '---';
      if (ts) {
        var d = new Date(ts > 9999999999 ? ts : ts * 1000);
        dateStr = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
      }

      Pebble.sendAppMessage({
        "ScaleWeight": weightStr,
        "ScaleBodyFat": rec.body_fat.toFixed(1) + '%',
        "ScaleBMI": rec.bmi.toFixed(1),
        "ScaleMuscle": rec.muscle.toFixed(1) + '%',
        "ScaleWater": rec.body_water.toFixed(1) + '%',
        "ScaleDate": dateStr
      });
    });
  });
}

// Camera thumbnail
function fetchCameraEvent(id) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  console.log('Fetching camera events for ' + dev.name);
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/device/get_event_list', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    console.log('DEBUG: camera event HTTP status=' + req.status + ' readyState=' + req.readyState);
    if (req.readyState === 4 && req.status === 200) {
      try {
        var json = JSON.parse(req.responseText);
        console.log('DEBUG: parsed JSON, code=' + json.code);
        console.log('DEBUG: has data=' + !!json.data + ' has event_list=' + !!(json.data && json.data.event_list));
        if (json.code == 1 && json.data && json.data.event_list && json.data.event_list.length > 0) {
          console.log('DEBUG: event_list length=' + json.data.event_list.length);
          var event = json.data.event_list[0];
          console.log('DEBUG: event keys=' + Object.keys(event).join(','));
          
          // Send event info to watch
          var eventType = '';
          if (event.tag_list && event.tag_list.length > 0) {
            eventType = event.tag_list.join(', ');
          }
          if (!eventType) eventType = 'Motion';
          console.log('DEBUG: eventType=' + eventType);
          
          var eventTs = event.event_ts || '';
          console.log('DEBUG: raw event_ts=' + eventTs);
          // Avoid toLocaleTimeString — may crash pypkjs
          var eventTime = '';
          if (eventTs) {
            try {
              var d = new Date(parseInt(eventTs));
              var hh = d.getHours(), mm = d.getMinutes();
              eventTime = 'Last Event at ' + (hh > 12 ? hh - 12 : hh || 12) + ':' + (mm < 10 ? '0' : '') + mm + (hh >= 12 ? ' PM' : ' AM');
            } catch (e2) {
              eventTime = 'time err';
              console.log('DEBUG: Date error: ' + e2);
            }
          }
          console.log('DEBUG: eventTime=' + eventTime);
          
          console.log('DEBUG: about to sendAppMessage event info');
          Pebble.sendAppMessage({
            "CameraEventType": eventType,
            "CameraEventTime": eventTime
          }, function() {
            console.log('DEBUG: event message sent to watch OK');
          }, function(e) {
            console.log('DEBUG: event message send FAILED');
          });
          
          // Extract image URL from file_list (API returns it there, not top-level)
          console.log('DEBUG: extracting image URL');
          var imageUrl = event.file_url || event.url || '';
          if (!imageUrl && event.file_list && event.file_list.length > 0) {
            imageUrl = event.file_list[0].url || '';
          }
          console.log('DEBUG: imageUrl=' + (imageUrl ? imageUrl.substring(0, 60) : '(none)'));
          if (imageUrl) {
            downloadAndSendImage(imageUrl);
          } else {
            console.log('No image URL in event');
          }
        } else {
          console.log('No camera events found: code=' + (json.code || 'n/a'));
          Pebble.sendAppMessage({
            "CameraEventType": "No events",
            "CameraEventTime": ""
          });
        }
      } catch (e) {
        console.log('Camera event parse error:', e);
      }
    }
  };
  req.onerror = function() {
    console.log('Camera event fetch error');
  };
  var payload = buildCameraPayload();
  payload.sv = WYZE_CAM_SV_EVENT_LIST;
  payload.device_mac = dev.mac;
  payload.device_model = dev.model;
  payload.count = 1;
  payload.order_by = 2; // Most recent first
  payload.begin_time = String(Date.now() - 7 * 24 * 3600 * 1000);
  payload.end_time = String(Date.now());
  req.send(JSON.stringify(payload));
}

function downloadAndSendImage(url) {
  console.log('Downloading camera image...');
  console.log('DEBUG: original URL domain=' + url.split('/')[2]);
  // Try original URL first (iOS params should generate valid st tokens)
  tryImageDownload(url, function() {
    // If original fails, try non-auth domain
    var altUrl = url.replace('prod-sight-safe-auth.wyze.com', 'prod-sight-safe.wyze.com');
    console.log('DEBUG: trying non-auth domain...');
    tryImageDownload(altUrl, function() {
      console.log('Both image download attempts failed');
    });
  });
}

function tryImageDownload(dlUrl, onFail) {
  console.log('DEBUG: GET ' + dlUrl.substring(0, 100));
  var req = new XMLHttpRequest();
  req.open('GET', dlUrl, true);
  req.responseType = 'arraybuffer';
  req.timeout = 15000;
  try { req.setRequestHeader('User-Agent', WYZE_CAM_USER_AGENT); } catch (e) { }
  req.onload = function() {
    console.log('DEBUG: onload status=' + req.status);
    if (req.status === 200 && req.response) {
      var ab = req.response;
      console.log('DEBUG: response type=' + typeof ab + ' constructor=' + (ab && ab.constructor ? ab.constructor.name : 'none'));
      var bytes = null;
      try {
        if (ab instanceof ArrayBuffer) {
          // Real hardware: response is a proper ArrayBuffer
          bytes = new Uint8Array(ab);
          console.log('DEBUG: ArrayBuffer path, ' + bytes.length + ' bytes');
        } else if (typeof ab === 'object' && ab.byteLength !== undefined) {
          // Some PebbleKit JS versions return ArrayBuffer-like objects
          bytes = new Uint8Array(ab);
          console.log('DEBUG: ArrayBuffer-like path, ' + bytes.length + ' bytes');
        } else if (typeof ab === 'string' && ab.length > 0) {
          // pypkjs emulator patch: returns base64 string
          var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          var lookup = {};
          for (var li = 0; li < B64.length; li++) lookup[B64[li]] = li;
          var b64str = ab.replace(/[=]+$/, '');
          var outLen = (b64str.length * 3 / 4) | 0;
          bytes = new Uint8Array(outLen);
          var p = 0;
          for (var bi = 0; bi < b64str.length; bi += 4) {
            var a0 = lookup[b64str[bi]] || 0;
            var a1 = lookup[b64str[bi+1]] || 0;
            var a2 = lookup[b64str[bi+2]] || 0;
            var a3 = lookup[b64str[bi+3]] || 0;
            bytes[p++] = (a0 << 2) | (a1 >> 4);
            if (bi + 2 < b64str.length) bytes[p++] = ((a1 & 15) << 4) | (a2 >> 2);
            if (bi + 3 < b64str.length) bytes[p++] = ((a2 & 3) << 6) | a3;
          }
          if (p < outLen) bytes = bytes.subarray(0, p);
          console.log('DEBUG: base64 path, decoded ' + bytes.length + ' bytes');
        } else {
          console.log('DEBUG: unknown response type, trying Uint8Array wrap');
          bytes = new Uint8Array(ab);
        }
        if (bytes && bytes.length >= 4) {
          console.log('DEBUG: header: ' + bytes[0].toString(16) + ' ' + bytes[1].toString(16) + ' ' + bytes[2].toString(16) + ' ' + bytes[3].toString(16));
        }
      } catch (e) {
        console.log('DEBUG: byte extraction error: ' + e);
      }
      
      if (bytes && bytes.length > 100 && bytes[0] === 0xFF) {
        processJpegResponse(bytes);
      } else {
        console.log('Failed to extract valid JPEG (first: ' + (bytes ? '0x' + bytes[0].toString(16) : 'null') + ', len: ' + (bytes ? bytes.length : 0) + ')');
        if (onFail) onFail();
      }
    } else {
      console.log('Image download failed: HTTP ' + req.status);
      if (onFail) onFail();
    }
  };
  req.onerror = function() {
    console.log('DEBUG: onerror fired');
    if (onFail) onFail();
  };
  req.ontimeout = function() {
    console.log('DEBUG: ontimeout fired');
    if (onFail) onFail();
  };
  req.send();
}

function processJpegResponse(jpegData) {
  console.log('Image downloaded: ' + jpegData.length + ' bytes');
  // Debug: check JPEG header bytes
  if (jpegData.length >= 4) {
    console.log('DEBUG: first 4 bytes: ' + jpegData[0].toString(16) + ' ' + jpegData[1].toString(16) + ' ' + jpegData[2].toString(16) + ' ' + jpegData[3].toString(16));
  }
  try {
    // Decode JPEG to RGBA pixel buffer (pass Uint8Array directly, no Buffer needed)
    var decoded = jpegDecode(jpegData, { useTArray: true });
    var srcW = decoded.width;
    var srcH = decoded.height;
    var rgba = decoded.data;
    console.log('JPEG decoded: ' + srcW + 'x' + srcH);

    // Resize to Pebble target size using nearest-neighbor
    var pebbleData = new Uint8Array(CAM_TARGET_W * CAM_TARGET_H);
    for (var y = 0; y < CAM_TARGET_H; y++) {
      var srcY = Math.floor(y * srcH / CAM_TARGET_H);
      for (var x = 0; x < CAM_TARGET_W; x++) {
        var srcX = Math.floor(x * srcW / CAM_TARGET_W);
        var si = (srcY * srcW + srcX) * 4;
        var r = rgba[si];
        var g = rgba[si + 1];
        var b = rgba[si + 2];
        // Convert to Pebble 8-bit color: 0b11RRGGBB
        pebbleData[y * CAM_TARGET_W + x] = 0xC0 | ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
      }
    }
    console.log('Pebble 8-bit: ' + pebbleData.length + ' bytes');
    var totalChunks = Math.ceil(pebbleData.length / CAM_CHUNK_SIZE);
    sendImageChunk(pebbleData, 0, totalChunks, CAM_TARGET_W, CAM_TARGET_H);
  } catch (e) {
    console.log('JPEG decode error: ' + e);
  }
}

function sendImageChunk(data, chunkIndex, totalChunks, width, height) {
  if (chunkIndex >= totalChunks) {
    console.log('All image chunks sent');
    return;
  }
  var start = chunkIndex * 1500;
  var end = Math.min(start + 1500, data.length);
  var chunk = Array.prototype.slice.call(data, start, end);
  
  var msg = {
    "CameraChunkIndex": chunkIndex,
    "CameraChunkTotal": totalChunks,
    "CameraChunkData": chunk,
    "CameraWidth": width,
    "CameraHeight": height
  };
  
  Pebble.sendAppMessage(msg, function() {
    setTimeout(function() { sendImageChunk(data, chunkIndex + 1, totalChunks, width, height); }, 100);
  }, function() {
    setTimeout(function() { sendImageChunk(data, chunkIndex, totalChunks, width, height); }, 1500);
  });
}

function wyzeLogout() {
  console.log('Logging out of Wyze...');
  // Optionally call server-side logout
  if (wyzeToken) {
    var req = new XMLHttpRequest();
    req.open('POST', 'https://api.wyzecam.com/app/user/logout', true);
    req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
    var payload = buildWyzeBasePayload();
    req.send(JSON.stringify(payload));
  }
  // Clear all local tokens
  localStorage.removeItem('wyze_access_token');
  localStorage.removeItem('wyze_refresh_token');
  wyzeToken = null;
  deviceList = [];
  setAuthStatus('none', null);
  sendAuthStatusToWatch(0);
  // Send empty device list to watch to clear UI
  Pebble.sendAppMessage({ "DeviceCount": 0 });
  console.log('Logged out. Tokens cleared.');
}

Pebble.addEventListener('ready', function(e) {
  console.log('JS Ready.');
  syncSettingsFromClayStorage();
  sendAuthStatusToWatch(1);
  authenticateWyze(null, function() {
    fetchDevices();
    fetchShortcuts();
  });
});

Pebble.addEventListener('showConfiguration', function(e) {
  rebuildClay();
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function(event) {
  if (!event || !event.response || event.response === 'CANCELLED') return;
  try {
    // Calling getSettings saves flattened props directly into localStorage 'clay-settings'
    clay.getSettings(event.response); 
  } catch (e) {
    console.log("Failed to parse Clay response");
  }
  
  syncSettingsFromClayStorage();
  
  // SECURITY: Grab password before wiping from storage so auth can use it in-memory only.
  var rawPassword = SETTINGS.WyzePassword || null;
  if (rawPassword) {
    delete SETTINGS.WyzePassword;
    localStorage.setItem('clay-settings', JSON.stringify(SETTINGS));
    console.log('Password captured in-memory and wiped from storage immediately.');
  }
  
  // Check if user requested logout via Clay toggle.
  // Clay toggles may serialize as true/1/"1" — use strict check to avoid
  // false positives from string "false" or 0.
  var shouldLogout = (SETTINGS.WyzeLogout === true || SETTINGS.WyzeLogout === 1 || SETTINGS.WyzeLogout === '1');
  if (shouldLogout) {
    SETTINGS.WyzeLogout = false;
    localStorage.setItem('clay-settings', JSON.stringify(SETTINGS));
    wyzeLogout();
    return;
  }
  
  authenticateWyze(rawPassword, function() {
    sendAuthStatusToWatch(1);
    fetchDevices();
  });
});

Pebble.addEventListener('appmessage', function(e) {
  var d = e.payload;
  if (d.ActionToggle !== undefined) {
    // Check if this is an advanced property action (has ActionType)
    if (d.ActionType !== undefined && d.ActionType > 0) {
      if (d.ActionType === 4) {
        // Garage door control
        garageControl(d.ActionToggle, d.ActionValue || 0);
      } else if (d.ActionType === 5) {
        // Scale data request
        fetchScaleData(d.ActionToggle);
      } else {
        setDeviceProperty(d.ActionToggle, d.ActionType, d.ActionValue || 0);
      }
    } else {
      toggleDevice(d.ActionToggle);
    }
  } else if (d.ShortcutTrigger !== undefined) {
    triggerShortcut(d.ShortcutTrigger);
  } else if (d.CameraRequest !== undefined) {
    fetchCameraEvent(d.CameraRequest);
  } else if (d.GarageRequest !== undefined) {
    // Garage image request — reuse camera event pipeline for the garage cam
    fetchCameraEvent(d.GarageRequest);
  } else if (d.ActionRefresh !== undefined) {
    fetchDevices();
    fetchShortcuts();
  } else if (d.ActionLogout !== undefined) {
    fetchDevices();
  } else if (d.ActionLogout !== undefined) {
    wyzeLogout();
  /* TEST AUTH — commented out, see test_menu_instructions.md to re-enable
  } else if (d.TestAuth !== undefined) {
    console.log('TEST AUTH: injecting test credentials (in-memory only)');
    SETTINGS.WyzeEmail = 'REDACTED_EMAIL';
    SETTINGS.WyzeAPIKey = 'REDACTED_WYZE_API_KEY';
    SETTINGS.WyzeKeyID = 'REDACTED_WYZE_KEY_ID';
    authenticateWyze('REDACTED_PASSWORD', function() {
      sendAuthStatusToWatch(1);
      fetchDevices();
      fetchShortcuts();
    });
  */
  } else if (d.AppReady) {
    sendAuthStatusToWatch(1);
    if (wyzeToken) {
        fetchDevices();
        fetchShortcuts();
    } else {
        authenticateWyze(null, function() {
          fetchDevices();
          fetchShortcuts();
        });
    }
  }
});
