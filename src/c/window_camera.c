#include <pebble.h>
#include "wyze_data.h"

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_name_layer;
static TextLayer *s_loading_layer;
static TextLayer *s_event_type_layer;
static TextLayer *s_event_time_layer;

#ifdef PBL_COLOR
static BitmapLayer *s_bitmap_layer;
static GBitmap *s_bitmap;
static uint8_t *s_img_buffer;
static int s_img_width;
static int s_img_height;
static int s_img_total_bytes;
static int s_chunks_received;
static int s_chunks_total;
#endif

static int s_device_index = -1;
static char s_event_type_buf[48];
static char s_event_time_buf[48];
static char s_loading_buf[32];

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

static void window_load(Window *window) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Camera: window_load");
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  int y = TITLE_BAR_HEIGHT;

  s_title_layer = setup_title_bar(window, bounds);

  // Camera name
  s_name_layer = text_layer_create(GRect(5, y, bounds.size.w - 10, 22));
  text_layer_set_font(s_name_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_name_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_name_layer));

#ifdef PBL_COLOR
  // Bitmap layer for camera thumbnail (below name, above event text)
  int img_y = y + 22;
  s_bitmap_layer = bitmap_layer_create(GRect(0, img_y, bounds.size.w, 84));
  bitmap_layer_set_compositing_mode(s_bitmap_layer, GCompOpSet);
  bitmap_layer_set_alignment(s_bitmap_layer, GAlignCenter);
  layer_add_child(window_layer, bitmap_layer_get_layer(s_bitmap_layer));
  int text_y = img_y + 84;
#else
  int text_y = y + 25;
#endif

  // Loading indicator
  s_loading_layer = text_layer_create(GRect(5, text_y, bounds.size.w - 10, 24));
  text_layer_set_text(s_loading_layer, "Loading events...");
  text_layer_set_font(s_loading_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_loading_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_loading_layer));

  // Event type (e.g., "Motion Detected")
  s_event_type_layer = text_layer_create(GRect(5, text_y, bounds.size.w - 10, 24));
  text_layer_set_font(s_event_type_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_event_type_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_event_type_layer));

  // Event timestamp
  s_event_time_layer = text_layer_create(GRect(5, text_y + 22, bounds.size.w - 10, 20));
  text_layer_set_font(s_event_time_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(s_event_time_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_event_time_layer));

}

static void window_appear(Window *window) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Camera: window_appear idx=%d count=%d", s_device_index, s_device_count);
  if (s_device_index >= 0 && s_device_index < s_device_count) {
    text_layer_set_text(s_name_layer, s_devices[s_device_index].name);
    text_layer_set_text(s_event_type_layer, "");
    text_layer_set_text(s_event_time_layer, "");

    text_layer_set_text(s_loading_layer, "Loading events...");

    wyze_set_image_target(0); // Route image data to camera window
    DictionaryIterator *iter;
    app_message_outbox_begin(&iter);
    if (!iter) return;
    dict_write_int32(iter, MESSAGE_KEY_CameraRequest, s_devices[s_device_index].id);
    app_message_outbox_send();
    APP_LOG(APP_LOG_LEVEL_INFO, "Camera: CameraRequest sent");
  }
}

static void window_unload(Window *window) {
#ifdef PBL_COLOR
  free_image();
  if (s_bitmap_layer) {
    bitmap_layer_destroy(s_bitmap_layer);
    s_bitmap_layer = NULL;
  }
#endif
  text_layer_destroy(s_title_layer);
  s_title_layer = NULL;
  text_layer_destroy(s_name_layer);
  s_name_layer = NULL;
  text_layer_destroy(s_loading_layer);
  s_loading_layer = NULL;
  text_layer_destroy(s_event_type_layer);
  s_event_type_layer = NULL;
  text_layer_destroy(s_event_time_layer);
  s_event_time_layer = NULL;
}

