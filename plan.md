## Plan: Wyze Control Pebble App

A Pebble smartwatch app using a multi-level MenuLayer interface to browse and control Wyze devices (Lights, Plugs, Switches). It utilizes PebbleKit JS to authenticate with the official Wyze API, fetch device states, and proxy commands from the watch. Device metadata (like long MAC addresses) is cached in JS to minimize the watch's memory footprint, passing only integer IDs back and forth. 

**Steps**
1. Initialize Project Configuration:
   - Update `package.json` to configure the app type (`"watchface": false`).
   - Define `messageKeys` for JS-C communication (`AppReady`, `DeviceCount`, `DeviceTypeIndex`, `DeviceType`, `DeviceIndex`, `DeviceName`, `DeviceState`, `ActionToggle`, `ActionRefresh`).
   - Add `@rebble/clay` for settings.

2. Implement Clay Settings (`src/pkjs/config.js`):
   - Add text input fields for "Wyze Key ID" and "Wyze API Key" so the user can paste their Developer Console credentials.

3. Implement JS Backend API Integration (`src/pkjs/index.js`):
   - Setup Clay to handle settings (with `autoHandleEvents: false` to intercept as detailed in workspace memory).
   - Authenticate with the Wyze API (`/api/v1/login` equivalent) to get an `access_token`.
   - Retrieve devices (`/api/v1/device/list`), categorize them into types (Bulbs, Plugs, Switches), map MAC addresses to an internal JS integer ID array, and send stripped-down category/device data to C sequentially.
   - Listen for action messages from C, construct the corresponding target property set command for the Wyze API, wait ~2 seconds, and push the updated device state back to C.

4. Implement C Data Layer (`src/c/WyzeControl.c`):
   - Define data structures to hold Device Types and their respective Devices (`id`, `name`, `state`, `type_id`).
   - Implement `app_message` handlers to receive batches of devices from JS and trigger window redraws dynamically.

5. Implement 3-Tier UI Flow (Modular C files):
   - **Screen 1 (Device Types Menu):** A `MenuLayer` listing the available device categories (e.g., "Lights", "Plugs", "Switches"). Selecting a row pushes Screen 2.
   - **Screen 2 (Specific Devices Menu):** A `MenuLayer` listing the specific devices under the selected category (e.g., "Living Room Bulb"). Rows display the device name and a small state indicator (On/Off). Selecting a row pushes Screen 3.
   - **Screen 3 (Device Actions Screen):** A detailed view for the selected device with specific actions (e.g., "Toggle Power"). Navigating back returns to Screen 2.

**Relevant files**
- `package.json` — Configuration and `messageKeys`.
- `src/pkjs/config.js` — Clay layout schema.
- `src/pkjs/index.js` — API integration and JS-to-C AppMessage bridge.
- `src/c/WyzeControl.c` — Main entry point and AppMessage initialization.
- `src/c/menu_types.c` / `menu_devices.c` / `window_actions.c` — Modularized UI views for the 3-tier flow.

**Decisions**
- Implemented a 3-tier menu structure (Type -> Device -> Action) to accommodate grouped devices gracefully and provide a clean UX on the small display.
- To respect the constrained memory on Pebble, bulky device MAC addresses stay strictly on the phone (in JS). The watch receives memory-efficient integer IDs.