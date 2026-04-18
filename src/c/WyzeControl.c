#include <pebble.h>
#include "wyze_data.h"

WyzeDevice s_devices[MAX_DEVICES];
int s_device_count = 0;
int s_auth_state = 0;

// Image target routing: 0=camera window, 1=garage window
static int s_image_target = 0;

void wyze_set_image_target(int target) { s_image_target = target; }
int wyze_get_image_target(void) { return s_image_target; }

static void in_recv_handler(DictionaryIterator *iter, void *context) {
  // Auth status from JS: 0=no auth, 1=authed/loading
  Tuple *auth_t = dict_find(iter, MESSAGE_KEY_AuthStatus);
  if (auth_t) {
    int new_state = auth_t->value->int32;
    // Don't downgrade from "refreshing" (3) to "loading" (1)
    if (!(s_auth_state == 3 && new_state == 1)) {
      s_auth_state = new_state;
    }
    APP_LOG(APP_LOG_LEVEL_INFO, "Auth status: %d", s_auth_state);
    menu_types_reload_data();
    return;
  }

  Tuple *count_t = dict_find(iter, MESSAGE_KEY_DeviceCount);
  if (count_t) {
    s_device_count = count_t->value->int32;
    if (s_device_count > MAX_DEVICES) s_device_count = MAX_DEVICES;
    s_auth_state = 2;
    APP_LOG(APP_LOG_LEVEL_INFO, "Preparing for %d devices", s_device_count);
    // If count is 0 (e.g. logout or no devices), refresh menu immediately
    if (s_device_count == 0) {
      menu_types_reload_data();
    }
    return;
  }

  // Shortcut data from JS
  Tuple *sc_count_t = dict_find(iter, MESSAGE_KEY_ShortcutCount);
  if (sc_count_t) {
    s_shortcut_count = sc_count_t->value->int32;
    if (s_shortcut_count > MAX_SHORTCUTS) s_shortcut_count = MAX_SHORTCUTS;
    APP_LOG(APP_LOG_LEVEL_INFO, "Preparing for %d shortcuts", s_shortcut_count);
    if (s_shortcut_count == 0) menu_types_reload_data();
    return;
  }

  Tuple *sc_idx_t = dict_find(iter, MESSAGE_KEY_ShortcutIndex);
  if (sc_idx_t && sc_idx_t->value->int32 < MAX_SHORTCUTS) {
    int idx = sc_idx_t->value->int32;
    s_shortcuts[idx].id = idx;
    Tuple *sc_name_t = dict_find(iter, MESSAGE_KEY_ShortcutName);
    if (sc_name_t) strncpy(s_shortcuts[idx].name, sc_name_t->value->cstring, sizeof(s_shortcuts[idx].name) - 1);
    if (idx == s_shortcut_count - 1) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Finished receiving %d shortcuts", s_shortcut_count);
      menu_shortcuts_reload_data();
      menu_types_reload_data();
    }
    return;
  }

  // Scale data from JS
  Tuple *scale_w = dict_find(iter, MESSAGE_KEY_ScaleWeight);
  if (scale_w) {
    strncpy(s_scale_data.weight, scale_w->value->cstring, SCALE_BUF_LEN - 1);
    Tuple *t;
    t = dict_find(iter, MESSAGE_KEY_ScaleBodyFat);
    if (t) strncpy(s_scale_data.body_fat, t->value->cstring, SCALE_BUF_LEN - 1);
    t = dict_find(iter, MESSAGE_KEY_ScaleBMI);
    if (t) strncpy(s_scale_data.bmi, t->value->cstring, SCALE_BUF_LEN - 1);
    t = dict_find(iter, MESSAGE_KEY_ScaleMuscle);
    if (t) strncpy(s_scale_data.muscle, t->value->cstring, SCALE_BUF_LEN - 1);
    t = dict_find(iter, MESSAGE_KEY_ScaleWater);
    if (t) strncpy(s_scale_data.water, t->value->cstring, SCALE_BUF_LEN - 1);
    t = dict_find(iter, MESSAGE_KEY_ScaleDate);
    if (t) strncpy(s_scale_data.date, t->value->cstring, SCALE_BUF_LEN - 1);
    window_scale_refresh();
    return;
  }

  // Camera image chunks from JS — route to camera or garage window
  Tuple *cam_chunk_t = dict_find(iter, MESSAGE_KEY_CameraChunkIndex);
  if (cam_chunk_t) {
    int chunk_idx = cam_chunk_t->value->int32;
    Tuple *total_t = dict_find(iter, MESSAGE_KEY_CameraChunkTotal);
    int total = total_t ? total_t->value->int32 : 1;
    Tuple *data_t = dict_find(iter, MESSAGE_KEY_CameraChunkData);
    Tuple *w_t = dict_find(iter, MESSAGE_KEY_CameraWidth);
    Tuple *h_t = dict_find(iter, MESSAGE_KEY_CameraHeight);
    int width = w_t ? w_t->value->int32 : 0;
    int height = h_t ? h_t->value->int32 : 0;
    if (data_t) {
      if (s_image_target == 1) {
        window_garage_receive_chunk(chunk_idx, total, data_t->value->data, data_t->length, width, height);
      } else {
        window_camera_receive_chunk(chunk_idx, total, data_t->value->data, data_t->length, width, height);
      }
    }
    return;
  }

  // Camera event info from JS — route to camera or garage window
  Tuple *cam_event_type_t = dict_find(iter, MESSAGE_KEY_CameraEventType);
  if (cam_event_type_t) {
    const char *event_type = cam_event_type_t->value->cstring;
    Tuple *cam_event_time_t = dict_find(iter, MESSAGE_KEY_CameraEventTime);
    const char *event_time = cam_event_time_t ? cam_event_time_t->value->cstring : "";
    if (s_image_target == 1) {
      window_garage_receive_event(event_type, event_time);
    } else {
      window_camera_receive_event(event_type, event_time);
    }
    return;
  }

  Tuple *idx_t = dict_find(iter, MESSAGE_KEY_DeviceIndex);
  if (idx_t && idx_t->value->int32 < MAX_DEVICES) {
    int idx = idx_t->value->int32;
    s_devices[idx].id = idx;
    
    Tuple *type_idx_t = dict_find(iter, MESSAGE_KEY_DeviceTypeIndex);
    if (type_idx_t) s_devices[idx].type_index = type_idx_t->value->int32;
    
    Tuple *type_t = dict_find(iter, MESSAGE_KEY_DeviceType);
    if (type_t) strncpy(s_devices[idx].type_name, type_t->value->cstring, sizeof(s_devices[idx].type_name) - 1);
    
    Tuple *name_t = dict_find(iter, MESSAGE_KEY_DeviceName);
    if (name_t) strncpy(s_devices[idx].name, name_t->value->cstring, sizeof(s_devices[idx].name) - 1);
    
    Tuple *state_t = dict_find(iter, MESSAGE_KEY_DeviceState);
    if (state_t) s_devices[idx].state = state_t->value->int32;

    Tuple *online_t = dict_find(iter, MESSAGE_KEY_DeviceOnline);
    if (online_t) s_devices[idx].online = online_t->value->int32;

    Tuple *garage_t = dict_find(iter, MESSAGE_KEY_DeviceHasGarage);
    if (garage_t) s_devices[idx].has_garage = garage_t->value->int32;

    // Refresh the main menu after the last device arrives
    if (idx == s_device_count - 1) {
       APP_LOG(APP_LOG_LEVEL_INFO, "Finished receiving all %d devices", s_device_count);
       menu_types_reload_data();
       menu_devices_reload_data();
    }
    // Always refresh the action window in case this device is being viewed
    window_device_action_refresh();
    menu_light_actions_reload_data();
    window_garage_refresh();
  }
}

