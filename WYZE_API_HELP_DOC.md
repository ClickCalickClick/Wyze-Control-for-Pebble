# Wyze API Help Doc

This document captures what has been validated in this repo for Wyze auth and control, and what it means for app features.

## 1) Executive Summary

- Auth is working with live credentials when using the Wyze mobile-style login flow.
- The old simplified login payload (single MD5, no nonce) fails with HTTP 400.
- Device list and control calls work when requests include Wyze app metadata fields in the JSON body.
- For this account, MFA is enabled at the account level but no API MFA challenge is currently returned (`mfa_options: null`).
- Current app should treat MFA as conditional (handle if returned, do not require UI by default).

## 2) What Is Required To Auth

### Required user inputs

- Wyze account email
- Wyze account password
- Wyze developer `key_id`
- Wyze developer `api_key`

### Required auth endpoint

- `POST https://auth-prod.api.wyze.com/api/user/login`

### Required headers (working)

- `Content-Type: application/json`
- `x-api-key: RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm`
- `apikey: <user developer api_key>`
- `keyid: <user developer key_id>`
- `User-Agent: wyze_android_2.49.0`

### Required JSON body (working)

- `email`: user email
- `password`: **triple-MD5** hash of plain password
- `nonce`: current timestamp string

### Notes

- Single-MD5 failed with `HTTP 400` and `errorCode 1000`.
- Triple-MD5 + nonce returned `access_token` and `refresh_token`.

## 3) Token Handling Recommendations

Current implementation pattern in this repo:

- Exchange password for tokens once.
- Persist `access_token` and `refresh_token` locally.
- Immediately remove plaintext password from local storage.

Recommended production behavior:

- Keep "token exchange and forget password" model.
- Add refresh-token flow (`/app/user/refresh_token`) so users do not need to re-enter password often.
- If token expires and refresh fails, request credentials again.

## 4) Working Device List Contract

### Endpoint

- `POST https://api.wyzecam.com/app/v2/home_page/get_object_list`

### Required JSON fields

- `access_token`
- `app_name: com.hualai`
- `app_ver: com.hualai___2.19.14`
- `app_version: 2.19.14`
- `phone_id: wyze_developer_api`
- `phone_system_type: 2`
- `sc: a626948714654991afd3c0dbd7cdb901`
- `ts: <timestamp>`
- `sv: c417b62d72ee44bf933054bdca183e77`

### Success shape

- HTTP status `200`
- Response `code: 1`, `msg: SUCCESS`
- Device list: `data.device_list[]`

### Status retrieval

From `device_list` entries you can generally read:

- `nickname`
- `product_model`
- `product_type`
- `mac`
- `device_params` (varies by device)
- connection/binding metadata

For richer status by device, use property-list endpoints.

## 5) Working Control Contract (set_property)

### Endpoint

- `POST https://api.wyzecam.com/app/v2/device/set_property`

### Required JSON fields

Base fields from device-list call, plus:

- `device_mac`
- `device_model`
- `pid`
- `pvalue`
- `sv: 44b6d5640c4d4978baba65c8ab9a6d6e`

### Validated PIDs (MeshLight HL_A19C2)

| PID | Function | Values | Notes |
|------|----------|--------|-------|
| P3 | Power | `"1"` (on) / `"0"` (off) | All devices |
| P1501 | Brightness | `"0"` - `"100"` | Percentage |
| P1502 | Color Temperature | `"2700"` - `"6500"` | Kelvin, warm to cool |
| P1507 | Color (RGB) | `"ff0000"`, `"00ff00"`, etc. | 6-char hex RGB string |
| P1508 | Color Mode | `"1"` (white/temp) / `"2"` (color) | Auto-set by bulb when P1502 or P1507 is sent |

### Important: `run_action_list` does NOT work for MeshLight

- `POST /app/v2/auto/run_action_list` with `set_mesh_property` returns `INVALID_PARAMETER` for all tested operations.
- Use `set_property` for all MeshLight control. Confirmed working for power, brightness, color temp, and hex RGB.

### Success criteria

- HTTP status `200`
- Response `code: 1`, `msg: SUCCESS`

## 6) PUT/PUSH Commands: What Is Accepted

For this integration, control and query calls are JSON POST requests.

