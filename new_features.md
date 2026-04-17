# Wyze Control Pebble App - Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for the upcoming feature enhancements to the Wyze Control Pebble smartwatch app.

---

## 1. Wyze Bluetooth Locks (Limitation Acknowledgment)
**Analysis:** As confirmed, pure Bluetooth locks (like the Wyze Lock Bolt) do not connect to a local Wi-Fi gateway and thus cannot be controlled remotely via the Wyze Cloud API. 
**Plan:** 
*   Keep the locks visible in the main device list, displaying their current status (e.g., Locked/Unlocked) if the API provides it.
*   If the user presses the Select (middle) button to attempt to control it, intercept the action and show an alert/toast message indicating that "Cloud control is unsupported" or "Control requires direct phone Bluetooth."

---

## 2. Advanced Lighting Controls (Power, Brightness, Color)
**Pebble UI Flow:**
1.  **Main Menu:** User selects a specific `Light` device.
2.  **Action Menu:** A new `MenuLayer` opens with three rows:
    *   `[Power: ON/OFF]`
    *   `[Brightness: XX%]`
    *   `[Color: Name]`
3.  **Sub-Menus:**
    *   Tapping `Power` toggles the light instantly (no sub-menu).
    *   Tapping `Brightness` opens a list of fixed integer steps: `20%, 40%, 60%, 80%, 100%`.
    *   Tapping `Color` opens a list of standard colors: `Soft White, Cool White, Red, Green, Blue`.

**API & JS Implementation:**
*   Watch passes the selections as simple integers via `AppMessage` to Phone JS (e.g., `ACTION: 2 (Brightness), VAL: 60`).
*   Phone JS translates these to Wyze API `set_property` commands:
    *   **Power:** `pid: "P3"` -> values `"1"` / `"0"`
    *   **Brightness:** `pid: "P1501"` -> values `"20"`, `"60"`, etc.
    *   **Color Temp:** `pid: "P1502"` -> values `"2700"` (Soft White), `"6500"` (Cool White)
    *   **Color (RGB):** `pid: "P1507"` -> hex RGB strings e.g. `"ff0000"` (Red), `"00ff00"` (Green), `"0000ff"` (Blue)
*   MeshLight devices (HL_A19C2) use standard `set_property` — `run_action_list` returns `INVALID_PARAMETER` for these devices.
*   Phone JS sends a success/update `AppMessage` back to the watch to refresh the UI states.

---

## 3. Camera Preview Thumbnails
**Pebble UI Flow:**
*   A new "Camera View" window is created. When a camera is selected, a `BitmapLayer` displays the most recent motion event thumbnail centered on the screen.

**API & JS Implementation:**
*   **API Call:** Phone JS calls `/app/v2/device/get_event_list` passing the camera's MAC/model to retrieve recently logged events.
*   The API returns an S3 `url` to a `.jpg` file.
*   **Image Processing:** Phone JS downloads the JPEG, resizes and crops it to map to the Pebble's screen bounds (e.g., `144x168` for basalt, or a smaller inset), and applies dithering/palette-matching depending on the Pebble hardware (Aplite B&W vs Time Color).
*   **Transmission:** Phone JS chunks the image byte array and sends it to the watch via `AppMessage` to be drawn dynamically.

---

## 4. Wyze Scale Metrics
**Pebble UI Flow:**
*   When the Wyze Scale is selected, a visually appealing read-only `TextLayer` window opens.
*   It displays a clean, large typography layout:
    *   **Weight:** 185.0 lbs (Large bold font)
    *   **Date:** Apr 14, 2026 (Medium font)
    *   **Body Fat:** 20.0% (Medium font)
    *   **BMI / Muscle / Water:** Values like `BMI: 24.0`, `Muscle Mass: 140lbs`, and `Body Water: 55%` (Small/Medium font)

**API & JS Implementation:**
*   Phone JS fetches data from `https://wyze-scale-service.wyzecam.com/plugin/scale/get_latest_records` (or generic equivalent).
*   Extract fields: `weight`, `body_fat`, `bmi`, `muscle`, `body_water`, and `measure_ts`.
*   Convert raw units (e.g., metric to imperial based on user preference) and format the timestamp.
*   Send the pre-formatted strings to the watch to display as a comprehensive health snapshot.

---

## 5. Wyze Rules / Shortcuts Execution
**Pebble UI Flow:**
*   Add a new top-level menu item above the Device List: `[ ★ Wyze Shortcuts ]`.
*   Selecting it opens a menu listing all user-defined Wyze rules/shortcuts (e.g., "Goodnight", "Leave Home").
*   Tapping one triggers the rule immediately and shows a brief confirmation vibration/toast.

**API & JS Implementation:**
*   **Populate:** Phone JS calls `/app/v2/auto/run_action_list` (or `get_rule_list`) to pull available shortcut names and IDs.
*   **Trigger:** When the watch sends the trigger command, Phone JS POSTs to `/app/v2/auto/run_action` with the specific `action_key`.

---

## 6. Garage Door Open / Closed View & Control
**Pebble UI Flow:**
*   A dedicated menu item for the Wyze Garage Door Controller.
*   The subtitle dynamically shows the real-time state: `Status: OPEN` or `Status: CLOSED`.
*   Tapping the item opens an action window with two massive buttons: `[ OPEN ]` and `[ CLOSE ]`, ensuring it's easy to press while driving or walking.

**API & JS Implementation:**
*   **State:** The gateway/camera accessory state is retrieved via standard `get_property_list` for the Garage Controller.
*   **Control:** Tapping open/close sends a `set_property` command with the specific Garage Relay PID.
*   **Verification:** Phone JS polls the state a few seconds after sending the command and updates the Watch UI to confirm the door successfully closed.

---

## 7. Standardized App Title Bar ("Wyze Control")
**Pebble UI Flow:**
*   **Requirement:** An app title ("Wyze Control") will persist at the top of *every* screen, taking up approximately the top 10-15% of the screen.
*   **Implementation:** 
    *   A standardized C function (e.g., `setup_title_bar(Window *window)`) will be called for each window.
    *   It will construct a `TextLayer` anchored at `GRect(0, 0, bounds.size.w, 20)` with inverted colors (e.g., Black background, White text) or utilize the OS-native `StatusBarLayer` setup appropriately.
    *   The text will strictly state `Wyze Control` in a readable standard systemic font (like `FONT_KEY_GOTHIC_18_BOLD`).
    *   All subsequent list menus or text views will have their `GRect` `y` offsets appropriately pushed down by ~20px so they do not overlap with the title bar.