void window_camera_receive_event(const char *event_type, const char *event_time) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Camera: receive_event type=%s", event_type ? event_type : "(null)");
  if (event_type) {
    strncpy(s_event_type_buf, event_type, sizeof(s_event_type_buf) - 1);
    s_event_type_buf[sizeof(s_event_type_buf) - 1] = '\0';
  }
  if (event_time) {
    strncpy(s_event_time_buf, event_time, sizeof(s_event_time_buf) - 1);
    s_event_time_buf[sizeof(s_event_time_buf) - 1] = '\0';
  }
  if (s_loading_layer) text_layer_set_text(s_loading_layer, "");
  if (s_event_type_layer) text_layer_set_text(s_event_type_layer, s_event_type_buf);
  if (s_event_time_layer) text_layer_set_text(s_event_time_layer, s_event_time_buf);
}

void window_camera_receive_chunk(int chunk_index, int chunk_total, uint8_t *data, int data_len, int width, int height) {
#ifdef PBL_COLOR
  // First chunk: allocate buffer
  if (chunk_index == 0) {
    free_image();
    s_img_width = width;
    s_img_height = height;
    s_img_total_bytes = width * height;
    s_chunks_total = chunk_total;
    s_chunks_received = 0;
    s_img_buffer = (uint8_t *)malloc(s_img_total_bytes);
    if (!s_img_buffer) {
      APP_LOG(APP_LOG_LEVEL_ERROR, "Camera: failed to malloc %d bytes", s_img_total_bytes);
      if (s_loading_layer) text_layer_set_text(s_loading_layer, "Memory error");
      return;
    }
    memset(s_img_buffer, 0, s_img_total_bytes);
    APP_LOG(APP_LOG_LEVEL_INFO, "Camera: alloc %dx%d (%d bytes), %d chunks", width, height, s_img_total_bytes, chunk_total);
  }

  if (!s_img_buffer) return;

  // Copy chunk data into buffer
  int offset = chunk_index * 1500;  // Must match JS CAM_CHUNK_SIZE
  int copy_len = data_len;
  if (offset + copy_len > s_img_total_bytes) {
    copy_len = s_img_total_bytes - offset;
  }
  if (copy_len > 0) {
    memcpy(&s_img_buffer[offset], data, copy_len);
  }
  s_chunks_received++;

  // Update loading text with progress
  snprintf(s_loading_buf, sizeof(s_loading_buf), "Image %d/%d", s_chunks_received, s_chunks_total);
  if (s_loading_layer) text_layer_set_text(s_loading_layer, s_loading_buf);

  // Final chunk: create GBitmap and display
  if (s_chunks_received >= s_chunks_total) {
    APP_LOG(APP_LOG_LEVEL_INFO, "Camera: all %d chunks received, creating bitmap", s_chunks_total);
    s_bitmap = gbitmap_create_blank(GSize(s_img_width, s_img_height), GBitmapFormat8Bit);
    if (s_bitmap) {
      uint8_t *bitmap_data = gbitmap_get_data(s_bitmap);
      int row_bytes = gbitmap_get_bytes_per_row(s_bitmap);
      // Copy row by row (bitmap may have padding per row)
      for (int y = 0; y < s_img_height; y++) {
        memcpy(&bitmap_data[y * row_bytes], &s_img_buffer[y * s_img_width], s_img_width);
      }
      if (s_bitmap_layer) {
        bitmap_layer_set_bitmap(s_bitmap_layer, s_bitmap);
        layer_mark_dirty(bitmap_layer_get_layer(s_bitmap_layer));
      }
      if (s_loading_layer) text_layer_set_text(s_loading_layer, "");
      APP_LOG(APP_LOG_LEVEL_INFO, "Camera: bitmap displayed");
    } else {
      APP_LOG(APP_LOG_LEVEL_ERROR, "Camera: gbitmap_create_blank failed");
      if (s_loading_layer) text_layer_set_text(s_loading_layer, "Image error");
    }
    // Free the temp buffer (bitmap has its own copy)
    free(s_img_buffer);
    s_img_buffer = NULL;
  }
#else
  // B&W platforms: no image support
  (void)chunk_index; (void)chunk_total; (void)data; (void)data_len; (void)width; (void)height;
#endif
}

void window_camera_push(int device_index) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Camera: push dev_idx=%d", device_index);
  s_device_index = device_index;
  memset(s_event_type_buf, 0, sizeof(s_event_type_buf));
  memset(s_event_time_buf, 0, sizeof(s_event_time_buf));
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
