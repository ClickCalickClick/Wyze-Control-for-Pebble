#include <pebble.h>
#include "wyze_data.h"

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_title_layer;

static const char **s_options;
static int s_option_count;
static PickerCallback s_callback;
static void *s_callback_context;
static char s_picker_title[32];

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data) { return 1; }
static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return s_option_count;
}

static void menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  if (cell_index->row < s_option_count) {
    menu_cell_basic_draw(ctx, cell_layer, s_options[cell_index->row], NULL, NULL);
  }
}

static void menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (cell_index->row < s_option_count && s_callback) {
    s_callback(cell_index->row, s_callback_context);
  }
  window_stack_pop(true);
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
  // Allow re-creation with different options next time
  window_destroy(s_window);
  s_window = NULL;
}

void window_picker_push(const char *title, const char **options, int count, PickerCallback callback, void *context) {
  s_options = options;
  s_option_count = count;
  s_callback = callback;
  s_callback_context = context;
  strncpy(s_picker_title, title, sizeof(s_picker_title) - 1);

  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers){
    .load = window_load,
    .unload = window_unload,
  });
  window_stack_push(s_window, true);
}
