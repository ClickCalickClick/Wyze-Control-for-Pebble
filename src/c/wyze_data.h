#pragma once
#include <pebble.h>

#define MAX_DEVICES 50
#define TITLE_BAR_HEIGHT PBL_IF_ROUND_ELSE(44, 20)
#define WYZE_BLUE GColorVividCerulean

typedef struct {
  int id;
  int type_index;
  char name[32];
  char type_name[16];
  int state;
  int online;
  int has_garage;
} WyzeDevice;

extern WyzeDevice s_devices[MAX_DEVICES];
extern int s_device_count;

// 0 = no auth (show "Open Settings on phone")
// 1 = authenticated, loading devices (show "Loading...")
// 2 = devices received
// 3 = refreshing (has cached data, fetching updates)
extern int s_auth_state;

void wyze_app_message_init(void);
void wyze_data_request_refresh(void);
void wyze_data_toggle_device(int device_id);
void wyze_data_set_property(int device_id, int action_type, int action_value);

void menu_types_window_push(void);
void menu_types_reload_data(void);
// void wyze_data_test_auth(void);  // TEST menu — commented out
void menu_devices_window_push(int type_index);
void menu_devices_reload_data(void);
void window_device_action_push(int device_index);
void window_device_action_refresh(void);
void menu_light_actions_window_push(int device_index);
void menu_light_actions_reload_data(void);
void window_garage_push(int device_index);
void window_garage_refresh(void);
void window_garage_receive_chunk(int chunk_index, int chunk_total, uint8_t *data, int data_len, int width, int height);
void window_garage_receive_event(const char *event_type, const char *event_time);

// Scale data
#define SCALE_BUF_LEN 32
typedef struct {
  char weight[SCALE_BUF_LEN];
  char body_fat[SCALE_BUF_LEN];
  char bmi[SCALE_BUF_LEN];
  char muscle[SCALE_BUF_LEN];
  char water[SCALE_BUF_LEN];
  char date[SCALE_BUF_LEN];
} ScaleData;
extern ScaleData s_scale_data;
void window_scale_push(int device_index);
void window_scale_refresh(void);

// Shortcuts
#define MAX_SHORTCUTS 20
typedef struct {
  int id;
  char name[32];
} WyzeShortcut;
extern WyzeShortcut s_shortcuts[MAX_SHORTCUTS];
extern int s_shortcut_count;
void menu_shortcuts_window_push(void);
void menu_shortcuts_reload_data(void);

// Camera
void window_camera_push(int device_index);
void window_camera_receive_chunk(int chunk_index, int chunk_total, uint8_t *data, int data_len, int width, int height);
void window_camera_receive_event(const char *event_type, const char *event_time);

// Image target routing: 0=camera window, 1=garage window
void wyze_set_image_target(int target);
int wyze_get_image_target(void);

// Reusable value picker
typedef void (*PickerCallback)(int index, void *context);
void window_picker_push(const char *title, const char **options, int count, PickerCallback callback, void *context);

TextLayer *setup_title_bar(Window *window, GRect bounds);