- Auth and device APIs validated here use `POST`.
- No HTTP `PUT` flow is currently required for the implemented features.
- No HTTP `PUSH` verb exists in this API context.

If "push" means pushing data from phone JS to watch C, that is Pebble AppMessage, not Wyze HTTP.

## 7) Endpoint Inventory Found In wyze-sdk (Relevant)

Auth and token:

- `/api/user/login`
- `/app/user/refresh_token`

Device and property (api.wyzecam.com):

- `/app/v2/home_page/get_object_list` — device discovery ✅ validated
- `/app/v2/device/set_property` — device control ✅ validated
- `/app/v2/device/set_property_list`
- `/app/v2/device/get_property_list` — works for lights, empty for scales ⚠️
- `/app/v2/device_list/get_property_list`
- `/app/v2/device/get_device_Info` — basic device info only
- `/app/device/get_device_info`

Events/actions/timers (api.wyzecam.com):

- `/app/v2/device/get_event_list` — camera events ✅ validated
- `/app/v2/device_event/set_read_state_list`
- `/app/v2/auto/run_action` — shortcut execution ✅ validated
- `/app/v2/auto/run_action_list` — ❌ returns INVALID_PARAMETER for MeshLight
- `/app/v2/device/timer/get`
- `/app/v2/device/timer/set`
- `/app/v2/device/timer/cancel`
- `/app/v2/device_group/timer/get`
- `/app/v2/plug/usage_record_list`

Scale microservice (wyze-scale-service.wyzecam.com):

- `/plugin/scale/get_latest_record` — latest measurements ✅ validated
- `/plugin/scale/get_record_range` — historical measurements
- `/plugin/scale/get_device_setting` — unit preference (lb/kg) ✅ validated
- `/plugin/scale/get_device_member` — users associated with scale ✅ validated
- `/plugin/scale/get_family_member`
- `/plugin/scale/get_goal_weight`
- `/plugin/scale/get_heart_rate_record_list`
- `/plugin/scale/get_user_preference`
- `/plugin/scale/get_token`

User/profile:

- `/app/user/get_user_info`
- `/app/user/logout`
- `/app/user/change_password`
- `/app/v2/platform/get_user_profile`
- `/app/v2/platform/update_user_profile`
- `/app/v2/platform/get_variable`

## 8) Device Support Snapshot (Live Account Sample)

Live test returned 21 devices with these product-type counts:

- `Camera`: 8
- `MeshLight`: 6
- `Lock`: 4
- `WyzeScale`: 1
- `JA_RO2`: 1
- `Common`: 1

Top product models observed:

- `HL_A19C2` (lights)
- `HL_CAM4`, `HL_PAN3` (cameras)
- `YD_BT1` (lock family)
- plus other account-specific models

## 9) Feature Mapping — Validated Per Device Type

### Lights (MeshLight / HL_A19C2) — ✅ Fully Working

- Power toggle: `set_property` P3 → `"1"`/`"0"`
- Brightness: `set_property` P1501 → `"0"`-`"100"`
- Color temperature: `set_property` P1502 → `"2700"`-`"6500"`
- Color (RGB): `set_property` P1507 → hex string e.g. `"ff0000"`
- All via standard `set_property` endpoint (NOT `run_action_list`)
- Physically confirmed: light turned blue with P1507=`"0000ff"`

### Cameras — ✅ Event Thumbnails Working

- Event list: `get_event_list` with `sv`, `begin_time`, `end_time`, `device_mac`, `device_model`
- Image URL: `event.file_list[0].url` (hosted at `prod-sight-safe-auth.wyze.com`)
- Event metadata: `event_value` (1=motion, 2=sound, etc.), `event_ts`
- No live streaming — Pebble displays most recent event thumbnail

### Scale (WyzeScale / JA.SC2) — ✅ Measurement Data Working

- Uses separate microservice: `wyze-scale-service.wyzecam.com` (see Section 14)
- Standard API (`get_property_list`) returns empty for scales
- Scale microservice returns: weight, BMI, body fat, body water, muscle, protein, bone mineral, metabolic age
- Unit preference (lb/kg) from `get_device_setting`

### Locks (YD_BT1) — ⚠️ Display Only

- Bluetooth-only locks (no Wi-Fi gateway) cannot be controlled via cloud API
- `device_params` contains no `switch_state` or `power_switch`
- App shows "Cloud control unsupported" when user attempts toggle
- Lock state (locked/unlocked) not reliably available from API for BT-only models

