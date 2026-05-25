#include <pebble.h>
#include "wyze_data.h"

ThermoData s_thermo_data;

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_name_layer;
static TextLayer *s_temp_layer;
static TextLayer *s_mode_layer;
static TextLayer *s_sp_layer;
static TextLayer *s_hint_layer;

static int s_device_index = -1;
static char s_temp_buf[40];
static char s_mode_buf[40];
static char s_sp_buf[48];

// Local mirror so UP/DOWN edits are responsive before server reply
static int s_local_heat_sp = 0;
static int s_local_cool_sp = 0;

static void request_status(void) {
  if (s_device_index < 0) return;
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_ThermoRequest, s_devices[s_device_index].id);
  app_message_outbox_send();
}

static void send_thermo_action(int action, int value) {
  if (s_device_index < 0) return;
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_ActionToggle, s_devices[s_device_index].id);
  dict_write_int32(iter, MESSAGE_KEY_ThermoAction, action);
  dict_write_int32(iter, MESSAGE_KEY_ThermoActionValue, value);
  app_message_outbox_send();
}

// Returns mode index: 0=OFF, 1=AUTO, 2=COOL, 3=HEAT
static int mode_index(void) {
  if (strcmp(s_thermo_data.mode, "OFF")  == 0) return 0;
  if (strcmp(s_thermo_data.mode, "AUTO") == 0) return 1;
  if (strcmp(s_thermo_data.mode, "COOL") == 0) return 2;
  if (strcmp(s_thermo_data.mode, "HEAT") == 0) return 3;
  return 0;
}

static void update_ui(void) {
  if (s_thermo_data.temp_x10 <= -9000) {
    text_layer_set_text(s_temp_layer, "--");
    text_layer_set_text(s_mode_layer, s_thermo_data.mode);
    text_layer_set_text(s_sp_layer, "");
    return;
  }
  int whole = s_thermo_data.temp_x10 / 10;
  int frac  = s_thermo_data.temp_x10 % 10;
  if (frac < 0) frac = -frac;
  if (s_thermo_data.humidity >= 0) {
    snprintf(s_temp_buf, sizeof(s_temp_buf), "%d.%d\u00B0F  %d%%", whole, frac, s_thermo_data.humidity);
  } else {
    snprintf(s_temp_buf, sizeof(s_temp_buf), "%d.%d\u00B0F", whole, frac);
  }
  text_layer_set_text(s_temp_layer, s_temp_buf);

  snprintf(s_mode_buf, sizeof(s_mode_buf), "%s  %s", s_thermo_data.mode, s_thermo_data.working);
  text_layer_set_text(s_mode_layer, s_mode_buf);

  snprintf(s_sp_buf, sizeof(s_sp_buf), "Heat %d\u00B0  Cool %d\u00B0",
    s_local_heat_sp, s_local_cool_sp);
  text_layer_set_text(s_sp_layer, s_sp_buf);
}

static int active_sp_action(void) {
  // Returns ThermoAction: 1=heat_sp, 2=cool_sp. Default to heat_sp if mode is HEAT
  // or AUTO, cool_sp if COOL, heat_sp otherwise (OFF still adjusts heat).
  int m = mode_index();
  if (m == 2) return 2;  // COOL
  return 1;              // HEAT/AUTO/OFF -> heat
}

static void up_handler(ClickRecognizerRef ref, void *ctx) {
  int action = active_sp_action();
  if (action == 2) s_local_cool_sp += 1;
  else             s_local_heat_sp += 1;
  if (s_local_heat_sp > 90) s_local_heat_sp = 90;
  if (s_local_cool_sp > 90) s_local_cool_sp = 90;
  update_ui();
  send_thermo_action(action, action == 2 ? s_local_cool_sp : s_local_heat_sp);
}
static void down_handler(ClickRecognizerRef ref, void *ctx) {
  int action = active_sp_action();
  if (action == 2) s_local_cool_sp -= 1;
  else             s_local_heat_sp -= 1;
  if (s_local_heat_sp < 40) s_local_heat_sp = 40;
  if (s_local_cool_sp < 40) s_local_cool_sp = 40;
  update_ui();
  send_thermo_action(action, action == 2 ? s_local_cool_sp : s_local_heat_sp);
}
static void select_handler(ClickRecognizerRef ref, void *ctx) {
  // Cycle mode OFF -> AUTO -> COOL -> HEAT -> OFF
  int next = (mode_index() + 1) % 4;
  const char *names[] = {"OFF", "AUTO", "COOL", "HEAT"};
  strncpy(s_thermo_data.mode, names[next], sizeof(s_thermo_data.mode) - 1);
  update_ui();
  send_thermo_action(0, next);
  text_layer_set_text(s_hint_layer, "Mode change sent");
}
static void long_select_handler(ClickRecognizerRef ref, void *ctx) {
  text_layer_set_text(s_hint_layer, "Refreshing...");
  request_status();
}
static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, up_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_UP, 200, up_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_DOWN, 200, down_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, select_handler);
  window_long_click_subscribe(BUTTON_ID_SELECT, 700, long_select_handler, NULL);
}

static void window_appear(Window *window) {
  if (s_device_index >= 0 && s_device_index < s_device_count) {
    text_layer_set_text(s_name_layer, s_devices[s_device_index].name);
  }
  memset(&s_thermo_data, 0, sizeof(s_thermo_data));
  s_thermo_data.temp_x10 = -9999;
  s_thermo_data.humidity = -1;
  strncpy(s_thermo_data.mode, "...", sizeof(s_thermo_data.mode) - 1);
  s_local_heat_sp = 70;
  s_local_cool_sp = 75;
  update_ui();
  text_layer_set_text(s_hint_layer, "UP/DN setpoint  SEL mode");
  request_status();
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  int y = TITLE_BAR_HEIGHT;

  s_title_layer = setup_title_bar(window, bounds);

  s_name_layer = text_layer_create(GRect(5, y, bounds.size.w - 10, 20));
  text_layer_set_font(s_name_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(s_name_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_name_layer));

  s_temp_layer = text_layer_create(GRect(5, y + 20, bounds.size.w - 10, 34));
  text_layer_set_font(s_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(s_temp_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_temp_layer));

  s_mode_layer = text_layer_create(GRect(5, y + 56, bounds.size.w - 10, 22));
  text_layer_set_font(s_mode_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_mode_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_mode_layer));

  s_sp_layer = text_layer_create(GRect(5, y + 78, bounds.size.w - 10, 22));
  text_layer_set_font(s_sp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_sp_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_sp_layer));

  s_hint_layer = text_layer_create(GRect(2, bounds.size.h - 22, bounds.size.w - 4, 20));
  text_layer_set_font(s_hint_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(s_hint_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_hint_layer));
}

static void window_unload(Window *window) {
  text_layer_destroy(s_title_layer); s_title_layer = NULL;
  text_layer_destroy(s_name_layer); s_name_layer = NULL;
  text_layer_destroy(s_temp_layer); s_temp_layer = NULL;
  text_layer_destroy(s_mode_layer); s_mode_layer = NULL;
  text_layer_destroy(s_sp_layer); s_sp_layer = NULL;
  text_layer_destroy(s_hint_layer); s_hint_layer = NULL;
}

void window_thermostat_refresh(void) {
  // Sync local SPs with server-reported values
  if (s_thermo_data.heat_sp > 0) s_local_heat_sp = s_thermo_data.heat_sp;
  if (s_thermo_data.cool_sp > 0) s_local_cool_sp = s_thermo_data.cool_sp;
  if (s_temp_layer) update_ui();
}

void window_thermostat_push(int device_index) {
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
