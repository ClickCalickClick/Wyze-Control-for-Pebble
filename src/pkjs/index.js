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
var CAM_TARGET_W_DEFAULT = 144;
var CAM_TARGET_H_DEFAULT = 84;
var CAM_PROGRESS_EVENT_END = 20;
var CAM_PROGRESS_DOWNLOAD_END = 65;
var CAM_PROGRESS_PROCESS_END = 85;
var CAM_PROGRESS_TRANSFER_END = 99;
var CAM_PROGRESS_EMIT_THROTTLE_MS = 160;

var s_cameraProgress = {
  requestId: 0,
  lastPercent: -1,
  lastEmitTs: 0
};

var REFRESH_RETRY_MAX = 3;
var REFRESH_RETRY_BASE_MS = 2000;
var s_refresh_retry_attempts = 0;

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

function isAutoReauthEnabled() {
  return SETTINGS.WyzeAutoReauth === true || SETTINGS.WyzeAutoReauth === 1 || SETTINGS.WyzeAutoReauth === '1';
}

function hasSavedReauthHash() {
  return !!(SETTINGS.WyzeEmail && SETTINGS.WyzePasswordHash && isAutoReauthEnabled());
}

function clearAuthTokens() {
  localStorage.removeItem('wyze_access_token');
  localStorage.removeItem('wyze_refresh_token');
  wyzeToken = null;
}

function isHardRefreshFailure(statusCode, responseJson) {
  if (statusCode === 401 || statusCode === 403) return true;
  if (!responseJson) return false;

  var code = responseJson.code;
  if (code === 2001 || code === 2002 || code === 3001) return true;

  var msg = String(responseJson.msg || responseJson.description || '').toLowerCase();
  return msg.indexOf('invalid token') >= 0 ||
    msg.indexOf('token expired') >= 0 ||
    msg.indexOf('refresh token') >= 0 ||
    msg.indexOf('unauthorized') >= 0;
}

function getCameraTargetSize() {
  var platform = null;
  if (Pebble.getActiveWatchInfo) {
    try {
      platform = Pebble.getActiveWatchInfo().platform;
    } catch (e) {
      platform = null;
    }
  }

  if (platform === 'emery') {
    return { width: 200, height: 132 };
  }
  if (platform === 'gabbro') {
    return { width: 164, height: 96 };
  }
  return { width: CAM_TARGET_W_DEFAULT, height: CAM_TARGET_H_DEFAULT };
}

function isCameraProgressActive(requestId) {
  return requestId === s_cameraProgress.requestId;
}

function clampPercent(percent) {
  if (percent < 0) return 0;
  if (percent > 100) return 100;
  return percent;
}

function toStagePercent(start, end, fraction) {
  var safeFraction = fraction;
  if (safeFraction < 0) safeFraction = 0;
  if (safeFraction > 1) safeFraction = 1;
  return Math.floor(start + ((end - start) * safeFraction));
}

function emitCameraProgress(requestId, percent, force) {
  if (!isCameraProgressActive(requestId)) return;
  var clamped = clampPercent(percent);
  if (clamped < s_cameraProgress.lastPercent) {
    clamped = s_cameraProgress.lastPercent;
  }

  var now = Date.now();
  if (!force) {
    if (clamped === s_cameraProgress.lastPercent) return;
    if ((now - s_cameraProgress.lastEmitTs) < CAM_PROGRESS_EMIT_THROTTLE_MS && clamped < 100) return;
  }

  s_cameraProgress.lastPercent = clamped;
  s_cameraProgress.lastEmitTs = now;
  Pebble.sendAppMessage({ "CameraProgress": clamped }, null, function() {});
}

function emitCameraStageProgress(requestId, start, end, fraction, force) {
  emitCameraProgress(requestId, toStagePercent(start, end, fraction), force);
}

