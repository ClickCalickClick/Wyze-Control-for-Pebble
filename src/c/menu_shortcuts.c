#include <pebble.h>
#include "wyze_data.h"

WyzeShortcut s_shortcuts[MAX_SHORTCUTS];
int s_shortcut_count = 0;

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_title_layer;
static TextLayer *s_confirm_layer;
static AppTimer *s_confirm_timer = NULL;

static void confirm_timer_callback(void *data) {
  s_confirm_timer = NULL;
  if (s_confirm_layer) {
    text_layer_set_text(s_confirm_layer, "");
  }
}

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data) { return 1; }

static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  if (s_shortcut_count == 0) return 1; // Show placeholder
  return s_shortcut_count;
}

static void menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  if (s_shortcut_count == 0) {
    menu_cell_basic_draw(ctx, cell_layer, "No Shortcuts", "Loading or none found", NULL);
    return;
  }
  if (cell_index->row < s_shortcut_count) {
    menu_cell_basic_draw(ctx, cell_layer, s_shortcuts[cell_index->row].name, "Tap to run", NULL);
  }
}

static void menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (s_shortcut_count == 0 || cell_index->row >= s_shortcut_count) return;

  int shortcut_id = s_shortcuts[cell_index->row].id;
  // Send trigger to JS
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_ShortcutTrigger, shortcut_id);
  app_message_outbox_send();

  vibes_short_pulse();
  if (s_confirm_layer) {
    text_layer_set_text(s_confirm_layer, "Triggered!");
    if (s_confirm_timer) app_timer_cancel(s_confirm_timer);
    s_confirm_timer = app_timer_register(1500, confirm_timer_callback, NULL);
  }
}

static void window_appear(Window *window) {
  if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_title_layer = setup_title_bar(window, bounds);

  GRect menu_bounds = GRect(0, TITLE_BAR_HEIGHT, bounds.size.w, bounds.size.h - TITLE_BAR_HEIGHT - 24);
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

  // Confirmation toast at bottom
  s_confirm_layer = text_layer_create(GRect(0, bounds.size.h - 24, bounds.size.w, 24));
  text_layer_set_font(s_confirm_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_confirm_layer, GTextAlignmentCenter);
  text_layer_set_background_color(s_confirm_layer, GColorBlack);
  text_layer_set_text_color(s_confirm_layer, GColorWhite);
  layer_add_child(window_layer, text_layer_get_layer(s_confirm_layer));
}

static void window_unload(Window *window) {
  menu_layer_destroy(s_menu_layer);
  s_menu_layer = NULL;
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
  text_layer_destroy(s_confirm_layer);
  s_confirm_layer = NULL;
  if (s_confirm_timer) {
    app_timer_cancel(s_confirm_timer);
    s_confirm_timer = NULL;
  }
}

void menu_shortcuts_reload_data(void) {
  if (s_menu_layer) menu_layer_reload_data(s_menu_layer);
}

void menu_shortcuts_window_push(void) {
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
