#include <pebble.h>
#include "wyze_data.h"

VacuumData s_vacuum_data;

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_name_layer;
static TextLayer *s_mode_layer;
static TextLayer *s_battery_layer;
static TextLayer *s_hint_layer;

static int s_device_index = -1;
static char s_battery_buf[24];
static char s_hint_buf[32];

static void request_status(void) {
  if (s_device_index < 0) return;
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_VacuumRequest, s_devices[s_device_index].id);
  app_message_outbox_send();
}

static void send_action(int action) {
  if (s_device_index < 0) return;
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_ActionToggle, s_devices[s_device_index].id);
  dict_write_int32(iter, MESSAGE_KEY_VacuumAction, action);
  app_message_outbox_send();
}

static void update_ui(void) {
  if (s_vacuum_data.battery < 0) {
    text_layer_set_text(s_battery_layer, "Loading...");
    text_layer_set_text(s_mode_layer, "");
    return;
  }
  snprintf(s_battery_buf, sizeof(s_battery_buf), "Battery: %d%%", s_vacuum_data.battery);
  text_layer_set_text(s_battery_layer, s_battery_buf);
  text_layer_set_text(s_mode_layer, s_vacuum_data.mode_text);
}

static void up_handler(ClickRecognizerRef ref, void *ctx) {
  send_action(0); // Start
  text_layer_set_text(s_hint_layer, "START sent");
}
static void select_handler(ClickRecognizerRef ref, void *ctx) {
  send_action(1); // Pause
  text_layer_set_text(s_hint_layer, "PAUSE sent");
}
static void down_handler(ClickRecognizerRef ref, void *ctx) {
  send_action(2); // Dock
  text_layer_set_text(s_hint_layer, "DOCK sent");
}
static void long_select_handler(ClickRecognizerRef ref, void *ctx) {
  text_layer_set_text(s_hint_layer, "Refreshing...");
  request_status();
}
static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, up_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, select_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_handler);
  window_long_click_subscribe(BUTTON_ID_SELECT, 700, long_select_handler, NULL);
}

static void window_appear(Window *window) {
  if (s_device_index >= 0 && s_device_index < s_device_count) {
    text_layer_set_text(s_name_layer, s_devices[s_device_index].name);
  }
  memset(&s_vacuum_data, 0, sizeof(s_vacuum_data));
  s_vacuum_data.battery = -1;
  update_ui();
  text_layer_set_text(s_hint_layer, "UP=Start  SEL=Pause  DN=Dock");
  request_status();
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  int y = TITLE_BAR_HEIGHT;

  s_title_layer = setup_title_bar(window, bounds);

  s_name_layer = text_layer_create(GRect(5, y, bounds.size.w - 10, 24));
  text_layer_set_font(s_name_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_name_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_name_layer));

  s_mode_layer = text_layer_create(GRect(5, y + 26, bounds.size.w - 10, 32));
  text_layer_set_font(s_mode_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(s_mode_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_mode_layer));

  s_battery_layer = text_layer_create(GRect(5, y + 62, bounds.size.w - 10, 24));
  text_layer_set_font(s_battery_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(s_battery_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_battery_layer));

  s_hint_layer = text_layer_create(GRect(2, bounds.size.h - 34, bounds.size.w - 4, 32));
  text_layer_set_font(s_hint_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(s_hint_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_hint_layer, GTextOverflowModeWordWrap);
  layer_add_child(window_layer, text_layer_get_layer(s_hint_layer));
}

static void window_unload(Window *window) {
  text_layer_destroy(s_title_layer); s_title_layer = NULL;
  text_layer_destroy(s_name_layer); s_name_layer = NULL;
  text_layer_destroy(s_mode_layer); s_mode_layer = NULL;
  text_layer_destroy(s_battery_layer); s_battery_layer = NULL;
  text_layer_destroy(s_hint_layer); s_hint_layer = NULL;
  (void)s_hint_buf;
}

void window_vacuum_refresh(void) {
  if (s_battery_layer) update_ui();
}

void window_vacuum_push(int device_index) {
  s_device_index = device_index;
  if (!s_window) {
    s_window = window_create();
    window_set_click_config_provider(s_window, click_config_provider);
    window_set_window_handlers(s_window, (WindowHandlers){
      .load = window_load,
      .appear = window_appear,
      .unload = window_unload,
    });
  }
  window_stack_push(s_window, true);
}