function beginCameraProgressRequest() {
  s_cameraProgress.requestId += 1;
  s_cameraProgress.lastPercent = -1;
  s_cameraProgress.lastEmitTs = 0;
  emitCameraProgress(s_cameraProgress.requestId, 0, true);
  return s_cameraProgress.requestId;
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

// Send a short free-text progress line to the watch so the user sees what the
// app is doing during auth/reconnect (e.g. "Checking sign-in…", "Reconnecting…").
function sendAuthProgressToWatch(text) {
  Pebble.sendAppMessage({ "AuthMessage": String(text || '') }, null, function() {
    console.log('Failed to send AuthMessage to watch');
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
      if (callback) callback(new Error('missing_api_credentials'));
      return;
    }
    if (callback) callback();
    return;
  }
  
  var cachedAccessToken = localStorage.getItem('wyze_access_token');
  var shouldUseSavedHash = !rawPassword && !cachedAccessToken && hasSavedReauthHash();
  var hashedPassword = null;
  if (rawPassword) {
    hashedPassword = md5(md5(md5(rawPassword)));
  } else if (shouldUseSavedHash) {
    hashedPassword = SETTINGS.WyzePasswordHash;
  }
  
  if (SETTINGS.WyzeEmail && hashedPassword) {
    console.log('Exchanging credentials for token...');
    if (rawPassword) {
      setAuthStatus('pending', 'Authenticating with Wyze...');
    } else {
      setAuthStatus('pending', 'Attempting automatic re-auth...');
    }
    
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
            if (callback) callback(null);
          } else if (res.mfa_options && res.mfa_options.length) {
            console.log('MFA challenge returned.');
            setAuthStatus('error', 'MFA challenge required. Not yet supported.');
            if (callback) callback(new Error('mfa_required'));
          } else {
            console.log('No access_token in response.');
            setAuthStatus('error', 'Token not present in Wyze response.');
            if (callback) callback(new Error('no_access_token'));
          }
        } catch (e) {
          console.log('Login parse error:', e);
          setAuthStatus('error', 'Could not parse login response.');
          if (callback) callback(new Error('parse_error'));
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
        if (callback) callback(new Error('login_http_' + req.status));
      }
    };
    req.onerror = function() {
      setAuthStatus('error', 'Network error contacting Wyze.');
      if (callback) callback(new Error('network_error'));
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
    if (callback) callback(null);
  } else {
    console.log('No password provided and no cached token.');
    setAuthStatus('error', 'Enter email and password to authenticate.');
    sendAuthStatusToWatch(0);
    if (callback) callback(new Error('no_credentials'));
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
  'WyzeScale': { index: 6, name: 'Scale' },
  'JA.SC':     { index: 7, name: 'Vacuum' },
  'JA_RO2':    { index: 7, name: 'Vacuum' },
  'Vacuum':    { index: 7, name: 'Vacuum' },
  'Thermostat': { index: 8, name: 'Thermostat' }
};

// Wyze sometimes reports vacuums as product_type "Common" or empty — detect by model prefix
function detectByModel(model) {
  if (!model) return null;
  if (model.indexOf('JA_RO') === 0 || model.indexOf('JA.SC') === 0) return { index: 7, name: 'Vacuum' };
  if (model.indexOf('CO_EA') === 0) return { index: 8, name: 'Thermostat' };
  return null;
}

