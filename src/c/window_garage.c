#include <pebble.h>
#include "wyze_data.h"

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_name_layer;
static TextLayer *s_hint_layer;

#ifdef PBL_COLOR
static BitmapLayer *s_bitmap_layer;
static GBitmap *s_bitmap;
static uint8_t *s_img_buffer;
static int s_img_width;
static int s_img_height;
static int s_img_total_bytes;
static int s_chunks_received;
static int s_chunks_total;
static TextLayer *s_loading_layer;
static TextLayer *s_event_time_layer;
static char s_loading_buf[32];
static char s_event_time_buf[48];
#else
static TextLayer *s_status_layer;
#endif

static int s_device_index = -1;

#ifdef PBL_COLOR
static void free_image(void) {
  if (s_bitmap) {
    gbitmap_destroy(s_bitmap);
    s_bitmap = NULL;
  }
  if (s_img_buffer) {
    free(s_img_buffer);
    s_img_buffer = NULL;
  }
  s_img_width = 0;
  s_img_height = 0;
  s_img_total_bytes = 0;
  s_chunks_received = 0;
  s_chunks_total = 0;
}
#endif

static void select_handler(ClickRecognizerRef ref, void *ctx) {
  if (s_device_index < 0) return;
  WyzeDevice dev = s_devices[s_device_index];
  if (!dev.online) return;
  // Toggle garage door via run_action
  wyze_data_set_property(dev.id, 4, 0);
  if (s_hint_layer) text_layer_set_text(s_hint_layer, "SENDING...");
}

static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_handler);
}

static void window_appear(Window *window) {
  if (s_device_index >= 0 && s_device_index < s_device_count) {
    text_layer_set_text(s_name_layer, s_devices[s_device_index].name);

#ifdef PBL_COLOR
    free_image();
    if (s_bitmap_layer) bitmap_layer_set_bitmap(s_bitmap_layer, NULL);
    if (s_loading_layer) text_layer_set_text(s_loading_layer, "Loading image...");
    if (s_event_time_layer) text_layer_set_text(s_event_time_layer, "");

    wyze_set_image_target(1); // Route image data to garage window
    DictionaryIterator *iter;
    app_message_outbox_begin(&iter);
    if (!iter) return;
    dict_write_int32(iter, MESSAGE_KEY_GarageRequest, s_devices[s_device_index].id);
    app_message_outbox_send();
#else
    if (!s_devices[s_device_index].online) {
      text_layer_set_text(s_status_layer, "OFFLINE");
    } else {
      text_layer_set_text(s_status_layer, s_devices[s_device_index].state ? "OPEN" : "CLOSED");
    }
#endif
  }
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  int y = TITLE_BAR_HEIGHT;

  s_title_layer = setup_title_bar(window, bounds);

  // Device name
  s_name_layer = text_layer_create(GRect(5, y, bounds.size.w - 10, 22));
  text_layer_set_font(s_name_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_name_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_name_layer));

#ifdef PBL_COLOR
  // Bitmap layer for camera thumbnail
  int img_y = y + 22;
  s_bitmap_layer = bitmap_layer_create(GRect(0, img_y, bounds.size.w, 84));
  bitmap_layer_set_compositing_mode(s_bitmap_layer, GCompOpSet);
  bitmap_layer_set_alignment(s_bitmap_layer, GAlignCenter);
  layer_add_child(window_layer, bitmap_layer_get_layer(s_bitmap_layer));
  int text_y = img_y + 84;

  // Loading/progress
  s_loading_layer = text_layer_create(GRect(5, text_y, bounds.size.w - 10, 20));
  text_layer_set_text(s_loading_layer, "Loading image...");
  text_layer_set_font(s_loading_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(s_loading_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_loading_layer));

  // Event time
  s_event_time_layer = text_layer_create(GRect(5, text_y, bounds.size.w - 10, 20));
  text_layer_set_font(s_event_time_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(s_event_time_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_event_time_layer));
#else
  // B&W: large status text
  s_status_layer = text_layer_create(GRect(5, y + 25, bounds.size.w - 10, 60));
  text_layer_set_font(s_status_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(s_status_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_status_layer));
#endif

  // Hint at bottom
  s_hint_layer = text_layer_create(GRect(5, bounds.size.h - 22, bounds.size.w - 10, 20));
  text_layer_set_text(s_hint_layer, "SELECT: Toggle Door");
  text_layer_set_font(s_hint_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(s_hint_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_hint_layer));

  window_set_click_config_provider(window, click_config_provider);
}