### Plugs / Switches — 🔲 Not Tested (No Devices on Account)

- Expected to use same `set_property` P3 toggle pattern as lights
- Standard product types: `Plug`, `Switch`

### Garage Door (Camera + HL_CGDC Dongle) — ✅ Control Working / ⚠️ State Unreadable

- Identified by: `device_params.dongle_product_model === "HL_CGDC"` on a camera
- Test device: Garage Cam (D03F2745AA94, WYZE_CAKP2JFUS) with garage controller dongle
- **Control**: `run_action` with `action_key: "garage_door_trigger"` — physically confirmed 3/3 triggers
- It is a **toggle** — same action for open and close
- Response: `code:1 msg:SUCCESS data:{ result:2 }` — `result:2` is the same for both directions
- **State detection**: NOT possible via any cloud REST API (see Section 17 for full investigation)
- P1056 (ACCESSORY property) is completely stale and never updates, even after API-triggered actions
- Real-time state comes from P2P/WebRTC connection (mobile app only), not REST
- App must track state locally after each API trigger; initial state is unknown

### Other (Vacuum JA_RO2, Headphones JA_HP) — Display Only

- Listed in device menu for visibility
- No control actions implemented

## 10) Can We Get Device Status Back Reliably?

Yes, with caveats:

- `get_object_list` gives broad status and metadata quickly.
- `get_property_list` endpoints are better for authoritative state and capabilities.
- Property schema varies by model, so status parsing must be model-aware.

## 11) Error Handling and User Messaging

Recommended app behavior:

- On auth 400/1000: show credential/config error details.
- On token expiration (401 or access-token error): clear access token, attempt refresh, then prompt re-auth if refresh fails.
- On control failure (`code != 1`): surface model + PID + message for diagnostics.

## 12) Local Test Harness Usage

`wyze_test.js` now supports env vars so secrets are not committed:

- `WYZE_KEY_ID`
- `WYZE_API_KEY`
- `WYZE_EMAIL`
- `WYZE_PASSWORD`
- `WYZE_DO_TOGGLE=1` (optional)

Example:

```bash
export WYZE_KEY_ID='...'
export WYZE_API_KEY='...'
export WYZE_EMAIL='...'
export WYZE_PASSWORD='...'
node wyze_test.js
```

## 13) Implementation State In This Repo

Current PKJS flow is aligned to working local tests:

- Auth: triple-MD5 + nonce to `auth-prod.api.wyze.com`
- List: app-v2 POST payload contract with `sc/sv/ts` and app metadata
- Toggle: `set_property` with validated payload shape
- Light controls: brightness (P1501), color temp (P1502), hex RGB color (P1507) — all via `set_property`
- Camera events: `get_event_list` with `sv` param, image URL from `file_list[0].url`
- Scale data: HMAC-signed GET to `wyze-scale-service.wyzecam.com/plugin/scale/get_latest_record`
- Shortcuts: `run_action` with `action_key`
- Locks: display-only, "Cloud control unsupported" messaging

### Device Type Mapping (product_type → type_index)

| product_type | type_index | Label |
|-------------|-----------|-------|
| MeshLight | 0 | Light |
| Plug | 1 | Plug |
| Switch | 2 | Switch |
| Camera | 3 | Camera |
| Lock | 4 | Lock |
| GarageDoor | 5 | Garage |
| WyzeScale | 6 | Scale |
| (anything else) | 99 | Other |

## 14) Scale Microservice (wyze-scale-service.wyzecam.com)

Scale measurement data is NOT available from the standard Wyze API (`api.wyzecam.com`). It requires a separate microservice with HMAC-signed authentication.

### Base URL

`https://wyze-scale-service.wyzecam.com`

### Auth Pattern (ExServiceClient)

All requests require these headers:

- `access_token`: Wyze auth token (same as standard API)
- `requestid`: `md5(md5(String(nonce)))` where nonce = `Date.now()`
- `appid`: `9319141212m2ik`
- `appinfo`: `wyze_android_2.19.14`
- `phoneid`: any string (e.g. `wyze_developer_api`)
- `User-Agent`: `wyze_android_2.19.14`
- `signature2`: HMAC-MD5 signature (see below)

### Signature Generation

For GET requests:

1. Add `nonce=<timestamp_ms>` to params
2. Sort all params alphabetically, join as `key1=val1&key2=val2`
3. `signing_key = md5(access_token + "wyze_app_secret_key_132")`
4. `signature2 = HMAC-MD5(signing_key, sorted_param_string)`

For POST requests:

1. Add `"nonce": "<timestamp_ms>"` to JSON body
2. Serialize JSON with no extra whitespace
3. `signing_key = md5(access_token + "wyze_app_secret_key_132")`
4. `signature2 = HMAC-MD5(signing_key, json_body_string)`

### Key Endpoint: get_latest_record

- `GET /plugin/scale/get_latest_record`
- No required params beyond auth headers + nonce
- Returns array of recent measurements:

```json
{
  "code": 1,
  "data": [{
    "weight": 95.24,
    "bmi": 29.28,
    "body_fat": 33.1,
    "body_water": 48.9,
    "muscle": 59.7,
    "protein": 13.8,
    "bone_mineral": 4,
    "metabolic_age": 37,
    "measure_ts": 1765367750001,
    "device_id": "JA.SC2.2CAA8E46BD83",
    "family_member_id": "..."
  }]
}
```

- Weight is always in **kg** regardless of user preference
- User unit preference (lb/kg) from `GET /plugin/scale/get_device_setting?device_id=<mac>`
- Convert: `weight_lb = weight_kg * 2.20462`

## 15) Camera Event List Details

### Endpoint

- `POST https://api.wyzecam.com/app/v2/device/get_event_list`

### Required fields (beyond base payload)

- `device_mac`: camera MAC
- `device_model`: camera model
- `sv: 782ced6909a44d92a1f70d582bbe88be` (CRITICAL: must use this sv, NOT the set_property sv)
- `begin_time`: epoch ms (e.g. 24 hours ago)
- `end_time`: epoch ms (e.g. now)
- `count`: number of events to return (e.g. 20)
- `order_by`: sort order (e.g. 2 = newest first)

**CRITICAL**: The base payload for this endpoint MUST use iOS-style parameters (see Section 18) for the returned image URLs to be downloadable. Using developer-style parameters returns valid event metadata but generates image URLs with invalid `st` tokens.

### Response shape

```json
{
  "code": 1,
  "data": {
    "event_list": [{
      "event_value": "1",
      "event_ts": 1765367750000,
      "file_list": [{
        "url": "https://prod-sight-safe-auth.wyze.com/resource/...",
        "type": 1
      }]
    }]
  }
}
```

- `event_value`: 1=motion, 2=sound, etc.
- Image URL: `file_list[0].url`
- Without `sv` param, API returns `INVALID_PARAMETER`

## 16) Test Scripts Reference

| Script | Purpose |
|--------|--------|
| `test_api.js` | Comprehensive device audit — all 21 devices, per-type tests, color/brightness/power control |
| `test_scale.js` | Standard API scale investigation (confirms no measurement data available) |
| `test_scale_service.js` | Scale microservice test with HMAC signing — confirmed working |
| `test_garage.js` | Basic garage door property inspection (P1056, device_params, device_info) |
| `test_garage_deep.js` | 10-approach exhaustive garage state detection (events, Earth service, devicemgmt, etc.) |
| `test_garage_deep2.js` | 9 follow-up tests (devicemgmt capabilities, run_action queries, timestamp analysis) |
| `test_garage_stream.js` | Camera stream endpoint, Olive API, local device_request, devicemgmt garage caps |
| `test_garage_trigger.js` | Physical garage door trigger test — confirms run_action control works |
| `wyze_test.js` | Original auth + basic device list test |

All scripts use env vars: `WYZE_EMAIL`, `WYZE_PASSWORD`, `WYZE_API_KEY`, `WYZE_KEY_ID`

## 17) Garage Door Controller (HL_CGDC) — Full Investigation

### Device Identification

The Wyze Garage Door Controller is a dongle that attaches to a Wyze Cam V3. It is not a standalone device — it appears as a camera in the device list with `device_params.dongle_product_model === "HL_CGDC"`.

- Test device: "Garage Cam" — MAC: D03F2745AA94, model: WYZE_CAKP2JFUS
- The camera itself is a standard Cam V3; the dongle adds garage door control capability

### Control — WORKING