function processDevices(devices) {
  deviceList = [];
  s_refresh_retry_attempts = 0;
  
  for (var i = 0; i < devices.length; i++) {
    var dev = devices[i];
    var pt = dev.product_type || '';
    var mapped = PRODUCT_TYPE_MAP[pt] || detectByModel(dev.product_model) || { index: 99, name: pt || 'Other' };
    
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

// Recover an expired/invalid session: refresh the token, and if that hard-fails,
// clear tokens and re-login using the saved password hash (when auto re-auth is
// enabled). Transient failures are retried with backoff. callback(err) — err null
// means a usable token is now in wyzeToken.
function recoverAuth(callback) {
  sendAuthProgressToWatch('Reconnecting\u2026');
  setAuthStatus('pending', 'Reconnecting to Wyze...');
  refreshWyzeToken(function(result) {
    if (result && result.ok) {
      s_refresh_retry_attempts = 0;
      sendAuthProgressToWatch('Signed in');
      if (callback) callback(null);
      return;
    }

    if (result && result.hardFailure) {
      clearAuthTokens();
      if (hasSavedReauthHash()) {
        sendAuthProgressToWatch('Reconnecting\u2026');
        setAuthStatus('pending', 'Attempting automatic re-auth...');
        authenticateWyze(null, function(err) {
          if (!err && wyzeToken) {
            s_refresh_retry_attempts = 0;
            sendAuthProgressToWatch('Signed in');
            if (callback) callback(null);
          } else {
            setAuthStatus('error', 'Session expired. Auto re-auth failed — re-enter password.');
            sendAuthStatusToWatch(0);
            if (callback) callback(err || new Error('reauth_failed'));
          }
        });
      } else {
        setAuthStatus('error', 'Session expired. Re-enter password to reconnect.');
        sendAuthStatusToWatch(0);
        if (callback) callback(new Error('session_expired'));
      }
      return;
    }

    // Transient failure — retry refresh with backoff.
    s_refresh_retry_attempts += 1;
    if (s_refresh_retry_attempts <= REFRESH_RETRY_MAX) {
      var delay = REFRESH_RETRY_BASE_MS * s_refresh_retry_attempts;
      setAuthStatus('pending', 'Temporary network issue. Retrying...');
      sendAuthProgressToWatch('Reconnecting\u2026');
      setTimeout(function() {
        recoverAuth(callback);
      }, delay);
    } else {
      s_refresh_retry_attempts = 0;
      setAuthStatus('error', 'Refresh failed due to temporary network errors. Try again.');
      sendAuthStatusToWatch(2);
      if (callback) callback(new Error('transient_exhausted'));
    }
  });
}

// Proactively guarantee a usable token before making a request. Emits progress to
// the watch. callback(err) — err null means wyzeToken is ready to use. If there is
// no token and we cannot reconnect automatically, the watch is set to "no auth".
function ensureAuth(callback) {
  // Already have an in-memory token — good to go. Per-request 401 recovery will
  // catch the case where it has silently expired.
  if (wyzeToken) {
    if (callback) callback(null);
    return;
  }

  var cachedAccessToken = localStorage.getItem('wyze_access_token');
  if (cachedAccessToken) {
    wyzeToken = cachedAccessToken;
    if (callback) callback(null);
    return;
  }

  // No token at all. If we can reconnect using the saved hash, do it silently.
  if (hasSavedReauthHash()) {
    sendAuthProgressToWatch('Reconnecting\u2026');
    setAuthStatus('pending', 'Attempting automatic re-auth...');
    authenticateWyze(null, function(err) {
      if (!err && wyzeToken) {
        sendAuthProgressToWatch('Signed in');
        if (callback) callback(null);
      } else {
        sendAuthStatusToWatch(0);
        if (callback) callback(err || new Error('reauth_failed'));
      }
    });
    return;
  }

  // Nothing we can do automatically — user must sign in via Clay settings.
  setAuthStatus('error', 'Sign in needed. Open settings to enter your password.');
  sendAuthStatusToWatch(0);
  if (callback) callback(new Error('no_session'));
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
      // Token expired — try to recover the session, then reload on success.
      console.log('Token expired, attempting recovery...');
      recoverAuth(function(err) {
        if (!err) {
          fetchDevices();
        }
        // On failure, recoverAuth has already set the error status and watch state.
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

// True when an XHR response indicates the access token is expired/invalid.
function isExpiredResponse(req) {
  return req.status === 401 || (req.status === 200 && tryParseCode(req.responseText) === 2001);
}

function refreshWyzeToken(callback) {
  var refreshToken = localStorage.getItem('wyze_refresh_token');
  if (!refreshToken) {
    console.log('No refresh token available.');
    if (callback) callback({ ok: false, hardFailure: true, reason: 'no_refresh_token' });
    return;
  }
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/user/refresh_token', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState !== 4) return;

    var json = null;
    try {
      json = JSON.parse(req.responseText);
    } catch (parseErr) {
      json = null;
    }

    if (req.readyState === 4 && req.status === 200) {
      try {
        if (json && json.code === 1 && json.data && json.data.access_token) {
          console.log('Token refreshed successfully.');
          wyzeToken = json.data.access_token;
          localStorage.setItem('wyze_access_token', json.data.access_token);
          if (json.data.refresh_token) {
            localStorage.setItem('wyze_refresh_token', json.data.refresh_token);
          }
          setAuthStatus('success', 'Token refreshed.');
          if (callback) callback({ ok: true });
          return;
        }
      } catch(e) {
        console.log('Refresh parse error:', e);
      }
    }

    if (isHardRefreshFailure(req.status, json)) {
      console.log('Refresh token hard-failed.');
      if (callback) callback({ ok: false, hardFailure: true, reason: 'invalid_refresh' });
    } else {
      console.log('Refresh token transient failure. status=' + req.status);
      if (callback) callback({ ok: false, hardFailure: false, reason: 'transient' });
    }
  };
  req.onerror = function() {
    if (callback) callback({ ok: false, hardFailure: false, reason: 'network_error' });
  };
  var payload = buildWyzeBasePayload();
  payload.sv = WYZE_SV_REFRESH_TOKEN;
  payload.refresh_token = refreshToken;
  req.send(JSON.stringify(payload));
}

function toggleDevice(id, isRetry) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/device/set_property', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && isExpiredResponse(req) && !isRetry) {
      console.log('Toggle hit expired token, recovering...');
      recoverAuth(function(err) {
        if (!err) toggleDevice(id, true);
        else Pebble.sendAppMessage({ "DeviceIndex": id, "DeviceState": dev.state });
      });
      return;
    }
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
function garageControl(id, actionValue, isRetry) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  console.log('Garage toggle device ' + id + ': ' + dev.name);
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/auto/run_action', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && isExpiredResponse(req) && !isRetry) {
      console.log('Garage trigger hit expired token, recovering...');
      recoverAuth(function(err) {
        if (!err) garageControl(id, actionValue, true);
      });
      return;
    }
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

function fetchShortcuts(isRetry) {
  if (!wyzeToken) return;
  console.log('Fetching shortcuts...');
  var req = new XMLHttpRequest();
  req.open('POST', 'https://api.wyzecam.com/app/v2/auto/run_action_list', true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.onload = function() {
    if (req.readyState === 4 && isExpiredResponse(req) && !isRetry) {
      console.log('Shortcuts hit expired token, recovering...');
      recoverAuth(function(err) {
        if (!err) fetchShortcuts(true);
        else Pebble.sendAppMessage({"ShortcutCount": 0});
      });
      return;
    }
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
  var progressRequestId = beginCameraProgressRequest();
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
          var TAG_NAMES = {1:'Motion',2:'Sound',101:'Motion',110:'Person',111:'Vehicle',112:'Pet',113:'Package'};
          var EVENT_VAL_NAMES = {'1':'Motion','2':'Sound'};
          var eventType = '';
          if (event.tag_list && event.tag_list.length > 0) {
            eventType = event.tag_list.map(function(t) {
              return TAG_NAMES[t] || TAG_NAMES[String(t)] || ('Tag ' + t);
            }).join(', ');
          }
          if (!eventType && event.event_value) {
            eventType = EVENT_VAL_NAMES[String(event.event_value)] || '';
          }
          if (!eventType) eventType = 'Motion';
          console.log('DEBUG: eventType=' + eventType);

          emitCameraProgress(progressRequestId, 10, false);
          
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
            emitCameraProgress(progressRequestId, CAM_PROGRESS_EVENT_END, true);
            downloadAndSendImage(imageUrl, progressRequestId);
          } else {
            console.log('No image URL in event');
          }
        } else {
          console.log('No camera events found: code=' + (json.code || 'n/a'));
          emitCameraProgress(progressRequestId, CAM_PROGRESS_EVENT_END, true);
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

function downloadAndSendImage(url, progressRequestId) {
  console.log('Downloading camera image...');
  console.log('DEBUG: original URL domain=' + url.split('/')[2]);
  emitCameraProgress(progressRequestId, CAM_PROGRESS_EVENT_END, true);
  // Try original URL first (iOS params should generate valid st tokens)
  tryImageDownload(url, function() {
    // If original fails, try non-auth domain
    var altUrl = url.replace('prod-sight-safe-auth.wyze.com', 'prod-sight-safe.wyze.com');
    console.log('DEBUG: trying non-auth domain...');
    tryImageDownload(altUrl, function() {
      console.log('Both image download attempts failed');
    }, progressRequestId);
  }, progressRequestId);
}

function tryImageDownload(dlUrl, onFail, progressRequestId) {
  console.log('DEBUG: GET ' + dlUrl.substring(0, 100));
  var req = new XMLHttpRequest();
  var headerContentLength = 0;
  req.open('GET', dlUrl, true);
  req.responseType = 'arraybuffer';
  req.timeout = 15000;
  try { req.setRequestHeader('User-Agent', WYZE_CAM_USER_AGENT); } catch (e) { }
  req.onprogress = function(evt) {
    var loaded = (evt && evt.loaded) ? evt.loaded : 0;
    var total = (evt && evt.lengthComputable && evt.total) ? evt.total : 0;
    if (!total && !headerContentLength) {
      try {
        var cl = req.getResponseHeader('Content-Length');
        headerContentLength = cl ? parseInt(cl, 10) : 0;
      } catch (e2) {
        headerContentLength = 0;
      }
    }
    if (!total && headerContentLength > 0) {
      total = headerContentLength;
    }
    if (total > 0 && loaded >= 0) {
      emitCameraStageProgress(progressRequestId, CAM_PROGRESS_EVENT_END, CAM_PROGRESS_DOWNLOAD_END, loaded / total, false);
    } else if (loaded > 0) {
      emitCameraProgress(progressRequestId, CAM_PROGRESS_EVENT_END + 1, false);
    }
  };
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
        emitCameraProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END, true);
        processJpegResponse(bytes, progressRequestId);
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

// Atkinson dither: RGBA source → 1-bit packed for GBitmapFormat1Bit
// Uses area-average downscaling, contrast stretch, unsharp mask, and Atkinson dithering.
// Output: Uint8Array with rows padded to 4-byte boundary (GBitmapFormat1Bit requirement).
// Bit packing: LSB-first (bit 0 = leftmost pixel) per the Pebble SDK bitmapgen.py.
// Packed as bytes within little-endian 32-bit words. 1 = white, 0 = black.
function ditherTo1Bit(rgba, srcW, srcH, dstW, dstH, progressRequestId) {
  // Step 1: Area-average downscale to grayscale
  var gray = new Float32Array(dstW * dstH);
  var xRatio = srcW / dstW;
  var yRatio = srcH / dstH;
  for (var dy = 0; dy < dstH; dy++) {
    var sy0 = Math.floor(dy * yRatio);
    var sy1 = Math.min(Math.ceil((dy + 1) * yRatio), srcH);
    for (var dx = 0; dx < dstW; dx++) {
      var sx0 = Math.floor(dx * xRatio);
      var sx1 = Math.min(Math.ceil((dx + 1) * xRatio), srcW);
      var sum = 0, count = 0;
      for (var sy = sy0; sy < sy1; sy++) {
        var rowOff = sy * srcW;
        for (var sx = sx0; sx < sx1; sx++) {
          var si = (rowOff + sx) * 4;
          sum += 0.299 * rgba[si] + 0.587 * rgba[si + 1] + 0.114 * rgba[si + 2];
          count++;
        }
      }
      gray[dy * dstW + dx] = count > 0 ? sum / count : 0;
    }
    if ((dy % 8) === 0 || dy === dstH - 1) {
      emitCameraStageProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END, CAM_PROGRESS_PROCESS_END, 0.05 + (0.45 * ((dy + 1) / dstH)), false);
    }
  }

  // Step 2: Contrast stretch — expand dynamic range before dithering
  var hist = new Uint32Array(256);
  for (var i = 0; i < gray.length; i++) hist[Math.min(255, Math.max(0, Math.round(gray[i])))]++;
  var total = gray.length;
  var clipLo = total * 0.02, clipHi = total * 0.98;
  var cumLo = 0;
  var lo = 0, hi = 255;
  for (var v = 0; v < 256; v++) {
    cumLo += hist[v];
    if (cumLo >= clipLo) { lo = v; break; }
  }
  var cumHi = 0;
  for (var v = 255; v >= 0; v--) {
    cumHi += hist[v];
    if (cumHi >= (total - clipHi)) { hi = v; break; }
  }
  if (hi > lo) {
    var scale = 255.0 / (hi - lo);
    for (var i = 0; i < gray.length; i++) {
      var v = (gray[i] - lo) * scale;
      gray[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
  }
  emitCameraStageProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END, CAM_PROGRESS_PROCESS_END, 0.6, false);

  // Step 3: Unsharp mask — sharpen edges before dithering for crisper 1-bit output
  // blur = 3×3 box blur, then sharpened = original + amount * (original - blur)
  var amount = 1.5;
  var sharp = new Float32Array(dstW * dstH);
  for (var y = 0; y < dstH; y++) {
    for (var x = 0; x < dstW; x++) {
      var sum = 0, cnt = 0;
      for (var ky = -1; ky <= 1; ky++) {
        var ny = y + ky;
        if (ny < 0 || ny >= dstH) continue;
        for (var kx = -1; kx <= 1; kx++) {
          var nx = x + kx;
          if (nx < 0 || nx >= dstW) continue;
          sum += gray[ny * dstW + nx];
          cnt++;
        }
      }
      var blur = sum / cnt;
      var orig = gray[y * dstW + x];
      var v = orig + amount * (orig - blur);
      sharp[y * dstW + x] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    if ((y % 8) === 0 || y === dstH - 1) {
      emitCameraStageProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END, CAM_PROGRESS_PROCESS_END, 0.6 + (0.2 * ((y + 1) / dstH)), false);
    }
  }

  // Step 4: Atkinson dithering with LSB-first bit packing
  // Pebble GBitmapFormat1Bit: bit 0 of byte = leftmost pixel (LSB-first),
  // rows padded to 4-byte (32-bit word) boundaries, little-endian.
  var rowBytes = Math.ceil(dstW / 32) * 4;
  var packed = new Uint8Array(rowBytes * dstH);

  for (var y = 0; y < dstH; y++) {
    for (var x = 0; x < dstW; x++) {
      var idx = y * dstW + x;
      var oldVal = sharp[idx];
      var newVal = oldVal >= 128 ? 255 : 0;
      var err = (oldVal - newVal) / 8;

      // Pack bit: 1 = white, 0 = black. LSB-first: pixel x → bit (x % 8).
      if (newVal > 0) {
        packed[y * rowBytes + Math.floor(x / 8)] |= (1 << (x % 8));
      }

      // Atkinson: diffuse 1/8 to each of 6 neighbors (total 6/8, 2/8 lost)
      if (x + 1 < dstW)                   sharp[idx + 1]          += err;
      if (x + 2 < dstW)                   sharp[idx + 2]          += err;
      if (y + 1 < dstH && x > 0)          sharp[idx + dstW - 1]   += err;
      if (y + 1 < dstH)                   sharp[idx + dstW]       += err;
      if (y + 1 < dstH && x + 1 < dstW)  sharp[idx + dstW + 1]   += err;
      if (y + 2 < dstH)                   sharp[idx + 2 * dstW]   += err;
    }
    if ((y % 8) === 0 || y === dstH - 1) {
      emitCameraStageProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END, CAM_PROGRESS_PROCESS_END, 0.8 + (0.2 * ((y + 1) / dstH)), false);
    }
  }

  return packed;
}

function processJpegResponse(jpegData, progressRequestId) {
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
    var targetSize = getCameraTargetSize();
    var targetW = targetSize.width;
    var targetH = targetSize.height;
    console.log('JPEG decoded: ' + srcW + 'x' + srcH);
    emitCameraProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END + 1, false);

    // Detect B&W platform
    var isBW = false;
    if (Pebble.getActiveWatchInfo) {
      var platform = Pebble.getActiveWatchInfo().platform;
      isBW = (platform === 'aplite' || platform === 'diorite' || platform === 'flint');
      console.log('Platform: ' + platform + ', isBW: ' + isBW);
    }

    if (isBW) {
      // B&W: Floyd-Steinberg dither to 1-bit, packed for GBitmapFormat1Bit
      var pebbleData = ditherTo1Bit(rgba, srcW, srcH, targetW, targetH, progressRequestId);
      console.log('Pebble 1-bit: ' + pebbleData.length + ' bytes');
      var totalChunks = Math.ceil(pebbleData.length / CAM_CHUNK_SIZE);
      emitCameraProgress(progressRequestId, CAM_PROGRESS_PROCESS_END, true);
      sendImageChunk(pebbleData, 0, totalChunks, targetW, targetH, progressRequestId);
    } else {
      // Color: existing 8-bit conversion
      var pebbleData = new Uint8Array(targetW * targetH);
      for (var y = 0; y < targetH; y++) {
        var srcY = Math.floor(y * srcH / targetH);
        for (var x = 0; x < targetW; x++) {
          var srcX = Math.floor(x * srcW / targetW);
          var si = (srcY * srcW + srcX) * 4;
          var r = rgba[si];
          var g = rgba[si + 1];
          var b = rgba[si + 2];
          // Convert to Pebble 8-bit color: 0b11RRGGBB
          pebbleData[y * targetW + x] = 0xC0 | ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
        }
        if ((y % 8) === 0 || y === targetH - 1) {
          emitCameraStageProgress(progressRequestId, CAM_PROGRESS_DOWNLOAD_END, CAM_PROGRESS_PROCESS_END, (y + 1) / targetH, false);
        }
      }
      console.log('Pebble 8-bit: ' + pebbleData.length + ' bytes');
      var totalChunks = Math.ceil(pebbleData.length / CAM_CHUNK_SIZE);
      emitCameraProgress(progressRequestId, CAM_PROGRESS_PROCESS_END, true);
      sendImageChunk(pebbleData, 0, totalChunks, targetW, targetH, progressRequestId);
    }
  } catch (e) {
    console.log('JPEG decode error: ' + e);
  }
}

function sendImageChunk(data, chunkIndex, totalChunks, width, height, progressRequestId) {
  if (chunkIndex >= totalChunks) {
    console.log('All image chunks sent');
    emitCameraProgress(progressRequestId, CAM_PROGRESS_TRANSFER_END, true);
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
    emitCameraStageProgress(progressRequestId, CAM_PROGRESS_PROCESS_END, CAM_PROGRESS_TRANSFER_END, (chunkIndex + 1) / totalChunks, false);
    setTimeout(function() { sendImageChunk(data, chunkIndex + 1, totalChunks, width, height, progressRequestId); }, 100);
  }, function() {
    setTimeout(function() { sendImageChunk(data, chunkIndex, totalChunks, width, height, progressRequestId); }, 1500);
  });
}

