# Release Notes - Wyze Control for Pebble

## Version 1.0.0 (First Release)
**April 17, 2026**

Welcome to the initial release of **Wyze Control for Pebble**! This application allows you to control and monitor your Wyze smart home devices directly from your Pebble smartwatch.

### Overview
Wyze Control for Pebble is a comprehensive control center for your Wyze ecosystem. It connects your Pebble to the Wyze Cloud API via PebbleKit JS, enabling remote management of lights, plugs, cameras, and more, all with a glance-first user interface optimized for every Pebble model.

### Key Features
*   **Smart Lighting:**
    *   Toggle power for Wyze Bulbs and Light Strips.
    *   Adjust brightness in 20% increments (20%, 40%, 60%, 80%, 100%).
    *   Select from preset colors: Soft White, Cool White, Red, Green, and Blue.
*   **Power Control:** Quick toggle for Wyze Plugs and Switches.
*   **Camera Thumbnails:** View the most recent motion event thumbnail from your Wyze Cams directly on your wrist. Images are optimized and dithered for all Pebble screens.
*   **Garage Door Control:** Monitor real-time status (Open/Closed) and control your Wyze Garage Door Controller with large, easy-to-press buttons.
*   **Health Metrics:** View your latest Wyze Scale data, including Weight, Body Fat %, BMI, Muscle Mass, and Body Water.
*   **Wyze Shortcuts:** Trigger your custom Wyze Rules and Shortcuts (e.g., "Goodnight", "I'm Home") with a single tap.
*   **Device Status:** At-a-glance monitoring of device online/offline status and current states.

### Supported Platforms
This app is built to run on all Pebble hardware:
*   **Pebble Classic (Aplite)** & **Pebble 2 (Diorite)** - High-contrast B&W interface.
*   **Pebble Time (Basalt)** & **Pebble Time 2 (Emery)** - Rich color UI.
*   **Pebble Time Round (Chalk)** - Fully optimized round layout.

### Known Limitations
*   **Bluetooth Locks:** Devices that use only direct Bluetooth (like the Wyze Lock Bolt without a Wi-Fi gateway) can display their status but cannot be controlled remotely via the cloud API.
*   **MFA Support:** Multi-Factor Authentication is not yet supported during the initial login process.

### Getting Started
1. Install the app on your Pebble.
2. Open the app settings on your phone via the Pebble/Rebble app.
3. Enter your Wyze credentials and API keys (refer to the setup guide for details on generating Wyze API keys).
4. Save settings and enjoy controlling your home from your wrist!