static void window_unload(Window *window) {
#ifdef PBL_COLOR
  free_image();
  if (s_bitmap_layer) {
    bitmap_layer_destroy(s_bitmap_layer);
    s_bitmap_layer = NULL;
  }
  if (s_loading_layer) {
    text_layer_destroy(s_loading_layer);
    s_loading_layer = NULL;
  }
  if (s_event_time_layer) {
    text_layer_destroy(s_event_time_layer);
    s_event_time_layer = NULL;
  }
#else
  if (s_status_layer) {
    text_layer_destroy(s_status_layer);
    s_status_layer = NULL;
  }
#endif
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
  text_layer_destroy(s_name_layer);
  s_name_layer = NULL;
  text_layer_destroy(s_hint_layer);
  s_hint_layer = NULL;
}

void window_garage_refresh(void) {
  if (s_device_index >= 0 && s_name_layer) {
    text_layer_set_text(s_name_layer, s_devices[s_device_index].name);
    if (s_hint_layer) text_layer_set_text(s_hint_layer, "SELECT: Toggle Door");
#ifndef PBL_COLOR
    if (s_status_layer) {
      if (!s_devices[s_device_index].online) {
        text_layer_set_text(s_status_layer, "OFFLINE");
      } else {
        text_layer_set_text(s_status_layer, s_devices[s_device_index].state ? "OPEN" : "CLOSED");
      }
    }
#endif
  }
}

void window_garage_receive_chunk(int chunk_index, int chunk_total, uint8_t *data, int data_len, int width, int height) {
#ifdef PBL_COLOR
  if (chunk_index == 0) {
    free_image();
    s_img_width = width;
    s_img_height = height;
    s_img_total_bytes = width * height;
    s_chunks_total = chunk_total;
    s_chunks_received = 0;
    s_img_buffer = (uint8_t *)malloc(s_img_total_bytes);
    if (!s_img_buffer) {
      APP_LOG(APP_LOG_LEVEL_ERROR, "Garage: failed to malloc %d bytes", s_img_total_bytes);
      if (s_loading_layer) text_layer_set_text(s_loading_layer, "Memory error");
      return;
    }
    memset(s_img_buffer, 0, s_img_total_bytes);
  }

  if (!s_img_buffer) return;

  int offset = chunk_index * 1500;  // Must match JS CAM_CHUNK_SIZE
  int copy_len = data_len;
  if (offset + copy_len > s_img_total_bytes) {
    copy_len = s_img_total_bytes - offset;
  }
  if (copy_len > 0) {
    memcpy(&s_img_buffer[offset], data, copy_len);
  }
  s_chunks_received++;

  snprintf(s_loading_buf, sizeof(s_loading_buf), "Image %d/%d", s_chunks_received, s_chunks_total);
  if (s_loading_layer) text_layer_set_text(s_loading_layer, s_loading_buf);

  if (s_chunks_received >= s_chunks_total) {
    s_bitmap = gbitmap_create_blank(GSize(s_img_width, s_img_height), GBitmapFormat8Bit);
    if (s_bitmap) {
      uint8_t *bitmap_data = gbitmap_get_data(s_bitmap);
      int row_bytes = gbitmap_get_bytes_per_row(s_bitmap);
      for (int y = 0; y < s_img_height; y++) {
        memcpy(&bitmap_data[y * row_bytes], &s_img_buffer[y * s_img_width], s_img_width);
      }
      if (s_bitmap_layer) {
        bitmap_layer_set_bitmap(s_bitmap_layer, s_bitmap);
        layer_mark_dirty(bitmap_layer_get_layer(s_bitmap_layer));
      }
      if (s_loading_layer) text_layer_set_text(s_loading_layer, "");
    } else {
      if (s_loading_layer) text_layer_set_text(s_loading_layer, "Image error");
    }
    free(s_img_buffer);
    s_img_buffer = NULL;
  }
#else
  (void)chunk_index; (void)chunk_total; (void)data; (void)data_len; (void)width; (void)height;
#endif
}

void window_garage_receive_event(const char *event_type, const char *event_time) {
#ifdef PBL_COLOR
  if (event_time) {
    strncpy(s_event_time_buf, event_time, sizeof(s_event_time_buf) - 1);
    s_event_time_buf[sizeof(s_event_time_buf) - 1] = '\0';
  }
  if (s_loading_layer) text_layer_set_text(s_loading_layer, "");
  if (s_event_time_layer) text_layer_set_text(s_event_time_layer, s_event_time_buf);
#else
  (void)event_type; (void)event_time;
#endif
}

void window_garage_push(int device_index) {
  s_device_index = device_index;
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