// ===================================================================
// VACUUM (Venus service) — live-verified May 2026.
//   Host: wyze-venus-service-vn.wyzecam.com
//   Sign: signature2 = HMAC-MD5(md5(token + VENUS_SECRET), sortedQuery | jsonBody)
// ===================================================================
var VENUS_APPID  = 'venp_4c30f812828de875';
var VENUS_SECRET = 'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq';

function venusHeaders(sig) {
  return {
    'access_token': wyzeToken,
    'requestid': md5(md5(String(Date.now()))),
    'appid': VENUS_APPID,
    'appinfo': 'wyze_android_' + WYZE_APP_VERSION,
    'phoneid': WYZE_PHONE_ID,
    'User-Agent': 'wyze_android_' + WYZE_APP_VERSION,
    'signature2': sig
  };
}

function venusGet(path, params, callback) {
  var merged = {};
  for (var k in params) merged[k] = params[k];
  merged.nonce = Date.now();
  var keys = Object.keys(merged).sort();
  var sortedStr = '', qs = '';
  for (var i = 0; i < keys.length; i++) {
    if (i > 0) { sortedStr += '&'; qs += '&'; }
    sortedStr += keys[i] + '=' + merged[keys[i]];
    qs += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(merged[keys[i]]);
  }
  var sig = md5(sortedStr, md5(wyzeToken + VENUS_SECRET));
  var headers = venusHeaders(sig);
  var req = new XMLHttpRequest();
  req.open('GET', 'https://wyze-venus-service-vn.wyzecam.com' + path + '?' + qs, true);
  for (var h in headers) req.setRequestHeader(h, headers[h]);
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try { callback(null, JSON.parse(req.responseText)); } catch (e) { callback(e); }
    } else callback(new Error('HTTP ' + req.status));
  };
  req.onerror = function() { callback(new Error('Network error')); };
  req.send();
}

