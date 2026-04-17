#include <pebble.h>
#include "wyze_data.h"

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_title_layer;
static int s_device_index = -1;

// Action type constants matching JS handler
#define ACTION_POWER 1
#define ACTION_BRIGHTNESS 2
#define ACTION_COLOR 3

static const char *s_brightness_options[] = {"20%", "40%", "60%", "80%", "100%"};
static const int s_brightness_values[] = {20, 40, 60, 80, 100};
#define NUM_BRIGHTNESS 5

static const char *s_color_options[] = {"Soft White", "Cool White", "Red", "Green", "Blue"};
#define NUM_COLORS 5

// Track last-selected values for display
static int s_last_brightness = -1;  // index into s_brightness_options
static int s_last_color = -1;       // index into s_color_options

static void brightness_selected(int index, void *context) {
  if (s_device_index < 0) return;
  s_last_brightness = index;
  wyze_data_set_property(s_devices[s_device_index].id, ACTION_BRIGHTNESS, s_brightness_values[index]);
}

static void color_selected(int index, void *context) {
  if (s_device_index < 0) return;
  s_last_color = index;
  wyze_data_set_property(s_devices[s_device_index].id, ACTION_COLOR, index);
}

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data) { return 1; }
static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) { return 3; }

static void menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  if (s_device_index < 0 || s_device_index >= s_device_count) return;
  WyzeDevice dev = s_devices[s_device_index];

  switch (cell_index->row) {
    case 0: {
      const char *state = !dev.online ? "Offline" : (dev.state ? "ON" : "OFF");
      menu_cell_basic_draw(ctx, cell_layer, "Power", state, NULL);
      break;
    }
    case 1: {
      const char *bri_label = s_last_brightness >= 0 ? s_brightness_options[s_last_brightness] : "Select";
      menu_cell_basic_draw(ctx, cell_layer, "Brightness", bri_label, NULL);
      break;
    }
    case 2: {
      const char *col_label = s_last_color >= 0 ? s_color_options[s_last_color] : "Select";
      menu_cell_basic_draw(ctx, cell_layer, "Color", col_label, NULL);
      break;
    }
  }
}

static void menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (s_device_index < 0) return;

  switch (cell_index->row) {
    case 0:
      // Toggle power immediately — optimistic update
      wyze_data_toggle_device(s_devices[s_device_index].id);
      s_devices[s_device_index].state = s_devices[s_device_index].state ? 0 : 1;
      menu_layer_reload_data(s_menu_layer);
      break;
    case 1:
      window_picker_push("Brightness", s_brightness_options, NUM_BRIGHTNESS, brightness_selected, NULL);
      break;
    case 2:
      window_picker_push("Color", s_color_options, NUM_COLORS, color_selected, NULL);
      break;
  }
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
  menu_layer_set_click_config_onto_window(s_menu_layer, window);
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));
}

static void window_unload(Window *window) {
  menu_layer_destroy(s_menu_layer);
  s_menu_layer = NULL;
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
}

void menu_light_actions_reload_data(void) {
  if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
}

void menu_light_actions_window_push(int device_index) {
  s_device_index = device_index;
  s_last_brightness = -1;
  s_last_color = -1;
  if (!s_window) {
    s_window = window_create();
    window_set_window_handlers(s_window, (WindowHandlers){
      .load = window_load,
      .appear = window_appear,
      .unload = window_unload,
    });
  }
  window_stack_push(s_window, true);
}