**Endpoint**: `POST https://api.wyzecam.com/app/v2/auto/run_action`

**Payload** (in addition to standard base fields):
```json
{
  "sv": "9d74946e652647e9b6c9d59326aef104",
  "provider_key": "WYZE_CAKP2JFUS",
  "instance_id": "D03F2745AA94",
  "action_key": "garage_door_trigger",
  "action_params": {},
  "custom_string": ""
}
```

**Response**: `{ code: 1, msg: "SUCCESS", data: { result: 2, instance_id: "D03F2745AA94", session_id: "...", action_session_id: "..." } }`

**Behavior**:
- This is a **blind toggle** — the same `garage_door_trigger` action opens or closes the door
- `result: 2` is returned for both open and close directions
- Physically confirmed: 3 consecutive triggers all produced physical door movement
- There is no separate `garage_door_open` / `garage_door_close` action that differs in behavior; ha-wyzeapi uses the same toggle for both

### State Detection — NOT POSSIBLE VIA CLOUD API

Extensive testing (25+ approaches across 5 test scripts) confirmed that **no cloud REST API returns real-time garage door open/closed state**.

#### Approaches Tested and Results

| Approach | Endpoint | Result |
|----------|----------|--------|
| P1056 via `get_property_list` | `api.wyzecam.com` | Stale — last updated 72 days ago (Feb 2, 2026), value never changes |
| P1056 via `get_device_Info` | `api.wyzecam.com` | Same stale data |
| P1056 targeted read | `api.wyzecam.com` | Same — `[{pid:"P1056",value:"1",ts:1770061981000}]` |
| P1056 after API trigger | `api.wyzecam.com` | Still unchanged after 20+ seconds post-trigger |
| Event list | `api.wyzecam.com/get_event_list` | Only motion events (val=13), no garage-specific events |
| Earth service `get_iot_prop` | `wyze-earth-service.wyzecam.com` | code 1004 (authentication failure — signing secret for `earp_*` APP_ID unknown) |
| Earth with Olive credentials | `wyze-earth-service.wyzecam.com` | code 1010 (wrong appid for this service) |
| Olive/Platform service | `wyze-platform-service.wyzecam.com` | code 1010 (unsupported device/keys) |
| devicemgmt `get_iot_prop` | `devicemgmt-service-beta.wyze.com` | Server knows "garage" capability schema (`door-state`, `state`, `open`) but ALL values are **null** |
| devicemgmt `run_action` | `devicemgmt-service-beta.wyze.com` | code 1000 Internal Error for garage queries |
| Camera `get-streams` (WebRTC) | `app.wyzecam.com` | Returns only `iot-state:1`, `iot-power:1` — no garage data |
| Local HTTP (camera IP:88) | `192.168.86.26:88` | All requests timeout — camera does not expose HTTP endpoints for accessory state |
| `run_action` with query action_keys | `api.wyzecam.com` | All return `result:3` (generic dispatched/unknown); `garage_door_trigger` returns `result:2` |
| Multiple `sv` parameter values | `api.wyzecam.com` | All return same stale P1056 |
| v3/v4 modern endpoints | `api.wyzecam.com` | All fail or return empty |
| `get_acc_props` with dongle_model | `api.wyzecam.com` | No response data |
| `get_sub_device` | `api.wyzecam.com` | No sub-devices found |

#### Why State Is Unavailable

The Wyze mobile app gets real-time garage sensor state through a **P2P/WebRTC connection** directly to the camera, which communicates with the HL_CGDC dongle locally over a wired connection. This real-time data path **never touches the cloud REST API**.

The `devicemgmt` service has a schema for `garage` capability with `door-state`, `state`, and `open` properties, but the Cam V3 (WYZE_CAKP2JFUS) is not in the DEVICEMGMT_API_MODELS list — it uses the old API path. The garage properties always return `null` because the camera does not push this data to the devicemgmt cloud service.

P1056 (ACCESSORY) is documented in ha-wyzeapi as: `1` = open, `0` = closed by app, `2` = closed by automation. However this property is completely stale on this device and does not update even after API-triggered actions.

### Implementation Strategy for Watch App

1. **Control**: Use `run_action` with `action_key: "garage_door_trigger"` — confirmed working
2. **State tracking**: Maintain local state on watch, toggling after each successful API trigger
3. **Initial state**: Show "Unknown" until first user-initiated trigger
4. **UX**: Single "Toggle Door" button with confirmation dialog (safety-critical action)
5. **Caveat**: Local state will desync if door is operated manually, by the Wyze app, or by automations

