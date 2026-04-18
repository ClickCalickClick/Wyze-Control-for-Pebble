/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(1);
	module.exports = __webpack_require__(2);


/***/ }),
/* 1 */
/***/ (function(module, exports) {

	/**
	 * Copyright 2024 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	
	(function(p) {
	  if (!p === undefined) {
	    console.error('Pebble object not found!?');
	    return;
	  }
	
	  // Aliases:
	  p.on = p.addEventListener;
	  p.off = p.removeEventListener;
	
	  // For Android (WebView-based) pkjs, print stacktrace for uncaught errors:
	  if (typeof window !== 'undefined' && window.addEventListener) {
	    window.addEventListener('error', function(event) {
	      if (event.error && event.error.stack) {
	        console.error('' + event.error + '\n' + event.error.stack);
	      }
	    });
	  }
	
	})(Pebble);


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	var Clay = __webpack_require__(3);
	var createClayConfig = __webpack_require__(6);
	var clay = new Clay(createClayConfig(''), null, { autoHandleEvents: false });
	var md5 = __webpack_require__(7);
	
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
	
	var jpegDecode = __webpack_require__(8).decode;
	
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
	
	// Atkinson dither: RGBA source → 1-bit packed for GBitmapFormat1Bit
	// Uses area-average downscaling, contrast stretch, unsharp mask, and Atkinson dithering.
	// Output: Uint8Array with rows padded to 4-byte boundary (GBitmapFormat1Bit requirement).
	// Bit packing: LSB-first (bit 0 = leftmost pixel) per the Pebble SDK bitmapgen.py.
	// Packed as bytes within little-endian 32-bit words. 1 = white, 0 = black.
	function ditherTo1Bit(rgba, srcW, srcH, dstW, dstH) {
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
	  }
	
	  return packed;
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
	
	    // Detect B&W platform
	    var isBW = false;
	    if (Pebble.getActiveWatchInfo) {
	      var platform = Pebble.getActiveWatchInfo().platform;
	      isBW = (platform === 'aplite' || platform === 'diorite' || platform === 'flint');
	      console.log('Platform: ' + platform + ', isBW: ' + isBW);
	    }
	
	    if (isBW) {
	      // B&W: Floyd-Steinberg dither to 1-bit, packed for GBitmapFormat1Bit
	      var pebbleData = ditherTo1Bit(rgba, srcW, srcH, CAM_TARGET_W, CAM_TARGET_H);
	      console.log('Pebble 1-bit: ' + pebbleData.length + ' bytes');
	      var totalChunks = Math.ceil(pebbleData.length / CAM_CHUNK_SIZE);
	      sendImageChunk(pebbleData, 0, totalChunks, CAM_TARGET_W, CAM_TARGET_H);
	    } else {
	      // Color: existing 8-bit conversion
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
	    }
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


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

	var require;var require;/* WEBPACK VAR INJECTION */(function(require) {/* Clay - https://github.com/pebble-dev/clay - Version: 1.0.8 - Build Date: 2026-02-19T02:58:23.912Z */
	!function(t){if(true)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.rebbleclay=t()}}(function(){var t;return function(){function t(e,n,r){function o(a,s){if(!n[a]){if(!e[a]){var c="function"==typeof require&&require;if(!s&&c)return require(a,!0);if(i)return i(a,!0);var l=new Error("Cannot find module '"+a+"'");throw l.code="MODULE_NOT_FOUND",l}var u=n[a]={exports:{}};e[a][0].call(u.exports,function(t){var n=e[a][1][t];return o(n||t)},u,u.exports,t,e,n,r)}return n[a].exports}for(var i="function"==typeof require&&require,a=0;a<r.length;a++)o(r[a]);return o}return t}()({1:[function(t,e,n){"use strict";function r(t){var e=t.length;if(e%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var n=t.indexOf("=");n===-1&&(n=e);var r=n===e?0:4-n%4;return[n,r]}function o(t){var e=r(t),n=e[0],o=e[1];return 3*(n+o)/4-o}function i(t,e,n){return 3*(e+n)/4-n}function a(t){var e,n,o=r(t),a=o[0],s=o[1],c=new p(i(t,a,s)),l=0,u=s>0?a-4:a;for(n=0;n<u;n+=4)e=f[t.charCodeAt(n)]<<18|f[t.charCodeAt(n+1)]<<12|f[t.charCodeAt(n+2)]<<6|f[t.charCodeAt(n+3)],c[l++]=e>>16&255,c[l++]=e>>8&255,c[l++]=255&e;return 2===s&&(e=f[t.charCodeAt(n)]<<2|f[t.charCodeAt(n+1)]>>4,c[l++]=255&e),1===s&&(e=f[t.charCodeAt(n)]<<10|f[t.charCodeAt(n+1)]<<4|f[t.charCodeAt(n+2)]>>2,c[l++]=e>>8&255,c[l++]=255&e),c}function s(t){return u[t>>18&63]+u[t>>12&63]+u[t>>6&63]+u[63&t]}function c(t,e,n){for(var r,o=[],i=e;i<n;i+=3)r=(t[i]<<16&16711680)+(t[i+1]<<8&65280)+(255&t[i+2]),o.push(s(r));return o.join("")}function l(t){for(var e,n=t.length,r=n%3,o=[],i=16383,a=0,s=n-r;a<s;a+=i)o.push(c(t,a,a+i>s?s:a+i));return 1===r?(e=t[n-1],o.push(u[e>>2]+u[e<<4&63]+"==")):2===r&&(e=(t[n-2]<<8)+t[n-1],o.push(u[e>>10]+u[e>>4&63]+u[e<<2&63]+"=")),o.join("")}n.byteLength=o,n.toByteArray=a,n.fromByteArray=l;for(var u=[],f=[],p="undefined"!=typeof Uint8Array?Uint8Array:Array,d="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",h=0,m=d.length;h<m;++h)u[h]=d[h],f[d.charCodeAt(h)]=h;f["-".charCodeAt(0)]=62,f["_".charCodeAt(0)]=63},{}],2:[function(t,e,n){(function(e,r){(function(){/*!
	 * The buffer module from node.js, for the browser.
	 *
	 * @author   Feross Aboukhadijeh <http://feross.org>
	 * @license  MIT
	 */
	"use strict";function r(){try{var t=new Uint8Array(1);return t.__proto__={__proto__:Uint8Array.prototype,foo:function(){return 42}},42===t.foo()&&"function"==typeof t.subarray&&0===t.subarray(1,1).byteLength}catch(e){return!1}}function o(){return a.TYPED_ARRAY_SUPPORT?2147483647:1073741823}function i(t,e){if(o()<e)throw new RangeError("Invalid typed array length");return a.TYPED_ARRAY_SUPPORT?(t=new Uint8Array(e),t.__proto__=a.prototype):(null===t&&(t=new a(e)),t.length=e),t}function a(t,e,n){if(!(a.TYPED_ARRAY_SUPPORT||this instanceof a))return new a(t,e,n);if("number"==typeof t){if("string"==typeof e)throw new Error("If encoding is specified then the first argument must be a string");return u(this,t)}return s(this,t,e,n)}function s(t,e,n,r){if("number"==typeof e)throw new TypeError('"value" argument must not be a number');return"undefined"!=typeof ArrayBuffer&&e instanceof ArrayBuffer?d(t,e,n,r):"string"==typeof e?f(t,e,n):h(t,e)}function c(t){if("number"!=typeof t)throw new TypeError('"size" argument must be a number');if(t<0)throw new RangeError('"size" argument must not be negative')}function l(t,e,n,r){return c(e),e<=0?i(t,e):void 0!==n?"string"==typeof r?i(t,e).fill(n,r):i(t,e).fill(n):i(t,e)}function u(t,e){if(c(e),t=i(t,e<0?0:0|m(e)),!a.TYPED_ARRAY_SUPPORT)for(var n=0;n<e;++n)t[n]=0;return t}function f(t,e,n){if("string"==typeof n&&""!==n||(n="utf8"),!a.isEncoding(n))throw new TypeError('"encoding" must be a valid string encoding');var r=0|b(e,n);t=i(t,r);var o=t.write(e,n);return o!==r&&(t=t.slice(0,o)),t}function p(t,e){var n=e.length<0?0:0|m(e.length);t=i(t,n);for(var r=0;r<n;r+=1)t[r]=255&e[r];return t}function d(t,e,n,r){if(e.byteLength,n<0||e.byteLength<n)throw new RangeError("'offset' is out of bounds");if(e.byteLength<n+(r||0))throw new RangeError("'length' is out of bounds");return e=void 0===n&&void 0===r?new Uint8Array(e):void 0===r?new Uint8Array(e,n):new Uint8Array(e,n,r),a.TYPED_ARRAY_SUPPORT?(t=e,t.__proto__=a.prototype):t=p(t,e),t}function h(t,e){if(a.isBuffer(e)){var n=0|m(e.length);return t=i(t,n),0===t.length?t:(e.copy(t,0,0,n),t)}if(e){if("undefined"!=typeof ArrayBuffer&&e.buffer instanceof ArrayBuffer||"length"in e)return"number"!=typeof e.length||H(e.length)?i(t,0):p(t,e);if("Buffer"===e.type&&_(e.data))return p(t,e.data)}throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.")}function m(t){if(t>=o())throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+o().toString(16)+" bytes");return 0|t}function g(t){return+t!=t&&(t=0),a.alloc(+t)}function b(t,e){if(a.isBuffer(t))return t.length;if("undefined"!=typeof ArrayBuffer&&"function"==typeof ArrayBuffer.isView&&(ArrayBuffer.isView(t)||t instanceof ArrayBuffer))return t.byteLength;"string"!=typeof t&&(t=""+t);var n=t.length;if(0===n)return 0;for(var r=!1;;)switch(e){case"ascii":case"latin1":case"binary":return n;case"utf8":case"utf-8":case void 0:return W(t).length;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return 2*n;case"hex":return n>>>1;case"base64":return J(t).length;default:if(r)return W(t).length;e=(""+e).toLowerCase(),r=!0}}function y(t,e,n){var r=!1;if((void 0===e||e<0)&&(e=0),e>this.length)return"";if((void 0===n||n>this.length)&&(n=this.length),n<=0)return"";if(n>>>=0,e>>>=0,n<=e)return"";for(t||(t="utf8");;)switch(t){case"hex":return D(this,e,n);case"utf8":case"utf-8":return E(this,e,n);case"ascii":return B(this,e,n);case"latin1":case"binary":return S(this,e,n);case"base64":return P(this,e,n);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return N(this,e,n);default:if(r)throw new TypeError("Unknown encoding: "+t);t=(t+"").toLowerCase(),r=!0}}function v(t,e,n){var r=t[e];t[e]=t[n],t[n]=r}function A(t,e,n,r,o){if(0===t.length)return-1;if("string"==typeof n?(r=n,n=0):n>2147483647?n=2147483647:n<-2147483648&&(n=-2147483648),n=+n,isNaN(n)&&(n=o?0:t.length-1),n<0&&(n=t.length+n),n>=t.length){if(o)return-1;n=t.length-1}else if(n<0){if(!o)return-1;n=0}if("string"==typeof e&&(e=a.from(e,r)),a.isBuffer(e))return 0===e.length?-1:w(t,e,n,r,o);if("number"==typeof e)return e=255&e,a.TYPED_ARRAY_SUPPORT&&"function"==typeof Uint8Array.prototype.indexOf?o?Uint8Array.prototype.indexOf.call(t,e,n):Uint8Array.prototype.lastIndexOf.call(t,e,n):w(t,[e],n,r,o);throw new TypeError("val must be string, number or Buffer")}function w(t,e,n,r,o){function i(t,e){return 1===a?t[e]:t.readUInt16BE(e*a)}var a=1,s=t.length,c=e.length;if(void 0!==r&&(r=String(r).toLowerCase(),"ucs2"===r||"ucs-2"===r||"utf16le"===r||"utf-16le"===r)){if(t.length<2||e.length<2)return-1;a=2,s/=2,c/=2,n/=2}var l;if(o){var u=-1;for(l=n;l<s;l++)if(i(t,l)===i(e,u===-1?0:l-u)){if(u===-1&&(u=l),l-u+1===c)return u*a}else u!==-1&&(l-=l-u),u=-1}else for(n+c>s&&(n=s-c),l=n;l>=0;l--){for(var f=!0,p=0;p<c;p++)if(i(t,l+p)!==i(e,p)){f=!1;break}if(f)return l}return-1}function x(t,e,n,r){n=Number(n)||0;var o=t.length-n;r?(r=Number(r),r>o&&(r=o)):r=o;var i=e.length;if(i%2!==0)throw new TypeError("Invalid hex string");r>i/2&&(r=i/2);for(var a=0;a<r;++a){var s=parseInt(e.substr(2*a,2),16);if(isNaN(s))return a;t[n+a]=s}return a}function k(t,e,n,r){return q(W(e,t.length-n),t,n,r)}function M(t,e,n,r){return q(U(e),t,n,r)}function T(t,e,n,r){return M(t,e,n,r)}function R(t,e,n,r){return q(J(e),t,n,r)}function O(t,e,n,r){return q(Z(e,t.length-n),t,n,r)}function P(t,e,n){return 0===e&&n===t.length?Q.fromByteArray(t):Q.fromByteArray(t.slice(e,n))}function E(t,e,n){n=Math.min(t.length,n);for(var r=[],o=e;o<n;){var i=t[o],a=null,s=i>239?4:i>223?3:i>191?2:1;if(o+s<=n){var c,l,u,f;switch(s){case 1:i<128&&(a=i);break;case 2:c=t[o+1],128===(192&c)&&(f=(31&i)<<6|63&c,f>127&&(a=f));break;case 3:c=t[o+1],l=t[o+2],128===(192&c)&&128===(192&l)&&(f=(15&i)<<12|(63&c)<<6|63&l,f>2047&&(f<55296||f>57343)&&(a=f));break;case 4:c=t[o+1],l=t[o+2],u=t[o+3],128===(192&c)&&128===(192&l)&&128===(192&u)&&(f=(15&i)<<18|(63&c)<<12|(63&l)<<6|63&u,f>65535&&f<1114112&&(a=f))}}null===a?(a=65533,s=1):a>65535&&(a-=65536,r.push(a>>>10&1023|55296),a=56320|1023&a),r.push(a),o+=s}return j(r)}function j(t){var e=t.length;if(e<=tt)return String.fromCharCode.apply(String,t);for(var n="",r=0;r<e;)n+=String.fromCharCode.apply(String,t.slice(r,r+=tt));return n}function B(t,e,n){var r="";n=Math.min(t.length,n);for(var o=e;o<n;++o)r+=String.fromCharCode(127&t[o]);return r}function S(t,e,n){var r="";n=Math.min(t.length,n);for(var o=e;o<n;++o)r+=String.fromCharCode(t[o]);return r}function D(t,e,n){var r=t.length;(!e||e<0)&&(e=0),(!n||n<0||n>r)&&(n=r);for(var o="",i=e;i<n;++i)o+=X(t[i]);return o}function N(t,e,n){for(var r=t.slice(e,n),o="",i=0;i<r.length;i+=2)o+=String.fromCharCode(r[i]+256*r[i+1]);return o}function F(t,e,n){if(t%1!==0||t<0)throw new RangeError("offset is not uint");if(t+e>n)throw new RangeError("Trying to access beyond buffer length")}function Y(t,e,n,r,o,i){if(!a.isBuffer(t))throw new TypeError('"buffer" argument must be a Buffer instance');if(e>o||e<i)throw new RangeError('"value" argument is out of bounds');if(n+r>t.length)throw new RangeError("Index out of range")}function z(t,e,n,r){e<0&&(e=65535+e+1);for(var o=0,i=Math.min(t.length-n,2);o<i;++o)t[n+o]=(e&255<<8*(r?o:1-o))>>>8*(r?o:1-o)}function L(t,e,n,r){e<0&&(e=4294967295+e+1);for(var o=0,i=Math.min(t.length-n,4);o<i;++o)t[n+o]=e>>>8*(r?o:3-o)&255}function I(t,e,n,r,o,i){if(n+r>t.length)throw new RangeError("Index out of range");if(n<0)throw new RangeError("Index out of range")}function K(t,e,n,r,o){return o||I(t,e,n,4,3.4028234663852886e38,-3.4028234663852886e38),$.write(t,e,n,r,23,4),n+4}function G(t,e,n,r,o){return o||I(t,e,n,8,1.7976931348623157e308,-1.7976931348623157e308),$.write(t,e,n,r,52,8),n+8}function C(t){if(t=V(t).replace(et,""),t.length<2)return"";for(;t.length%4!==0;)t+="=";return t}function V(t){return t.trim?t.trim():t.replace(/^\s+|\s+$/g,"")}function X(t){return t<16?"0"+t.toString(16):t.toString(16)}function W(t,e){e=e||1/0;for(var n,r=t.length,o=null,i=[],a=0;a<r;++a){if(n=t.charCodeAt(a),n>55295&&n<57344){if(!o){if(n>56319){(e-=3)>-1&&i.push(239,191,189);continue}if(a+1===r){(e-=3)>-1&&i.push(239,191,189);continue}o=n;continue}if(n<56320){(e-=3)>-1&&i.push(239,191,189),o=n;continue}n=(o-55296<<10|n-56320)+65536}else o&&(e-=3)>-1&&i.push(239,191,189);if(o=null,n<128){if((e-=1)<0)break;i.push(n)}else if(n<2048){if((e-=2)<0)break;i.push(n>>6|192,63&n|128)}else if(n<65536){if((e-=3)<0)break;i.push(n>>12|224,n>>6&63|128,63&n|128)}else{if(!(n<1114112))throw new Error("Invalid code point");if((e-=4)<0)break;i.push(n>>18|240,n>>12&63|128,n>>6&63|128,63&n|128)}}return i}function U(t){for(var e=[],n=0;n<t.length;++n)e.push(255&t.charCodeAt(n));return e}function Z(t,e){for(var n,r,o,i=[],a=0;a<t.length&&!((e-=2)<0);++a)n=t.charCodeAt(a),r=n>>8,o=n%256,i.push(o),i.push(r);return i}function J(t){return Q.toByteArray(C(t))}function q(t,e,n,r){for(var o=0;o<r&&!(o+n>=e.length||o>=t.length);++o)e[o+n]=t[o];return o}function H(t){return t!==t}var Q=t("base64-js"),$=t("ieee754"),_=t("isarray");n.Buffer=a,n.SlowBuffer=g,n.INSPECT_MAX_BYTES=50,a.TYPED_ARRAY_SUPPORT=void 0!==e.TYPED_ARRAY_SUPPORT?e.TYPED_ARRAY_SUPPORT:r(),n.kMaxLength=o(),a.poolSize=8192,a._augment=function(t){return t.__proto__=a.prototype,t},a.from=function(t,e,n){return s(null,t,e,n)},a.TYPED_ARRAY_SUPPORT&&(a.prototype.__proto__=Uint8Array.prototype,a.__proto__=Uint8Array,"undefined"!=typeof Symbol&&Symbol.species&&a[Symbol.species]===a&&Object.defineProperty(a,Symbol.species,{value:null,configurable:!0})),a.alloc=function(t,e,n){return l(null,t,e,n)},a.allocUnsafe=function(t){return u(null,t)},a.allocUnsafeSlow=function(t){return u(null,t)},a.isBuffer=function(t){return!(null==t||!t._isBuffer)},a.compare=function(t,e){if(!a.isBuffer(t)||!a.isBuffer(e))throw new TypeError("Arguments must be Buffers");if(t===e)return 0;for(var n=t.length,r=e.length,o=0,i=Math.min(n,r);o<i;++o)if(t[o]!==e[o]){n=t[o],r=e[o];break}return n<r?-1:r<n?1:0},a.isEncoding=function(t){switch(String(t).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"latin1":case"binary":case"base64":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},a.concat=function(t,e){if(!_(t))throw new TypeError('"list" argument must be an Array of Buffers');if(0===t.length)return a.alloc(0);var n;if(void 0===e)for(e=0,n=0;n<t.length;++n)e+=t[n].length;var r=a.allocUnsafe(e),o=0;for(n=0;n<t.length;++n){var i=t[n];if(!a.isBuffer(i))throw new TypeError('"list" argument must be an Array of Buffers');i.copy(r,o),o+=i.length}return r},a.byteLength=b,a.prototype._isBuffer=!0,a.prototype.swap16=function(){var t=this.length;if(t%2!==0)throw new RangeError("Buffer size must be a multiple of 16-bits");for(var e=0;e<t;e+=2)v(this,e,e+1);return this},a.prototype.swap32=function(){var t=this.length;if(t%4!==0)throw new RangeError("Buffer size must be a multiple of 32-bits");for(var e=0;e<t;e+=4)v(this,e,e+3),v(this,e+1,e+2);return this},a.prototype.swap64=function(){var t=this.length;if(t%8!==0)throw new RangeError("Buffer size must be a multiple of 64-bits");for(var e=0;e<t;e+=8)v(this,e,e+7),v(this,e+1,e+6),v(this,e+2,e+5),v(this,e+3,e+4);return this},a.prototype.toString=function(){var t=0|this.length;return 0===t?"":0===arguments.length?E(this,0,t):y.apply(this,arguments)},a.prototype.equals=function(t){if(!a.isBuffer(t))throw new TypeError("Argument must be a Buffer");return this===t||0===a.compare(this,t)},a.prototype.inspect=function(){var t="",e=n.INSPECT_MAX_BYTES;return this.length>0&&(t=this.toString("hex",0,e).match(/.{2}/g).join(" "),this.length>e&&(t+=" ... ")),"<Buffer "+t+">"},a.prototype.compare=function(t,e,n,r,o){if(!a.isBuffer(t))throw new TypeError("Argument must be a Buffer");if(void 0===e&&(e=0),void 0===n&&(n=t?t.length:0),void 0===r&&(r=0),void 0===o&&(o=this.length),e<0||n>t.length||r<0||o>this.length)throw new RangeError("out of range index");if(r>=o&&e>=n)return 0;if(r>=o)return-1;if(e>=n)return 1;if(e>>>=0,n>>>=0,r>>>=0,o>>>=0,this===t)return 0;for(var i=o-r,s=n-e,c=Math.min(i,s),l=this.slice(r,o),u=t.slice(e,n),f=0;f<c;++f)if(l[f]!==u[f]){i=l[f],s=u[f];break}return i<s?-1:s<i?1:0},a.prototype.includes=function(t,e,n){return this.indexOf(t,e,n)!==-1},a.prototype.indexOf=function(t,e,n){return A(this,t,e,n,!0)},a.prototype.lastIndexOf=function(t,e,n){return A(this,t,e,n,!1)},a.prototype.write=function(t,e,n,r){if(void 0===e)r="utf8",n=this.length,e=0;else if(void 0===n&&"string"==typeof e)r=e,n=this.length,e=0;else{if(!isFinite(e))throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");e=0|e,isFinite(n)?(n=0|n,void 0===r&&(r="utf8")):(r=n,n=void 0)}var o=this.length-e;if((void 0===n||n>o)&&(n=o),t.length>0&&(n<0||e<0)||e>this.length)throw new RangeError("Attempt to write outside buffer bounds");r||(r="utf8");for(var i=!1;;)switch(r){case"hex":return x(this,t,e,n);case"utf8":case"utf-8":return k(this,t,e,n);case"ascii":return M(this,t,e,n);case"latin1":case"binary":return T(this,t,e,n);case"base64":return R(this,t,e,n);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return O(this,t,e,n);default:if(i)throw new TypeError("Unknown encoding: "+r);r=(""+r).toLowerCase(),i=!0}},a.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};var tt=4096;a.prototype.slice=function(t,e){var n=this.length;t=~~t,e=void 0===e?n:~~e,t<0?(t+=n,t<0&&(t=0)):t>n&&(t=n),e<0?(e+=n,e<0&&(e=0)):e>n&&(e=n),e<t&&(e=t);var r;if(a.TYPED_ARRAY_SUPPORT)r=this.subarray(t,e),r.__proto__=a.prototype;else{var o=e-t;r=new a(o,(void 0));for(var i=0;i<o;++i)r[i]=this[i+t]}return r},a.prototype.readUIntLE=function(t,e,n){t=0|t,e=0|e,n||F(t,e,this.length);for(var r=this[t],o=1,i=0;++i<e&&(o*=256);)r+=this[t+i]*o;return r},a.prototype.readUIntBE=function(t,e,n){t=0|t,e=0|e,n||F(t,e,this.length);for(var r=this[t+--e],o=1;e>0&&(o*=256);)r+=this[t+--e]*o;return r},a.prototype.readUInt8=function(t,e){return e||F(t,1,this.length),this[t]},a.prototype.readUInt16LE=function(t,e){return e||F(t,2,this.length),this[t]|this[t+1]<<8},a.prototype.readUInt16BE=function(t,e){return e||F(t,2,this.length),this[t]<<8|this[t+1]},a.prototype.readUInt32LE=function(t,e){return e||F(t,4,this.length),(this[t]|this[t+1]<<8|this[t+2]<<16)+16777216*this[t+3]},a.prototype.readUInt32BE=function(t,e){return e||F(t,4,this.length),16777216*this[t]+(this[t+1]<<16|this[t+2]<<8|this[t+3])},a.prototype.readIntLE=function(t,e,n){t=0|t,e=0|e,n||F(t,e,this.length);for(var r=this[t],o=1,i=0;++i<e&&(o*=256);)r+=this[t+i]*o;return o*=128,r>=o&&(r-=Math.pow(2,8*e)),r},a.prototype.readIntBE=function(t,e,n){t=0|t,e=0|e,n||F(t,e,this.length);for(var r=e,o=1,i=this[t+--r];r>0&&(o*=256);)i+=this[t+--r]*o;return o*=128,i>=o&&(i-=Math.pow(2,8*e)),i},a.prototype.readInt8=function(t,e){return e||F(t,1,this.length),128&this[t]?(255-this[t]+1)*-1:this[t]},a.prototype.readInt16LE=function(t,e){e||F(t,2,this.length);var n=this[t]|this[t+1]<<8;return 32768&n?4294901760|n:n},a.prototype.readInt16BE=function(t,e){e||F(t,2,this.length);var n=this[t+1]|this[t]<<8;return 32768&n?4294901760|n:n},a.prototype.readInt32LE=function(t,e){return e||F(t,4,this.length),this[t]|this[t+1]<<8|this[t+2]<<16|this[t+3]<<24},a.prototype.readInt32BE=function(t,e){return e||F(t,4,this.length),this[t]<<24|this[t+1]<<16|this[t+2]<<8|this[t+3]},a.prototype.readFloatLE=function(t,e){return e||F(t,4,this.length),$.read(this,t,!0,23,4)},a.prototype.readFloatBE=function(t,e){return e||F(t,4,this.length),$.read(this,t,!1,23,4)},a.prototype.readDoubleLE=function(t,e){return e||F(t,8,this.length),$.read(this,t,!0,52,8)},a.prototype.readDoubleBE=function(t,e){return e||F(t,8,this.length),$.read(this,t,!1,52,8)},a.prototype.writeUIntLE=function(t,e,n,r){if(t=+t,e=0|e,n=0|n,!r){var o=Math.pow(2,8*n)-1;Y(this,t,e,n,o,0)}var i=1,a=0;for(this[e]=255&t;++a<n&&(i*=256);)this[e+a]=t/i&255;return e+n},a.prototype.writeUIntBE=function(t,e,n,r){if(t=+t,e=0|e,n=0|n,!r){var o=Math.pow(2,8*n)-1;Y(this,t,e,n,o,0)}var i=n-1,a=1;for(this[e+i]=255&t;--i>=0&&(a*=256);)this[e+i]=t/a&255;return e+n},a.prototype.writeUInt8=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,1,255,0),a.TYPED_ARRAY_SUPPORT||(t=Math.floor(t)),this[e]=255&t,e+1},a.prototype.writeUInt16LE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,2,65535,0),a.TYPED_ARRAY_SUPPORT?(this[e]=255&t,this[e+1]=t>>>8):z(this,t,e,!0),e+2},a.prototype.writeUInt16BE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,2,65535,0),a.TYPED_ARRAY_SUPPORT?(this[e]=t>>>8,this[e+1]=255&t):z(this,t,e,!1),e+2},a.prototype.writeUInt32LE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,4,4294967295,0),a.TYPED_ARRAY_SUPPORT?(this[e+3]=t>>>24,this[e+2]=t>>>16,this[e+1]=t>>>8,this[e]=255&t):L(this,t,e,!0),e+4},a.prototype.writeUInt32BE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,4,4294967295,0),a.TYPED_ARRAY_SUPPORT?(this[e]=t>>>24,this[e+1]=t>>>16,this[e+2]=t>>>8,this[e+3]=255&t):L(this,t,e,!1),e+4},a.prototype.writeIntLE=function(t,e,n,r){if(t=+t,e=0|e,!r){var o=Math.pow(2,8*n-1);Y(this,t,e,n,o-1,-o)}var i=0,a=1,s=0;for(this[e]=255&t;++i<n&&(a*=256);)t<0&&0===s&&0!==this[e+i-1]&&(s=1),this[e+i]=(t/a>>0)-s&255;return e+n},a.prototype.writeIntBE=function(t,e,n,r){if(t=+t,e=0|e,!r){var o=Math.pow(2,8*n-1);Y(this,t,e,n,o-1,-o)}var i=n-1,a=1,s=0;for(this[e+i]=255&t;--i>=0&&(a*=256);)t<0&&0===s&&0!==this[e+i+1]&&(s=1),this[e+i]=(t/a>>0)-s&255;return e+n},a.prototype.writeInt8=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,1,127,-128),a.TYPED_ARRAY_SUPPORT||(t=Math.floor(t)),t<0&&(t=255+t+1),this[e]=255&t,e+1},a.prototype.writeInt16LE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,2,32767,-32768),a.TYPED_ARRAY_SUPPORT?(this[e]=255&t,this[e+1]=t>>>8):z(this,t,e,!0),e+2},a.prototype.writeInt16BE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,2,32767,-32768),a.TYPED_ARRAY_SUPPORT?(this[e]=t>>>8,this[e+1]=255&t):z(this,t,e,!1),e+2},a.prototype.writeInt32LE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,4,2147483647,-2147483648),a.TYPED_ARRAY_SUPPORT?(this[e]=255&t,this[e+1]=t>>>8,this[e+2]=t>>>16,this[e+3]=t>>>24):L(this,t,e,!0),e+4},a.prototype.writeInt32BE=function(t,e,n){return t=+t,e=0|e,n||Y(this,t,e,4,2147483647,-2147483648),t<0&&(t=4294967295+t+1),a.TYPED_ARRAY_SUPPORT?(this[e]=t>>>24,this[e+1]=t>>>16,this[e+2]=t>>>8,this[e+3]=255&t):L(this,t,e,!1),e+4},a.prototype.writeFloatLE=function(t,e,n){return K(this,t,e,!0,n)},a.prototype.writeFloatBE=function(t,e,n){return K(this,t,e,!1,n)},a.prototype.writeDoubleLE=function(t,e,n){return G(this,t,e,!0,n)},a.prototype.writeDoubleBE=function(t,e,n){return G(this,t,e,!1,n)},a.prototype.copy=function(t,e,n,r){if(n||(n=0),r||0===r||(r=this.length),e>=t.length&&(e=t.length),e||(e=0),r>0&&r<n&&(r=n),r===n)return 0;if(0===t.length||0===this.length)return 0;if(e<0)throw new RangeError("targetStart out of bounds");if(n<0||n>=this.length)throw new RangeError("sourceStart out of bounds");if(r<0)throw new RangeError("sourceEnd out of bounds");r>this.length&&(r=this.length),t.length-e<r-n&&(r=t.length-e+n);var o,i=r-n;if(this===t&&n<e&&e<r)for(o=i-1;o>=0;--o)t[o+e]=this[o+n];else if(i<1e3||!a.TYPED_ARRAY_SUPPORT)for(o=0;o<i;++o)t[o+e]=this[o+n];else Uint8Array.prototype.set.call(t,this.subarray(n,n+i),e);return i},a.prototype.fill=function(t,e,n,r){if("string"==typeof t){if("string"==typeof e?(r=e,e=0,n=this.length):"string"==typeof n&&(r=n,n=this.length),1===t.length){var o=t.charCodeAt(0);o<256&&(t=o)}if(void 0!==r&&"string"!=typeof r)throw new TypeError("encoding must be a string");if("string"==typeof r&&!a.isEncoding(r))throw new TypeError("Unknown encoding: "+r)}else"number"==typeof t&&(t=255&t);if(e<0||this.length<e||this.length<n)throw new RangeError("Out of range index");if(n<=e)return this;e>>>=0,n=void 0===n?this.length:n>>>0,t||(t=0);var i;if("number"==typeof t)for(i=e;i<n;++i)this[i]=t;else{var s=a.isBuffer(t)?t:W(new a(t,r).toString()),c=s.length;for(i=0;i<n-e;++i)this[i+e]=s[i%c]}return this};var et=/[^+\/0-9A-Za-z-_]/g}).call(this)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},t("buffer").Buffer)},{"base64-js":1,buffer:2,ieee754:4,isarray:5}],3:[function(e,n,r){(function(e){(function(){/*!
	 * @license deepcopy.js Copyright(c) 2013 sasa+1
	 * https://github.com/sasaplus1/deepcopy.js
	 * Released under the MIT license.
	 */
	!function(e,o){"object"==typeof r&&"object"==typeof n?n.exports=o():"function"==typeof t&&t.amd?t([],o):"object"==typeof r?r.deepcopy=o():e.deepcopy=o()}(this,function(){return function(t){function e(r){if(n[r])return n[r].exports;var o=n[r]={exports:{},id:r,loaded:!1};return t[r].call(o.exports,o,o.exports,e),o.loaded=!0,o.exports}var n={};return e.m=t,e.c=n,e.p="",e(0)}([function(t,e,n){"use strict";t.exports=n(3)},function(t,n){"use strict";function r(t,e){if("[object Array]"!==o.call(t))throw new TypeError("array must be an Array");var n=void 0,r=void 0,i=void 0;for(n=0,r=t.length;r>n;++n)if(i=t[n],i===e||i!==i&&e!==e)return n;return-1}n.__esModule=!0;var o=Object.prototype.toString,i="undefined"!=typeof e?function(t){return e.isBuffer(t)}:function(){return!1},a="function"==typeof Object.keys?function(t){return Object.keys(t)}:function(t){var e=typeof t;if(null===t||"function"!==e&&"object"!==e)throw new TypeError("obj must be an Object");var n=[],r=void 0;for(r in t)Object.prototype.hasOwnProperty.call(t,r)&&n.push(r);return n},s="function"==typeof Symbol?function(t){return Object.getOwnPropertySymbols(t)}:function(){return[]};n.getKeys=a,n.getSymbols=s,n.indexOf=r,n.isBuffer=i},function(t,n,r){"use strict";function o(t,e){var n=a(t);return null!==n?n:i(t,e)}function i(t,n){if("function"!=typeof n)throw new TypeError("customizer is must be a Function");if("function"==typeof t){var r=String(t);return/^\s*function\s*\S*\([^\)]*\)\s*{\s*\[native code\]\s*}/.test(r)?t:new Function("return "+String(r))()}var o=c.call(t);if("[object Array]"===o)return[];if("[object Object]"===o&&t.constructor===Object)return{};if("[object Date]"===o)return new Date(t.getTime());if("[object RegExp]"===o){var i=String(t),a=i.lastIndexOf("/");return new RegExp(i.slice(1,a),i.slice(a+1))}if((0,s.isBuffer)(t)){var l=new e(t.length);return t.copy(l),l}var u=n(t);return void 0!==u?u:null}function a(t){var e=typeof t;return null!==t&&"object"!==e&&"function"!==e?t:null}n.__esModule=!0,n.copyValue=n.copyCollection=n.copy=void 0;var s=r(1),c=Object.prototype.toString;n.copy=o,n.copyCollection=i,n.copyValue=a},function(t,e,n){"use strict";function r(t){}function o(t){var e=arguments.length<=1||void 0===arguments[1]?r:arguments[1];if(null===t)return null;var n=(0,a.copyValue)(t);if(null!==n)return n;var o=(0,a.copyCollection)(t,e),s=null!==o?o:t,c=[t],l=[s];return i(t,e,s,c,l)}function i(t,e,n,r,o){if(null===t)return null;var c=(0,a.copyValue)(t);if(null!==c)return c;var l=(0,s.getKeys)(t).concat((0,s.getSymbols)(t)),u=void 0,f=void 0,p=void 0,d=void 0,h=void 0,m=void 0,g=void 0,b=void 0;for(u=0,f=l.length;f>u;++u)p=l[u],d=t[p],h=(0,s.indexOf)(r,d),m=void 0,g=void 0,b=void 0,-1===h?(m=(0,a.copy)(d,e),g=null!==m?m:d,null!==d&&/^(?:function|object)$/.test(typeof d)&&(r.push(d),o.push(g))):b=o[h],n[p]=b||i(d,e,g,r,o);return n}e.__esModule=!0;var a=n(2),s=n(1);e["default"]=o,t.exports=e["default"]}])})}).call(this)}).call(this,e("buffer").Buffer)},{buffer:2}],4:[function(t,e,n){/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
	n.read=function(t,e,n,r,o){var i,a,s=8*o-r-1,c=(1<<s)-1,l=c>>1,u=-7,f=n?o-1:0,p=n?-1:1,d=t[e+f];for(f+=p,i=d&(1<<-u)-1,d>>=-u,u+=s;u>0;i=256*i+t[e+f],f+=p,u-=8);for(a=i&(1<<-u)-1,i>>=-u,u+=r;u>0;a=256*a+t[e+f],f+=p,u-=8);if(0===i)i=1-l;else{if(i===c)return a?NaN:(d?-1:1)*(1/0);a+=Math.pow(2,r),i-=l}return(d?-1:1)*a*Math.pow(2,i-r)},n.write=function(t,e,n,r,o,i){var a,s,c,l=8*i-o-1,u=(1<<l)-1,f=u>>1,p=23===o?Math.pow(2,-24)-Math.pow(2,-77):0,d=r?0:i-1,h=r?1:-1,m=e<0||0===e&&1/e<0?1:0;for(e=Math.abs(e),isNaN(e)||e===1/0?(s=isNaN(e)?1:0,a=u):(a=Math.floor(Math.log(e)/Math.LN2),e*(c=Math.pow(2,-a))<1&&(a--,c*=2),e+=a+f>=1?p/c:p*Math.pow(2,1-f),e*c>=2&&(a++,c/=2),a+f>=u?(s=0,a=u):a+f>=1?(s=(e*c-1)*Math.pow(2,o),a+=f):(s=e*Math.pow(2,f-1)*Math.pow(2,o),a=0));o>=8;t[n+d]=255&s,d+=h,s/=256,o-=8);for(a=a<<o|s,l+=o;l>0;t[n+d]=255&a,d+=h,a/=256,l-=8);t[n+d-h]|=128*m}},{}],5:[function(t,e,n){var r={}.toString;e.exports=Array.isArray||function(t){return"[object Array]"==r.call(t)}},{}],6:[function(t,e,n){function r(t){return/^[a-z_$][0-9a-z_$]*$/gi.test(t)&&!i.test(t)}function o(t){if(a)return t.toString();var e=t.source.replace(/\//g,function(t,e,n){return 0===e||"\\"!==n[e-1]?"\\/":"/"}),n=(t.global&&"g"||"")+(t.ignoreCase&&"i"||"")+(t.multiline&&"m"||"");return"/"+e+"/"+n}/* toSource by Marcello Bastea-Forte - zlib license */
	e.exports=function(t,e,n,i){function a(t,e,n,i,s){function c(t){return n.slice(1)+t.join(","+(n&&"\n")+l)+(n?" ":"")}var l=i+n;switch(t=e?e(t):t,typeof t){case"string":return JSON.stringify(t);case"boolean":case"number":case"undefined":return""+t;case"function":return t.toString()}if(null===t)return"null";if(t instanceof RegExp)return o(t);if(t instanceof Date)return"new Date("+t.getTime()+")";var u=s.indexOf(t)+1;if(u>0)return"{$circularReference:"+u+"}";if(s.push(t),Array.isArray(t))return"["+c(t.map(function(t){return a(t,e,n,l,s.slice())}))+"]";var f=Object.keys(t);return f.length?"{"+c(f.map(function(o){return(r(o)?o:JSON.stringify(o))+":"+a(t[o],e,n,l,s.slice())}))+"}":"{}"}var s=[];return a(t,e,void 0===n?"  ":n||"",i||"",s)};var i=/^(abstract|boolean|break|byte|case|catch|char|class|const|continue|debugger|default|delete|do|double|else|enum|export|extends|false|final|finally|float|for|function|goto|if|implements|import|in|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|typeof|undefined|var|void|volatile|while|with)$/,a="\\/"===new RegExp("/").source},{}],7:[function(t,e,n){e.exports={name:"@rebble/clay",version:"1.0.8",description:"Pebble Config Framework",scripts:{"test-travis":"./node_modules/.bin/gulp && ./node_modules/.bin/karma start ./test/karma.conf.js --single-run --browsers chromeTravisCI","test-debug":"(export DEBUG=true && ./node_modules/.bin/gulp && ./node_modules/.bin/karma start ./test/karma.conf.js --no-single-run)",test:"./node_modules/.bin/gulp && ./node_modules/.bin/karma start ./test/karma.conf.js --single-run",lint:"./node_modules/.bin/eslint ./",build:"gulp",dev:"gulp dev","pebble-clean":"rm -rf tmp src/js/index.js && pebble clean","pebble-publish":"npm run pebble-clean && npm run build && pebble build && pebble package publish && npm run pebble-clean","pebble-build":"npm run build && pebble build"},repository:{type:"git",url:"git+https://github.com/pebble-dev/clay.git"},keywords:["pebble","config","configuration","pebble-package"],author:"Pebble Technology",license:"MIT",bugs:{url:"https://github.com/pebble-dev/clay/issues"},pebble:{projectType:"package",sdkVersion:"3",targetPlatforms:["aplite","basalt","chalk","diorite","emery","flint","gabbro"],resources:{media:[]},capabilities:["configurable"]},homepage:"https://github.com/pebble-dev/clay#readme",devDependencies:{autoprefixer:"^10.4.23",bourbon:"^4.2.6",browserify:"^13.0.0","browserify-istanbul":"^3.0.1",chai:"^3.4.1",deamdify:"^0.2.0",deepcopy:"^0.6.1",del:"^2.0.2",eslint:"^1.5.1","eslint-config-pebble":"^1.2.0","eslint-plugin-standard":"^1.3.1",gulp:"^5.0.1","gulp-autoprefixer":"^3.1.0","gulp-htmlmin":"^1.3.0","gulp-inline":"^0.1.3","gulp-insert":"^0.5.0","gulp-sass":"^6.0.1","gulp-sourcemaps":"^1.6.0","gulp-uglify":"^1.5.2",joi:"^6.10.1",karma:"^6.4.0","karma-browserify":"^8.1.0","karma-chrome-launcher":"^3.2.0","karma-coverage":"^2.2.1","karma-mocha":"^2.0.1","karma-mocha-reporter":"^2.2.5","karma-source-map-support":"^1.4.0","karma-threshold-reporter":"^0.1.15",mocha:"^11.7.5",postcss:"^8.5.6","require-from-string":"^2.0.2",sass:"^1.94.2",sinon:"^1.17.3",stringify:"^3.2.0",through:"^2.3.8",tosource:"^1.0.0","vinyl-buffer":"^1.0.0","vinyl-source-stream":"^2.0.0",watchify:"^3.11.1"}}},{}],8:[function(t,e,n){"use strict";e.exports={name:"button",template:t("../../templates/components/button.tpl"),style:t("../../../tmp/button.css"),manipulator:"button",defaults:{primary:!1,attributes:{},description:""}}},{"../../../tmp/button.css":33,"../../templates/components/button.tpl":21}],9:[function(t,e,n){"use strict";e.exports={name:"checkboxgroup",template:t("../../templates/components/checkboxgroup.tpl"),style:t("../../../tmp/checkboxgroup.css"),manipulator:"checkboxgroup",defaults:{label:"",options:[],description:""}}},{"../../../tmp/checkboxgroup.css":34,"../../templates/components/checkboxgroup.tpl":22}],10:[function(t,e,n){"use strict";e.exports={name:"color",template:t("../../templates/components/color.tpl"),style:t("../../../tmp/color.css"),manipulator:"color",defaults:{label:"",description:""},initialize:function(t,e){function n(t){if("number"==typeof t)t=t.toString(16);else if(!t)return"transparent";return t=r(t),"#"+(f?p[t]:t)}function r(t){for(t=t.toLowerCase();t.length<6;)t="0"+t;return t}function o(t){switch(typeof t){case"number":return r(t.toString(16));case"string":return t.replace(/^#|^0x/,"");default:return t}}function i(t){return t.reduce(function(t,e){return t.concat(e)},[])}function a(t){t=t.replace(/^#|^0x/,"");var e=parseInt(t.slice(0,2),16)/255,n=parseInt(t.slice(2,4),16)/255,r=parseInt(t.slice(4),16)/255;e=e>.04045?Math.pow((e+.055)/1.055,2.4):e/12.92,n=n>.04045?Math.pow((n+.055)/1.055,2.4):n/12.92,r=r>.04045?Math.pow((r+.055)/1.055,2.4):r/12.92;var o=(.4124*e+.3576*n+.1805*r)/.95047,i=(.2126*e+.7152*n+.0722*r)/1,a=(.0193*e+.1192*n+.9505*r)/1.08883;return o=o>.008856?Math.pow(o,1/3):7.787*o+16/116,i=i>.008856?Math.pow(i,1/3):7.787*i+16/116,a=a>.008856?Math.pow(a,1/3):7.787*a+16/116,[116*i-16,500*(o-i),200*(i-a)]}function s(t,e){var n=t[0]-e[0],r=t[1]-e[1],o=t[2]-e[2];return Math.sqrt(Math.pow(n,2)+Math.pow(r,2)+Math.pow(o,2))}function c(){var t=["aplite","diorite","flint"];return!e.meta.activeWatchInfo||2===e.meta.activeWatchInfo.firmware.major||t.indexOf(e.meta.activeWatchInfo.platform)>-1&&!u.config.allowGray?d.BLACK_WHITE:t.indexOf(e.meta.activeWatchInfo.platform)>-1&&u.config.allowGray?d.GRAY:d.COLOR}var l=t.HTML,u=this;u.roundColorToLayout=function(t){var e=o(t);if(m.indexOf(e)===-1){var n=a(e),r=m.map(function(t){var e=a(o(t));return s(n,e)}),i=Math.min.apply(Math,r),c=r.indexOf(i);e=m[c]}return parseInt(e,16)};var f=u.config.sunlight!==!1,p={"000000":"000000","000055":"001e41","0000aa":"004387","0000ff":"0068ca","005500":"2b4a2c","005555":"27514f","0055aa":"16638d","0055ff":"007dce","00aa00":"5e9860","00aa55":"5c9b72","00aaaa":"57a5a2","00aaff":"4cb4db","00ff00":"8ee391","00ff55":"8ee69e","00ffaa":"8aebc0","00ffff":"84f5f1",550000:"4a161b",550055:"482748","5500aa":"40488a","5500ff":"2f6bcc",555500:"564e36",555555:"545454","5555aa":"4f6790","5555ff":"4180d0","55aa00":"759a64","55aa55":"759d76","55aaaa":"71a6a4","55aaff":"69b5dd","55ff00":"9ee594","55ff55":"9de7a0","55ffaa":"9becc2","55ffff":"95f6f2",aa0000:"99353f",aa0055:"983e5a",aa00aa:"955694",aa00ff:"8f74d2",aa5500:"9d5b4d",aa5555:"9d6064",aa55aa:"9a7099",aa55ff:"9587d5",aaaa00:"afa072",aaaa55:"aea382",aaaaaa:"ababab",ffffff:"ffffff",aaaaff:"a7bae2",aaff00:"c9e89d",aaff55:"c9eaa7",aaffaa:"c7f0c8",aaffff:"c3f9f7",ff0000:"e35462",ff0055:"e25874",ff00aa:"e16aa3",ff00ff:"de83dc",ff5500:"e66e6b",ff5555:"e6727c",ff55aa:"e37fa7",ff55ff:"e194df",ffaa00:"f1aa86",ffaa55:"f1ad93",ffaaaa:"efb5b8",ffaaff:"ecc3eb",ffff00:"ffeeab",ffff55:"fff1b5",ffffaa:"fff6d3"},d={COLOR:[[!1,!1,"55ff00","aaff55",!1,"ffff55","ffffaa",!1,!1],[!1,"aaffaa","55ff55","00ff00","aaff00","ffff00","ffaa55","ffaaaa",!1],["55ffaa","00ff55","00aa00","55aa00","aaaa55","aaaa00","ffaa00","ff5500","ff5555"],["aaffff","00ffaa","00aa55","55aa55","005500","555500","aa5500","ff0000","ff0055"],[!1,"55aaaa","00aaaa","005555","ffffff","000000","aa5555","aa0000",!1],["55ffff","00ffff","00aaff","0055aa","aaaaaa","555555","550000","aa0055","ff55aa"],["55aaff","0055ff","0000ff","0000aa","000055","550055","aa00aa","ff00aa","ffaaff"],[!1,"5555aa","5555ff","5500ff","5500aa","aa00ff","ff00ff","ff55ff",!1],[!1,!1,!1,"aaaaff","aa55ff","aa55aa",!1,!1,!1]],GRAY:[["000000","aaaaaa","ffffff"]],BLACK_WHITE:[["000000","ffffff"]]},h=u.config.layout||c();"string"==typeof h&&(h=d[h]),Array.isArray(h[0])||(h=[h]);var m=i(h).map(function(t){return o(t)}).filter(function(t){return t}),g="",b=h.length,y=0;h.forEach(function(t){y=t.length>y?t.length:y});for(var v=100/y,A=100/b,w=u.$element,x=0;x<b;x++)for(var k=0;k<y;k++){var M=o(h[x][k]),T=M?" selectable":"",R=0===x&&0===k||0===x&&!h[x][k-1]||!h[x][k-1]&&!h[x-1][k]?" rounded-tl":"",O=0===x&&!h[x][k+1]||!h[x][k+1]&&!h[x-1][k]?" rounded-tr ":"",P=x===h.length-1&&0===k||x===h.length-1&&!h[x][k-1]||!h[x][k-1]&&!h[x+1][k]?" rounded-bl":"",E=x===h.length-1&&!h[x][k+1]||!h[x][k+1]&&!h[x+1][k]?" rounded-br":"";g+='<i class="color-box '+T+R+O+P+E+'" '+(M?'data-value="'+parseInt(M,16)+'" ':"")+'style="width:'+v+"%; height:"+A+"%; background:"+n(M)+';"></i>'}var j=0;3===y&&(j=5),2===y&&(j=8);var B=j*v/A+"%",S=j+"%";w.select(".color-box-container").add(l(g)).set("$paddingTop",B).set("$paddingRight",S).set("$paddingBottom",B).set("$paddingLeft",S),w.select(".color-box-wrap").set("$paddingBottom",v/A*100+"%");var D=w.select(".value"),N=w.select(".picker-wrap"),F=u.$manipulatorTarget.get("disabled");w.select("label").on("click",function(){F||N.set("show")}),u.on("change",function(){var t=u.get();D.set("$background-color",n(t)),w.select(".color-box").set("-selected"),w.select('.color-box[data-value="'+t+'"]').set("+selected")}),w.select(".color-box.selectable").on("click",function(t){u.set(parseInt(t.target.dataset.value,10)),N.set("-show")}),N.on("click",function(){N.set("-show")}),u.on("disabled",function(){F=!0}),u.on("enabled",function(){F=!1}),u._layout=h}}},{"../../../tmp/color.css":35,"../../templates/components/color.tpl":23}],11:[function(t,e,n){"use strict";e.exports={name:"footer",template:t("../../templates/components/footer.tpl"),manipulator:"html"}},{"../../templates/components/footer.tpl":24}],12:[function(t,e,n){"use strict";e.exports={name:"heading",template:t("../../templates/components/heading.tpl"),manipulator:"html",defaults:{size:4}}},{"../../templates/components/heading.tpl":25}],13:[function(t,e,n){"use strict";e.exports={color:t("./color"),footer:t("./footer"),heading:t("./heading"),input:t("./input"),select:t("./select"),submit:t("./submit"),text:t("./text"),toggle:t("./toggle"),radiogroup:t("./radiogroup"),checkboxgroup:t("./checkboxgroup"),button:t("./button"),slider:t("./slider")}},{"./button":8,"./checkboxgroup":9,"./color":10,"./footer":11,"./heading":12,"./input":14,"./radiogroup":15,"./select":16,"./slider":17,"./submit":18,"./text":19,"./toggle":20}],14:[function(t,e,n){"use strict";e.exports={name:"input",template:t("../../templates/components/input.tpl"),style:t("../../../tmp/input.css"),manipulator:"val",defaults:{label:"",description:"",attributes:{}}}},{"../../../tmp/input.css":37,"../../templates/components/input.tpl":26}],15:[function(t,e,n){"use strict";e.exports={name:"radiogroup",template:t("../../templates/components/radiogroup.tpl"),style:t("../../../tmp/radiogroup.css"),manipulator:"radiogroup",defaults:{label:"",options:[],description:"",attributes:{}}}},{"../../../tmp/radiogroup.css":38,"../../templates/components/radiogroup.tpl":27}],16:[function(t,e,n){"use strict";e.exports={name:"select",template:t("../../templates/components/select.tpl"),style:t("../../../tmp/select.css"),manipulator:"val",defaults:{label:"",options:[],description:"",attributes:{}},initialize:function(){function t(){var t=e.$manipulatorTarget.get("selectedIndex"),r=e.$manipulatorTarget.select("option"),o=r[t]&&r[t].innerHTML;n.set("innerHTML",o)}var e=this,n=e.$element.select(".value");t(),e.on("change",t)}}},{"../../../tmp/select.css":39,"../../templates/components/select.tpl":28}],17:[function(t,e,n){"use strict";e.exports={name:"slider",template:t("../../templates/components/slider.tpl"),style:t("../../../tmp/slider.css"),manipulator:"slider",defaults:{label:"",description:"",min:0,max:100,step:1,attributes:{}},initialize:function(){function t(){var t=e.get().toFixed(e.precision);n.set("value",t),r.set("innerHTML",t)}var e=this,n=e.$element.select(".value"),r=e.$element.select(".value-pad"),o=e.$manipulatorTarget,i=o.get("step");i=i.toString(10).split(".")[1],e.precision=i?i.length:0,e.on("change",t),o.on("|input",t),t(),n.on("|input",function(){r.set("innerHTML",this.get("value"))}),n.on("|change",function(){e.set(this.get("value")),t()})}}},{"../../../tmp/slider.css":40,"../../templates/components/slider.tpl":29}],18:[function(t,e,n){"use strict";e.exports={name:"submit",template:t("../../templates/components/submit.tpl"),style:t("../../../tmp/submit.css"),manipulator:"button",defaults:{attributes:{}}}},{"../../../tmp/submit.css":41,"../../templates/components/submit.tpl":30}],19:[function(t,e,n){"use strict";e.exports={name:"text",template:t("../../templates/components/text.tpl"),manipulator:"html"}},{"../../templates/components/text.tpl":31}],20:[function(t,e,n){"use strict";e.exports={name:"toggle",template:t("../../templates/components/toggle.tpl"),style:t("../../../tmp/toggle.css"),manipulator:"checked",defaults:{label:"",description:"",attributes:{}}}},{"../../../tmp/toggle.css":42,"../../templates/components/toggle.tpl":32}],21:[function(t,e,n){e.exports='<div class="component component-button">\n  <button\n    type="button"\n    data-manipulator-target\n    class="{{primary ? \'primary\' : \'\'}}"\n    {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n  ></button>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],22:[function(t,e,n){e.exports='<div class="component component-checkbox">\n  <span class="label">{{{label}}}</span>\n  <div class="checkbox-group">\n    {{each options}}\n      <label class="tap-highlight">\n        <span class="label">{{{this}}}</span>\n        <input type="checkbox" value="1" name="clay-{{clayId}}" />\n        <i></i>\n      </label>\n    {{/each}}\n  </div>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],23:[function(t,e,n){e.exports='<div class="component component-color">\n  <label class="tap-highlight">\n    <input\n      data-manipulator-target\n      type="hidden"\n    />\n    <span class="label">{{{label}}}</span>\n    <span class="value"></span>\n  </label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n  <div class="picker-wrap">\n    <div class="picker">\n      <div class="color-box-wrap">\n        <div class="color-box-container"></div>\n      </div>\n    </div>\n  </div>\n</div>\n'},{}],24:[function(t,e,n){e.exports='<footer data-manipulator-target class="component component-footer"></footer>\n'},{}],25:[function(t,e,n){e.exports='<div class="component component-heading">\n  <h{{size}} data-manipulator-target></h{{size}}>\n</div>\n'},{}],26:[function(t,e,n){e.exports='<div class="component component-input">\n  <label class="tap-highlight">\n    <span class="label">{{{label}}}</span>\n    <span class="input">\n      <input\n      data-manipulator-target\n        {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n    />\n    </span>\n  </label>\n\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],27:[function(t,e,n){e.exports='<div class="component component-radio">\n  <span class="label">{{{label}}}</span>\n  <div class="radio-group">\n    {{each options}}\n      <label class="tap-highlight">\n        <span class="label">{{{this.label}}}</span>\n        <input\n          type="radio"\n          value="{{this.value}}"\n          name="clay-{{clayId}}"\n          {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n        />\n        <i></i>\n      </label>\n    {{/each}}\n  </div>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],28:[function(t,e,n){e.exports='<div class="component component-select">\n  <label class="tap-highlight">\n    <span class="label">{{{label}}}</span>\n    <span class="value"></span>\n    <select data-manipulator-target {{each key: attributes}}{{key}}="{{this}}"{{/each}}>\n      {{each options}}\n        {{if Array.isArray(this.value)}}\n          <optgroup label="{{this.label}}">\n            {{each this.value}}\n              <option value="{{this.value}}" class="item-select-option">{{this.label}}</option>\n            {{/each}}\n          </optgroup>\n        {{else}}\n          <option value="{{this.value}}" class="item-select-option">{{this.label}}</option>\n        {{/if}}\n      {{/each}}\n    </select>\n  </label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],29:[function(t,e,n){e.exports='<div class="component component-slider">\n  <label class="tap-highlight">\n    <span class="label-container">\n      <span class="label">{{{label}}}</span>\n      <span class="value-wrap">\n        <span class="value-pad"></span>\n        <input type="text" class="value" />\n      </span>\n    </span>\n    <span class="input">\n      <input\n        data-manipulator-target\n        class="slider"\n        type="range"\n        min="{{min}}"\n        max="{{max}}"\n        step="{{step}}"\n        {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n      />\n    </span>\n</label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],30:[function(t,e,n){e.exports='<div class="component component-submit">\n  <button\n    data-manipulator-target\n    type="submit"\n    {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n  ></button>\n</div>\n'},{}],31:[function(t,e,n){e.exports='<div class="component component-text">\n  <p data-manipulator-target></p>\n</div>\n'},{}],32:[function(t,e,n){e.exports='<div class="component component-toggle">\n  <label class="tap-highlight">\n    <span class="label">{{{label}}}</span>\n    <span class="input">\n      <input\n        data-manipulator-target\n        type="checkbox"\n        {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n      />\n      <span class="graphic">\n        <span class="slide"></span>\n        <span class="marker"></span>\n      </span>\n    </span>\n  </label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],33:[function(t,e,n){e.exports=".component-button {\n  text-align: center;\n}\n.section .component-button {\n  padding-bottom: 0;\n}\n.component-button .description {\n  padding-left: 0;\n  padding-right: 0;\n}\n/*# sourceMappingURL=button.css.map */\n"},{}],34:[function(t,e,n){e.exports='.component-checkbox {\n  display: block;\n}\n.section .component-checkbox {\n  padding-right: 0.375rem;\n}\n.component-checkbox > .label {\n  display: block;\n  padding-bottom: 0.35rem;\n}\n.component-checkbox .checkbox-group {\n  padding-bottom: 0.35rem;\n}\n.component-checkbox .checkbox-group label {\n  padding: 0.35rem 0.375rem;\n}\n.component-checkbox .checkbox-group .label {\n  font-size: 0.9em;\n}\n.component-checkbox .checkbox-group input {\n  opacity: 0;\n  position: absolute;\n}\n.component-checkbox .checkbox-group i {\n  display: block;\n  position: relative;\n  border-radius: 0.25rem;\n  width: 1.4rem;\n  height: 1.4rem;\n  border: 0.1176470588rem solid #767676;\n  -webkit-flex-shrink: 0;\n  flex-shrink: 0;\n}\n.component-checkbox .checkbox-group input:checked + i {\n  border-color: #ff4700;\n  background: #ff4700;\n}\n.component-checkbox .checkbox-group input:checked + i:after {\n  content: "";\n  box-sizing: border-box;\n  -webkit-transform: rotate(45deg);\n  transform: rotate(45deg);\n  position: absolute;\n  left: 0.35rem;\n  top: -0.05rem;\n  display: block;\n  width: 0.5rem;\n  height: 1rem;\n  border: 0 solid #ffffff;\n  border-right-width: 0.1176470588rem;\n  border-bottom-width: 0.1176470588rem;\n}\n.component-checkbox .description {\n  padding-left: 0;\n  padding-right: 0;\n}\n/*# sourceMappingURL=checkboxgroup.css.map */\n'},{}],35:[function(t,e,n){e.exports=".section .component-color {\n  padding: 0;\n}\n.component-color .value {\n  width: 2.2652rem;\n  height: 1.4rem;\n  border-radius: 0.7rem;\n  box-shadow: 0 0.1rem 0.1rem #2f2f2f;\n  display: block;\n  background: #000;\n}\n.component-color .picker-wrap {\n  left: 0;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  position: fixed;\n  padding: 0.7rem 0.375rem;\n  background: rgba(0, 0, 0, 0.65);\n  opacity: 0;\n  -webkit-transition: opacity 100ms ease-in 175ms;\n  transition: opacity 100ms ease-in 175ms;\n  pointer-events: none;\n  z-index: 100;\n  display: -webkit-box;\n  display: -webkit-flex;\n  display: flex;\n  -webkit-box-orient: vertical;\n  -webkit-box-direction: normal;\n  -webkit-flex-direction: column;\n  flex-direction: column;\n  -webkit-box-pack: center;\n  -webkit-justify-content: center;\n  justify-content: center;\n  -webkit-box-align: center;\n  -webkit-align-items: center;\n  align-items: center;\n}\n.component-color .picker-wrap .picker {\n  padding: 0.7rem 0.75rem;\n  background: #484848;\n  box-shadow: 0 0.1764705882rem 0.8823529412rem rgba(0, 0, 0, 0.4);\n  border-radius: 0.25rem;\n  width: 100%;\n  max-width: 26rem;\n  overflow: auto;\n}\n.component-color .picker-wrap.show {\n  -webkit-transition-delay: 0ms;\n  transition-delay: 0ms;\n  pointer-events: auto;\n  opacity: 1;\n}\n.component-color .color-box-wrap {\n  box-sizing: border-box;\n  position: relative;\n  height: 0;\n  width: 100%;\n  padding: 0 0 100% 0;\n}\n.component-color .color-box-wrap .color-box-container {\n  position: absolute;\n  height: 99.97%;\n  width: 100%;\n  left: 0;\n  top: 0;\n}\n.component-color .color-box-wrap .color-box-container .color-box {\n  float: left;\n  cursor: pointer;\n  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);\n}\n.component-color .color-box-wrap .color-box-container .color-box.rounded-tl {\n  border-top-left-radius: 0.25rem;\n}\n.component-color .color-box-wrap .color-box-container .color-box.rounded-tr {\n  border-top-right-radius: 0.25rem;\n}\n.component-color .color-box-wrap .color-box-container .color-box.rounded-bl {\n  border-bottom-left-radius: 0.25rem;\n}\n.component-color .color-box-wrap .color-box-container .color-box.rounded-br {\n  border-bottom-right-radius: 0.25rem;\n}\n.component-color .color-box-wrap .color-box-container .color-box.selected {\n  -webkit-transform: scale(1.1);\n  transform: scale(1.1);\n  border-radius: 0.25rem;\n  box-shadow: #111 0 0 0.24rem;\n  position: relative;\n  z-index: 100;\n}\n/*# sourceMappingURL=color.css.map */\n"},{}],36:[function(t,e,n){e.exports='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>@font-face{font-family:PFDinDisplayProRegularWebfont;src:url(data:application/font-woff;charset=utf-8;base64,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) format("woff");font-weight:400;font-style:normal}a,abbr,acronym,address,applet,article,aside,audio,b,big,blockquote,body,canvas,caption,center,cite,code,dd,del,details,dfn,div,dl,dt,em,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,html,i,iframe,img,ins,kbd,label,legend,li,mark,menu,nav,object,ol,p,pre,q,s,samp,section,small,span,strike,strong,sub,summary,sup,table,tbody,td,tfoot,th,thead,time,tr,tt,u,ul,var,video{margin:0;padding:0;border:0;outline:0;font-size:100%;font:inherit;vertical-align:baseline}button,input,textarea{outline:0}article,aside,details,figcaption,figure,footer,header,hgroup,menu,nav,section{display:block}body{line-height:1}ol,ul{list-style:none}blockquote:after,blockquote:before,q:after,q:before{content:"";content:none}html{box-sizing:border-box}*,:after,:before{box-sizing:inherit}body,html{font-weight:400;font-family:PFDinDisplayPro-Regular,PFDinDisplayProRegularWebfont,sans-serif;-webkit-font-smoothing:antialiased;font-size:17px;line-height:1.4;height:100%;color:#fff}body.platform-ios,html.platform-ios{font-size:16px}body{background-color:#333;padding:0 .75rem .7rem}em{font-style:italic}strong{font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif}.platform-android strong{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}strong{color:#ff4700}a{color:#858585}a:hover{color:inherit}h1,h2,h3,h4{text-transform:uppercase;font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif}.platform-android h1,.platform-android h2,.platform-android h3,.platform-android h4{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}h1,h2,h3,h4{text-transform:uppercase;position:relative;top:.05rem;line-height:.9}h1{font-size:2rem;line-height:2.8rem}h2{font-size:1.8rem;line-height:2.8rem}h3{font-size:1.5rem;line-height:2.8rem}h4{font-size:1.2rem;line-height:1.4rem}h5{font-size:1rem;line-height:1.4rem}h6{font-size:.8rem;line-height:1.4rem}input{font-family:inherit;font-size:inherit;line-height:inherit}label{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center;padding:.7rem .75rem}label .input{white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;max-width:50%;margin-left:.75rem}label.invalid .input:after{content:"!";display:inline-block;color:#fff;background:#ff4700;border-radius:.55rem;width:1.1rem;text-align:center;height:1.1rem;font-size:.825rem;vertical-align:middle;line-height:1.1rem;box-shadow:0 .1rem .1rem #2f2f2f;font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif}.platform-android label.invalid .input:after{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}label.invalid .input:after{-webkit-box-flex:0;-webkit-flex:0 0 1.1rem;flex:0 0 1.1rem;margin-left:.3rem}.hide{display:none!important}.tap-highlight{-webkit-tap-highlight-color:rgba(255,255,255,.1)}.tap-highlight:active{background-color:rgba(255,255,255,.1)}.tap-highlight{border-radius:.25rem}.component{padding-top:.7rem}.component.disabled{pointer-events:none}.component.disabled>*{opacity:.25}.section{background:#484848;border-radius:.25rem;box-shadow:#2f2f2f 0 .15rem .25rem}.section>.component{padding-bottom:.7rem;padding-right:.75rem;padding-left:.75rem;position:relative;margin-top:1rem}.section>.component:not(.hide)~.component{margin-top:0}.section>.component:first-child:after{display:none}.section>.component:after{content:"";background:#666;display:block;position:absolute;top:0;left:.375rem;right:.375rem;height:1px;pointer-events:none}.section>.component:not(.hide):after{display:none}.section>.component:not(.hide)~.component:not(.hide):after{display:block}.section>.component-heading:first-child{background:#414141;border-radius:.25rem .25rem 0 0}.section>.component-heading:first-child:after,.section>.component-heading:first-child~.component:not(.hide):after{display:none}.section>.component-heading:first-child~.component:not(.hide)~.component:not(.hide):after{display:block}.description{padding:0 .75rem .7rem;font-size:.9rem;line-height:1.4rem;color:#a4a4a4;text-align:left}.inputs{display:block;width:100%;border-collapse:collapse}.button,button{font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif}.platform-android .button,.platform-android button{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}.button,button{font-size:1rem;line-height:1.4rem;text-transform:uppercase;background-color:#767676;border-radius:.25rem;border:none;display:inline-block;color:#fff;min-width:12rem;text-align:center;margin:0 auto .7rem;padding:.6rem;-webkit-tap-highlight-color:#858585}.button:active,button:active{background-color:#858585}.platform-ios .button,.platform-ios button{padding:.5rem}.button.primary,.button[type=submit],button.primary,button[type=submit]{background-color:#ff4700;-webkit-tap-highlight-color:red}.button.primary:active,.button[type=submit]:active,button.primary:active,button[type=submit]:active{background-color:red}a.button{text-decoration:none;color:#fff}</style><meta name="viewport"content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><script>window.returnTo="$$RETURN_TO$$",window.clayConfig=$$CONFIG$$,window.claySettings=$$SETTINGS$$,window.customFn=$$CUSTOM_FN$$,window.clayComponents=$$COMPONENTS$$,window.clayMeta=$$META$$</script></head><body><form id="main-form"class="inputs"></form><script>!function(){function t(e,n,r){function i(a,u){if(!n[a]){if(!e[a]){var s="function"==typeof require&&require;if(!u&&s)return s(a,!0);if(o)return o(a,!0);var c=new Error("Cannot find module \'"+a+"\'");throw c.code="MODULE_NOT_FOUND",c}var f=n[a]={exports:{}};e[a][0].call(f.exports,function(t){var n=e[a][1][t];return i(n||t)},f,f.exports,t,e,n,r)}return n[a].exports}for(var o="function"==typeof require&&require,a=0;a<r.length;a++)i(r[a]);return i}return t}()({1:[function(t,e,n){"use strict";var r=t("./vendor/minified"),i=t("./lib/clay-config"),o=r.$,a=r._,u=a.extend([],window.clayConfig||[]),s=a.extend({},window.claySettings||{}),c=window.returnTo||"pebblejs://close#",f=window.customFn||function(){},l=window.clayComponents||{},m=window.clayMeta||{},h=window.navigator.userAgent.match(/android/i)?"android":"ios";document.documentElement.classList.add("platform-"+h),a.eachObj(l,function(t,e){i.registerComponent(e)});var p=o("#main-form"),d=new i(s,u,p,m);p.on("submit",function(){location.href=c+encodeURIComponent(JSON.stringify(d.serialize()))}),f.call(d,r),d.build()},{"./lib/clay-config":2,"./vendor/minified":8}],2:[function(t,e,n){"use strict";function r(t,e,n,c){function f(){h=[],p={},d={},g=!1}function l(t,e){if(Array.isArray(t))t.forEach(function(t){l(t,e)});else if(u.includesCapability(c.activeWatchInfo,t.capabilities))if("section"===t.type){var n=i(\'<div class="section">\');e.add(n),l(t.items,n)}else{var r=o.copyObj(t);r.clayId=h.length;var s=new a(r).initialize(v);r.id&&(p[r.id]=s),r.messageKey&&(d[r.messageKey]=s),h.push(s);var f="undefined"!=typeof y[r.messageKey]?y[r.messageKey]:r.defaultValue;s.set("undefined"!=typeof f?f:""),e.add(s.$element)}}function m(t){if(!g)throw new Error("ClayConfig not built. build() must be run before you can run "+t+"()");return!0}var h,p,d,g,v=this,y=o.copyObj(t);v.meta=c,v.$rootContainer=n,v.EVENTS={BEFORE_BUILD:"BEFORE_BUILD",AFTER_BUILD:"AFTER_BUILD",BEFORE_DESTROY:"BEFORE_DESTROY",AFTER_DESTROY:"AFTER_DESTROY"},u.updateProperties(v.EVENTS,{writable:!1}),v.getAllItems=function(){return m("getAllItems"),h},v.getItemByMessageKey=function(t){return m("getItemByMessageKey"),d[t]},v.getItemById=function(t){return m("getItemById"),p[t]},v.getItemsByType=function(t){return m("getItemsByType"),h.filter(function(e){return e.config.type===t})},v.getItemsByGroup=function(t){return m("getItemsByGroup"),h.filter(function(e){return e.config.group===t})},v.serialize=function(){return m("serialize"),y={},o.eachObj(d,function(t,e){y[t]={value:e.get()},e.precision&&(y[t].precision=e.precision)}),y},v.registerComponent=r.registerComponent,v.destroy=function(){var t=n[0];for(v.trigger(v.EVENTS.BEFORE_DESTROY);t.firstChild;)t.removeChild(t.firstChild);return f(),v.trigger(v.EVENTS.AFTER_DESTROY),v},v.build=function(){return g&&v.destroy(),v.trigger(v.EVENTS.BEFORE_BUILD),l(v.config,n),g=!0,v.trigger(v.EVENTS.AFTER_BUILD),v},f(),s.call(v,n),u.updateProperties(v,{writable:!1,configurable:!1}),v.config=e}var i=t("../vendor/minified").HTML,o=t("../vendor/minified")._,a=t("./clay-item"),u=t("../lib/utils"),s=t("./clay-events"),c=t("./component-registry"),f=t("./manipulators");r.registerComponent=function(t){var e=o.copyObj(t);if(c[e.name])return console.warn("Component: "+e.name+" is already registered. If you wish to override the existing functionality, you must provide a new name"),!1;if("string"==typeof e.manipulator&&(e.manipulator=f[t.manipulator],!e.manipulator))throw new Error("The manipulator: "+t.manipulator+" does not exist in the built-in manipulators.");if(!e.manipulator)throw new Error("The manipulator must be defined");if("function"!=typeof e.manipulator.set||"function"!=typeof e.manipulator.get)throw new Error("The manipulator must have both a `get` and `set` method");if(e.style){var n=document.createElement("style");n.type="text/css",n.appendChild(document.createTextNode(e.style)),document.head.appendChild(n)}return c[e.name]=e,!0},e.exports=r},{"../lib/utils":7,"../vendor/minified":8,"./clay-events":3,"./clay-item":4,"./component-registry":5,"./manipulators":6}],3:[function(t,e,n){"use strict";function r(t){function e(t){return t.split(" ").map(function(t){return"|"+t.replace(/^\\|/,"")}).join(" ")}function n(t,e){var n=o.find(u,function(e){return e.handler===t?e:null});return n||(n={handler:t,proxy:e},u.push(n)),n.proxy}function r(t){return o.find(u,function(e){return e.handler===t?e.proxy:null})}var a=this,u=[];a.on=function(r,i){var o=e(r),a=this,u=n(i,function(){i.apply(a,arguments)});return t.on(o,u),a},a.off=function(t){var e=r(t);return e&&i.off(e),a},a.trigger=function(e,n){return t.trigger(e,n),a}}var i=t("../vendor/minified").$,o=t("../vendor/minified")._;e.exports=r},{"../vendor/minified":8}],4:[function(t,e,n){"use strict";function r(t){var e=this,n=i[t.type];if(!n)throw new Error("The component: "+t.type+" is not registered. Make sure to register it with ClayConfig.registerComponent()");var r=s.extend({},n.defaults||{},t);e.id=t.id||null,e.messageKey=t.messageKey||null,e.config=t,e.$element=c(n.template.trim(),r),e.$manipulatorTarget=e.$element.select("[data-manipulator-target]"),e.$manipulatorTarget.length||(e.$manipulatorTarget=e.$element),e.initialize=function(t){return"function"==typeof n.initialize&&n.initialize.call(e,o,t),e},u.call(e,e.$manipulatorTarget),s.eachObj(n.manipulator,function(t,n){e[t]=n.bind(e)}),a.updateProperties(e,{writable:!1,configurable:!1})}var i=t("./component-registry"),o=t("../vendor/minified"),a=t("../lib/utils"),u=t("./clay-events"),s=o._,c=o.HTML;e.exports=r},{"../lib/utils":7,"../vendor/minified":8,"./clay-events":3,"./component-registry":5}],5:[function(t,e,n){"use strict";e.exports={}},{}],6:[function(t,e,n){"use strict";function r(){return this.$manipulatorTarget.get("disabled")?this:(this.$element.set("+disabled"),this.$manipulatorTarget.set("disabled",!0),this.trigger("disabled"))}function i(){return this.$manipulatorTarget.get("disabled")?(this.$element.set("-disabled"),this.$manipulatorTarget.set("disabled",!1),this.trigger("enabled")):this}function o(){return this.$element[0].classList.contains("hide")?this:(this.$element.set("+hide"),this.trigger("hide"))}function a(){return this.$element[0].classList.contains("hide")?(this.$element.set("-hide"),this.trigger("show")):this}var u=t("../vendor/minified")._;e.exports={html:{get:function(){return this.$manipulatorTarget.get("innerHTML")},set:function(t){return this.get()===t.toString(10)?this:(this.$manipulatorTarget.set("innerHTML",t),this.trigger("change"))},hide:o,show:a},button:{get:function(){return this.$manipulatorTarget.get("innerHTML")},set:function(t){return this.get()===t.toString(10)?this:(this.$manipulatorTarget.set("innerHTML",t),this.trigger("change"))},disable:r,enable:i,hide:o,show:a},val:{get:function(){return this.$manipulatorTarget.get("value")},set:function(t){return this.get()===t.toString(10)?this:(this.$manipulatorTarget.set("value",t),this.trigger("change"))},disable:r,enable:i,hide:o,show:a},slider:{get:function(){return parseFloat(this.$manipulatorTarget.get("value"))},set:function(t){var e=this.get();return this.$manipulatorTarget.set("value",t),this.get()===e?this:this.trigger("change")},disable:r,enable:i,hide:o,show:a},checked:{get:function(){return this.$manipulatorTarget.get("checked")},set:function(t){return!this.get()==!t?this:(this.$manipulatorTarget.set("checked",!!t),this.trigger("change"))},disable:r,enable:i,hide:o,show:a},radiogroup:{get:function(){return this.$element.select("input:checked").get("value")},set:function(t){return this.get()===t.toString(10)?this:(this.$element.select(\'input[value="\'+t.replace(\'"\',\'\\\\"\')+\'"]\').set("checked",!0),this.trigger("change"))},disable:r,enable:i,hide:o,show:a},checkboxgroup:{get:function(){var t=[];return this.$element.select("input").each(function(e){t.push(!!e.checked)}),t},set:function(t){var e=this;for(t=Array.isArray(t)?t:[];t.length<this.get().length;)t.push(!1);return u.equals(this.get(),t)?this:(e.$element.select("input").set("checked",!1).each(function(e,n){e.checked=!!t[n]}),e.trigger("change"))},disable:r,enable:i,hide:o,show:a},color:{get:function(){return parseInt(this.$manipulatorTarget.get("value"),10)||0},set:function(t){return t=this.roundColorToLayout(t||0),this.get()===t?this:(this.$manipulatorTarget.set("value",t),this.trigger("change"))},disable:r,enable:i,hide:o,show:a}}},{"../vendor/minified":8}],7:[function(t,e,n){"use strict";e.exports.updateProperties=function(t,e){Object.getOwnPropertyNames(t).forEach(function(n){Object.defineProperty(t,n,e)})},e.exports.capabilityMap={PLATFORM_APLITE:{platforms:["aplite"],minFwMajor:0,minFwMinor:0},PLATFORM_BASALT:{platforms:["basalt"],minFwMajor:0,minFwMinor:0},PLATFORM_CHALK:{platforms:["chalk"],minFwMajor:0,minFwMinor:0},PLATFORM_DIORITE:{platforms:["diorite"],minFwMajor:0,minFwMinor:0},PLATFORM_EMERY:{platforms:["emery"],minFwMajor:0,minFwMinor:0},PLATFORM_FLINT:{platforms:["flint"],minFwMajor:0,minFwMinor:0},PLATFORM_GABBRO:{platforms:["gabbro"],minFwMajor:0,minFwMinor:0},BW:{platforms:["aplite","diorite","flint"],minFwMajor:0,minFwMinor:0},COLOR:{platforms:["basalt","chalk","emery","gabbro"],minFwMajor:0,minFwMinor:0},MICROPHONE:{platforms:["basalt","chalk","diorite","emery","flint","gabbro"],minFwMajor:0,minFwMinor:0},SMARTSTRAP:{platforms:["basalt","chalk","diorite","emery"],minFwMajor:3,minFwMinor:4},SMARTSTRAP_POWER:{platforms:["basalt","chalk","emery"],minFwMajor:3,minFwMinor:4},HEALTH:{platforms:["basalt","chalk","diorite","emery","flint","gabbro"],minFwMajor:3,minFwMinor:10},RECT:{platforms:["aplite","basalt","diorite","emery","flint"],minFwMajor:0,minFwMinor:0},ROUND:{platforms:["chalk","gabbro"],minFwMajor:0,minFwMinor:0},DISPLAY_144x168:{platforms:["aplite","basalt","diorite","flint"],minFwMajor:0,minFwMinor:0},DISPLAY_180x180_ROUND:{platforms:["chalk"],minFwMajor:0,minFwMinor:0},DISPLAY_200x228:{platforms:["emery"],minFwMajor:0,minFwMinor:0},DISPLAY_260x260_ROUND:{platforms:["gabbro"],minFwMajor:0,minFwMinor:0}},e.exports.includesCapability=function(t,n){var r=/^NOT_/,i=[];if(!n||!n.length)return!0;for(var o=n.length-1;o>=0;o--){var a=n[o],u=e.exports.capabilityMap[a.replace(r,"")];!u||u.platforms.indexOf(t.platform)===-1||u.minFwMajor>t.firmware.major||u.minFwMajor===t.firmware.major&&u.minFwMinor>t.firmware.minor?i.push(!!a.match(r)):i.push(!a.match(r))}return i.indexOf(!1)===-1}},{}],8:[function(t,e,n){e.exports=function(){function t(t){return t.substr(0,3)}function e(t){return t!=lt?""+t:""}function n(t,e){return typeof t==e}function r(t){return n(t,"string")}function i(t){return!!t&&n(t,"object")}function o(t){return t&&t.nodeType}function a(t){return n(t,"number")}function u(t){return i(t)&&!!t.getDay}function s(t){return t===!0||t===!1}function c(t){var e=typeof t;return"object"==e?!(!t||!t.getDay):"string"==e||"number"==e||s(t)}function f(t){return t}function l(t,n,r){return e(t).replace(n,r!=lt?r:"")}function m(t){return l(t,/^\\s+|\\s+$/g)}function h(t,e,n){for(var r in t)t.hasOwnProperty(r)&&e.call(n||t,r,t[r]);return t}function p(t,e,n){if(t)for(var r=0;r<t.length;r++)e.call(n||t,t[r],r);return t}function d(t,e,n){var r=[],i=B(e)?e:function(t){return e!=t};return p(t,function(e,o){i.call(n||t,e,o)&&r.push(e)}),r}function g(t,e,n,r){var i=[];return t(e,function(t,o){P(t=n.call(r||e,t,o))?p(t,function(t){i.push(t)}):t!=lt&&i.push(t)}),i}function v(t){var e=0;return h(t,function(t){e++}),e}function y(t){var e=[];return h(t,function(t){e.push(t)}),e}function b(t,e,n){var r=[];return p(t,function(i,o){r.push(e.call(n||t,i,o))}),r}function w(t,e){var n={};return p(t,function(t,r){n[t]=e}),n}function $(t,e){var n=e||{};for(var r in t)n[r]=t[r];return n}function T(t,e){for(var n=e,r=0;r<t.length;r++)n=$(t[r],n);return n}function M(t){return B(t)?t:function(e,n){if(t===e)return n}}function F(t,e,n){return e==lt?n:e<0?Math.max(t.length+e,0):Math.min(t.length,e)}function E(t,e,n,r){for(var i,o=M(e),a=F(t,r,t.length),u=F(t,n,0);u<a;u++)if((i=o.call(t,t[u],u))!=lt)return i}function x(t,e,n){var r=[];if(t)for(var i=F(t,n,t.length),o=F(t,e,0);o<i;o++)r.push(t[o]);return r}function O(t){return b(t,f)}function A(t,e){var n,r=B(t)?t():t,i=B(e)?e():e;return r==i||r!=lt&&i!=lt&&(c(r)||c(i)?u(r)&&u(i)&&+r==+i:P(r)?r.length==i.length&&!E(r,function(t,e){if(!A(t,i[e]))return!0}):!P(i)&&(n=y(r)).length==v(i)&&!E(n,function(t){if(!A(r[t],i[t]))return!0}))}function j(t,e,n){if(B(t))return t.apply(n&&e,b(n||e,f))}function R(t,e,n){return b(t,function(t){return j(t,e,n)})}function L(t){return"\\\\u"+("0000"+t.charCodeAt(0).toString(16)).slice(-4)}function _(t){return l(t,/[\\x00-\\x1f\'"\\u2028\\u2029]/g,L)}function S(t,e){return t.split(e)}function C(t,e){if(dt[t])return dt[t];var n="with(_.isObject(obj)?obj:{}){"+b(S(t,/{{|}}}?/g),function(t,e){var n,r=m(t),i=l(r,/^{/),o=r==i?"esc(":"";return e%2?(n=/^each\\b(\\s+([\\w_]+(\\s*,\\s*[\\w_]+)?)\\s*:)?(.*)/.exec(i))?"each("+(m(n[4])?n[4]:"this")+", function("+n[2]+"){":(n=/^if\\b(.*)/.exec(i))?"if("+n[1]+"){":(n=/^else\\b\\s*(if\\b(.*))?/.exec(i))?"}else "+(n[1]?"if("+n[2]+")":"")+"{":(n=/^\\/(if)?/.exec(i))?n[1]?"}\\n":"});\\n":(n=/^(var\\s.*)/.exec(i))?n[1]+";":(n=/^#(.*)/.exec(i))?n[1]:(n=/(.*)::\\s*(.*)/.exec(i))?"print("+o+\'_.formatValue("\'+_(n[2])+\'",\'+(m(n[1])?n[1]:"this")+(o&&")")+"));\\n":"print("+o+(m(i)?i:"this")+(o&&")")+");\\n":t?\'print("\'+_(t)+\'");\\n\':void 0}).join("")+"}",r=new Function("obj","each","esc","print","_",n),i=function(t,n){var i=[];return r.call(n||t,t,function(t,e){P(t)?p(t,function(t,n){e.call(t,t,n)}):h(t,function(t,n){e.call(n,t,n)})},e||f,function(){j(i.push,i,arguments)},rt),i.join("")};return gt.push(i)>pt&&delete dt[gt.shift()],dt[t]=i}function I(t){return l(t,/[<>\'"&]/g,function(t){return"&#"+t.charCodeAt(0)+";"})}function N(t,e){return C(t,I)(e)}function D(t){return function(e,n,r){return t(this,e,n,r)}}function B(t){return"function"==typeof t&&!t.item}function P(t){return t&&t.length!=lt&&!r(t)&&!o(t)&&!B(t)&&t!==ot}function k(t){return parseFloat(l(t,/^[^\\d-]+/))}function H(t){return t[at]=t[at]||++ct}function q(t,e){var n,r=[],i={};return Q(t,function(t){Q(e(t),function(t){i[n=H(t)]||(r.push(t),i[n]=!0)})}),r}function U(t,e){var n={$position:"absolute",$visibility:"hidden",$display:"block",$height:lt},r=t.get(n),i=t.set(n).get("clientHeight");return t.set(r),i*e+"px"}function Y(t,n,i,o,a){return B(n)?this.on(lt,t,n,i,o):r(o)?this.on(t,n,i,lt,o):this.each(function(r,u){Q(t?X(t,r):r,function(t){Q(e(n).split(/\\s/),function(e){function n(e,n,r){var f=!a,l=a?r:t;if(a)for(var m=Z(a,t);l&&l!=t&&!(f=m(l));)l=l.parentNode;return!f||s!=e||i.apply(G(l),o||[n,u])&&"?"==c||"|"==c}function r(t){n(s,t,t.target)||(t.preventDefault(),t.stopPropagation())}var s=l(e,/[?|]/g),c=l(e,/[^?|]/g),m=("blur"==s||"focus"==s)&&!!a,h=ct++;t.addEventListener(s,r,m),t.M||(t.M={}),t.M[h]=n,i.M=g(Q,[i.M,function(){t.removeEventListener(s,r,m),delete t.M[h]}],f)})})})}function K(t){R(t.M),t.M=lt}function V(t){ft?ft.push(t):setTimeout(t,0)}function z(t,e,n){return X(t,e,n)[0]}function W(t,e,n){var r=G(document.createElement(t));return P(e)||e!=lt&&!i(e)?r.add(e):r.set(e).add(n)}function J(t){return g(Q,t,function(t){var e;return P(t)?J(t):o(t)?(e=t.cloneNode(!0),e.removeAttribute&&e.removeAttribute("id"),e):t})}function G(t,e,n){return B(t)?V(t):new nt(X(t,e,n))}function X(t,e,n){function i(t){return P(t)?g(Q,t,i):t}function a(t){return d(g(Q,t,i),function(t){for(var r=t;r=r.parentNode;)if(r==e[0]||n)return r==e[0]})}return e?1!=(e=X(e)).length?q(e,function(e){return X(t,e,n)}):r(t)?1!=o(e[0])?[]:n?a(e[0].querySelectorAll(t)):e[0].querySelectorAll(t):a(t):r(t)?document.querySelectorAll(t):g(Q,t,i)}function Z(t,e){function n(t,e){var n=RegExp("(^|\\\\s+)"+t+"(?=$|\\\\s)","i");return function(r){return!t||n.test(r[e])}}var i={},u=i;if(B(t))return t;if(a(t))return function(e,n){return n==t};if(!t||"*"==t||r(t)&&(u=/^([\\w-]*)\\.?([\\w-]*)$/.exec(t))){var s=n(u[1],"tagName"),c=n(u[2],"className");return function(t){return 1==o(t)&&s(t)&&c(t)}}return e?function(n){return G(t,e).find(n)!=lt}:(G(t).each(function(t){i[H(t)]=!0}),function(t){return i[H(t)]})}function Q(t,e){return P(t)?p(t,e):t!=lt&&e(t,0),t}function tt(){this.state=null,this.values=[],this.parent=null}function et(){var t=[],e=arguments,n=e.length,r=0,o=0,a=new tt;a.errHandled=function(){o++,a.parent&&a.parent.errHandled()};var u=a.fire=function(e,n){return null==a.state&&null!=e&&(a.state=!!e,a.values=P(n)?n:[n],setTimeout(function(){p(t,function(t){t()})},0)),a};p(e,function c(t,e){try{t.then?t.then(function(t){var o;(i(t)||B(t))&&B(o=t.then)?c(t,e):(a.values[e]=O(arguments),++r==n&&u(!0,n<2?a.values[e]:a.values))},function(t){a.values[e]=O(arguments),u(!1,n<2?a.values[e]:[a.values[e][0],a.values,e])}):t(function(){u(!0,O(arguments))},function(){u(!1,O(arguments))})}catch(o){u(!1,[o,a.values,e])}}),a.stop=function(){return p(e,function(t){t.stop&&t.stop()}),a.stop0&&j(a.stop0)};var s=a.then=function(e,n){var r=et(),u=function(){try{var t=a.state?e:n;B(t)?!function s(t){try{var e,n=0;if((i(t)||B(t))&&B(e=t.then)){if(t===r)throw new TypeError;e.call(t,function(t){n++||s(t)},function(t){n++||r.fire(!1,[t])}),r.stop0=t.stop}else r.fire(!0,[t])}catch(a){if(!n++&&(r.fire(!1,[a]),!o))throw a}}(j(t,it,a.values)):r.fire(a.state,a.values)}catch(u){if(r.fire(!1,[u]),!o)throw u}};return B(n)&&a.errHandled(),r.stop0=a.stop,r.parent=a,null!=a.state?setTimeout(u,0):t.push(u),r};return a.always=function(t){return s(t,t)},a.error=function(t){return s(0,t)},a}function nt(t,e){var n=this,r=0;if(t)for(var i=0,o=t.length;i<o;i++){var a=t[i];if(e&&P(a))for(var u=0,s=a.length;u<s;u++)n[r++]=a[u];else n[r++]=a}else n[r++]=e;n.length=r,n._=!0}function rt(){return new nt(arguments,(!0))}var it,ot=window,at="Nia",ut={},st={},ct=1,ft=/^[ic]/.test(document.readyState)?lt:[],lt=null,mt=S("January,February,March,April,May,June,July,August,September,October,November,December",/,/g),ht=(b(mt,t),S("Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",/,/g)),pt=(b(ht,t),S("am,pm",/,/g),S("am,am,am,am,am,am,am,am,am,am,am,am,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm",/,/g),99),dt={},gt=[];return $({each:D(p),equals:D(A),find:D(E),dummySort:0,select:function(t,e){return G(t,this,e)},get:function(t,e){var n=this,i=n[0];if(i){if(r(t)){var o,a=/^(\\W*)(.*)/.exec(l(t,/^%/,"@data-")),u=a[1];return o=st[u]?st[u](this,a[2]):"$"==t?n.get("className"):"$$"==t?n.get("@style"):"$$slide"==t?n.get("$height"):"$$fade"==t||"$$show"==t?"hidden"==n.get("$visibility")||"none"==n.get("$display")?0:"$$fade"==t?isNaN(n.get("$opacity",!0))?1:n.get("$opacity",!0):1:"$"==u?ot.getComputedStyle(i,lt).getPropertyValue(l(a[2],/[A-Z]/g,function(t){return"-"+t.toLowerCase()})):"@"==u?i.getAttribute(a[2]):i[a[2]],e?k(o):o}var s={};return(P(t)?Q:h)(t,function(t){s[t]=n.get(t,e)}),s}},set:function(t,e){var n=this;if(e!==it){var i=/^(\\W*)(.*)/.exec(l(l(t,/^\\$float$/,"cssFloat"),/^%/,"@data-")),o=i[1];ut[o]?ut[o](this,i[2],e):"$$fade"==t?this.set({$visibility:e?"visible":"hidden",$opacity:e}):"$$slide"==t?n.set({$visibility:e?"visible":"hidden",$overflow:"hidden",$height:/px/.test(e)?e:function(t,n,r){return U(G(r),e)}}):"$$show"==t?e?n.set({$visibility:e?"visible":"hidden",$display:""}).set({$display:function(t){return"none"==t?"block":t}}):n.set({$display:"none"}):"$$"==t?n.set("@style",e):Q(this,function(n,r){var a=B(e)?e(G(n).get(t),r,n):e;"$"==o?i[2]?n.style[i[2]]=a:Q(a&&a.split(/\\s+/),function(t){var e=l(t,/^[+-]/);/^\\+/.test(t)?n.classList.add(e):/^-/.test(t)?n.classList.remove(e):n.classList.toggle(e)}):"$$scrollX"==t?n.scroll(a,G(n).get("$$scrollY")):"$$scrollY"==t?n.scroll(G(n).get("$$scrollX"),a):"@"==o?a==lt?n.removeAttribute(i[2]):n.setAttribute(i[2],a):n[i[2]]=a})}else r(t)||B(t)?n.set("$",t):h(t,function(t,e){n.set(t,e)});return n},add:function(t,e){return this.each(function(n,r){function i(t){if(P(t))Q(t,i);else if(B(t))i(t(n,r));else if(t!=lt){var u=o(t)?t:document.createTextNode(t);a?a.parentNode.insertBefore(u,a.nextSibling):e?e(u,n,n.parentNode):n.appendChild(u),a=u}}var a;i(r&&!B(t)?J(t):t)})},on:Y,trigger:function(t,e){return this.each(function(n,r){for(var i=!0,o=n;o&&i;)h(o.M,function(r,o){i=i&&o(t,e,n)}),o=o.parentNode})},ht:function(t,e){var n=arguments.length>2?T(x(arguments,1)):e;return this.set("innerHTML",B(t)?t(n):/{{/.test(t)?N(t,n):/^#\\S+$/.test(t)?N(z(t).text,n):t)}},nt.prototype),$({request:function(t,n,r,i){var o,a=i||{},u=0,s=et(),c=r&&r.constructor==a.constructor;try{s.xhr=o=new XMLHttpRequest,s.stop0=function(){o.abort()},c&&(r=g(h,r,function(t,e){return g(Q,e,function(e){return encodeURIComponent(t)+(e!=lt?"="+encodeURIComponent(e):"")})}).join("&")),r==lt||/post/i.test(t)||(n+="?"+r,r=lt),o.open(t,n,!0,a.user,a.pass),c&&/post/i.test(t)&&o.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),h(a.headers,function(t,e){o.setRequestHeader(t,e)}),h(a.xhr,function(t,e){o[t]=e}),o.onreadystatechange=function(){4!=o.readyState||u++||(o.status>=200&&o.status<300?s.fire(!0,[o.responseText,o]):s.fire(!1,[o.status,o.responseText,o]))},o.send(r)}catch(f){u||s.fire(!1,[0,lt,e(f)])}return s},ready:V,off:K,wait:function(t,e){var n=et(),r=setTimeout(function(){n.fire(!0,e)},t);return n.stop0=function(){n.fire(!1),clearTimeout(r)},n}},G),$({each:p,toObject:w,find:E,equals:A,copyObj:$,extend:function(t){return T(x(arguments,1),t)},eachObj:h,isObject:i,format:function(t,e,n){return C(t,n)(e)},template:C,formatHtml:N,promise:et},rt),document.addEventListener("DOMContentLoaded",function(){R(ft),ft=lt},!1),{HTML:function(){var t=W("div");return rt(j(t.ht,t,arguments)[0].childNodes)},_:rt,$:G,$$:z,M:nt,getter:st,setter:ut}}()},{}]},{},[1])</script></body></html>';
	},{}],37:[function(t,e,n){e.exports=".section .component-input {\n  padding: 0;\n}\n.component-input label {\n  display: block;\n}\n.component-input .label {\n  padding-bottom: 0.7rem;\n}\n.component-input .input {\n  position: relative;\n  min-width: 100%;\n  margin-top: 0.7rem;\n  margin-left: 0;\n}\n.component-input input {\n  display: block;\n  width: 100%;\n  background: #333333;\n  border-radius: 0.25rem;\n  padding: 0.35rem 0.375rem;\n  border: none;\n  vertical-align: baseline;\n  color: #ffffff;\n  font-size: inherit;\n  -webkit-appearance: none;\n  appearance: none;\n  min-height: 2.1rem;\n}\n.component-input input::-webkit-input-placeholder {\n  color: #858585;\n}\n.component-input input::-moz-placeholder {\n  color: #858585;\n}\n.component-input input:-moz-placeholder {\n  color: #858585;\n}\n.component-input input:-ms-input-placeholder {\n  color: #858585;\n}\n.component-input input:focus::-webkit-input-placeholder {\n  color: #666666;\n}\n.component-input input:focus::-moz-placeholder {\n  color: #666666;\n}\n.component-input input:focus:-moz-placeholder {\n  color: #666666;\n}\n.component-input input:focus:-ms-input-placeholder {\n  color: #666666;\n}\n.component-input input:focus {\n  border: none;\n  box-shadow: none;\n}\n/*# sourceMappingURL=input.css.map */\n"},{}],38:[function(t,e,n){e.exports='.component-radio {\n  display: block;\n}\n.section .component-radio {\n  padding-right: 0.375rem;\n}\n.component-radio > .label {\n  display: block;\n  padding-bottom: 0.35rem;\n}\n.component-radio .radio-group {\n  padding-bottom: 0.35rem;\n}\n.component-radio .radio-group label {\n  padding: 0.35rem 0.375rem;\n}\n.component-radio .radio-group .label {\n  font-size: 0.9em;\n}\n.component-radio .radio-group input {\n  opacity: 0;\n  position: absolute;\n}\n.component-radio .radio-group i {\n  display: block;\n  position: relative;\n  border-radius: 1.4rem;\n  width: 1.4rem;\n  height: 1.4rem;\n  border: 2px solid #767676;\n  -webkit-flex-shrink: 0;\n  flex-shrink: 0;\n}\n.component-radio .radio-group input:checked + i {\n  border-color: #ff4700;\n}\n.component-radio .radio-group input:checked + i:after {\n  content: "";\n  display: block;\n  position: absolute;\n  left: 15%;\n  right: 15%;\n  top: 15%;\n  bottom: 15%;\n  border-radius: 1.4rem;\n  background: #ff4700;\n}\n.component-radio .description {\n  padding-left: 0;\n  padding-right: 0;\n}\n/*# sourceMappingURL=radiogroup.css.map */\n'},{}],39:[function(t,e,n){e.exports='.section .component-select {\n  padding: 0;\n}\n.component-select label {\n  position: relative;\n}\n.component-select .value {\n  position: relative;\n  padding-right: 1.1rem;\n  display: block;\n}\n.component-select .value:after {\n  content: "";\n  position: absolute;\n  right: 0;\n  top: 50%;\n  margin-top: -0.1rem;\n  height: 0;\n  width: 0;\n  border-left: 0.425rem solid transparent;\n  border-right: 0.425rem solid transparent;\n  border-top: 0.425rem solid #ff4700;\n}\n.component-select select {\n  opacity: 0;\n  position: absolute;\n  display: block;\n  left: 0;\n  right: 0;\n  top: 0;\n  bottom: 0;\n  width: 100%;\n  border: none;\n  margin: 0;\n  padding: 0;\n}\n/*# sourceMappingURL=select.css.map */\n'},{}],40:[function(t,e,n){e.exports='.section .component-slider {\n  padding: 0;\n}\n.component-slider label {\n  display: block;\n}\n.component-slider .label-container {\n  display: -webkit-box;\n  display: -webkit-flex;\n  display: flex;\n  -webkit-box-align: center;\n  -webkit-align-items: center;\n  align-items: center;\n  width: 100%;\n  padding-bottom: 0.7rem;\n}\n.component-slider .label {\n  -webkit-box-flex: 1;\n  -webkit-flex: 1;\n  flex: 1;\n  min-width: 1rem;\n  display: block;\n  padding-right: 0.75rem;\n}\n.component-slider .value-wrap {\n  display: block;\n  position: relative;\n}\n.component-slider .value,\n.component-slider .value-pad {\n  display: block;\n  background: #333333;\n  border-radius: 0.25rem;\n  padding: 0.35rem 0.375rem;\n  border: none;\n  vertical-align: baseline;\n  color: #ffffff;\n  text-align: right;\n  margin: 0;\n  min-width: 1rem;\n}\n.component-slider .value-pad {\n  visibility: hidden;\n}\n.component-slider .value-pad:before {\n  content: " ";\n  display: inline-block;\n}\n.component-slider .value {\n  max-width: 100%;\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n.component-slider .input-wrap {\n  padding: 0 0.75rem 0.7rem;\n}\n.component-slider .input {\n  display: block;\n  position: relative;\n  min-width: 100%;\n  height: 1.4rem;\n  overflow: hidden;\n  margin-left: 0;\n}\n.component-slider .input:before {\n  content: "";\n  display: block;\n  position: absolute;\n  height: 0.1764705882rem;\n  background: #666666;\n  width: 100%;\n  top: 0.6117647059rem;\n}\n.component-slider .input .slider {\n  display: block;\n  width: 100%;\n  -webkit-appearance: none;\n  appearance: none;\n  position: relative;\n  height: 1.4rem;\n  margin: 0;\n  background-color: transparent;\n}\n.component-slider .input .slider:focus {\n  outline: none;\n}\n.component-slider .input .slider::-webkit-slider-runnable-track {\n  border: none;\n  height: 1.4rem;\n  width: 100%;\n  background-color: transparent;\n}\n.component-slider .input .slider::-webkit-slider-thumb {\n  -webkit-appearance: none;\n  appearance: none;\n  position: relative;\n  height: 1.4rem;\n  width: 1.4rem;\n  background-color: #ff4700;\n  border-radius: 50%;\n}\n.component-slider .input .slider::-webkit-slider-thumb:before {\n  content: "";\n  position: absolute;\n  left: -1000px;\n  top: 0.6117647059rem;\n  height: 0.1764705882rem;\n  width: 1001px;\n  background: #ff4700;\n}\n/*# sourceMappingURL=slider.css.map */\n'},{}],41:[function(t,e,n){e.exports=".component-submit {\n  text-align: center;\n}\n/*# sourceMappingURL=submit.css.map */\n"},{}],42:[function(t,e,n){e.exports=".section .component-toggle {\n  padding: 0;\n}\n.component-toggle input {\n  display: none;\n}\n.component-toggle .graphic {\n  display: inline-block;\n  position: relative;\n}\n.component-toggle .graphic .slide {\n  display: block;\n  border-radius: 1.05rem;\n  height: 1.05rem;\n  width: 2.2652rem;\n  background: #2f2f2f;\n  -webkit-transition: background-color 150ms linear;\n  transition: background-color 150ms linear;\n}\n.component-toggle .graphic .marker {\n  background: #ececec;\n  width: 1.4rem;\n  height: 1.4rem;\n  border-radius: 1.4rem;\n  position: absolute;\n  left: 0;\n  display: block;\n  top: -0.175rem;\n  -webkit-transition: -webkit-transform 150ms linear;\n  transition: -webkit-transform 150ms linear;\n  transition: transform 150ms linear;\n  transition: transform 150ms linear, -webkit-transform 150ms linear;\n  box-shadow: 0 0.1rem 0.1rem #2f2f2f;\n}\n.component-toggle input:checked + .graphic .slide {\n  background: #993d19;\n}\n.component-toggle input:checked + .graphic .marker {\n  background: #ff4700;\n  -webkit-transform: translateX(0.8652rem);\n  transform: translateX(0.8652rem);\n}\n/*# sourceMappingURL=toggle.css.map */\n"},{}],"@rebble/clay":[function(t,e,n){"use strict";function r(t,e,n){function r(){i.meta={activeWatchInfo:Pebble.getActiveWatchInfo&&Pebble.getActiveWatchInfo(),accountToken:Pebble.getAccountToken(),watchToken:Pebble.getWatchToken(),userData:s(n.userData||{})}}function o(t,e,n){Array.isArray(t)?t.forEach(function(t){o(t,e,n)}):"section"===t.type?o(t.items,e,n):e(t)&&n(t)}var i=this;if(!Array.isArray(t))throw new Error("config must be an Array");if(e&&"function"!=typeof e)throw new Error('customFn must be a function or "null"');n=n||{},i.config=s(t),i.customFn=e||function(){},i.components={},i.meta={activeWatchInfo:null,accountToken:"",watchToken:"",userData:{}},i.version=c,n.autoHandleEvents!==!1&&"undefined"!=typeof Pebble?(Pebble.addEventListener("showConfiguration",function(){r(),Pebble.openURL(i.generateUrl())}),Pebble.addEventListener("webviewclosed",function(t){t&&t.response&&Pebble.sendAppMessage(i.getSettings(t.response),function(){console.log("Sent config data to Pebble")},function(t){console.log("Failed to send config data!"),console.log(JSON.stringify(t))})})):"undefined"!=typeof Pebble&&Pebble.addEventListener("ready",function(){r()}),o(i.config,function(t){return a[t.type]},function(t){i.registerComponent(a[t.type])}),o(i.config,function(t){return t.appKey},function(){throw new Error("appKeys are no longer supported. Please follow the migration guide to upgrade your project")})}var o=t("./tmp/config-page.html"),i=t("tosource"),a=t("./src/scripts/components"),s=t("deepcopy/build/deepcopy.min"),c=t("./package.json").version,l=t("message_keys");r.prototype.registerComponent=function(t){this.components[t.name]=t},r.prototype.generateUrl=function(){var t={},e=!Pebble||"pypkjs"===Pebble.platform,n=e?"$$$RETURN_TO$$$":"pebblejs://close#";try{t=JSON.parse(localStorage.getItem("clay-settings"))||{}}catch(a){console.error(a.toString())}var s=o.replace("$$RETURN_TO$$",n).replace("$$CUSTOM_FN$$",i(this.customFn)).replace("$$CONFIG$$",i(this.config)).replace("$$SETTINGS$$",i(t)).replace("$$COMPONENTS$$",i(this.components)).replace("$$META$$",i(this.meta));return e?r.encodeDataUri(s,"http://clay.pebble.com.s3-website-us-west-2.amazonaws.com/#"):r.encodeDataUri(s)},r.prototype.getSettings=function(t,e){var n={};t=t.match(/^\{/)?t:decodeURIComponent(t);try{n=JSON.parse(t)}catch(o){throw new Error("The provided response was not valid JSON")}var i={};return Object.keys(n).forEach(function(t){"object"==typeof n[t]&&n[t]?i[t]=n[t].value:i[t]=n[t]}),localStorage.setItem("clay-settings",JSON.stringify(i)),e===!1?n:r.prepareSettingsForAppMessage(n)},r.prototype.setSettings=function(t,e){var n={};try{n=JSON.parse(localStorage.getItem("clay-settings"))||{}}catch(r){console.error(r.toString())}if("object"==typeof t){var o=t;Object.keys(o).forEach(function(t){n[t]=o[t]})}else n[t]=e;localStorage.setItem("clay-settings",JSON.stringify(n))},r.encodeDataUri=function(t,e){return e="undefined"!=typeof e?e:"data:text/html;charset=utf-8,",e+encodeURIComponent(t)},r.prepareForAppMessage=function(t){function e(t,e){return Math.floor(t*Math.pow(10,e||0))}var n;return Array.isArray(t)?(n=[],t.forEach(function(t,e){n[e]=r.prepareForAppMessage(t)})):n="object"==typeof t&&t?"number"==typeof t.value?e(t.value,t.precision):Array.isArray(t.value)?t.value.map(function(n){return"number"==typeof n?e(n,t.precision):n}):r.prepareForAppMessage(t.value):"boolean"==typeof t?t?1:0:t,n},r.prepareSettingsForAppMessage=function(t){var e={};Object.keys(t).forEach(function(n){var r=t[n],o=n.match(/(.+?)(?:\[(\d*)\])?$/);if(!o[2])return void(e[n]=r);var i=parseInt(o[2],10);n=o[1],"undefined"==typeof e[n]&&(e[n]=[]),e[n][i]=r});var n={};return Object.keys(e).forEach(function(t){var o=l[t],i=r.prepareForAppMessage(e[t]);i=Array.isArray(i)?i:[i],i.forEach(function(t,e){n[o+e]=t})}),Object.keys(n).forEach(function(t){if(Array.isArray(n[t]))throw new Error('Clay does not support 2 dimensional arrays for item values. Make sure you are not attempting to use array syntax (eg: "myMessageKey[2]") in the messageKey for components that return an array, such as a checkboxgroup')}),n},e.exports=r},{"./package.json":7,"./src/scripts/components":13,"./tmp/config-page.html":36,"deepcopy/build/deepcopy.min":3,message_keys:void 0,tosource:6}]},{},["@rebble/clay"])("@rebble/clay")});
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(4)))

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Copyright 2024 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	
	module.exports = function(module) {
	    switch(module) {
	        case "message_keys": return __webpack_require__(5);
	    }
	    throw new Error('Module not found: ' + module);
	};


/***/ }),
/* 5 */
/***/ (function(module, exports) {

	module.exports = {"ActionLogout":10011,"ActionRefresh":10010,"ActionToggle":10009,"ActionType":10017,"ActionValue":10018,"AppReady":10000,"AuthStatus":10001,"CameraChunkData":10034,"CameraChunkIndex":10032,"CameraChunkTotal":10033,"CameraEventTime":10031,"CameraEventType":10030,"CameraHeight":10036,"CameraRequest":10029,"CameraWidth":10035,"DeviceCount":10002,"DeviceHasGarage":10037,"DeviceIndex":10005,"DeviceName":10006,"DeviceOnline":10008,"DeviceState":10007,"DeviceType":10004,"DeviceTypeIndex":10003,"GarageRequest":10038,"ScaleBMI":10021,"ScaleBodyFat":10020,"ScaleDate":10024,"ScaleMuscle":10022,"ScaleWater":10023,"ScaleWeight":10019,"ShortcutCount":10025,"ShortcutIndex":10026,"ShortcutName":10027,"ShortcutTrigger":10028,"TestAuth":10039,"WyzeAPIKey":10015,"WyzeEmail":10012,"WyzeKeyID":10014,"WyzeLogout":10016,"WyzePassword":10013}

/***/ }),
/* 6 */
/***/ (function(module, exports) {

	module.exports = function createClayConfig(statusHtml) {
	  return [
	    {
	      "type": "heading",
	      "defaultValue": "Wyze Control Settings"
	    },
	    {
	      "type": "text",
	      "defaultValue": statusHtml || ""
	    },
	    {
	      "type": "text",
	      "defaultValue": "Generate an API Key and Key ID via the <a href='https://developer-api-console.wyze.com/' target='_blank'>Wyze Developer Console</a>."
	    },
	    {
	      "type": "text",
	      "defaultValue": "<b>Security Notice:</b> Wyze does not provide an OAuth login page. Therefore, to connect, we must briefly handle your Wyze Email and Password. <br><br><b>Your password is NEVER stored permanently.</b> Once you click Save, your phone securely exchanges your password for Wyze Auth Tokens, and your password is immediately deleted from your phone's storage. It is never sent to any 3rd-party servers, only directly to Wyze."
	    },
	    {
	      "type": "section",
	      "items": [
	        {
	          "type": "heading",
	          "defaultValue": "Wyze Credentials"
	        },
	        {
	          "type": "input",
	          "messageKey": "WyzeEmail",
	          "defaultValue": "",
	          "label": "Wyze Account Email"
	        },
	        {
	          "type": "input",
	          "messageKey": "WyzePassword",
	          "defaultValue": "",
	          "label": "Wyze Password",
	          "attributes": {
	            "type": "password"
	          }
	        },
	        {
	          "type": "input",
	          "messageKey": "WyzeKeyID",
	          "defaultValue": "",
	          "label": "Wyze Key ID"
	        },
	        {
	          "type": "input",
	          "messageKey": "WyzeAPIKey",
	          "defaultValue": "",
	          "label": "Wyze API Key"
	        }
	      ]
	    },
	    {
	      "type": "submit",
	      "defaultValue": "Save Settings"
	    },
	    {
	      "type": "section",
	      "items": [
	        {
	          "type": "heading",
	          "defaultValue": "Account"
	        },
	        {
	          "type": "toggle",
	          "messageKey": "WyzeLogout",
	          "defaultValue": false,
	          "label": "Log Out of Wyze",
	          "description": "Enable and Save to log out. Clears all tokens from this phone."
	        }
	      ]
	    }
	  ];
	};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;!function(n){"use strict";function d(n,t){var r=(65535&n)+(65535&t);return(n>>16)+(t>>16)+(r>>16)<<16|65535&r}function f(n,t,r,e,o,u){return d((u=d(d(t,n),d(e,u)))<<o|u>>>32-o,r)}function l(n,t,r,e,o,u,c){return f(t&r|~t&e,n,t,o,u,c)}function g(n,t,r,e,o,u,c){return f(t&e|r&~e,n,t,o,u,c)}function v(n,t,r,e,o,u,c){return f(t^r^e,n,t,o,u,c)}function m(n,t,r,e,o,u,c){return f(r^(t|~e),n,t,o,u,c)}function c(n,t){var r,e,o,u;n[t>>5]|=128<<t%32,n[14+(t+64>>>9<<4)]=t;for(var c=1732584193,f=-271733879,i=-1732584194,a=271733878,h=0;h<n.length;h+=16)c=l(r=c,e=f,o=i,u=a,n[h],7,-680876936),a=l(a,c,f,i,n[h+1],12,-389564586),i=l(i,a,c,f,n[h+2],17,606105819),f=l(f,i,a,c,n[h+3],22,-1044525330),c=l(c,f,i,a,n[h+4],7,-176418897),a=l(a,c,f,i,n[h+5],12,1200080426),i=l(i,a,c,f,n[h+6],17,-1473231341),f=l(f,i,a,c,n[h+7],22,-45705983),c=l(c,f,i,a,n[h+8],7,1770035416),a=l(a,c,f,i,n[h+9],12,-1958414417),i=l(i,a,c,f,n[h+10],17,-42063),f=l(f,i,a,c,n[h+11],22,-1990404162),c=l(c,f,i,a,n[h+12],7,1804603682),a=l(a,c,f,i,n[h+13],12,-40341101),i=l(i,a,c,f,n[h+14],17,-1502002290),c=g(c,f=l(f,i,a,c,n[h+15],22,1236535329),i,a,n[h+1],5,-165796510),a=g(a,c,f,i,n[h+6],9,-1069501632),i=g(i,a,c,f,n[h+11],14,643717713),f=g(f,i,a,c,n[h],20,-373897302),c=g(c,f,i,a,n[h+5],5,-701558691),a=g(a,c,f,i,n[h+10],9,38016083),i=g(i,a,c,f,n[h+15],14,-660478335),f=g(f,i,a,c,n[h+4],20,-405537848),c=g(c,f,i,a,n[h+9],5,568446438),a=g(a,c,f,i,n[h+14],9,-1019803690),i=g(i,a,c,f,n[h+3],14,-187363961),f=g(f,i,a,c,n[h+8],20,1163531501),c=g(c,f,i,a,n[h+13],5,-1444681467),a=g(a,c,f,i,n[h+2],9,-51403784),i=g(i,a,c,f,n[h+7],14,1735328473),c=v(c,f=g(f,i,a,c,n[h+12],20,-1926607734),i,a,n[h+5],4,-378558),a=v(a,c,f,i,n[h+8],11,-2022574463),i=v(i,a,c,f,n[h+11],16,1839030562),f=v(f,i,a,c,n[h+14],23,-35309556),c=v(c,f,i,a,n[h+1],4,-1530992060),a=v(a,c,f,i,n[h+4],11,1272893353),i=v(i,a,c,f,n[h+7],16,-155497632),f=v(f,i,a,c,n[h+10],23,-1094730640),c=v(c,f,i,a,n[h+13],4,681279174),a=v(a,c,f,i,n[h],11,-358537222),i=v(i,a,c,f,n[h+3],16,-722521979),f=v(f,i,a,c,n[h+6],23,76029189),c=v(c,f,i,a,n[h+9],4,-640364487),a=v(a,c,f,i,n[h+12],11,-421815835),i=v(i,a,c,f,n[h+15],16,530742520),c=m(c,f=v(f,i,a,c,n[h+2],23,-995338651),i,a,n[h],6,-198630844),a=m(a,c,f,i,n[h+7],10,1126891415),i=m(i,a,c,f,n[h+14],15,-1416354905),f=m(f,i,a,c,n[h+5],21,-57434055),c=m(c,f,i,a,n[h+12],6,1700485571),a=m(a,c,f,i,n[h+3],10,-1894986606),i=m(i,a,c,f,n[h+10],15,-1051523),f=m(f,i,a,c,n[h+1],21,-2054922799),c=m(c,f,i,a,n[h+8],6,1873313359),a=m(a,c,f,i,n[h+15],10,-30611744),i=m(i,a,c,f,n[h+6],15,-1560198380),f=m(f,i,a,c,n[h+13],21,1309151649),c=m(c,f,i,a,n[h+4],6,-145523070),a=m(a,c,f,i,n[h+11],10,-1120210379),i=m(i,a,c,f,n[h+2],15,718787259),f=m(f,i,a,c,n[h+9],21,-343485551),c=d(c,r),f=d(f,e),i=d(i,o),a=d(a,u);return[c,f,i,a]}function i(n){for(var t="",r=32*n.length,e=0;e<r;e+=8)t+=String.fromCharCode(n[e>>5]>>>e%32&255);return t}function a(n){var t=[];for(t[(n.length>>2)-1]=void 0,e=0;e<t.length;e+=1)t[e]=0;for(var r=8*n.length,e=0;e<r;e+=8)t[e>>5]|=(255&n.charCodeAt(e/8))<<e%32;return t}function e(n){for(var t,r="0123456789abcdef",e="",o=0;o<n.length;o+=1)t=n.charCodeAt(o),e+=r.charAt(t>>>4&15)+r.charAt(15&t);return e}function r(n){return unescape(encodeURIComponent(n))}function o(n){return i(c(a(n=r(n)),8*n.length))}function u(n,t){return function(n,t){var r,e=a(n),o=[],u=[];for(o[15]=u[15]=void 0,16<e.length&&(e=c(e,8*n.length)),r=0;r<16;r+=1)o[r]=909522486^e[r],u[r]=1549556828^e[r];return t=c(o.concat(a(t)),512+8*t.length),i(c(u.concat(t),640))}(r(n),r(t))}function t(n,t,r){return t?r?u(t,n):e(u(t,n)):r?o(n):e(o(n))} true?!(__WEBPACK_AMD_DEFINE_RESULT__ = function(){return t}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)):"object"==typeof module&&module.exports?module.exports=t:n.md5=t}(this);
	//# sourceMappingURL=md5.min.js.map

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

	var encode = __webpack_require__(9),
	    decode = __webpack_require__(10);
	
	module.exports = {
	  encode: encode,
	  decode: decode
	};


/***/ }),
/* 9 */
/***/ (function(module, exports) {

	/*
	  Copyright (c) 2008, Adobe Systems Incorporated
	  All rights reserved.
	
	  Redistribution and use in source and binary forms, with or without 
	  modification, are permitted provided that the following conditions are
	  met:
	
	  * Redistributions of source code must retain the above copyright notice, 
	    this list of conditions and the following disclaimer.
	  
	  * Redistributions in binary form must reproduce the above copyright
	    notice, this list of conditions and the following disclaimer in the 
	    documentation and/or other materials provided with the distribution.
	  
	  * Neither the name of Adobe Systems Incorporated nor the names of its 
	    contributors may be used to endorse or promote products derived from 
	    this software without specific prior written permission.
	
	  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
	  IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
	  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
	  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR 
	  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
	  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
	  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
	  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
	  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
	  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	*/
	/*
	JPEG encoder ported to JavaScript and optimized by Andreas Ritter, www.bytestrom.eu, 11/2009
	
	Basic GUI blocking jpeg encoder
	*/
	
	var btoa = btoa || function(buf) {
	  return new Buffer(buf).toString('base64');
	};
	
	function JPEGEncoder(quality) {
	  var self = this;
		var fround = Math.round;
		var ffloor = Math.floor;
		var YTable = new Array(64);
		var UVTable = new Array(64);
		var fdtbl_Y = new Array(64);
		var fdtbl_UV = new Array(64);
		var YDC_HT;
		var UVDC_HT;
		var YAC_HT;
		var UVAC_HT;
		
		var bitcode = new Array(65535);
		var category = new Array(65535);
		var outputfDCTQuant = new Array(64);
		var DU = new Array(64);
		var byteout = [];
		var bytenew = 0;
		var bytepos = 7;
		
		var YDU = new Array(64);
		var UDU = new Array(64);
		var VDU = new Array(64);
		var clt = new Array(256);
		var RGB_YUV_TABLE = new Array(2048);
		var currentQuality;
		
		var ZigZag = [
				 0, 1, 5, 6,14,15,27,28,
				 2, 4, 7,13,16,26,29,42,
				 3, 8,12,17,25,30,41,43,
				 9,11,18,24,31,40,44,53,
				10,19,23,32,39,45,52,54,
				20,22,33,38,46,51,55,60,
				21,34,37,47,50,56,59,61,
				35,36,48,49,57,58,62,63
			];
		
		var std_dc_luminance_nrcodes = [0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0];
		var std_dc_luminance_values = [0,1,2,3,4,5,6,7,8,9,10,11];
		var std_ac_luminance_nrcodes = [0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
		var std_ac_luminance_values = [
				0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,
				0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,
				0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,
				0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,
				0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,
				0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,
				0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,
				0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
				0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
				0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
				0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
				0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
				0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,
				0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,
				0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,
				0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,
				0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,
				0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,
				0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,
				0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
				0xf9,0xfa
			];
		
		var std_dc_chrominance_nrcodes = [0,0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0];
		var std_dc_chrominance_values = [0,1,2,3,4,5,6,7,8,9,10,11];
		var std_ac_chrominance_nrcodes = [0,0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77];
		var std_ac_chrominance_values = [
				0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,
				0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,
				0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,
				0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,
				0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,
				0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,
				0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,
				0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,
				0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,
				0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,
				0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,
				0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,
				0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,
				0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,
				0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,
				0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,
				0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,
				0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,
				0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,
				0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
				0xf9,0xfa
			];
		
		function initQuantTables(sf){
				var YQT = [
					16, 11, 10, 16, 24, 40, 51, 61,
					12, 12, 14, 19, 26, 58, 60, 55,
					14, 13, 16, 24, 40, 57, 69, 56,
					14, 17, 22, 29, 51, 87, 80, 62,
					18, 22, 37, 56, 68,109,103, 77,
					24, 35, 55, 64, 81,104,113, 92,
					49, 64, 78, 87,103,121,120,101,
					72, 92, 95, 98,112,100,103, 99
				];
				
				for (var i = 0; i < 64; i++) {
					var t = ffloor((YQT[i]*sf+50)/100);
					if (t < 1) {
						t = 1;
					} else if (t > 255) {
						t = 255;
					}
					YTable[ZigZag[i]] = t;
				}
				var UVQT = [
					17, 18, 24, 47, 99, 99, 99, 99,
					18, 21, 26, 66, 99, 99, 99, 99,
					24, 26, 56, 99, 99, 99, 99, 99,
					47, 66, 99, 99, 99, 99, 99, 99,
					99, 99, 99, 99, 99, 99, 99, 99,
					99, 99, 99, 99, 99, 99, 99, 99,
					99, 99, 99, 99, 99, 99, 99, 99,
					99, 99, 99, 99, 99, 99, 99, 99
				];
				for (var j = 0; j < 64; j++) {
					var u = ffloor((UVQT[j]*sf+50)/100);
					if (u < 1) {
						u = 1;
					} else if (u > 255) {
						u = 255;
					}
					UVTable[ZigZag[j]] = u;
				}
				var aasf = [
					1.0, 1.387039845, 1.306562965, 1.175875602,
					1.0, 0.785694958, 0.541196100, 0.275899379
				];
				var k = 0;
				for (var row = 0; row < 8; row++)
				{
					for (var col = 0; col < 8; col++)
					{
						fdtbl_Y[k]  = (1.0 / (YTable [ZigZag[k]] * aasf[row] * aasf[col] * 8.0));
						fdtbl_UV[k] = (1.0 / (UVTable[ZigZag[k]] * aasf[row] * aasf[col] * 8.0));
						k++;
					}
				}
			}
			
			function computeHuffmanTbl(nrcodes, std_table){
				var codevalue = 0;
				var pos_in_table = 0;
				var HT = new Array();
				for (var k = 1; k <= 16; k++) {
					for (var j = 1; j <= nrcodes[k]; j++) {
						HT[std_table[pos_in_table]] = [];
						HT[std_table[pos_in_table]][0] = codevalue;
						HT[std_table[pos_in_table]][1] = k;
						pos_in_table++;
						codevalue++;
					}
					codevalue*=2;
				}
				return HT;
			}
			
			function initHuffmanTbl()
			{
				YDC_HT = computeHuffmanTbl(std_dc_luminance_nrcodes,std_dc_luminance_values);
				UVDC_HT = computeHuffmanTbl(std_dc_chrominance_nrcodes,std_dc_chrominance_values);
				YAC_HT = computeHuffmanTbl(std_ac_luminance_nrcodes,std_ac_luminance_values);
				UVAC_HT = computeHuffmanTbl(std_ac_chrominance_nrcodes,std_ac_chrominance_values);
			}
		
			function initCategoryNumber()
			{
				var nrlower = 1;
				var nrupper = 2;
				for (var cat = 1; cat <= 15; cat++) {
					//Positive numbers
					for (var nr = nrlower; nr<nrupper; nr++) {
						category[32767+nr] = cat;
						bitcode[32767+nr] = [];
						bitcode[32767+nr][1] = cat;
						bitcode[32767+nr][0] = nr;
					}
					//Negative numbers
					for (var nrneg =-(nrupper-1); nrneg<=-nrlower; nrneg++) {
						category[32767+nrneg] = cat;
						bitcode[32767+nrneg] = [];
						bitcode[32767+nrneg][1] = cat;
						bitcode[32767+nrneg][0] = nrupper-1+nrneg;
					}
					nrlower <<= 1;
					nrupper <<= 1;
				}
			}
			
			function initRGBYUVTable() {
				for(var i = 0; i < 256;i++) {
					RGB_YUV_TABLE[i]      		=  19595 * i;
					RGB_YUV_TABLE[(i+ 256)>>0] 	=  38470 * i;
					RGB_YUV_TABLE[(i+ 512)>>0] 	=   7471 * i + 0x8000;
					RGB_YUV_TABLE[(i+ 768)>>0] 	= -11059 * i;
					RGB_YUV_TABLE[(i+1024)>>0] 	= -21709 * i;
					RGB_YUV_TABLE[(i+1280)>>0] 	=  32768 * i + 0x807FFF;
					RGB_YUV_TABLE[(i+1536)>>0] 	= -27439 * i;
					RGB_YUV_TABLE[(i+1792)>>0] 	= - 5329 * i;
				}
			}
			
			// IO functions
			function writeBits(bs)
			{
				var value = bs[0];
				var posval = bs[1]-1;
				while ( posval >= 0 ) {
					if (value & (1 << posval) ) {
						bytenew |= (1 << bytepos);
					}
					posval--;
					bytepos--;
					if (bytepos < 0) {
						if (bytenew == 0xFF) {
							writeByte(0xFF);
							writeByte(0);
						}
						else {
							writeByte(bytenew);
						}
						bytepos=7;
						bytenew=0;
					}
				}
			}
		
			function writeByte(value)
			{
				//byteout.push(clt[value]); // write char directly instead of converting later
	      byteout.push(value);
			}
		
			function writeWord(value)
			{
				writeByte((value>>8)&0xFF);
				writeByte((value   )&0xFF);
			}
			
			// DCT & quantization core
			function fDCTQuant(data, fdtbl)
			{
				var d0, d1, d2, d3, d4, d5, d6, d7;
				/* Pass 1: process rows. */
				var dataOff=0;
				var i;
				var I8 = 8;
				var I64 = 64;
				for (i=0; i<I8; ++i)
				{
					d0 = data[dataOff];
					d1 = data[dataOff+1];
					d2 = data[dataOff+2];
					d3 = data[dataOff+3];
					d4 = data[dataOff+4];
					d5 = data[dataOff+5];
					d6 = data[dataOff+6];
					d7 = data[dataOff+7];
					
					var tmp0 = d0 + d7;
					var tmp7 = d0 - d7;
					var tmp1 = d1 + d6;
					var tmp6 = d1 - d6;
					var tmp2 = d2 + d5;
					var tmp5 = d2 - d5;
					var tmp3 = d3 + d4;
					var tmp4 = d3 - d4;
		
					/* Even part */
					var tmp10 = tmp0 + tmp3;	/* phase 2 */
					var tmp13 = tmp0 - tmp3;
					var tmp11 = tmp1 + tmp2;
					var tmp12 = tmp1 - tmp2;
		
					data[dataOff] = tmp10 + tmp11; /* phase 3 */
					data[dataOff+4] = tmp10 - tmp11;
		
					var z1 = (tmp12 + tmp13) * 0.707106781; /* c4 */
					data[dataOff+2] = tmp13 + z1; /* phase 5 */
					data[dataOff+6] = tmp13 - z1;
		
					/* Odd part */
					tmp10 = tmp4 + tmp5; /* phase 2 */
					tmp11 = tmp5 + tmp6;
					tmp12 = tmp6 + tmp7;
		
					/* The rotator is modified from fig 4-8 to avoid extra negations. */
					var z5 = (tmp10 - tmp12) * 0.382683433; /* c6 */
					var z2 = 0.541196100 * tmp10 + z5; /* c2-c6 */
					var z4 = 1.306562965 * tmp12 + z5; /* c2+c6 */
					var z3 = tmp11 * 0.707106781; /* c4 */
		
					var z11 = tmp7 + z3;	/* phase 5 */
					var z13 = tmp7 - z3;
		
					data[dataOff+5] = z13 + z2;	/* phase 6 */
					data[dataOff+3] = z13 - z2;
					data[dataOff+1] = z11 + z4;
					data[dataOff+7] = z11 - z4;
		
					dataOff += 8; /* advance pointer to next row */
				}
		
				/* Pass 2: process columns. */
				dataOff = 0;
				for (i=0; i<I8; ++i)
				{
					d0 = data[dataOff];
					d1 = data[dataOff + 8];
					d2 = data[dataOff + 16];
					d3 = data[dataOff + 24];
					d4 = data[dataOff + 32];
					d5 = data[dataOff + 40];
					d6 = data[dataOff + 48];
					d7 = data[dataOff + 56];
					
					var tmp0p2 = d0 + d7;
					var tmp7p2 = d0 - d7;
					var tmp1p2 = d1 + d6;
					var tmp6p2 = d1 - d6;
					var tmp2p2 = d2 + d5;
					var tmp5p2 = d2 - d5;
					var tmp3p2 = d3 + d4;
					var tmp4p2 = d3 - d4;
		
					/* Even part */
					var tmp10p2 = tmp0p2 + tmp3p2;	/* phase 2 */
					var tmp13p2 = tmp0p2 - tmp3p2;
					var tmp11p2 = tmp1p2 + tmp2p2;
					var tmp12p2 = tmp1p2 - tmp2p2;
		
					data[dataOff] = tmp10p2 + tmp11p2; /* phase 3 */
					data[dataOff+32] = tmp10p2 - tmp11p2;
		
					var z1p2 = (tmp12p2 + tmp13p2) * 0.707106781; /* c4 */
					data[dataOff+16] = tmp13p2 + z1p2; /* phase 5 */
					data[dataOff+48] = tmp13p2 - z1p2;
		
					/* Odd part */
					tmp10p2 = tmp4p2 + tmp5p2; /* phase 2 */
					tmp11p2 = tmp5p2 + tmp6p2;
					tmp12p2 = tmp6p2 + tmp7p2;
		
					/* The rotator is modified from fig 4-8 to avoid extra negations. */
					var z5p2 = (tmp10p2 - tmp12p2) * 0.382683433; /* c6 */
					var z2p2 = 0.541196100 * tmp10p2 + z5p2; /* c2-c6 */
					var z4p2 = 1.306562965 * tmp12p2 + z5p2; /* c2+c6 */
					var z3p2 = tmp11p2 * 0.707106781; /* c4 */
		
					var z11p2 = tmp7p2 + z3p2;	/* phase 5 */
					var z13p2 = tmp7p2 - z3p2;
		
					data[dataOff+40] = z13p2 + z2p2; /* phase 6 */
					data[dataOff+24] = z13p2 - z2p2;
					data[dataOff+ 8] = z11p2 + z4p2;
					data[dataOff+56] = z11p2 - z4p2;
		
					dataOff++; /* advance pointer to next column */
				}
		
				// Quantize/descale the coefficients
				var fDCTQuant;
				for (i=0; i<I64; ++i)
				{
					// Apply the quantization and scaling factor & Round to nearest integer
					fDCTQuant = data[i]*fdtbl[i];
					outputfDCTQuant[i] = (fDCTQuant > 0.0) ? ((fDCTQuant + 0.5)|0) : ((fDCTQuant - 0.5)|0);
					//outputfDCTQuant[i] = fround(fDCTQuant);
	
				}
				return outputfDCTQuant;
			}
			
			function writeAPP0()
			{
				writeWord(0xFFE0); // marker
				writeWord(16); // length
				writeByte(0x4A); // J
				writeByte(0x46); // F
				writeByte(0x49); // I
				writeByte(0x46); // F
				writeByte(0); // = "JFIF",'\0'
				writeByte(1); // versionhi
				writeByte(1); // versionlo
				writeByte(0); // xyunits
				writeWord(1); // xdensity
				writeWord(1); // ydensity
				writeByte(0); // thumbnwidth
				writeByte(0); // thumbnheight
			}
		
			function writeSOF0(width, height)
			{
				writeWord(0xFFC0); // marker
				writeWord(17);   // length, truecolor YUV JPG
				writeByte(8);    // precision
				writeWord(height);
				writeWord(width);
				writeByte(3);    // nrofcomponents
				writeByte(1);    // IdY
				writeByte(0x11); // HVY
				writeByte(0);    // QTY
				writeByte(2);    // IdU
				writeByte(0x11); // HVU
				writeByte(1);    // QTU
				writeByte(3);    // IdV
				writeByte(0x11); // HVV
				writeByte(1);    // QTV
			}
		
			function writeDQT()
			{
				writeWord(0xFFDB); // marker
				writeWord(132);	   // length
				writeByte(0);
				for (var i=0; i<64; i++) {
					writeByte(YTable[i]);
				}
				writeByte(1);
				for (var j=0; j<64; j++) {
					writeByte(UVTable[j]);
				}
			}
		
			function writeDHT()
			{
				writeWord(0xFFC4); // marker
				writeWord(0x01A2); // length
		
				writeByte(0); // HTYDCinfo
				for (var i=0; i<16; i++) {
					writeByte(std_dc_luminance_nrcodes[i+1]);
				}
				for (var j=0; j<=11; j++) {
					writeByte(std_dc_luminance_values[j]);
				}
		
				writeByte(0x10); // HTYACinfo
				for (var k=0; k<16; k++) {
					writeByte(std_ac_luminance_nrcodes[k+1]);
				}
				for (var l=0; l<=161; l++) {
					writeByte(std_ac_luminance_values[l]);
				}
		
				writeByte(1); // HTUDCinfo
				for (var m=0; m<16; m++) {
					writeByte(std_dc_chrominance_nrcodes[m+1]);
				}
				for (var n=0; n<=11; n++) {
					writeByte(std_dc_chrominance_values[n]);
				}
		
				writeByte(0x11); // HTUACinfo
				for (var o=0; o<16; o++) {
					writeByte(std_ac_chrominance_nrcodes[o+1]);
				}
				for (var p=0; p<=161; p++) {
					writeByte(std_ac_chrominance_values[p]);
				}
			}
		
			function writeSOS()
			{
				writeWord(0xFFDA); // marker
				writeWord(12); // length
				writeByte(3); // nrofcomponents
				writeByte(1); // IdY
				writeByte(0); // HTY
				writeByte(2); // IdU
				writeByte(0x11); // HTU
				writeByte(3); // IdV
				writeByte(0x11); // HTV
				writeByte(0); // Ss
				writeByte(0x3f); // Se
				writeByte(0); // Bf
			}
			
			function processDU(CDU, fdtbl, DC, HTDC, HTAC){
				var EOB = HTAC[0x00];
				var M16zeroes = HTAC[0xF0];
				var pos;
				var I16 = 16;
				var I63 = 63;
				var I64 = 64;
				var DU_DCT = fDCTQuant(CDU, fdtbl);
				//ZigZag reorder
				for (var j=0;j<I64;++j) {
					DU[ZigZag[j]]=DU_DCT[j];
				}
				var Diff = DU[0] - DC; DC = DU[0];
				//Encode DC
				if (Diff==0) {
					writeBits(HTDC[0]); // Diff might be 0
				} else {
					pos = 32767+Diff;
					writeBits(HTDC[category[pos]]);
					writeBits(bitcode[pos]);
				}
				//Encode ACs
				var end0pos = 63; // was const... which is crazy
				for (; (end0pos>0)&&(DU[end0pos]==0); end0pos--) {};
				//end0pos = first element in reverse order !=0
				if ( end0pos == 0) {
					writeBits(EOB);
					return DC;
				}
				var i = 1;
				var lng;
				while ( i <= end0pos ) {
					var startpos = i;
					for (; (DU[i]==0) && (i<=end0pos); ++i) {}
					var nrzeroes = i-startpos;
					if ( nrzeroes >= I16 ) {
						lng = nrzeroes>>4;
						for (var nrmarker=1; nrmarker <= lng; ++nrmarker)
							writeBits(M16zeroes);
						nrzeroes = nrzeroes&0xF;
					}
					pos = 32767+DU[i];
					writeBits(HTAC[(nrzeroes<<4)+category[pos]]);
					writeBits(bitcode[pos]);
					i++;
				}
				if ( end0pos != I63 ) {
					writeBits(EOB);
				}
				return DC;
			}
	
			function initCharLookupTable(){
				var sfcc = String.fromCharCode;
				for(var i=0; i < 256; i++){ ///// ACHTUNG // 255
					clt[i] = sfcc(i);
				}
			}
			
			this.encode = function(image,quality) // image data object
			{
				var time_start = new Date().getTime();
				
				if(quality) setQuality(quality);
				
				// Initialize bit writer
				byteout = new Array();
				bytenew=0;
				bytepos=7;
		
				// Add JPEG headers
				writeWord(0xFFD8); // SOI
				writeAPP0();
				writeDQT();
				writeSOF0(image.width,image.height);
				writeDHT();
				writeSOS();
	
		
				// Encode 8x8 macroblocks
				var DCY=0;
				var DCU=0;
				var DCV=0;
				
				bytenew=0;
				bytepos=7;
				
				
				this.encode.displayName = "_encode_";
	
				var imageData = image.data;
				var width = image.width;
				var height = image.height;
	
				var quadWidth = width*4;
				var tripleWidth = width*3;
				
				var x, y = 0;
				var r, g, b;
				var start,p, col,row,pos;
				while(y < height){
					x = 0;
					while(x < quadWidth){
					start = quadWidth * y + x;
					p = start;
					col = -1;
					row = 0;
					
					for(pos=0; pos < 64; pos++){
						row = pos >> 3;// /8
						col = ( pos & 7 ) * 4; // %8
						p = start + ( row * quadWidth ) + col;		
						
						if(y+row >= height){ // padding bottom
							p-= (quadWidth*(y+1+row-height));
						}
	
						if(x+col >= quadWidth){ // padding right	
							p-= ((x+col) - quadWidth +4)
						}
						
						r = imageData[ p++ ];
						g = imageData[ p++ ];
						b = imageData[ p++ ];
						
						
						/* // calculate YUV values dynamically
						YDU[pos]=((( 0.29900)*r+( 0.58700)*g+( 0.11400)*b))-128; //-0x80
						UDU[pos]=(((-0.16874)*r+(-0.33126)*g+( 0.50000)*b));
						VDU[pos]=((( 0.50000)*r+(-0.41869)*g+(-0.08131)*b));
						*/
						
						// use lookup table (slightly faster)
						YDU[pos] = ((RGB_YUV_TABLE[r]             + RGB_YUV_TABLE[(g +  256)>>0] + RGB_YUV_TABLE[(b +  512)>>0]) >> 16)-128;
						UDU[pos] = ((RGB_YUV_TABLE[(r +  768)>>0] + RGB_YUV_TABLE[(g + 1024)>>0] + RGB_YUV_TABLE[(b + 1280)>>0]) >> 16)-128;
						VDU[pos] = ((RGB_YUV_TABLE[(r + 1280)>>0] + RGB_YUV_TABLE[(g + 1536)>>0] + RGB_YUV_TABLE[(b + 1792)>>0]) >> 16)-128;
	
					}
					
					DCY = processDU(YDU, fdtbl_Y, DCY, YDC_HT, YAC_HT);
					DCU = processDU(UDU, fdtbl_UV, DCU, UVDC_HT, UVAC_HT);
					DCV = processDU(VDU, fdtbl_UV, DCV, UVDC_HT, UVAC_HT);
					x+=32;
					}
					y+=8;
				}
				
				
				////////////////////////////////////////////////////////////////
		
				// Do the bit alignment of the EOI marker
				if ( bytepos >= 0 ) {
					var fillbits = [];
					fillbits[1] = bytepos+1;
					fillbits[0] = (1<<(bytepos+1))-1;
					writeBits(fillbits);
				}
		
				writeWord(0xFFD9); //EOI
	
	      //return new Uint8Array(byteout);
	      return new Buffer(byteout);
	
				var jpegDataUri = 'data:image/jpeg;base64,' + btoa(byteout.join(''));
				
				byteout = [];
				
				// benchmarking
				var duration = new Date().getTime() - time_start;
	    		//console.log('Encoding time: '+ duration + 'ms');
	    		//
				
				return jpegDataUri			
		}
		
		function setQuality(quality){
			if (quality <= 0) {
				quality = 1;
			}
			if (quality > 100) {
				quality = 100;
			}
			
			if(currentQuality == quality) return // don't recalc if unchanged
			
			var sf = 0;
			if (quality < 50) {
				sf = Math.floor(5000 / quality);
			} else {
				sf = Math.floor(200 - quality*2);
			}
			
			initQuantTables(sf);
			currentQuality = quality;
			//console.log('Quality set to: '+quality +'%');
		}
		
		function init(){
			var time_start = new Date().getTime();
			if(!quality) quality = 50;
			// Create tables
			initCharLookupTable()
			initHuffmanTbl();
			initCategoryNumber();
			initRGBYUVTable();
			
			setQuality(quality);
			var duration = new Date().getTime() - time_start;
	    	//console.log('Initialization '+ duration + 'ms');
		}
		
		init();
		
	};
	if (typeof module !== undefined) {
		module.exports = encode;
	}
	
	function encode(imgData, qu) {
	  if (typeof qu === 'undefined') qu = 50;
	  var encoder = new JPEGEncoder(qu);
		var data = encoder.encode(imgData, qu);
	  return {
	    data: data,
	    width: imgData.width,
	    height: imgData.height
	  };
	}
	
	// helper function to get the imageData of an existing image on the current page.
	function getImageDataFromImage(idOrElement){
		var theImg = (typeof(idOrElement)=='string')? document.getElementById(idOrElement):idOrElement;
		var cvs = document.createElement('canvas');
		cvs.width = theImg.width;
		cvs.height = theImg.height;
		var ctx = cvs.getContext("2d");
		ctx.drawImage(theImg,0,0);
		
		return (ctx.getImageData(0, 0, cvs.width, cvs.height));
	}


/***/ }),
/* 10 */
/***/ (function(module, exports) {

	/* -*- tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
	/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
	/*
	   Copyright 2011 notmasteryet
	
	   Licensed under the Apache License, Version 2.0 (the "License");
	   you may not use this file except in compliance with the License.
	   You may obtain a copy of the License at
	
	       http://www.apache.org/licenses/LICENSE-2.0
	
	   Unless required by applicable law or agreed to in writing, software
	   distributed under the License is distributed on an "AS IS" BASIS,
	   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	   See the License for the specific language governing permissions and
	   limitations under the License.
	*/
	
	// - The JPEG specification can be found in the ITU CCITT Recommendation T.81
	//   (www.w3.org/Graphics/JPEG/itu-t81.pdf)
	// - The JFIF specification can be found in the JPEG File Interchange Format
	//   (www.w3.org/Graphics/JPEG/jfif3.pdf)
	// - The Adobe Application-Specific JPEG markers in the Supporting the DCT Filters
	//   in PostScript Level 2, Technical Note #5116
	//   (partners.adobe.com/public/developer/en/ps/sdk/5116.DCT_Filter.pdf)
	
	var JpegImage = (function jpegImage() {
	  "use strict";
	  var dctZigZag = new Int32Array([
	     0,
	     1,  8,
	    16,  9,  2,
	     3, 10, 17, 24,
	    32, 25, 18, 11, 4,
	     5, 12, 19, 26, 33, 40,
	    48, 41, 34, 27, 20, 13,  6,
	     7, 14, 21, 28, 35, 42, 49, 56,
	    57, 50, 43, 36, 29, 22, 15,
	    23, 30, 37, 44, 51, 58,
	    59, 52, 45, 38, 31,
	    39, 46, 53, 60,
	    61, 54, 47,
	    55, 62,
	    63
	  ]);
	
	  var dctCos1  =  4017   // cos(pi/16)
	  var dctSin1  =   799   // sin(pi/16)
	  var dctCos3  =  3406   // cos(3*pi/16)
	  var dctSin3  =  2276   // sin(3*pi/16)
	  var dctCos6  =  1567   // cos(6*pi/16)
	  var dctSin6  =  3784   // sin(6*pi/16)
	  var dctSqrt2 =  5793   // sqrt(2)
	  var dctSqrt1d2 = 2896  // sqrt(2) / 2
	
	  function constructor() {
	  }
	
	  function buildHuffmanTable(codeLengths, values) {
	    var k = 0, code = [], i, j, length = 16;
	    while (length > 0 && !codeLengths[length - 1])
	      length--;
	    code.push({children: [], index: 0});
	    var p = code[0], q;
	    for (i = 0; i < length; i++) {
	      for (j = 0; j < codeLengths[i]; j++) {
	        p = code.pop();
	        p.children[p.index] = values[k];
	        while (p.index > 0) {
	          if (code.length === 0)
	            throw new Error('Could not recreate Huffman Table');
	          p = code.pop();
	        }
	        p.index++;
	        code.push(p);
	        while (code.length <= i) {
	          code.push(q = {children: [], index: 0});
	          p.children[p.index] = q.children;
	          p = q;
	        }
	        k++;
	      }
	      if (i + 1 < length) {
	        // p here points to last code
	        code.push(q = {children: [], index: 0});
	        p.children[p.index] = q.children;
	        p = q;
	      }
	    }
	    return code[0].children;
	  }
	
	  function decodeScan(data, offset,
	                      frame, components, resetInterval,
	                      spectralStart, spectralEnd,
	                      successivePrev, successive) {
	    var precision = frame.precision;
	    var samplesPerLine = frame.samplesPerLine;
	    var scanLines = frame.scanLines;
	    var mcusPerLine = frame.mcusPerLine;
	    var progressive = frame.progressive;
	    var maxH = frame.maxH, maxV = frame.maxV;
	
	    var startOffset = offset, bitsData = 0, bitsCount = 0;
	    function readBit() {
	      if (bitsCount > 0) {
	        bitsCount--;
	        return (bitsData >> bitsCount) & 1;
	      }
	      bitsData = data[offset++];
	      if (bitsData == 0xFF) {
	        var nextByte = data[offset++];
	        if (nextByte) {
	          throw new Error("unexpected marker: " + ((bitsData << 8) | nextByte).toString(16));
	        }
	        // unstuff 0
	      }
	      bitsCount = 7;
	      return bitsData >>> 7;
	    }
	    function decodeHuffman(tree) {
	      var node = tree, bit;
	      while ((bit = readBit()) !== null) {
	        node = node[bit];
	        if (typeof node === 'number')
	          return node;
	        if (typeof node !== 'object')
	          throw new Error("invalid huffman sequence");
	      }
	      return null;
	    }
	    function receive(length) {
	      var n = 0;
	      while (length > 0) {
	        var bit = readBit();
	        if (bit === null) return;
	        n = (n << 1) | bit;
	        length--;
	      }
	      return n;
	    }
	    function receiveAndExtend(length) {
	      var n = receive(length);
	      if (n >= 1 << (length - 1))
	        return n;
	      return n + (-1 << length) + 1;
	    }
	    function decodeBaseline(component, zz) {
	      var t = decodeHuffman(component.huffmanTableDC);
	      var diff = t === 0 ? 0 : receiveAndExtend(t);
	      zz[0]= (component.pred += diff);
	      var k = 1;
	      while (k < 64) {
	        var rs = decodeHuffman(component.huffmanTableAC);
	        var s = rs & 15, r = rs >> 4;
	        if (s === 0) {
	          if (r < 15)
	            break;
	          k += 16;
	          continue;
	        }
	        k += r;
	        var z = dctZigZag[k];
	        zz[z] = receiveAndExtend(s);
	        k++;
	      }
	    }
	    function decodeDCFirst(component, zz) {
	      var t = decodeHuffman(component.huffmanTableDC);
	      var diff = t === 0 ? 0 : (receiveAndExtend(t) << successive);
	      zz[0] = (component.pred += diff);
	    }
	    function decodeDCSuccessive(component, zz) {
	      zz[0] |= readBit() << successive;
	    }
	    var eobrun = 0;
	    function decodeACFirst(component, zz) {
	      if (eobrun > 0) {
	        eobrun--;
	        return;
	      }
	      var k = spectralStart, e = spectralEnd;
	      while (k <= e) {
	        var rs = decodeHuffman(component.huffmanTableAC);
	        var s = rs & 15, r = rs >> 4;
	        if (s === 0) {
	          if (r < 15) {
	            eobrun = receive(r) + (1 << r) - 1;
	            break;
	          }
	          k += 16;
	          continue;
	        }
	        k += r;
	        var z = dctZigZag[k];
	        zz[z] = receiveAndExtend(s) * (1 << successive);
	        k++;
	      }
	    }
	    var successiveACState = 0, successiveACNextValue;
	    function decodeACSuccessive(component, zz) {
	      var k = spectralStart, e = spectralEnd, r = 0;
	      while (k <= e) {
	        var z = dctZigZag[k];
	        var direction = zz[z] < 0 ? -1 : 1;
	        switch (successiveACState) {
	        case 0: // initial state
	          var rs = decodeHuffman(component.huffmanTableAC);
	          var s = rs & 15, r = rs >> 4;
	          if (s === 0) {
	            if (r < 15) {
	              eobrun = receive(r) + (1 << r);
	              successiveACState = 4;
	            } else {
	              r = 16;
	              successiveACState = 1;
	            }
	          } else {
	            if (s !== 1)
	              throw new Error("invalid ACn encoding");
	            successiveACNextValue = receiveAndExtend(s);
	            successiveACState = r ? 2 : 3;
	          }
	          continue;
	        case 1: // skipping r zero items
	        case 2:
	          if (zz[z])
	            zz[z] += (readBit() << successive) * direction;
	          else {
	            r--;
	            if (r === 0)
	              successiveACState = successiveACState == 2 ? 3 : 0;
	          }
	          break;
	        case 3: // set value for a zero item
	          if (zz[z])
	            zz[z] += (readBit() << successive) * direction;
	          else {
	            zz[z] = successiveACNextValue << successive;
	            successiveACState = 0;
	          }
	          break;
	        case 4: // eob
	          if (zz[z])
	            zz[z] += (readBit() << successive) * direction;
	          break;
	        }
	        k++;
	      }
	      if (successiveACState === 4) {
	        eobrun--;
	        if (eobrun === 0)
	          successiveACState = 0;
	      }
	    }
	    function decodeMcu(component, decode, mcu, row, col) {
	      var mcuRow = (mcu / mcusPerLine) | 0;
	      var mcuCol = mcu % mcusPerLine;
	      var blockRow = mcuRow * component.v + row;
	      var blockCol = mcuCol * component.h + col;
	      decode(component, component.blocks[blockRow][blockCol]);
	    }
	    function decodeBlock(component, decode, mcu) {
	      var blockRow = (mcu / component.blocksPerLine) | 0;
	      var blockCol = mcu % component.blocksPerLine;
	      decode(component, component.blocks[blockRow][blockCol]);
	    }
	
	    var componentsLength = components.length;
	    var component, i, j, k, n;
	    var decodeFn;
	    if (progressive) {
	      if (spectralStart === 0)
	        decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
	      else
	        decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
	    } else {
	      decodeFn = decodeBaseline;
	    }
	
	    var mcu = 0, marker;
	    var mcuExpected;
	    if (componentsLength == 1) {
	      mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
	    } else {
	      mcuExpected = mcusPerLine * frame.mcusPerColumn;
	    }
	    if (!resetInterval) resetInterval = mcuExpected;
	
	    var h, v;
	    while (mcu < mcuExpected) {
	      // reset interval stuff
	      for (i = 0; i < componentsLength; i++)
	        components[i].pred = 0;
	      eobrun = 0;
	
	      if (componentsLength == 1) {
	        component = components[0];
	        for (n = 0; n < resetInterval; n++) {
	          decodeBlock(component, decodeFn, mcu);
	          mcu++;
	        }
	      } else {
	        for (n = 0; n < resetInterval; n++) {
	          for (i = 0; i < componentsLength; i++) {
	            component = components[i];
	            h = component.h;
	            v = component.v;
	            for (j = 0; j < v; j++) {
	              for (k = 0; k < h; k++) {
	                decodeMcu(component, decodeFn, mcu, j, k);
	              }
	            }
	          }
	          mcu++;
	
	          // If we've reached our expected MCU's, stop decoding
	          if (mcu === mcuExpected) break;
	        }
	      }
	
	      // find marker
	      bitsCount = 0;
	      marker = (data[offset] << 8) | data[offset + 1];
	      if (marker < 0xFF00) {
	        throw new Error("marker was not found");
	      }
	
	      if (marker >= 0xFFD0 && marker <= 0xFFD7) { // RSTx
	        offset += 2;
	      }
	      else
	        break;
	    }
	
	    return offset - startOffset;
	  }
	
	  function buildComponentData(frame, component) {
	    var lines = [];
	    var blocksPerLine = component.blocksPerLine;
	    var blocksPerColumn = component.blocksPerColumn;
	    var samplesPerLine = blocksPerLine << 3;
	    var R = new Int32Array(64), r = new Uint8Array(64);
	
	    // A port of poppler's IDCT method which in turn is taken from:
	    //   Christoph Loeffler, Adriaan Ligtenberg, George S. Moschytz,
	    //   "Practical Fast 1-D DCT Algorithms with 11 Multiplications",
	    //   IEEE Intl. Conf. on Acoustics, Speech & Signal Processing, 1989,
	    //   988-991.
	    function quantizeAndInverse(zz, dataOut, dataIn) {
	      var qt = component.quantizationTable;
	      var v0, v1, v2, v3, v4, v5, v6, v7, t;
	      var p = dataIn;
	      var i;
	
	      // dequant
	      for (i = 0; i < 64; i++)
	        p[i] = zz[i] * qt[i];
	
	      // inverse DCT on rows
	      for (i = 0; i < 8; ++i) {
	        var row = 8 * i;
	
	        // check for all-zero AC coefficients
	        if (p[1 + row] == 0 && p[2 + row] == 0 && p[3 + row] == 0 &&
	            p[4 + row] == 0 && p[5 + row] == 0 && p[6 + row] == 0 &&
	            p[7 + row] == 0) {
	          t = (dctSqrt2 * p[0 + row] + 512) >> 10;
	          p[0 + row] = t;
	          p[1 + row] = t;
	          p[2 + row] = t;
	          p[3 + row] = t;
	          p[4 + row] = t;
	          p[5 + row] = t;
	          p[6 + row] = t;
	          p[7 + row] = t;
	          continue;
	        }
	
	        // stage 4
	        v0 = (dctSqrt2 * p[0 + row] + 128) >> 8;
	        v1 = (dctSqrt2 * p[4 + row] + 128) >> 8;
	        v2 = p[2 + row];
	        v3 = p[6 + row];
	        v4 = (dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128) >> 8;
	        v7 = (dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128) >> 8;
	        v5 = p[3 + row] << 4;
	        v6 = p[5 + row] << 4;
	
	        // stage 3
	        t = (v0 - v1+ 1) >> 1;
	        v0 = (v0 + v1 + 1) >> 1;
	        v1 = t;
	        t = (v2 * dctSin6 + v3 * dctCos6 + 128) >> 8;
	        v2 = (v2 * dctCos6 - v3 * dctSin6 + 128) >> 8;
	        v3 = t;
	        t = (v4 - v6 + 1) >> 1;
	        v4 = (v4 + v6 + 1) >> 1;
	        v6 = t;
	        t = (v7 + v5 + 1) >> 1;
	        v5 = (v7 - v5 + 1) >> 1;
	        v7 = t;
	
	        // stage 2
	        t = (v0 - v3 + 1) >> 1;
	        v0 = (v0 + v3 + 1) >> 1;
	        v3 = t;
	        t = (v1 - v2 + 1) >> 1;
	        v1 = (v1 + v2 + 1) >> 1;
	        v2 = t;
	        t = (v4 * dctSin3 + v7 * dctCos3 + 2048) >> 12;
	        v4 = (v4 * dctCos3 - v7 * dctSin3 + 2048) >> 12;
	        v7 = t;
	        t = (v5 * dctSin1 + v6 * dctCos1 + 2048) >> 12;
	        v5 = (v5 * dctCos1 - v6 * dctSin1 + 2048) >> 12;
	        v6 = t;
	
	        // stage 1
	        p[0 + row] = v0 + v7;
	        p[7 + row] = v0 - v7;
	        p[1 + row] = v1 + v6;
	        p[6 + row] = v1 - v6;
	        p[2 + row] = v2 + v5;
	        p[5 + row] = v2 - v5;
	        p[3 + row] = v3 + v4;
	        p[4 + row] = v3 - v4;
	      }
	
	      // inverse DCT on columns
	      for (i = 0; i < 8; ++i) {
	        var col = i;
	
	        // check for all-zero AC coefficients
	        if (p[1*8 + col] == 0 && p[2*8 + col] == 0 && p[3*8 + col] == 0 &&
	            p[4*8 + col] == 0 && p[5*8 + col] == 0 && p[6*8 + col] == 0 &&
	            p[7*8 + col] == 0) {
	          t = (dctSqrt2 * dataIn[i+0] + 8192) >> 14;
	          p[0*8 + col] = t;
	          p[1*8 + col] = t;
	          p[2*8 + col] = t;
	          p[3*8 + col] = t;
	          p[4*8 + col] = t;
	          p[5*8 + col] = t;
	          p[6*8 + col] = t;
	          p[7*8 + col] = t;
	          continue;
	        }
	
	        // stage 4
	        v0 = (dctSqrt2 * p[0*8 + col] + 2048) >> 12;
	        v1 = (dctSqrt2 * p[4*8 + col] + 2048) >> 12;
	        v2 = p[2*8 + col];
	        v3 = p[6*8 + col];
	        v4 = (dctSqrt1d2 * (p[1*8 + col] - p[7*8 + col]) + 2048) >> 12;
	        v7 = (dctSqrt1d2 * (p[1*8 + col] + p[7*8 + col]) + 2048) >> 12;
	        v5 = p[3*8 + col];
	        v6 = p[5*8 + col];
	
	        // stage 3
	        t = (v0 - v1 + 1) >> 1;
	        v0 = (v0 + v1 + 1) >> 1;
	        v1 = t;
	        t = (v2 * dctSin6 + v3 * dctCos6 + 2048) >> 12;
	        v2 = (v2 * dctCos6 - v3 * dctSin6 + 2048) >> 12;
	        v3 = t;
	        t = (v4 - v6 + 1) >> 1;
	        v4 = (v4 + v6 + 1) >> 1;
	        v6 = t;
	        t = (v7 + v5 + 1) >> 1;
	        v5 = (v7 - v5 + 1) >> 1;
	        v7 = t;
	
	        // stage 2
	        t = (v0 - v3 + 1) >> 1;
	        v0 = (v0 + v3 + 1) >> 1;
	        v3 = t;
	        t = (v1 - v2 + 1) >> 1;
	        v1 = (v1 + v2 + 1) >> 1;
	        v2 = t;
	        t = (v4 * dctSin3 + v7 * dctCos3 + 2048) >> 12;
	        v4 = (v4 * dctCos3 - v7 * dctSin3 + 2048) >> 12;
	        v7 = t;
	        t = (v5 * dctSin1 + v6 * dctCos1 + 2048) >> 12;
	        v5 = (v5 * dctCos1 - v6 * dctSin1 + 2048) >> 12;
	        v6 = t;
	
	        // stage 1
	        p[0*8 + col] = v0 + v7;
	        p[7*8 + col] = v0 - v7;
	        p[1*8 + col] = v1 + v6;
	        p[6*8 + col] = v1 - v6;
	        p[2*8 + col] = v2 + v5;
	        p[5*8 + col] = v2 - v5;
	        p[3*8 + col] = v3 + v4;
	        p[4*8 + col] = v3 - v4;
	      }
	
	      // convert to 8-bit integers
	      for (i = 0; i < 64; ++i) {
	        var sample = 128 + ((p[i] + 8) >> 4);
	        dataOut[i] = sample < 0 ? 0 : sample > 0xFF ? 0xFF : sample;
	      }
	    }
	
	    var i, j;
	    for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
	      var scanLine = blockRow << 3;
	      for (i = 0; i < 8; i++)
	        lines.push(new Uint8Array(samplesPerLine));
	      for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
	        quantizeAndInverse(component.blocks[blockRow][blockCol], r, R);
	
	        var offset = 0, sample = blockCol << 3;
	        for (j = 0; j < 8; j++) {
	          var line = lines[scanLine + j];
	          for (i = 0; i < 8; i++)
	            line[sample + i] = r[offset++];
	        }
	      }
	    }
	    return lines;
	  }
	
	  function clampTo8bit(a) {
	    return a < 0 ? 0 : a > 255 ? 255 : a;
	  }
	
	  constructor.prototype = {
	    load: function load(path) {
	      var xhr = new XMLHttpRequest();
	      xhr.open("GET", path, true);
	      xhr.responseType = "arraybuffer";
	      xhr.onload = (function() {
	        // TODO catch parse error
	        var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
	        this.parse(data);
	        if (this.onload)
	          this.onload();
	      }).bind(this);
	      xhr.send(null);
	    },
	    parse: function parse(data) {
	      var offset = 0, length = data.length;
	      function readUint16() {
	        var value = (data[offset] << 8) | data[offset + 1];
	        offset += 2;
	        return value;
	      }
	      function readDataBlock() {
	        var length = readUint16();
	        var array = data.subarray(offset, offset + length - 2);
	        offset += array.length;
	        return array;
	      }
	      function prepareComponents(frame) {
	        var maxH = 0, maxV = 0;
	        var component, componentId;
	        for (componentId in frame.components) {
	          if (frame.components.hasOwnProperty(componentId)) {
	            component = frame.components[componentId];
	            if (maxH < component.h) maxH = component.h;
	            if (maxV < component.v) maxV = component.v;
	          }
	        }
	        var mcusPerLine = Math.ceil(frame.samplesPerLine / 8 / maxH);
	        var mcusPerColumn = Math.ceil(frame.scanLines / 8 / maxV);
	        for (componentId in frame.components) {
	          if (frame.components.hasOwnProperty(componentId)) {
	            component = frame.components[componentId];
	            var blocksPerLine = Math.ceil(Math.ceil(frame.samplesPerLine / 8) * component.h / maxH);
	            var blocksPerColumn = Math.ceil(Math.ceil(frame.scanLines  / 8) * component.v / maxV);
	            var blocksPerLineForMcu = mcusPerLine * component.h;
	            var blocksPerColumnForMcu = mcusPerColumn * component.v;
	            var blocks = [];
	            for (var i = 0; i < blocksPerColumnForMcu; i++) {
	              var row = [];
	              for (var j = 0; j < blocksPerLineForMcu; j++)
	                row.push(new Int32Array(64));
	              blocks.push(row);
	            }
	            component.blocksPerLine = blocksPerLine;
	            component.blocksPerColumn = blocksPerColumn;
	            component.blocks = blocks;
	          }
	        }
	        frame.maxH = maxH;
	        frame.maxV = maxV;
	        frame.mcusPerLine = mcusPerLine;
	        frame.mcusPerColumn = mcusPerColumn;
	      }
	      var jfif = null;
	      var adobe = null;
	      var pixels = null;
	      var frame, resetInterval;
	      var quantizationTables = [], frames = [];
	      var huffmanTablesAC = [], huffmanTablesDC = [];
	      var fileMarker = readUint16();
	      if (fileMarker != 0xFFD8) { // SOI (Start of Image)
	        throw new Error("SOI not found");
	      }
	
	      fileMarker = readUint16();
	      while (fileMarker != 0xFFD9) { // EOI (End of image)
	        var i, j, l;
	        switch(fileMarker) {
	          case 0xFF00: break;
	          case 0xFFE0: // APP0 (Application Specific)
	          case 0xFFE1: // APP1
	          case 0xFFE2: // APP2
	          case 0xFFE3: // APP3
	          case 0xFFE4: // APP4
	          case 0xFFE5: // APP5
	          case 0xFFE6: // APP6
	          case 0xFFE7: // APP7
	          case 0xFFE8: // APP8
	          case 0xFFE9: // APP9
	          case 0xFFEA: // APP10
	          case 0xFFEB: // APP11
	          case 0xFFEC: // APP12
	          case 0xFFED: // APP13
	          case 0xFFEE: // APP14
	          case 0xFFEF: // APP15
	          case 0xFFFE: // COM (Comment)
	            var appData = readDataBlock();
	
	            if (fileMarker === 0xFFE0) {
	              if (appData[0] === 0x4A && appData[1] === 0x46 && appData[2] === 0x49 &&
	                appData[3] === 0x46 && appData[4] === 0) { // 'JFIF\x00'
	                jfif = {
	                  version: { major: appData[5], minor: appData[6] },
	                  densityUnits: appData[7],
	                  xDensity: (appData[8] << 8) | appData[9],
	                  yDensity: (appData[10] << 8) | appData[11],
	                  thumbWidth: appData[12],
	                  thumbHeight: appData[13],
	                  thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
	                };
	              }
	            }
	            // TODO APP1 - Exif
	            if (fileMarker === 0xFFEE) {
	              if (appData[0] === 0x41 && appData[1] === 0x64 && appData[2] === 0x6F &&
	                appData[3] === 0x62 && appData[4] === 0x65 && appData[5] === 0) { // 'Adobe\x00'
	                adobe = {
	                  version: appData[6],
	                  flags0: (appData[7] << 8) | appData[8],
	                  flags1: (appData[9] << 8) | appData[10],
	                  transformCode: appData[11]
	                };
	              }
	            }
	            break;
	
	          case 0xFFDB: // DQT (Define Quantization Tables)
	            var quantizationTablesLength = readUint16();
	            var quantizationTablesEnd = quantizationTablesLength + offset - 2;
	            while (offset < quantizationTablesEnd) {
	              var quantizationTableSpec = data[offset++];
	              var tableData = new Int32Array(64);
	              if ((quantizationTableSpec >> 4) === 0) { // 8 bit values
	                for (j = 0; j < 64; j++) {
	                  var z = dctZigZag[j];
	                  tableData[z] = data[offset++];
	                }
	              } else if ((quantizationTableSpec >> 4) === 1) { //16 bit
	                for (j = 0; j < 64; j++) {
	                  var z = dctZigZag[j];
	                  tableData[z] = readUint16();
	                }
	              } else
	                throw new Error("DQT: invalid table spec");
	              quantizationTables[quantizationTableSpec & 15] = tableData;
	            }
	            break;
	
	          case 0xFFC0: // SOF0 (Start of Frame, Baseline DCT)
	          case 0xFFC1: // SOF1 (Start of Frame, Extended DCT)
	          case 0xFFC2: // SOF2 (Start of Frame, Progressive DCT)
	            readUint16(); // skip data length
	            frame = {};
	            frame.extended = (fileMarker === 0xFFC1);
	            frame.progressive = (fileMarker === 0xFFC2);
	            frame.precision = data[offset++];
	            frame.scanLines = readUint16();
	            frame.samplesPerLine = readUint16();
	            frame.components = {};
	            frame.componentsOrder = [];
	            var componentsCount = data[offset++], componentId;
	            var maxH = 0, maxV = 0;
	            for (i = 0; i < componentsCount; i++) {
	              componentId = data[offset];
	              var h = data[offset + 1] >> 4;
	              var v = data[offset + 1] & 15;
	              var qId = data[offset + 2];
	              frame.componentsOrder.push(componentId);
	              frame.components[componentId] = {
	                h: h,
	                v: v,
	                quantizationIdx: qId
	              };
	              offset += 3;
	            }
	            prepareComponents(frame);
	            frames.push(frame);
	            break;
	
	          case 0xFFC4: // DHT (Define Huffman Tables)
	            var huffmanLength = readUint16();
	            for (i = 2; i < huffmanLength;) {
	              var huffmanTableSpec = data[offset++];
	              var codeLengths = new Uint8Array(16);
	              var codeLengthSum = 0;
	              for (j = 0; j < 16; j++, offset++)
	                codeLengthSum += (codeLengths[j] = data[offset]);
	              var huffmanValues = new Uint8Array(codeLengthSum);
	              for (j = 0; j < codeLengthSum; j++, offset++)
	                huffmanValues[j] = data[offset];
	              i += 17 + codeLengthSum;
	
	              ((huffmanTableSpec >> 4) === 0 ?
	                huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] =
	                buildHuffmanTable(codeLengths, huffmanValues);
	            }
	            break;
	
	          case 0xFFDD: // DRI (Define Restart Interval)
	            readUint16(); // skip data length
	            resetInterval = readUint16();
	            break;
	
	          case 0xFFDA: // SOS (Start of Scan)
	            var scanLength = readUint16();
	            var selectorsCount = data[offset++];
	            var components = [], component;
	            for (i = 0; i < selectorsCount; i++) {
	              component = frame.components[data[offset++]];
	              var tableSpec = data[offset++];
	              component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
	              component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
	              components.push(component);
	            }
	            var spectralStart = data[offset++];
	            var spectralEnd = data[offset++];
	            var successiveApproximation = data[offset++];
	            var processed = decodeScan(data, offset,
	              frame, components, resetInterval,
	              spectralStart, spectralEnd,
	              successiveApproximation >> 4, successiveApproximation & 15);
	            offset += processed;
	            break;
	
	          case 0xFFFF: // Fill bytes
	            if (data[offset] !== 0xFF) { // Avoid skipping a valid marker.
	              offset--;
	            }
	            break;
	
	          default:
	            if (data[offset - 3] == 0xFF &&
	                data[offset - 2] >= 0xC0 && data[offset - 2] <= 0xFE) {
	              // could be incorrect encoding -- last 0xFF byte of the previous
	              // block was eaten by the encoder
	              offset -= 3;
	              break;
	            }
	            throw new Error("unknown JPEG marker " + fileMarker.toString(16));
	        }
	        fileMarker = readUint16();
	      }
	      if (frames.length != 1)
	        throw new Error("only single frame JPEGs supported");
	
	      // set each frame's components quantization table
	      for (var i = 0; i < frames.length; i++) {
	        var cp = frames[i].components;
	        for (var j in cp) {
	          cp[j].quantizationTable = quantizationTables[cp[j].quantizationIdx];
	          delete cp[j].quantizationIdx;
	        }
	      }
	
	      this.width = frame.samplesPerLine;
	      this.height = frame.scanLines;
	      this.jfif = jfif;
	      this.adobe = adobe;
	      this.components = [];
	      for (var i = 0; i < frame.componentsOrder.length; i++) {
	        var component = frame.components[frame.componentsOrder[i]];
	        this.components.push({
	          lines: buildComponentData(frame, component),
	          scaleX: component.h / frame.maxH,
	          scaleY: component.v / frame.maxV
	        });
	      }
	    },
	    getData: function getData(width, height) {
	      var scaleX = this.width / width, scaleY = this.height / height;
	
	      var component1, component2, component3, component4;
	      var component1Line, component2Line, component3Line, component4Line;
	      var x, y;
	      var offset = 0;
	      var Y, Cb, Cr, K, C, M, Ye, R, G, B;
	      var colorTransform;
	      var dataLength = width * height * this.components.length;
	      var data = new Uint8Array(dataLength);
	      switch (this.components.length) {
	        case 1:
	          component1 = this.components[0];
	          for (y = 0; y < height; y++) {
	            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
	            for (x = 0; x < width; x++) {
	              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
	
	              data[offset++] = Y;
	            }
	          }
	          break;
	        case 2:
	          // PDF might compress two component data in custom colorspace
	          component1 = this.components[0];
	          component2 = this.components[1];
	          for (y = 0; y < height; y++) {
	            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
	            component2Line = component2.lines[0 | (y * component2.scaleY * scaleY)];
	            for (x = 0; x < width; x++) {
	              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
	              data[offset++] = Y;
	              Y = component2Line[0 | (x * component2.scaleX * scaleX)];
	              data[offset++] = Y;
	            }
	          }
	          break;
	        case 3:
	          // The default transform for three components is true
	          colorTransform = true;
	          // The adobe transform marker overrides any previous setting
	          if (this.adobe && this.adobe.transformCode)
	            colorTransform = true;
	          else if (typeof this.colorTransform !== 'undefined')
	            colorTransform = !!this.colorTransform;
	
	          component1 = this.components[0];
	          component2 = this.components[1];
	          component3 = this.components[2];
	          for (y = 0; y < height; y++) {
	            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
	            component2Line = component2.lines[0 | (y * component2.scaleY * scaleY)];
	            component3Line = component3.lines[0 | (y * component3.scaleY * scaleY)];
	            for (x = 0; x < width; x++) {
	              if (!colorTransform) {
	                R = component1Line[0 | (x * component1.scaleX * scaleX)];
	                G = component2Line[0 | (x * component2.scaleX * scaleX)];
	                B = component3Line[0 | (x * component3.scaleX * scaleX)];
	              } else {
	                Y = component1Line[0 | (x * component1.scaleX * scaleX)];
	                Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
	                Cr = component3Line[0 | (x * component3.scaleX * scaleX)];
	
	                R = clampTo8bit(Y + 1.402 * (Cr - 128));
	                G = clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
	                B = clampTo8bit(Y + 1.772 * (Cb - 128));
	              }
	
	              data[offset++] = R;
	              data[offset++] = G;
	              data[offset++] = B;
	            }
	          }
	          break;
	        case 4:
	          if (!this.adobe)
	            throw new Error('Unsupported color mode (4 components)');
	          // The default transform for four components is false
	          colorTransform = false;
	          // The adobe transform marker overrides any previous setting
	          if (this.adobe && this.adobe.transformCode)
	            colorTransform = true;
	          else if (typeof this.colorTransform !== 'undefined')
	            colorTransform = !!this.colorTransform;
	
	          component1 = this.components[0];
	          component2 = this.components[1];
	          component3 = this.components[2];
	          component4 = this.components[3];
	          for (y = 0; y < height; y++) {
	            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
	            component2Line = component2.lines[0 | (y * component2.scaleY * scaleY)];
	            component3Line = component3.lines[0 | (y * component3.scaleY * scaleY)];
	            component4Line = component4.lines[0 | (y * component4.scaleY * scaleY)];
	            for (x = 0; x < width; x++) {
	              if (!colorTransform) {
	                C = component1Line[0 | (x * component1.scaleX * scaleX)];
	                M = component2Line[0 | (x * component2.scaleX * scaleX)];
	                Ye = component3Line[0 | (x * component3.scaleX * scaleX)];
	                K = component4Line[0 | (x * component4.scaleX * scaleX)];
	              } else {
	                Y = component1Line[0 | (x * component1.scaleX * scaleX)];
	                Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
	                Cr = component3Line[0 | (x * component3.scaleX * scaleX)];
	                K = component4Line[0 | (x * component4.scaleX * scaleX)];
	
	                C = 255 - clampTo8bit(Y + 1.402 * (Cr - 128));
	                M = 255 - clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
	                Ye = 255 - clampTo8bit(Y + 1.772 * (Cb - 128));
	              }
	              data[offset++] = 255-C;
	              data[offset++] = 255-M;
	              data[offset++] = 255-Ye;
	              data[offset++] = 255-K;
	            }
	          }
	          break;
	        default:
	          throw new Error('Unsupported color mode');
	      }
	      return data;
	    },
	    copyToImageData: function copyToImageData(imageData, formatAsRGBA) {
	      var width = imageData.width, height = imageData.height;
	      var imageDataArray = imageData.data;
	      var data = this.getData(width, height);
	      var i = 0, j = 0, x, y;
	      var Y, K, C, M, R, G, B;
	      switch (this.components.length) {
	        case 1:
	          for (y = 0; y < height; y++) {
	            for (x = 0; x < width; x++) {
	              Y = data[i++];
	
	              imageDataArray[j++] = Y;
	              imageDataArray[j++] = Y;
	              imageDataArray[j++] = Y;
	              if (formatAsRGBA) {
	                imageDataArray[j++] = 255;
	              }
	            }
	          }
	          break;
	        case 3:
	          for (y = 0; y < height; y++) {
	            for (x = 0; x < width; x++) {
	              R = data[i++];
	              G = data[i++];
	              B = data[i++];
	
	              imageDataArray[j++] = R;
	              imageDataArray[j++] = G;
	              imageDataArray[j++] = B;
	              if (formatAsRGBA) {
	                imageDataArray[j++] = 255;
	              }
	            }
	          }
	          break;
	        case 4:
	          for (y = 0; y < height; y++) {
	            for (x = 0; x < width; x++) {
	              C = data[i++];
	              M = data[i++];
	              Y = data[i++];
	              K = data[i++];
	
	              R = 255 - clampTo8bit(C * (1 - K / 255) + K);
	              G = 255 - clampTo8bit(M * (1 - K / 255) + K);
	              B = 255 - clampTo8bit(Y * (1 - K / 255) + K);
	
	              imageDataArray[j++] = R;
	              imageDataArray[j++] = G;
	              imageDataArray[j++] = B;
	              if (formatAsRGBA) {
	                imageDataArray[j++] = 255;
	              }
	            }
	          }
	          break;
	        default:
	          throw new Error('Unsupported color mode');
	      }
	    }
	  };
	
	  return constructor;
	})();
	module.exports = decode;
	
	function decode(jpegData, opts) {
	  var defaultOpts = {
	    useTArray: false,
	    // "undefined" means "Choose whether to transform colors based on the image’s color model."
	    colorTransform: undefined,
	    formatAsRGBA: true
	  };
	  if (opts) {
	    if (typeof opts === 'object') {
	      opts = {
	        useTArray: (typeof opts.useTArray === 'undefined' ?
	                    defaultOpts.useTArray : opts.useTArray),
	        colorTransform: (typeof opts.colorTransform === 'undefined' ?
	                         defaultOpts.colorTransform : opts.colorTransform),
	        formatAsRGBA: (typeof opts.formatAsRGBA === 'undefined' ?
	                         defaultOpts.formatAsRGBA : opts.formatAsRGBA)
	      };
	    } else {
	      // backwards compatiblity, before 0.3.5, we only had the useTArray param
	      opts = defaultOpts;
	      opts.useTArray = true;
	    }
	  } else {
	    opts = defaultOpts;
	  }
	
	  var arr = new Uint8Array(jpegData);
	  var decoder = new JpegImage();
	  decoder.parse(arr);
	  decoder.colorTransform = opts.colorTransform;
	
	  var channels = (opts.formatAsRGBA) ? 4 : 3;
	  var bytesNeeded = decoder.width * decoder.height * channels;
	  try {
	    var image = {
	      width: decoder.width,
	      height: decoder.height,
	      data: opts.useTArray ?
	        new Uint8Array(bytesNeeded) :
	        new Buffer(bytesNeeded)
	    };
	  } catch (err){
	    if (err instanceof RangeError){
	      throw new Error("Could not allocate enough memory for the image. " +
	                      "Required: " + bytesNeeded);
	    } else {
	      throw err;
	    }
	  }
	
	  decoder.copyToImageData(image, opts.formatAsRGBA);
	
	  return image;
	}


/***/ })
/******/ ]);
//# sourceMappingURL=pebble-js-app.js.map