static void in_dropped_handler(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "App Message Dropped! Reason: %d", reason);
}

void wyze_app_message_init(void) {
  app_message_register_inbox_received(in_recv_handler);
  app_message_register_inbox_dropped(in_dropped_handler);
  app_message_open(app_message_inbox_size_maximum(), 512);
}

void wyze_data_toggle_device(int device_id) {
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_ActionToggle, device_id);
  app_message_outbox_send();
}

void wyze_data_set_property(int device_id, int action_type, int action_value) {
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_int32(iter, MESSAGE_KEY_ActionToggle, device_id);
  dict_write_int32(iter, MESSAGE_KEY_ActionType, action_type);
  dict_write_int32(iter, MESSAGE_KEY_ActionValue, action_value);
  app_message_outbox_send();
}

void wyze_data_request_refresh(void) {
  // Keep existing device data visible during refresh
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_uint8(iter, MESSAGE_KEY_ActionRefresh, 1);
  app_message_outbox_send();
}

/* TEST auth — uncommented for testing, see test_menu_instructions.md to re-disable
void wyze_data_test_auth(void) {
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (!iter) return;
  dict_write_uint8(iter, MESSAGE_KEY_TestAuth, 1);
  app_message_outbox_send();
}
*/

int main(void) {
  wyze_app_message_init();

  menu_types_window_push();

  // Tell JS we are ready
  DictionaryIterator *iter;
  if(app_message_outbox_begin(&iter) == APP_MSG_OK) {
      dict_write_uint8(iter, MESSAGE_KEY_AppReady, 1);
      app_message_outbox_send();
  }

  app_event_loop();
}