### P1056 Property Reference (Historical)

Per ha-wyzeapi source code, P1056 (ACCESSORY) values:
- `"1"` = open
- `"0"` = closed by app
- `"2"` = closed by automation / smart platform (Alexa, Google Home, Rules)

**Note**: These values were NOT observed to change in any testing. The property appears vestigial or only updated via MQTT push (not pollable via REST).

## 18) Camera Image Download — CRITICAL: Correct API Parameters

### The Problem

Downloading Wyze camera event thumbnail images from `prod-sight-safe-auth.wyze.com` URLs returned HTTP 401 "Access token is invalid" with every authentication method tried. Over 10 different approaches were tested — all failed.

### Root Cause

The image URLs contain a signed `st` (signature/token) parameter generated server-side when `get_event_list` is called. **The `st` value is only valid if the API request that generated it used the correct `sc`, `sv`, and app metadata parameters.** The "developer API" style parameters (`sc: a626948714654991afd3c0dbd7cdb901`, `phone_system_type: 2`, `app_name: com.hualai`) cause the API to generate URLs with **invalid** `st` tokens that the CDN rejects.

The backend is Azure Blob Storage (not AWS S3), as revealed by Authorization header attempts returning XML `InvalidAuthenticationInfo` errors.

### The Fix — Docker-Wyze-Bridge Parameters