function venusPost(path, body, callback) {
  var merged = {};
  for (var k in body) merged[k] = body[k];
  merged.nonce = String(Date.now());
  var ser = JSON.stringify(merged);
  var sig = md5(ser, md5(wyzeToken + VENUS_SECRET));
  var headers = venusHeaders(sig);
  headers['Content-Type'] = 'application/json;charset=utf-8';
  var req = new XMLHttpRequest();
  req.open('POST', 'https://wyze-venus-service-vn.wyzecam.com' + path, true);
  for (var h in headers) req.setRequestHeader(h, headers[h]);
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try { callback(null, JSON.parse(req.responseText)); } catch (e) { callback(e); }
    } else callback(new Error('HTTP ' + req.status));
  };
  req.onerror = function() { callback(new Error('Network error')); };
  req.send(ser);
}

var VACUUM_MODE_TEXT = {
  0: 'Idle', 1: 'Cleaning', 2: 'Paused', 3: 'Error',
  4: 'Docking', 5: 'Charging', 11: 'Charged', 39: 'Spot'
};

function fetchVacuumStatus(id) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  venusGet('/plugin/venus/get_iot_prop',
    { did: dev.mac, keys: 'iot_state,battary,mode,charge_state,fault_code' },
    function(err, res) {
      if (err || !res || res.code != 1 || !res.data) {
        console.log('Vacuum status error: ' + (err || (res && res.msg)));
        Pebble.sendAppMessage({ 'VacuumBattery': -1, 'VacuumMode': -1, 'VacuumModeText': 'Offline' });
        return;
      }
      var d = res.data;
      var battery = (d.battary !== undefined) ? d.battary : (d.battery || 0); // Wyze API typo
      var mode = (d.mode !== undefined) ? d.mode : -1;
      var modeText = VACUUM_MODE_TEXT[mode] || ('Mode ' + mode);
      if (d.charge_state === 1 && (mode === 0 || mode === 5)) {
        modeText = battery >= 100 ? 'Charged' : 'Charging';
      }
      var iotOnline = (d.iot_state === 'connected' || d.iot_state === 1) ? 1 : 0;
      console.log('Vacuum status: battery=' + battery + ' mode=' + mode + ' (' + modeText + ')');
      Pebble.sendAppMessage({
        'VacuumBattery': battery,
        'VacuumMode': mode,
        'VacuumModeText': modeText.substring(0, 31),
        'DeviceIndex': id,
        'DeviceOnline': iotOnline
      });
      dev.online = iotOnline;
    }
  );
}

