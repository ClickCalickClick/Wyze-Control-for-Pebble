#include <pebble.h>
#include "wyze_data.h"

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_title_layer;
static int s_filtered_indices[MAX_DEVICES];
static int s_filtered_count = 0;
static int s_current_type_index = 0;

static void filter_devices(void) {
  s_filtered_count = 0;
  for(int i = 0; i < s_device_count; i++) {
    if (s_current_type_index == 99 && s_devices[i].type_index != 0 && s_devices[i].type_index != 1 && s_devices[i].type_index != 2 && s_devices[i].type_index != 3 && s_devices[i].type_index != 4 && s_devices[i].type_index != 5 && s_devices[i].type_index != 6) {
      s_filtered_indices[s_filtered_count++] = i;
    } else if (s_current_type_index == 5 && s_devices[i].has_garage) {
      // Dual-listing: cameras with garage dongle also appear in Garage category
      s_filtered_indices[s_filtered_count++] = i;
    } else if (s_devices[i].type_index == s_current_type_index) {
      s_filtered_indices[s_filtered_count++] = i;
    }
  }
}

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data) { return 1; }

static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return s_filtered_count > 0 ? s_filtered_count : 1;
}

static void menu_draw_row_callback(GContext* ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  if (s_filtered_count == 0) {
    menu_cell_basic_draw(ctx, cell_layer, "No devices found", NULL, NULL);
    return;
  }
  if (cell_index->row >= s_filtered_count) return;
  int d_idx = s_filtered_indices[cell_index->row];
  WyzeDevice dev = s_devices[d_idx];
  
  char state_buf[32];
  if (!dev.online) {
    snprintf(state_buf, sizeof(state_buf), "Offline");
  } else if (dev.type_index == 0) { // Light
    snprintf(state_buf, sizeof(state_buf), dev.state ? "ON" : "OFF");
  } else if (dev.type_index == 1) { // Plug
    snprintf(state_buf, sizeof(state_buf), dev.state ? "ON" : "OFF");
  } else if (dev.type_index == 2) { // Switch
    snprintf(state_buf, sizeof(state_buf), dev.state ? "ON" : "OFF");
  } else if (dev.type_index == 3) { // Camera
    snprintf(state_buf, sizeof(state_buf), dev.state ? "ON" : "OFF");
  } else if (dev.type_index == 4) { // Lock
    snprintf(state_buf, sizeof(state_buf), dev.state ? "Locked" : "Unlocked");
  } else if (dev.type_index == 5) { // Garage Door
    snprintf(state_buf, sizeof(state_buf), dev.state ? "Open" : "Closed");
  } else if (s_current_type_index == 5 && dev.has_garage) { // Camera with garage dongle in Garage category
    snprintf(state_buf, sizeof(state_buf), dev.state ? "Open" : "Closed");
  } else if (dev.type_index == 6) { // Scale
    snprintf(state_buf, sizeof(state_buf), dev.state ? "Connected" : "Offline");
  } else if (dev.type_index >= 99) { // Others — show raw type
    snprintf(state_buf, sizeof(state_buf), "%s", dev.type_name);
  } else {
    snprintf(state_buf, sizeof(state_buf), dev.state ? "ON" : "OFF");
  }
  
  menu_cell_basic_draw(ctx, cell_layer, dev.name, state_buf, NULL);
}

static void menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (s_filtered_count == 0 || cell_index->row >= s_filtered_count) return;
  int d_idx = s_filtered_indices[cell_index->row];
  int type = s_devices[d_idx].type_index;

  // Route to specialized windows by device type
  if (s_current_type_index == 5) {
    // Garage category: open garage window (including dual-listed cams with garage dongle)
    window_garage_push(d_idx);
  } else if (type == 0) {
    menu_light_actions_window_push(d_idx);
  } else if (type == 3) {
    window_camera_push(d_idx);
  } else if (type == 5) {
    window_garage_push(d_idx);
  } else if (type == 6) {
    window_scale_push(d_idx);
  } else if (type >= 99) {
    // "Other" devices are display-only, not clickable
    return;
  } else {
    window_device_action_push(d_idx);
  }
}

static void window_appear(Window *window) {
  filter_devices();
  if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_title_layer = setup_title_bar(window, bounds);

  GRect menu_bounds = GRect(0, TITLE_BAR_HEIGHT, bounds.size.w, bounds.size.h - TITLE_BAR_HEIGHT);
  s_menu_layer = menu_layer_create(menu_bounds);
  menu_layer_set_callbacks(s_menu_layer, NULL, (MenuLayerCallbacks){
    .get_num_sections = menu_get_num_sections_callback,
    .get_num_rows = menu_get_num_rows_callback,
    .draw_row = menu_draw_row_callback,
    .select_click = menu_select_callback,
  });
#ifdef PBL_COLOR
  menu_layer_set_highlight_colors(s_menu_layer, WYZE_BLUE, GColorWhite);
#endif
  menu_layer_set_click_config_onto_window(s_menu_layer, window);
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));
}

static void window_unload(Window *window) {
  menu_layer_destroy(s_menu_layer);
  s_menu_layer = NULL;
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
}

void menu_devices_reload_data(void) {
  if (s_menu_layer) {
    filter_devices();
    menu_layer_reload_data(s_menu_layer);
  }
}

void menu_devices_window_push(int type_index) {
  s_current_type_index = type_index;
  filter_devices();
  if(!s_window) {
    s_window = window_create();
    window_set_window_handlers(s_window, (WindowHandlers) {
      .load = window_load,
      .appear = window_appear,
      .unload = window_unload,
    });
  }
  window_stack_push(s_window, true);
}
