#include <pebble.h>
#include "wyze_data.h"

TextLayer *setup_title_bar(Window *window, GRect bounds) {
  // Rectangular: nudge layer 4px up so Gothic18Bold renders centered within 20px bar
  // Round: start at 0, height=44 gives room for the newline-push trick
  int y_offset = PBL_IF_ROUND_ELSE(0, -4);
  int height   = PBL_IF_ROUND_ELSE(TITLE_BAR_HEIGHT, TITLE_BAR_HEIGHT + 4);

  TextLayer *title = text_layer_create(GRect(0, y_offset, bounds.size.w, height));
  // On round the empty first line pushes text into the visible curved area
  text_layer_set_text(title, PBL_IF_ROUND_ELSE("\nWyze Control", "Wyze Control"));
  text_layer_set_font(title, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(title, GTextAlignmentCenter);
  text_layer_set_background_color(title, PBL_IF_COLOR_ELSE(WYZE_BLUE, GColorBlack));
  text_layer_set_text_color(title, GColorWhite);
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(title));
  return title;
}