// VacuumAction: 0=Start, 1=Pause, 2=Dock
function vacuumControl(id, action) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  var body;
  if (action === 0)      body = { type: 0, value: 1, vacuumMopMode: 0 };
  else if (action === 1) body = { type: 0, value: 2, vacuumMopMode: 0 };
  else if (action === 2) body = { type: 3, value: 1, vacuumMopMode: 0 };
  else { console.log('Unknown vacuum action: ' + action); return; }
  console.log('Vacuum action ' + action + ' on ' + dev.mac);
  venusPost('/plugin/venus/' + dev.mac + '/control', body, function(err, res) {
    if (err) { console.log('Vacuum action err: ' + err); return; }
    console.log('Vacuum action result: code=' + (res && res.code));
    setTimeout(function() { fetchVacuumStatus(id); }, 2500);
  });
}

// ===================================================================
// THERMOSTAT (Earth service via Olive signing). Implemented per wyzeapy
// production code. NOT live-verified — account has no thermostat.
// ===================================================================
var EARTH_HOST = 'earth-service.wyzecam.com';
var THERMO_KEYS = 'iot_state,temperature,humidity,mode_sys,fan_mode,working_state,heat_sp,cool_sp,emheat,kid_lock';
var THERMO_MODE_NAMES = { 0: 'OFF', 1: 'AUTO', 2: 'COOL', 3: 'HEAT' };
var THERMO_MODE_VALS  = ['off', 'auto', 'cool', 'heat'];
var THERMO_FAN_VALS   = ['auto', 'on', 'cycle'];

