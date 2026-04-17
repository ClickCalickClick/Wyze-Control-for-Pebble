# Test Menu — Re-enable Instructions

The "** TEST **" menu item was a development shortcut that injects hardcoded Wyze
credentials and loads devices without requiring Clay configuration on a phone.
It has been commented out but all code is retained in-place.

## What it does

1. Adds a "** TEST **" row at the bottom of the main types menu
2. When tapped, sends a `TestAuth` AppMessage to PKJS
3. PKJS injects hardcoded email/API key/key ID, authenticates, and loads all devices
4. This bypasses the normal Clay settings flow entirely

## Files modified (all changes are comment blocks)

### src/c/menu_types.c
- **Line 6-8**: `s_type_names` array — add `"** TEST **"` as last entry
- **Line 7**: `s_type_indices` array — add `-99` as last entry  
- **Line 8**: Change `NUM_ROWS` from `9` to `10`
- **Draw callback**: Uncomment the `target_type == -99` block that draws the test row
- **Select callback**: Uncomment the `target_type == -99` block that calls `wyze_data_test_auth()`

### src/c/WyzeControl.c
- Uncomment `wyze_data_test_auth()` function definition

### src/c/wyze_data.h
- Uncomment `void wyze_data_test_auth(void);` declaration

### src/pkjs/index.js
- Uncomment the `d.TestAuth !== undefined` handler block
- Update credentials inside if needed

## Quick re-enable

Search for `test_menu_instructions` in all source files — each commented block
references this file. Uncomment those blocks and restore the arrays in menu_types.c:

```c
// menu_types.c line 6-8:
static char *s_type_names[] = {"* Shortcuts", "Lights", "Plugs", "Switches", "Cameras", "Locks", "Garage Doors", "Scales", "Others", "** TEST **"};
static int s_type_indices[] = {-1, 0, 1, 2, 3, 4, 5, 6, 99, -99};
#define NUM_ROWS 10
```

## Credentials (for reference)

These were hardcoded in the test handler — replace as needed:
- Email: configured in PKJS handler
- API Key: configured in PKJS handler
- Key ID: configured in PKJS handler
- Password: passed directly to `authenticateWyze()` in PKJS
