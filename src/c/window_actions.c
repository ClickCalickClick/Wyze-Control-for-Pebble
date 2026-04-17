#include <pebble.h>
#include "wyze_data.h"

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_name_layer;
static TextLayer *s_state_layer;
static TextLayer *s_instruct_layer;

static int s_device_index = -1;
static AppTimer *s_lock_timer = NULL;

static void update_ui(void) {
  if (s_device_index < 0 || s_device_index >= s_device_count) return;
  WyzeDevice dev = s_devices[s_device_index];
  
  text_layer_set_text(s_name_layer, dev.name);
  if (!dev.online) {
    text_layer_set_font(s_state_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
    text_layer_set_text(s_state_layer, "OFFLINE");
  } else {
    text_layer_set_font(s_state_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
    if (dev.type_index == 4) {
      text_layer_set_text(s_state_layer, dev.state ? "LOCKED" : "UNLOCK");
    } else {
      text_layer_set_text(s_state_layer, dev.state ? "ON" : "OFF");
    }
  }

  // Show appropriate instruction for device type
  if (dev.type_index == 4) {
    text_layer_set_text(s_instruct_layer, "Bluetooth Only");
  } else {
    text_layer_set_text(s_instruct_layer, "SELECT to Toggle");
  }
}

static void lock_alert_timer_callback(void *data) {
  s_lock_timer = NULL;
  update_ui();
}

static void select_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (s_device_index < 0) return;

  // Locks cannot be cloud-controlled
  if (s_devices[s_device_index].type_index == 4) {
    text_layer_set_font(s_state_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text(s_state_layer, "Cloud control\nunsupported");
    vibes_short_pulse();
    if (s_lock_timer) app_timer_cancel(s_lock_timer);
    s_lock_timer = app_timer_register(2000, lock_alert_timer_callback, NULL);
    return;
  }

  wyze_data_toggle_device(s_devices[s_device_index].id);
  text_layer_set_font(s_state_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text(s_state_layer, "WAIT...");
}

static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
}

static void window_appear(Window *window) {
  update_ui();
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_title_layer = setup_title_bar(window, bounds);
  int y_off = TITLE_BAR_HEIGHT;

  s_name_layer = text_layer_create(GRect(5, y_off + 5, bounds.size.w - 10, 40));
  text_layer_set_font(s_name_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(s_name_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_name_layer));

  s_state_layer = text_layer_create(GRect(5, y_off + 50, bounds.size.w - 10, 60));
  text_layer_set_font(s_state_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(s_state_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_state_layer));

  s_instruct_layer = text_layer_create(GRect(5, bounds.size.h - 30, bounds.size.w - 10, 30));
  text_layer_set_text(s_instruct_layer, "SELECT to Toggle");
  text_layer_set_text_alignment(s_instruct_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_instruct_layer));
}

static void window_unload(Window *window) {
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
  text_layer_destroy(s_name_layer);
  text_layer_destroy(s_state_layer);
  text_layer_destroy(s_instruct_layer);
  if (s_lock_timer) {
    app_timer_cancel(s_lock_timer);
    s_lock_timer = NULL;
  }
}

void window_device_action_refresh(void) {
  if (s_device_index >= 0 && s_name_layer) {
    update_ui();
  }
}

void window_device_action_push(int device_index) {
  s_device_index = device_index;
  if(!s_window) {
    s_window = window_create();
    window_set_click_config_provider(s_window, click_config_provider);
    window_set_window_handlers(s_window, (WindowHandlers) {
      .load = window_load,
      .appear = window_appear,
      .unload = window_unload,
    });
  }
  window_stack_push(s_window, true);
}