function oliveServiceGet(host, path, params, callback) {
  var nonce = Date.now();
  var merged = { nonce: nonce };
  for (var k in params) merged[k] = params[k];
  var keys = Object.keys(merged).sort();
  var sortedStr = '', qs = '';
  for (var i = 0; i < keys.length; i++) {
    if (i > 0) { sortedStr += '&'; qs += '&'; }
    sortedStr += keys[i] + '=' + merged[keys[i]];
    qs += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(merged[keys[i]]);
  }
  var sig = md5(sortedStr, md5(wyzeToken + SCALE_SIGNING_SECRET));
  var requestId = md5(md5(String(nonce)));
  var req = new XMLHttpRequest();
  req.open('GET', 'https://' + host + path + '?' + qs, true);
  req.setRequestHeader('access_token', wyzeToken);
  req.setRequestHeader('requestid', requestId);
  req.setRequestHeader('appid', SCALE_APP_ID);
  req.setRequestHeader('appinfo', 'wyze_android_' + WYZE_APP_VERSION);
  req.setRequestHeader('phoneid', WYZE_PHONE_ID);
  req.setRequestHeader('User-Agent', 'wyze_android_' + WYZE_APP_VERSION);
  req.setRequestHeader('signature2', sig);
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try { callback(null, JSON.parse(req.responseText)); } catch (e) { callback(e); }
    } else callback(new Error('HTTP ' + req.status));
  };
  req.onerror = function() { callback(new Error('Network error')); };
  req.send();
}

function oliveServicePost(host, path, body, callback) {
  var merged = { nonce: String(Date.now()) };
  for (var k in body) merged[k] = body[k];
  var ser = JSON.stringify(merged);
  var sig = md5(ser, md5(wyzeToken + SCALE_SIGNING_SECRET));
  var requestId = md5(md5(String(Date.now())));
  var req = new XMLHttpRequest();
  req.open('POST', 'https://' + host + path, true);
  req.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
  req.setRequestHeader('access_token', wyzeToken);
  req.setRequestHeader('requestid', requestId);
  req.setRequestHeader('appid', SCALE_APP_ID);
  req.setRequestHeader('appinfo', 'wyze_android_' + WYZE_APP_VERSION);
  req.setRequestHeader('phoneid', WYZE_PHONE_ID);
  req.setRequestHeader('User-Agent', 'wyze_android_' + WYZE_APP_VERSION);
  req.setRequestHeader('signature2', sig);
  req.onload = function() {
    if (req.readyState === 4 && req.status === 200) {
      try { callback(null, JSON.parse(req.responseText)); } catch (e) { callback(e); }
    } else callback(new Error('HTTP ' + req.status));
  };
  req.onerror = function() { callback(new Error('Network error')); };
  req.send(ser);
}

