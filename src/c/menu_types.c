#include <pebble.h>
#include "wyze_data.h"

// Define known device categories
// Row 0 is Shortcuts (special), rows 1+ are device categories
static char *s_type_names[] = {"* Shortcuts", "Lights", "Plugs", "Switches", "Cameras", "Locks", "Garage Doors", "Scales", "Others"};
static int s_type_indices[] = {-1, 0, 1, 2, 3, 4, 5, 6, 99};
#define NUM_ROWS 9
// To re-enable TEST menu: add "** TEST **" to s_type_names, -99 to s_type_indices, set NUM_ROWS=10

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_title_layer;

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data) {
  return 1;
}

static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return NUM_ROWS;
}

static void menu_draw_row_callback(GContext* ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  int target_type = s_type_indices[cell_index->row];

  // Shortcuts row
  if (target_type == -1) {
    char buf[32];
    if (s_shortcut_count > 0) {
      snprintf(buf, sizeof(buf), "%d Available", s_shortcut_count);
    } else {
      snprintf(buf, sizeof(buf), "Tap to load");
    }
    menu_cell_basic_draw(ctx, cell_layer, s_type_names[cell_index->row], buf, NULL);
    return;
  }

  /* TEST row — commented out, see test_menu_instructions.md to re-enable
  if (target_type == -99) {
    char buf[32];
    if (s_auth_state >= 2 && s_device_count > 0) {
      snprintf(buf, sizeof(buf), "Loaded %d devices", s_device_count);
    } else if (s_auth_state == 1) {
      snprintf(buf, sizeof(buf), "Loading...");
    } else {
      snprintf(buf, sizeof(buf), "Tap to load test data");
    }
    menu_cell_basic_draw(ctx, cell_layer, s_type_names[cell_index->row], buf, NULL);
    return;
  } */

  int count = 0;
  for(int i = 0; i < s_device_count; i++) {
    if(target_type == 99 && s_devices[i].type_index != 0 && s_devices[i].type_index != 1 && s_devices[i].type_index != 2 && s_devices[i].type_index != 3 && s_devices[i].type_index != 4 && s_devices[i].type_index != 5 && s_devices[i].type_index != 6) count++;
    else if (target_type == 5 && s_devices[i].has_garage) count++;
    else if (s_devices[i].type_index == target_type) count++;
  }

  char buf[32];
  if (s_auth_state == 0) {
      snprintf(buf, sizeof(buf), "Open Settings on phone");
  } else if (s_auth_state == 1) {
      snprintf(buf, sizeof(buf), "Loading...");
  } else if (s_auth_state == 3) {
      snprintf(buf, sizeof(buf), "Refreshing...");
  } else if (count == 0) {
      snprintf(buf, sizeof(buf), "0 Devices");
  } else {
      snprintf(buf, sizeof(buf), "%d Devices", count);
  }
  menu_cell_basic_draw(ctx, cell_layer, s_type_names[cell_index->row], buf, NULL);
}

static void menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  int target_type = s_type_indices[cell_index->row];
  if (target_type == -1) {
    // Shortcuts
    menu_shortcuts_window_push();
    return;
  }
  /* TEST: inject test credentials — commented out, see test_menu_instructions.md
  if (target_type == -99) {
    s_auth_state = 1;
    menu_layer_reload_data(s_menu_layer);
    wyze_data_test_auth();
    return;
  } */
  // Auto-refresh device data silently when entering a category
  wyze_data_request_refresh();
  // Push device list of this category
  menu_devices_window_push(target_type);
}

static void app_msg_callback(DictionaryIterator *iter, void *context) {
    if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
}

// Custom click handlers for menu navigation + long-press refresh
static void up_handler(ClickRecognizerRef ref, void *ctx) {
  if (s_menu_layer) menu_layer_set_selected_next(s_menu_layer, true, MenuRowAlignCenter, true);
}
static void down_handler(ClickRecognizerRef ref, void *ctx) {
  if (s_menu_layer) menu_layer_set_selected_next(s_menu_layer, false, MenuRowAlignCenter, true);
}
static void select_handler(ClickRecognizerRef ref, void *ctx) {
  if (!s_menu_layer) return;
  MenuIndex idx = menu_layer_get_selected_index(s_menu_layer);
  menu_select_callback(s_menu_layer, &idx, NULL);
}
static void long_select_handler(ClickRecognizerRef ref, void *ctx) {
  // Manual refresh: show "Refreshing..." and fetch new data
  s_auth_state = 3;
  if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
  wyze_data_request_refresh();
}
static void back_handler(ClickRecognizerRef ref, void *ctx) {
  window_stack_pop(true);
}
static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, up_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_UP, 100, up_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_DOWN, 100, down_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, select_handler);
  window_long_click_subscribe(BUTTON_ID_SELECT, 700, long_select_handler, NULL);
  window_single_click_subscribe(BUTTON_ID_BACK, back_handler);
}

static void window_appear(Window *window) {
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
  // Use custom click config so we can add long-press SELECT for refresh
  window_set_click_config_provider(window, click_config_provider);
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));
  
}

static void window_unload(Window *window) {
  menu_layer_destroy(s_menu_layer);
  s_menu_layer = NULL;
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
}

void menu_types_reload_data(void) {
  if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
}

void menu_types_window_push() {
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