The breakthrough came from studying [docker-wyze-bridge](https://github.com/mrlt8/docker-wyze-bridge) source code (`app/wyzecam/api.py`), which uses iOS mobile app parameters rather than developer API parameters.

### Working Parameters for `get_event_list` (Camera Events)

| Parameter | OLD (broken — generates invalid image URLs) | NEW (working — generates valid image URLs) |
|-----------|----------------------------------------------|--------------------------------------------|
| `sc` | `a626948714654991afd3c0dbd7cdb901` | `9f275790cab94a72bd206c8876429f3c` |
| `sv` | `44b6d5640c4d4978baba65c8ab9a6d6e` | `782ced6909a44d92a1f70d582bbe88be` |
| `app_name` | `com.hualai` | `com.hualai.WyzeCam` |
| `app_ver` | `com.hualai___2.19.14` | `com.hualai.WyzeCam___2.50.6.9` |
| `app_version` | `2.19.14` | `2.50.6.9` |
| `phone_system_type` | `2` (Android) | `1` (iOS) |
| `phone_id` | `wyze_developer_api` | Random UUID (e.g. `crypto.randomUUID()`) |

### Image Download (GET Request)

| Setting | Value |
|---------|-------|
| Method | `GET` — plain request, **NO auth headers** |
| `User-Agent` | `Wyze/2.50.6.9 (iPhone; iOS 17.0; Scale/3.00)` |
| Auth headers | **NONE** — the `st` param in the URL IS the auth |

The image URLs look like:
```
https://prod-sight-safe-auth.wyze.com/resource/{mac}/{date}/{event_id}/{file_id}.jpg?st=...&kid=...&nonce=...
```

### Why This Works

The Wyze CDN (`prod-sight-safe-auth.wyze.com`) is Azure Blob Storage with signed URL tokens. The `st` parameter is a short-lived signature generated when the API processes the `get_event_list` request. The signature generation is tied to the `sc`/`sv`/app metadata of the requesting client. When developer-style parameters are used, the generated `st` is invalid for the CDN. The iOS app parameters produce a valid `st`.

**The key insight: the problem was never in the download request — it was in the `get_event_list` request that generated the URL. Fix the event list parameters, and the plain GET download just works.**

### Docker-Wyze-Bridge SC/SV Reference (All Endpoints)

Source: `docker-wyze-bridge/app/wyzecam/api.py`

| Endpoint | SC | SV |
|----------|----|----|  
| Default | `9f275790cab94a72bd206c8876429f3c` | `e1fe392906d54888a9b99b88de4162d7` |
| `get_event_list` | `9f275790cab94a72bd206c8876429f3c` | `782ced6909a44d92a1f70d582bbe88be` |
| `run_action` | `01dd431d098546f9baf5233724fa2ee2` | `2c0edc06d4c5465b8c55af207144f0d9` |
| `get_device_Info` | `01dd431d098546f9baf5233724fa2ee2` | `0bc2c3bedf6c4be688754c9ad42bbf2e` |
| `set_device_Info` | `01dd431d098546f9baf5233724fa2ee2` | `e8e1db44128f4e31a2047a8f5f80d2bd` |

### Docker-Wyze-Bridge Header Pattern (Non-Login Requests)

```
User-Agent: Wyze/<VERSION> (iPhone; iOS <IOS_VERSION>; Scale/3.00)
appversion: <VERSION>
env: prod
```

Where `VERSION` = `2.50.6.9` and `IOS_VERSION` = `17.0`.

### All 10 Failed Approaches for Image Download

Every one of these returned HTTP 401 or an error, because the underlying `st` token was invalid:

1. Direct GET (no headers) — 401
2. `Authorization: Bearer <access_token>` — 401
3. `Authorization: <access_token>` — 401
4. `access_token` query parameter — 401
5. `x-api-key` + `access_token` header — 401
6. AWS S3 pre-signed URL pattern (`X-Amz-*` params) — 400 (Azure, not AWS)
7. Wyze `/app/v2/auto/sign_url` signing endpoint — Not implemented
8. `ai_url` from `file_list` — Same `st` problem
9. Multiple `User-Agent` strings with auth headers — 401
10. `sight-token` / `X-Access-Token` custom headers — 401

### Validated Test (April 16, 2026)

```
Camera: Backdoor (online, model WVOD1, MAC D03F27912564)
Event list: HTTP 200, 20 events returned
Image URL: https://prod-sight-safe-auth.wyze.com/resource/...
Image download: HTTP 200, 27,958 bytes, valid 640×360 JPEG
Content: Deck with patio furniture, Wyze watermark, timestamp 2026-04-16 11:12:30
```

### Pebble Display Pipeline (Validated)

After downloading a JPEG from the working URL:

1. **Decode JPEG** (640×360) — requires a pure-JS JPEG decoder in PebbleKit JS
2. **Resize** to 144×84 pixels (Pebble basalt camera area) using nearest-neighbor sampling
3. **Convert** each pixel to Pebble 8-bit color: `0xC0 | (R>>6 << 4) | (G>>6 << 2) | (B>>6)`
4. **Result**: 12,096 bytes (144 × 84 pixels, 1 byte each in `GBitmapFormat8Bit`)
5. **Transfer** to watch via `CameraChunkData` AppMessage in 1,500-byte chunks
6. **Display** on watch: `gbitmap_create_blank()` → copy row-by-row respecting `gbitmap_get_bytes_per_row()` padding → `bitmap_layer_set_bitmap()`

**Important**: Pebble's `gbitmap_create_blank()` may add padding bytes per row. Always use `gbitmap_get_bytes_per_row()` and copy row-by-row, not a single `memcpy()` of the entire buffer.

Static test with pre-converted image data confirmed working on basalt emulator — the Backdoor camera thumbnail rendered correctly at 144×84.

### Impact on Other Endpoints

The "developer API" parameters (`sc: a626...`, `phone_system_type: 2`) still work for:
- Device list (`get_object_list`)
- Property control (`set_property`)
- Run action (`run_action`)
- Scale microservice

Only the camera event image pipeline requires the iOS-style parameters. Switching all endpoints to iOS-style parameters should also work and may be more future-proof.

## 19) V4 API — Alternate Event Endpoint (Discovered)

An alternate, newer API exists at `https://app-core.cloud.wyze.com/app/v4/device/get_event_list` with HMAC signing.

### Auth Pattern

- `appid: '9319141212m2ik'`
- `secret: 'wyze_app_secret_key_132'`
- Signing: `key = md5(access_token + secret)`, `signature2 = hmac(key, sorted_json_payload, md5)`
- Headers: `content-type`, `phoneid`, `user-agent`, `appinfo`, `appversion`, `access_token`, `appid`, `env`, `signature2`
- Payload serialization: `JSON.stringify()` with no extra whitespace, keys sorted alphabetically

This V4 endpoint was confirmed working but uses the same `prod-sight-safe-auth.wyze.com` CDN for images, so the same `st` signing rules apply. The V2 endpoint with corrected iOS-style parameters is simpler and sufficient for this app.