function fetchThermostatStatus(id) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  oliveServiceGet(EARTH_HOST, '/plugin/earth/get_iot_prop',
    { did: dev.mac, keys: THERMO_KEYS },
    function(err, res) {
      if (err || !res || res.code != 1 || !res.data) {
        console.log('Thermo status error: ' + (err || (res && res.msg)));
        Pebble.sendAppMessage({ 'ThermoTemp': -9999, 'ThermoMode': 'OFFLINE' });
        return;
      }
      var d = res.data;
      var temp = (d.temperature !== undefined) ? d.temperature : -999;
      var humidity = (d.humidity !== undefined) ? d.humidity : -1;
      var modeKey = String(d.mode_sys || 'off').toLowerCase();
      var modeIdx = THERMO_MODE_VALS.indexOf(modeKey);
      var modeName = THERMO_MODE_NAMES[modeIdx] || modeKey.toUpperCase();
      var heatSp = (d.heat_sp !== undefined) ? parseInt(d.heat_sp, 10) : 0;
      var coolSp = (d.cool_sp !== undefined) ? parseInt(d.cool_sp, 10) : 0;
      var fanKey = String(d.fan_mode || 'auto').toLowerCase();
      var working = String(d.working_state || 'idle');
      var iotOnline = (d.iot_state === 'connected' || d.iot_state === 1) ? 1 : 0;
      console.log('Thermo: temp=' + temp + ' hum=' + humidity + ' mode=' + modeName +
        ' heat=' + heatSp + ' cool=' + coolSp + ' fan=' + fanKey);
      Pebble.sendAppMessage({
        'ThermoTemp': Math.round(temp * 10),  // x10 fixed-point F
        'ThermoHumidity': humidity,
        'ThermoMode': modeName.substring(0, 15),
        'ThermoHeatSP': heatSp,
        'ThermoCoolSP': coolSp,
        'ThermoFan': fanKey.substring(0, 15),
        'ThermoWorking': working.substring(0, 15),
        'DeviceIndex': id,
        'DeviceOnline': iotOnline
      });
      dev.online = iotOnline;
    }
  );
}

// ThermoAction: 0=mode, 1=heat_sp, 2=cool_sp, 3=fan_mode
function thermostatControl(id, action, value) {
  var dev = deviceList[id];
  if (!dev || !wyzeToken) return;
  var prop, val;
  if (action === 0)      { prop = 'mode_sys'; val = THERMO_MODE_VALS[value] || 'off'; }
  else if (action === 1) { prop = 'heat_sp';  val = String(value); }
  else if (action === 2) { prop = 'cool_sp';  val = String(value); }
  else if (action === 3) { prop = 'fan_mode'; val = THERMO_FAN_VALS[value] || 'auto'; }
  else { console.log('Unknown thermo action ' + action); return; }
  console.log('Thermo set ' + prop + '=' + val + ' on ' + dev.mac);
  var body = { did: dev.mac, model: dev.model, props: {}, is_sub_device: 0 };
  body.props[prop] = val;
  oliveServicePost(EARTH_HOST, '/plugin/earth/set_iot_prop_by_topic', body, function(err, res) {
    if (err) { console.log('Thermo set err: ' + err); return; }
    console.log('Thermo set result: code=' + (res && res.code));
    setTimeout(function() { fetchThermostatStatus(id); }, 1500);
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
  sendAuthProgressToWatch('Checking sign-in…');
  ensureAuth(function(err) {
    if (err) {
      // ensureAuth has already set the watch to a "sign in needed" state.
      return;
    }
    sendAuthProgressToWatch('Loading…');
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
    if (isAutoReauthEnabled()) {
      SETTINGS.WyzePasswordHash = md5(md5(md5(rawPassword)));
      console.log('Auto re-auth is enabled; updated saved password hash.');
    } else {
      delete SETTINGS.WyzePasswordHash;
    }
    delete SETTINGS.WyzePassword;
    localStorage.setItem('clay-settings', JSON.stringify(SETTINGS));
    console.log('Password captured in-memory and wiped from storage immediately.');
  } else if (!isAutoReauthEnabled() && SETTINGS.WyzePasswordHash) {
    delete SETTINGS.WyzePasswordHash;
    localStorage.setItem('clay-settings', JSON.stringify(SETTINGS));
    console.log('Auto re-auth disabled; removed saved password hash.');
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
  
  authenticateWyze(rawPassword, function(err) {
    if (err) {
      // authenticateWyze has already recorded the error status for Clay/watch.
      return;
    }
    sendAuthStatusToWatch(1);
    sendAuthProgressToWatch('Loading…');
    fetchDevices();
  });
});

Pebble.addEventListener('appmessage', function(e) {
  var d = e.payload;
  if (d.VacuumRequest !== undefined) {
    fetchVacuumStatus(d.VacuumRequest);
    return;
  }
  if (d.VacuumAction !== undefined && d.ActionToggle !== undefined) {
    vacuumControl(d.ActionToggle, d.VacuumAction);
    return;
  }
  if (d.ThermoRequest !== undefined) {
    fetchThermostatStatus(d.ThermoRequest);
    return;
  }
  if (d.ThermoAction !== undefined && d.ActionToggle !== undefined) {
    thermostatControl(d.ActionToggle, d.ThermoAction, d.ThermoActionValue || 0);
    return;
  }
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
    wyzeLogout();
  /* TEST AUTH — uncomment for testing, see test_menu_instructions.md to re-disable
  } else if (d.TestAuth !== undefined) {
    console.log('TEST AUTH: injecting test credentials (in-memory only)');
    SETTINGS.WyzeEmail = 'YOUR_EMAIL@example.com';
    SETTINGS.WyzeAPIKey = 'YOUR_WYZE_API_KEY';
    SETTINGS.WyzeKeyID = 'YOUR_WYZE_KEY_ID';
    authenticateWyze('YOUR_PASSWORD', function() {
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
