#include <pebble.h>
#include "wyze_data.h"

ScaleData s_scale_data;

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_weight_layer;
static TextLayer *s_date_layer;
static TextLayer *s_stats_layer;
static TextLayer *s_loading_layer;

static int s_device_index = -1;
static char s_stats_buf[128];

static void update_ui(void) {
  if (s_scale_data.weight[0] == '\0') {
    text_layer_set_text(s_loading_layer, "Loading...");
    return;
  }
  text_layer_set_text(s_loading_layer, "");
  text_layer_set_text(s_weight_layer, s_scale_data.weight);
  text_layer_set_text(s_date_layer, s_scale_data.date);

  snprintf(s_stats_buf, sizeof(s_stats_buf), "Fat: %s  BMI: %s\nMuscle: %s\nWater: %s",
    s_scale_data.body_fat, s_scale_data.bmi, s_scale_data.muscle, s_scale_data.water);
  text_layer_set_text(s_stats_layer, s_stats_buf);
}

static void window_appear(Window *window) {
  update_ui();
  // Request scale data from JS
  if (s_device_index >= 0) {
    wyze_data_set_property(s_devices[s_device_index].id, 5, 0);
  }
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  int y_off = TITLE_BAR_HEIGHT;

  s_title_layer = setup_title_bar(window, bounds);

  // Loading text
  s_loading_layer = text_layer_create(GRect(5, y_off + 50, bounds.size.w - 10, 30));
  text_layer_set_text(s_loading_layer, "Loading...");
  text_layer_set_font(s_loading_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_loading_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_loading_layer));

  // Weight (large)
  s_weight_layer = text_layer_create(GRect(5, y_off + 2, bounds.size.w - 10, 40));
  text_layer_set_font(s_weight_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(s_weight_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_weight_layer));

  // Date
  s_date_layer = text_layer_create(GRect(5, y_off + 42, bounds.size.w - 10, 24));
  text_layer_set_font(s_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_date_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_date_layer));

  // Stats block
  s_stats_layer = text_layer_create(GRect(5, y_off + 68, bounds.size.w - 10, 80));
  text_layer_set_font(s_stats_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_stats_layer, GTextAlignmentLeft);
  layer_add_child(window_layer, text_layer_get_layer(s_stats_layer));
}

static void window_unload(Window *window) {
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
  text_layer_destroy(s_weight_layer);
  s_weight_layer = NULL;
  text_layer_destroy(s_date_layer);
  s_date_layer = NULL;
  text_layer_destroy(s_stats_layer);
  s_stats_layer = NULL;
  text_layer_destroy(s_loading_layer);
  s_loading_layer = NULL;
}

void window_scale_refresh(void) {
  if (s_weight_layer) update_ui();
}

void window_scale_push(int device_index) {
  s_device_index = device_index;
  memset(&s_scale_data, 0, sizeof(s_scale_data));
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
