#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <cstring>

#if __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
#endif

#ifndef ESP_ARDUINO_VERSION_MAJOR
#define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#define BOX_ID "boxB"
#define HOSTNAME "irrigation-b"

// IMPORTANT:
// Box B uses ESP-NOW only. It does not connect to Firebase or the internet.
// ESP-NOW must be on the same WiFi channel as Box A.
// v7: Start on the current router channel seen from Box A serial log.
// If Box A later uses another channel, Box B will still hop through 1-13 until it finds the gateway.
#define ESPNOW_WIFI_CHANNEL 7  // first search channel. Box A is currently on router channel 1; B still hops if not found.

uint8_t ESP_NOW_BROADCAST_MAC[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

#define ESPNOW_PROTOCOL_MAGIC 0x4B495749UL
#define ESPNOW_PROTOCOL_VERSION 23

const int PIN_VALVE = 0;
const int PIN_RAIN = 5;
const bool RAIN_SENSOR_ACTIVE_LOW = true;

const char *AP_SSID = "Setup-boxB";
const char *AP_PASS = "12345678";

const unsigned long REPORT_INTERVAL_MS = 1000;  // v12: status every 1 s to avoid false offline display
const unsigned long GATEWAY_TIMEOUT_MS = 60000;
const unsigned long RAIN_BLOCK_CONFIRM_MS = 5000;
const unsigned long WATER_CONFIRM_TIMEOUT_MS = 30000; // Safer for testing than 10 s.
const unsigned long POST_WATER_RAIN_IGNORE_MS = 20UL * 60UL * 1000UL;
const unsigned long AP_ACTIVE_TIME_MS = 20UL * 60UL * 1000UL;
const unsigned long CHANNEL_HOP_INTERVAL_MS = 2500UL;  // longer dwell so Box B catches Box A broadcasts even when A is busy with Firebase.
const bool FORCE_FIXED_ESPNOW_CHANNEL = false;  // v17: do not force router channel. Hop only while offline; lock when Gateway is found.

WebServer server(80);
bool webServerStarted = false;
Preferences prefs;

bool valveState = false;
bool sensorWet = false;
bool rainBlockedToday = false;
bool waterDetected = false;
bool wateringConfirmed = false;
bool valveFault = false;
bool wateredToday = false;
bool weatherBlocked = false;
int weatherRainProbability = 0;
float weatherPrecipitationMM = 0.0f;

bool manualMode = false;
bool manualValve = false;
bool autoMode = true;
bool scheduleEnabled = false;
bool localMode = false;
int wateringSeconds = 30;
int noWaterTimeoutSeconds = 30;
bool useRainStopRule = false;
bool currentWateringFromSchedule = false;
bool currentWateringOfflineBypass = false;
bool gatewayOfflineScheduleBypass = false;

bool hasGateway = false;
uint8_t gatewayMac[6] = {0};
unsigned long lastCommandTime = 0;
unsigned long valveStartMillis = 0;
unsigned long lastReport = 0;
unsigned long sensorWetSince = 0;
unsigned long valveStopMillis = 0;
unsigned long lastWaterEndMillis = 0;
uint32_t lastRequestId = 0;
uint32_t heartbeatSeq = 0;
uint32_t valveActionSeq = 0;
char lastValveAction[24] = "boot";
bool apRunning = false;
unsigned long apStartMillis = 0;
int currentEspNowChannel = ESPNOW_WIFI_CHANNEL;
unsigned long lastChannelHop = 0;
bool lastPrintedScheduleEnabled = false;
int lastPrintedWateringSeconds = -1;
int lastPrintedNoWaterTimeoutSeconds = -1;
bool lastPrintedUseRainStopRule = false;
bool gatewayOnlinePrinted = false;
uint32_t espNowRxCount = 0;
uint32_t espNowTxOkCount = 0;
uint32_t espNowTxFailCount = 0;
unsigned long lastEspNowDebugPrint = 0;
uint8_t gatewayPeerChannel = 0;
uint8_t broadcastPeerChannel = 0;

struct CommandToB {
  bool rain;
  bool manualMode;
  bool manualValve;
  bool autoMode;
  bool scheduleEnabled;
  bool startWaterRequest;
  bool clearTodayStatus;
  bool weatherBlocked;
  int wateringSeconds;
  int noWaterTimeoutSeconds;
  bool useRainStopRule;
  int weatherRainProbability;
  float weatherPrecipitationMM;
  uint32_t requestId;
  uint32_t heartbeatSeq;
  bool requestLocalAP;
  bool offlineScheduleBypass;
  uint32_t magic;
  uint16_t protocolVersion;
  char sourceBox[8];
  char targetBox[8];
};

struct StatusFromB {
  bool valve;
  bool online;
  bool rain;
  bool sensorWet;
  bool waterDetected;
  bool wateringConfirmed;
  bool valveFault;
  bool rainBlockedToday;
  bool wateredToday;
  bool weatherBlocked;
  bool manualMode;
  bool manualValve;
  bool autoMode;
  bool scheduleEnabled;
  bool localMode;
  int remain;
  int scheduleRemainSeconds;
  int noWaterTimeoutRemainSeconds;
  int noWaterTimeoutSeconds;
  bool useRainStopRule;
  uint32_t heartbeatSeq;
  uint32_t valveActionSeq;
  char lastValveAction[24];
  bool localAPActive;
  uint32_t magic;
  uint16_t protocolVersion;
  char sourceBox[8];
  char targetBox[8];
};

CommandToB cmd;
StatusFromB status;

void startAPMode();
void stopAPMode();
void setEspNowChannel(int channel);
void maybeHopEspNowChannel();


#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len);
void onDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t sendStatus);
#else
void onDataRecv(const uint8_t *mac, const uint8_t *data, int len);
void onDataSent(const uint8_t *mac_addr, esp_now_send_status_t sendStatus);
#endif


int loadLastGoodChannel() {
  prefs.begin("espnowB", true);
  int ch = prefs.getInt("lastCh", ESPNOW_WIFI_CHANNEL);
  prefs.end();
  if (ch < 1 || ch > 13) ch = ESPNOW_WIFI_CHANNEL;
  return ch;
}

void saveLastGoodChannel(int ch) {
  if (ch < 1 || ch > 13) return;
  static int lastSavedChannel = 0;
  if (lastSavedChannel == ch) return;
  lastSavedChannel = ch;
  prefs.begin("espnowB", false);
  prefs.putInt("lastCh", ch);
  prefs.end();
  Serial.print("Save ESP-NOW last-good channel=");
  Serial.println(ch);
}

void setEspNowChannel(int channel) {
  if (channel < 1) channel = 1;
  if (channel > 13) channel = 13;

  bool channelChanged = (currentEspNowChannel != channel);
  currentEspNowChannel = channel;

  // ESP-NOW uses the currently selected WiFi channel. Box B does not connect
  // to router WiFi, so it is safe to force the radio channel here.
  esp_err_t result = esp_wifi_set_channel((uint8_t)currentEspNowChannel, WIFI_SECOND_CHAN_NONE);

  // v17 critical fix:
  // ESP-NOW peers remember the channel used when they were added.
  // After Box B hops channels, the old peer can remain registered on the previous
  // channel and esp_now_send() fails with: Peer channel is not equal to home channel.
  // Delete peers after any channel change so ensureGatewayPeer()/ensureBroadcastPeer()
  // can re-add them on the current channel before sending status.
  if (channelChanged) {
    if (esp_now_is_peer_exist(gatewayMac)) esp_now_del_peer(gatewayMac);
    if (esp_now_is_peer_exist(ESP_NOW_BROADCAST_MAC)) esp_now_del_peer(ESP_NOW_BROADCAST_MAC);
    gatewayPeerChannel = 0;
    broadcastPeerChannel = 0;
  }

  uint8_t actualCh = 0;
  wifi_second_chan_t second = WIFI_SECOND_CHAN_NONE;
  esp_wifi_get_channel(&actualCh, &second);

  Serial.print("ESP-NOW channel set request=");
  Serial.print(currentEspNowChannel);
  Serial.print(" actual=");
  Serial.print(actualCh);
  Serial.print(" result=");
  Serial.println(result == ESP_OK ? "OK" : String((int)result));
}

void maybeHopEspNowChannel() {
  // v16: optional fixed-channel mode. Normal mode hops only while gateway is offline.
  if (FORCE_FIXED_ESPNOW_CHANNEL) {
    if (currentEspNowChannel != ESPNOW_WIFI_CHANNEL) setEspNowChannel(ESPNOW_WIFI_CHANNEL);
    return;
  }

  // When Box B local AP is open, do not hop channels. The phone AP and ESP-NOW
  // must stay on the same channel until AP closes.
  if (apRunning) return;

  // Gateway is alive; stay on the channel that is currently working.
  if (hasGateway && millis() - lastCommandTime <= GATEWAY_TIMEOUT_MS) return;

  if (hasGateway && millis() - lastCommandTime > GATEWAY_TIMEOUT_MS) {
    hasGateway = false;
    gatewayOnlinePrinted = false;
  }

  if (millis() - lastChannelHop < CHANNEL_HOP_INTERVAL_MS) return;
  lastChannelHop = millis();

  const int searchChannels[] = {7, 1, 6, 11, 8, 9, 10, 12, 13, 2, 3, 4, 5};
  const int count = sizeof(searchChannels) / sizeof(searchChannels[0]);
  int index = 0;
  for (int i = 0; i < count; i++) {
    if (searchChannels[i] == currentEspNowChannel) { index = i; break; }
  }
  int nextChannel = searchChannels[(index + 1) % count];

  Serial.print("Gateway not found/timeout. Hop ESP-NOW channel ");
  Serial.print(currentEspNowChannel);
  Serial.print(" -> ");
  Serial.println(nextChannel);

  setEspNowChannel(nextChannel);
}


#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t sendStatus) {
  (void)tx_info;
  if (sendStatus == ESP_NOW_SEND_SUCCESS) espNowTxOkCount++;
  else espNowTxFailCount++;
}
#else
void onDataSent(const uint8_t *mac_addr, esp_now_send_status_t sendStatus) {
  (void)mac_addr;
  if (sendStatus == ESP_NOW_SEND_SUCCESS) espNowTxOkCount++;
  else espNowTxFailCount++;
}
#endif

int validWateringSeconds(int seconds) {
  if (seconds < 1) return 1;
  if (seconds > 3600) return 3600;
  return seconds;
}

bool readRainSensor() {
  int v = digitalRead(PIN_RAIN);
  if (RAIN_SENSOR_ACTIVE_LOW) return v == LOW;
  return v == HIGH;
}

String macToString(const uint8_t *mac) {
  char buf[18];
  snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

void setLastValveAction(const char *action) {
  strncpy(lastValveAction, action, sizeof(lastValveAction) - 1);
  lastValveAction[sizeof(lastValveAction) - 1] = '\0';
  valveActionSeq++;
}

int validNoWaterTimeoutSeconds(int seconds) {
  if (seconds < 1) return 1;
  if (seconds > 3600) return 3600;
  return seconds;
}

int scheduleRemainSeconds() {
  if (!valveState || !currentWateringFromSchedule) return 0;
  unsigned long elapsed = (millis() - valveStartMillis) / 1000UL;
  if (elapsed >= (unsigned long)wateringSeconds) return 0;
  return wateringSeconds - (int)elapsed;
}

int noWaterTimeoutRemainSeconds() {
  if (!valveState || wateringConfirmed) return 0;
  unsigned long elapsed = (millis() - valveStartMillis) / 1000UL;
  if (elapsed >= (unsigned long)noWaterTimeoutSeconds) return 0;
  return noWaterTimeoutSeconds - (int)elapsed;
}

int remainSeconds() {
  return scheduleRemainSeconds();
}

void ensureGatewayPeer(const uint8_t *mac) {
  if (!mac) return;

  uint8_t actualCh = 0;
  wifi_second_chan_t second = WIFI_SECOND_CHAN_NONE;
  if (esp_wifi_get_channel(&actualCh, &second) == ESP_OK && actualCh >= 1 && actualCh <= 13) {
    currentEspNowChannel = actualCh;
  }

  if (esp_now_is_peer_exist(mac)) {
    if (gatewayPeerChannel == currentEspNowChannel) return;
    esp_now_del_peer(mac);
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, mac, 6);
  peerInfo.channel = currentEspNowChannel;
  peerInfo.ifidx = WIFI_IF_STA;
  peerInfo.encrypt = false;

  esp_err_t result = esp_now_add_peer(&peerInfo);
  Serial.print("ESP-NOW add gateway peer ch=");
  Serial.print(currentEspNowChannel);
  Serial.print(" result=");
  Serial.println(result == ESP_OK ? "OK" : String((int)result));

  if (result == ESP_OK || result == ESP_ERR_ESPNOW_EXIST) {
    gatewayPeerChannel = currentEspNowChannel;
  }
}

void ensureBroadcastPeer() {
  uint8_t actualCh = 0;
  wifi_second_chan_t second = WIFI_SECOND_CHAN_NONE;
  if (esp_wifi_get_channel(&actualCh, &second) == ESP_OK && actualCh >= 1 && actualCh <= 13) {
    currentEspNowChannel = actualCh;
  }

  if (esp_now_is_peer_exist(ESP_NOW_BROADCAST_MAC)) {
    if (broadcastPeerChannel == currentEspNowChannel) return;
    esp_now_del_peer(ESP_NOW_BROADCAST_MAC);
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, ESP_NOW_BROADCAST_MAC, 6);
  peerInfo.channel = currentEspNowChannel;
  peerInfo.ifidx = WIFI_IF_STA;
  peerInfo.encrypt = false;

  esp_err_t result = esp_now_add_peer(&peerInfo);
  Serial.print("ESP-NOW add broadcast peer ch=");
  Serial.print(currentEspNowChannel);
  Serial.print(" result=");
  Serial.println(result == ESP_OK ? "OK" : String((int)result));

  if (result == ESP_OK || result == ESP_ERR_ESPNOW_EXIST) {
    broadcastPeerChannel = currentEspNowChannel;
  }
}


bool validCommandForBoxB(const CommandToB &packet) {
  if (packet.magic != ESPNOW_PROTOCOL_MAGIC) return false;
  if (packet.protocolVersion != ESPNOW_PROTOCOL_VERSION) return false;
  if (strncmp(packet.sourceBox, "boxA", sizeof(packet.sourceBox)) != 0) return false;
  if (strncmp(packet.targetBox, "boxB", sizeof(packet.targetBox)) != 0) return false;
  return true;
}

void prepareStatusProtocol() {
  status.magic = ESPNOW_PROTOCOL_MAGIC;
  status.protocolVersion = ESPNOW_PROTOCOL_VERSION;
  memset(status.sourceBox, 0, sizeof(status.sourceBox));
  memset(status.targetBox, 0, sizeof(status.targetBox));
  strncpy(status.sourceBox, "boxB", sizeof(status.sourceBox) - 1);
  strncpy(status.targetBox, "boxA", sizeof(status.targetBox) - 1);
}

void sendStatus() {
  if (!hasGateway) return;

  heartbeatSeq++;

  status.valve = valveState;
  status.online = true;
  status.rain = ((!valveState && sensorWet) || rainBlockedToday);
  status.sensorWet = sensorWet;
  status.waterDetected = waterDetected;
  status.wateringConfirmed = wateringConfirmed;
  status.valveFault = valveFault;
  status.rainBlockedToday = rainBlockedToday;
  status.wateredToday = wateredToday;
  status.weatherBlocked = weatherBlocked;
  status.manualMode = manualMode;
  status.manualValve = manualValve;
  status.autoMode = autoMode;
  status.scheduleEnabled = scheduleEnabled;
  status.localMode = localMode;
  status.remain = remainSeconds();
  status.scheduleRemainSeconds = scheduleRemainSeconds();
  status.noWaterTimeoutRemainSeconds = noWaterTimeoutRemainSeconds();
  status.noWaterTimeoutSeconds = noWaterTimeoutSeconds;
  status.useRainStopRule = useRainStopRule;
  status.heartbeatSeq = heartbeatSeq;
  status.valveActionSeq = valveActionSeq;
  status.localAPActive = apRunning;
  strncpy(status.lastValveAction, lastValveAction, sizeof(status.lastValveAction) - 1);
  status.lastValveAction[sizeof(status.lastValveAction) - 1] = '\0';

  // v15 critical fix: fill magic/sourceBox/targetBox before every status packet.
  // Without this, Box A learns the MAC but rejects status as wrong role/magic.
  prepareStatusProtocol();

  ensureGatewayPeer(gatewayMac);
  esp_err_t result = esp_now_send(gatewayMac, (uint8_t *)&status, sizeof(status));
  if (result != ESP_OK) {
    Serial.print("ESP-NOW send status unicast failed: ");
    Serial.println((int)result);
  }

  // Broadcast one copy too. This lets Box A learn Box B's real STA MAC even if
  // the preferred hard-coded MAC is wrong or the two boards were swapped.
  ensureBroadcastPeer();
  esp_err_t bcastResult = esp_now_send(ESP_NOW_BROADCAST_MAC, (uint8_t *)&status, sizeof(status));
  if (bcastResult != ESP_OK) {
    Serial.print("ESP-NOW send status broadcast failed: ");
    Serial.println((int)bcastResult);
  }
}

void setValve(bool on, const char *reason) {
  // Always force GPIO4 to the requested level, even when valveState already matches.
  pinMode(PIN_VALVE, OUTPUT);
  digitalWrite(PIN_VALVE, on ? HIGH : LOW);

  Serial.print("GPIO");
  Serial.print(PIN_VALVE);
  Serial.print(" forced ");
  Serial.print(on ? "HIGH" : "LOW");
  Serial.print(" reason=");
  Serial.print(reason ? reason : "");
  Serial.print(" readback=");
  Serial.println(digitalRead(PIN_VALVE));

  if (valveState == on) {
    return;
  }

  valveState = on;

  if (on) {
    valveStartMillis = millis();
    waterDetected = false;
    wateringConfirmed = false;
    valveFault = false;
    sensorWetSince = 0;
    setLastValveAction(reason && strlen(reason) > 0 ? reason : "valve_on");
  } else {
    lastWaterEndMillis = millis();
    valveStopMillis = millis();
    currentWateringOfflineBypass = false;
    setLastValveAction(reason && strlen(reason) > 0 ? reason : "valve_off");
  }

  Serial.print("Valve: ");
  Serial.print(on ? "ON" : "OFF");
  Serial.print(" reason=");
  Serial.println(lastValveAction);

  sendStatus();
}

void markWaterConfirmed() {
  if (wateringConfirmed) return;

  waterDetected = true;
  wateringConfirmed = true;
  wateredToday = true;
  valveFault = false;
  setLastValveAction("water_ok");

  Serial.println("Water confirmed by sensor");
  sendStatus();
}

void markValveFault() {
  if (valveFault) return;

  valveFault = true;
  waterDetected = false;
  wateringConfirmed = false;
  setValve(false, "no_water");

  Serial.println("Valve fault: no water detected within timeout");
  sendStatus();
}

void markRainBlockedToday() {
  if (rainBlockedToday) return;

  rainBlockedToday = true;
  setLastValveAction("rain_blocked");

  Serial.println("Rain blocked today");
  sendStatus();
}

void clearTodayStatus() {
  rainBlockedToday = false;
  waterDetected = false;
  wateringConfirmed = false;
  valveFault = false;
  wateredToday = false;
  sensorWetSince = 0;
  currentWateringOfflineBypass = false;
  setLastValveAction("clear_day");

  Serial.println("Clear today status");
  sendStatus();
}


void printSettingsFromGatewayIfChanged(const char *reason) {
  bool changed = false;
  if (lastPrintedWateringSeconds != wateringSeconds) changed = true;
  if (lastPrintedNoWaterTimeoutSeconds != noWaterTimeoutSeconds) changed = true;
  if (lastPrintedScheduleEnabled != scheduleEnabled) changed = true;
  if (lastPrintedUseRainStopRule != useRainStopRule) changed = true;

  if (!changed && strcmp(reason ? reason : "", "command") != 0) return;

  lastPrintedWateringSeconds = wateringSeconds;
  lastPrintedNoWaterTimeoutSeconds = noWaterTimeoutSeconds;
  lastPrintedScheduleEnabled = scheduleEnabled;
  lastPrintedUseRainStopRule = useRainStopRule;

  Serial.print("BOX B SETTINGS from gateway reason=");
  Serial.print(reason ? reason : "");
  Serial.print(" scheduleEnabled=");
  Serial.print(scheduleEnabled);
  Serial.print(" wateringSeconds=");
  Serial.print(wateringSeconds);
  Serial.print(" noWaterTimeout=");
  Serial.print(noWaterTimeoutSeconds);
  Serial.print(" rainRule=");
  Serial.print(useRainStopRule);
  Serial.print(" weatherBlocked=");
  Serial.print(weatherBlocked);
  Serial.print(" offlineBypass=");
  Serial.println(gatewayOfflineScheduleBypass);
}

void handleDataRecv(const uint8_t *srcAddr, const uint8_t *data, int len) {
  espNowRxCount++;

  if (len != (int)sizeof(CommandToB)) {
    Serial.print("Ignore ESP-NOW packet invalid size from ");
    Serial.print(macToString(srcAddr));
    Serial.print(" len=");
    Serial.print(len);
    Serial.print(" expected=");
    Serial.println(sizeof(CommandToB));
    return;
  }

  CommandToB incoming;
  memcpy(&incoming, data, sizeof(incoming));

  if (!validCommandForBoxB(incoming)) {
    Serial.print("Ignore ESP-NOW packet wrong role/magic/version from ");
    Serial.print(macToString(srcAddr));
    Serial.print(" magic=0x");
    Serial.print(incoming.magic, HEX);
    Serial.print(" ver=");
    Serial.print(incoming.protocolVersion);
    Serial.print(" source=");
    Serial.print(incoming.sourceBox);
    Serial.print(" target=");
    Serial.println(incoming.targetBox);
    return;
  }

  memcpy(&cmd, &incoming, sizeof(cmd));

  memcpy(gatewayMac, srcAddr, 6);
  hasGateway = true;
  localMode = false;
  lastCommandTime = millis();
  lastChannelHop = millis();

  uint8_t primaryChannel = 0;
  wifi_second_chan_t secondChannel = WIFI_SECOND_CHAN_NONE;
  if (esp_wifi_get_channel(&primaryChannel, &secondChannel) == ESP_OK && primaryChannel >= 1 && primaryChannel <= 13) {
    currentEspNowChannel = primaryChannel;
    saveLastGoodChannel(currentEspNowChannel);
  }

  if (!gatewayOnlinePrinted) {
    gatewayOnlinePrinted = true;
    Serial.print("Gateway found on ESP-NOW channel ");
    Serial.print(currentEspNowChannel);
    Serial.print(" mac=");
    Serial.println(macToString(srcAddr));
  }

  ensureGatewayPeer(gatewayMac);

  bool newRequest = (cmd.requestId != 0 && cmd.requestId != lastRequestId);
  bool manualCommand = newRequest && cmd.manualMode;
  bool resumeAutoCommand = newRequest && !cmd.manualMode && cmd.autoMode &&
                           !cmd.startWaterRequest && !cmd.clearTodayStatus && !cmd.requestLocalAP;

  // Settings and weather are allowed on every valid heartbeat.
  // Manual state is NOT copied from heartbeat, otherwise a stale ON/OFF can replay later.
  scheduleEnabled = cmd.scheduleEnabled;
  weatherBlocked = cmd.weatherBlocked;
  wateringSeconds = validWateringSeconds(cmd.wateringSeconds);
  noWaterTimeoutSeconds = validNoWaterTimeoutSeconds(cmd.noWaterTimeoutSeconds);
  useRainStopRule = cmd.useRainStopRule;
  gatewayOfflineScheduleBypass = cmd.offlineScheduleBypass;
  autoMode = cmd.autoMode || !manualMode;
  printSettingsFromGatewayIfChanged(cmd.startWaterRequest ? "schedule_or_gateway" : "heartbeat");

  // Do NOT let Box A rain state overwrite Box B's own rain sensor decision.
  weatherRainProbability = cmd.weatherRainProbability;
  weatherPrecipitationMM = cmd.weatherPrecipitationMM;

  if (cmd.clearTodayStatus && newRequest) {
    lastRequestId = cmd.requestId;
    clearTodayStatus();
  }

  if (cmd.requestLocalAP && newRequest) {
    lastRequestId = cmd.requestId;
    startAPMode();
    setLastValveAction("ap_open_20min");
  }

  if (manualCommand) {
    lastRequestId = cmd.requestId;
    valveFault = false;
    waterDetected = false;
    wateringConfirmed = false;
    currentWateringFromSchedule = false;
    currentWateringOfflineBypass = false;

    manualMode = true;
    manualValve = cmd.manualValve;
    autoMode = false;

    if (manualValve) {
      setValve(true, "espnow_manual_on");
      setLastValveAction("espnow_manual_on");
    } else {
      setValve(false, "espnow_manual_off");
      setLastValveAction("espnow_manual_off");
      manualMode = false;
      manualValve = false;
      autoMode = true;
    }
    sendStatus();
    return;
  }

  if (resumeAutoCommand) {
    lastRequestId = cmd.requestId;
    manualMode = false;
    manualValve = false;
    autoMode = true;
    currentWateringFromSchedule = false;
    currentWateringOfflineBypass = false;
    setValve(false, "espnow_resume_auto");
    setLastValveAction("espnow_resume_auto");
    sendStatus();
    return;
  }

  if (cmd.startWaterRequest && newRequest) {
    lastRequestId = cmd.requestId;
    bool bypassAllScheduleBlocks = cmd.offlineScheduleBypass;

    if (!bypassAllScheduleBlocks && useRainStopRule && sensorWet) {
      rainBlockedToday = true;
      setLastValveAction("schedule_skip_sensor_wet_before_start");
      Serial.println("Schedule request blocked: sensor wet before valve start");
      sendStatus();
      return;
    }

    if (!manualMode && autoMode && (bypassAllScheduleBlocks || (!weatherBlocked && !valveFault))) {
      currentWateringFromSchedule = true;
      currentWateringOfflineBypass = bypassAllScheduleBlocks;
      if (bypassAllScheduleBlocks) {
        valveFault = false;
        waterDetected = false;
        wateringConfirmed = false;
      }
      setValve(true, bypassAllScheduleBlocks ? "schedule_on_offline_bypass" : "schedule_on");
    } else {
      setLastValveAction("schedule_skip_blocked");
      Serial.println("Schedule request blocked");
    }
  }

  sendStatus();
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (!info || !data) return;
  handleDataRecv(info->src_addr, data, len);
}
#else
void onDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
  if (!mac || !data) return;
  handleDataRecv(mac, data, len);
}
#endif

void updateSingleSensorLogic() {
  sensorWet = readRainSensor();
  unsigned long now = millis();

  if (sensorWet) {
    if (sensorWetSince == 0) sensorWetSince = now;
  } else {
    sensorWetSince = 0;
  }

  if (valveState) {
    // 排程/手動啟動後，雨滴感測器改作出水確認。
    if (sensorWet && sensorWetSince > 0 && now - sensorWetSince >= RAIN_BLOCK_CONFIRM_MS) {
      markWaterConfirmed();
    }
  } else {
    // 電磁閥關閉時只回報目前 sensorWet，不提前鎖死今日排程。
    // 是否跳過排程由 Box A gateway 與本機收到 startWaterRequest 當下即時判斷。
  }
}

void controlLogic() {
  updateSingleSensorLogic();

  if (!hasGateway || millis() - lastCommandTime > GATEWAY_TIMEOUT_MS) {
    if (!localMode) {
      Serial.println("Gateway timeout. Enter local safety mode and resume channel search.");
      gatewayOnlinePrinted = false;
    }
    localMode = true;
  } else {
    localMode = false;
  }

  unsigned long now = millis();

  if (manualMode && manualValve) {
    if (!valveState) {
      valveFault = false;
      waterDetected = false;
      wateringConfirmed = false;
      currentWateringFromSchedule = false;
      setValve(true, "manual_control_sync_on");
    }
  }

  if (valveState) {
    bool fromSchedule = currentWateringFromSchedule;
    bool fromManual = manualMode;

    bool offlineBypassSchedule = fromSchedule && currentWateringOfflineBypass;

    if ((fromSchedule || fromManual) && !offlineBypassSchedule && !wateringConfirmed &&
        now - valveStartMillis >= (unsigned long)noWaterTimeoutSeconds * 1000UL) {
      bool wasSchedule = fromSchedule;
      currentWateringFromSchedule = false;
      manualMode = false;
      manualValve = false;
      autoMode = true;
      waterDetected = false;
      wateringConfirmed = false;
      valveFault = true;
      setValve(false, "fault_off");
      setLastValveAction(wasSchedule ? "schedule_no_water_fault" : "manual_no_water_fault");
      Serial.println("Valve fault: no water detected within timeout, valve forced OFF and state cleared");
      sendStatus();
      return;
    }

    if (fromSchedule && now - valveStartMillis >= (unsigned long)wateringSeconds * 1000UL) {
      wateredToday = true;
      currentWateringFromSchedule = false;
      currentWateringOfflineBypass = false;
      waterDetected = false;
      wateringConfirmed = false;
      setValve(false, "time_off");
      setLastValveAction("schedule_watering_done");
      Serial.println("SCHEDULE B DONE: wateringSeconds reached, valve forced OFF");
      sendStatus();
      return;
    }
  }

  // 雨滴停止排程只在收到 startWaterRequest 前即時判斷。
}

String boolText(bool v) {
  return v ? "true" : "false";
}

String htmlStatus() {
  String s;
  s.reserve(5200);

  s.concat("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>");
  s.concat("<title>Box B</title>");
  s.concat("<style>");
  s.concat("body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#07111f;color:white;padding:16px;line-height:1.5}");
  s.concat(".card{background:#102033;border:1px solid #1d3855;border-radius:16px;padding:16px;margin:12px 0}");
  s.concat("button{width:100%;padding:14px;border:0;border-radius:12px;margin:6px 0;color:white;font-weight:800;font-size:16px}");
  s.concat(".g{background:#27ae60}.r{background:#d94c48}.b{background:#2f80ed}.gray{background:#606b7a}");
  s.concat(".line{padding:8px 0;border-bottom:1px solid #1d3855;display:flex;justify-content:space-between;gap:12px}.ok{color:#34c759}.bad{color:#ff5a52}.warn{color:#ffd60a}");
  s.concat("a{text-decoration:none}");
  s.concat("</style></head><body>");

  s.concat("<h2>Box B 本地控制</h2>");
  s.concat("<div class='card'>");
  s.concat("<div class='line'><span>電磁閥</span><b>"); s.concat(valveState ? "開" : "關"); s.concat("</b></div>");
  s.concat("<div class='line'><span>單顆感測器</span><b>"); s.concat(sensorWet ? "濕 / 有水" : "乾燥"); s.concat("</b></div>");
  s.concat("<div class='line'><span>今日雨滴暫停</span><b>"); s.concat(rainBlockedToday ? "是" : "否"); s.concat("</b></div>");
  s.concat("<div class='line'><span>出水確認</span><b>"); s.concat(wateringConfirmed ? "已確認" : "待命"); s.concat("</b></div>");
  s.concat("<div class='line'><span>故障</span><b class='"); s.concat(valveFault ? "bad" : "ok"); s.concat("'>"); s.concat(valveFault ? "疑似沒出水" : "正常"); s.concat("</b></div>");
  s.concat("<div class='line'><span>Gateway</span><b class='"); s.concat(hasGateway ? "ok" : "warn"); s.concat("'>"); s.concat(hasGateway ? "已連線" : "未連線"); s.concat("</b></div>");
  s.concat("<div class='line'><span>本地模式</span><b>"); s.concat(localMode ? "啟用" : "關閉"); s.concat("</b></div>");
  s.concat("<div class='line'><span>天氣限制</span><b>"); s.concat(weatherBlocked ? "暫停" : "允許"); s.concat("</b></div>");
  s.concat("<div class='line'><span>降雨機率</span><b>"); s.concat(String(weatherRainProbability)); s.concat("%</b></div>");
  s.concat("<div class='line'><span>預估雨量</span><b>"); s.concat(String(weatherPrecipitationMM, 1)); s.concat(" mm</b></div>");
  s.concat("<div class='line'><span>剩餘秒數</span><b>"); s.concat(String(remainSeconds())); s.concat("</b></div>");
  s.concat("<div class='line'><span>心跳</span><b>#"); s.concat(String(heartbeatSeq)); s.concat("</b></div>");
  s.concat("<div class='line'><span>最後動作</span><b>"); s.concat(lastValveAction); s.concat("</b></div>");
  s.concat("</div>");

  s.concat("<div class='card'>");
  s.concat("<a href='/on'><button class='g'>本地開閥</button></a>");
  s.concat("<a href='/off'><button class='r'>本地關閥</button></a>");
  s.concat("<a href='/auto'><button class='b'>恢復 Gateway 控制</button></a>");
  s.concat("<a href='/clear'><button class='b'>清除今日狀態 / 故障</button></a>");
  s.concat("<a href='/json'><button class='gray'>查看 JSON 狀態</button></a>");
  s.concat("<a href='/update'><button class='gray'>OTA 更新</button></a>");
  s.concat("</div>");

  s.concat("<div class='card'>");
  s.concat("<div class='line'><span>AP SSID</span><b>"); s.concat(AP_SSID); s.concat("</b></div>");
  s.concat("<div class='line'><span>AP IP</span><b>"); s.concat(WiFi.softAPIP().toString()); s.concat("</b></div>");
  s.concat("<div class='line'><span>STA MAC</span><b>"); s.concat(WiFi.macAddress()); s.concat("</b></div>");
  s.concat("<div class='line'><span>ESP-NOW Channel</span><b>"); s.concat(String(currentEspNowChannel)); s.concat("</b></div>");
  s.concat("<div class='line'><span>Gateway MAC</span><b>"); s.concat(hasGateway ? macToString(gatewayMac) : "--"); s.concat("</b></div>");
  s.concat("</div>");

  s.concat("</body></html>");
  return s;
}

String jsonStatus() {
  String j;
  j.reserve(1200);

  j.concat("{");
  j.concat("\"box\":\"boxB\",");
  j.concat("\"valve\":"); j.concat(boolText(valveState)); j.concat(",");
  j.concat("\"sensorWet\":"); j.concat(boolText(sensorWet)); j.concat(",");
  j.concat("\"rainBlockedToday\":"); j.concat(boolText(rainBlockedToday)); j.concat(",");
  j.concat("\"waterDetected\":"); j.concat(boolText(waterDetected)); j.concat(",");
  j.concat("\"wateringConfirmed\":"); j.concat(boolText(wateringConfirmed)); j.concat(",");
  j.concat("\"valveFault\":"); j.concat(boolText(valveFault)); j.concat(",");
  j.concat("\"weatherBlocked\":"); j.concat(boolText(weatherBlocked)); j.concat(",");
  j.concat("\"manualMode\":"); j.concat(boolText(manualMode)); j.concat(",");
  j.concat("\"manualValve\":"); j.concat(boolText(manualValve)); j.concat(",");
  j.concat("\"autoMode\":"); j.concat(boolText(autoMode)); j.concat(",");
  j.concat("\"scheduleEnabled\":"); j.concat(boolText(scheduleEnabled)); j.concat(",");
  j.concat("\"localMode\":"); j.concat(boolText(localMode)); j.concat(",");
  j.concat("\"remain\":"); j.concat(String(remainSeconds())); j.concat(",");
  j.concat("\"scheduleRemainSeconds\":"); j.concat(String(scheduleRemainSeconds())); j.concat(",");
  j.concat("\"noWaterTimeoutRemainSeconds\":"); j.concat(String(noWaterTimeoutRemainSeconds())); j.concat(",");
  j.concat("\"noWaterTimeoutSeconds\":"); j.concat(String(noWaterTimeoutSeconds)); j.concat(",");
  j.concat("\"heartbeatSeq\":"); j.concat(String(heartbeatSeq)); j.concat(",");
  j.concat("\"lastValveAction\":\""); j.concat(lastValveAction); j.concat("\",");
  j.concat("\"gateway\":"); j.concat(boolText(hasGateway));
  j.concat("}");

  return j;
}

void setupServer() {
  if (webServerStarted) return;
  server.on("/", []() {
    server.send(200, "text/html", htmlStatus());
  });

  server.on("/json", []() {
    server.send(200, "application/json", jsonStatus());
  });

  server.on("/on", []() {
    localMode = true;
    manualMode = true;
    manualValve = true;
    valveFault = false;
    waterDetected = false;
    wateringConfirmed = false;
    setValve(true, "local_on");
    sendStatus();
    server.sendHeader("Location", "/");
    server.send(302);
  });

  server.on("/off", []() {
    localMode = true;
    manualMode = false;
    manualValve = false;
    currentWateringFromSchedule = false;
    currentWateringOfflineBypass = false;
    valveFault = false;
    waterDetected = false;
    wateringConfirmed = false;
    setValve(false, "local_off");
    sendStatus();
    server.sendHeader("Location", "/");
    server.send(302);
  });

  server.on("/auto", []() {
    localMode = false;
    manualMode = false;
    manualValve = false;
    setLastValveAction("gateway_control");
    sendStatus();
    server.sendHeader("Location", "/");
    server.send(302);
  });

  server.on("/clear", []() {
    clearTodayStatus();
    server.sendHeader("Location", "/");
    server.send(302);
  });

  server.on("/reboot", []() {
    server.send(200, "text/plain", "Rebooting Box B...");
    delay(500);
    ESP.restart();
  });

  server.on("/update", HTTP_GET, []() {
    String h;
    h.reserve(1800);
    h.concat("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>");
    h.concat("<title>Box B OTA</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#07111f;color:white;padding:16px}.card{background:#102033;border:1px solid #1d3855;border-radius:12px;padding:16px;margin:12px 0}button,input{width:100%;padding:14px;border:0;border-radius:10px;margin:6px 0;font-weight:700}</style></head><body>");
    h.concat("<div class='card'><h2>Box B OTA 更新</h2><form method='POST' action='/update' enctype='multipart/form-data'><input type='file' name='update'><button type='submit'>上傳韌體</button></form><a href='/'>返回</a></div></body></html>");
    server.send(200, "text/html", h);
  });

  server.on("/update", HTTP_POST, []() {
    server.send(200, "text/plain", Update.hasError() ? "Update failed" : "Update complete. Restarting.");
    delay(1000);
    ESP.restart();
  }, []() {
    HTTPUpload &upload = server.upload();
    if (upload.status == UPLOAD_FILE_START) {
      Serial.print("OTA start: ");
      Serial.println(upload.filename);
      if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (Update.end(true)) {
        Serial.println("OTA complete");
      } else {
        Update.printError(Serial);
      }
    }
  });

  server.onNotFound([]() {
    server.sendHeader("Location", String("http://192.168.4.1/"), true);
    server.send(302, "text/plain", "Redirect to Box B setup page");
  });

  server.begin();
  webServerStarted = true;
  Serial.println("Box B WebServer started on port 80");
}

void startAPMode() {
  // Force Box B local AP. Keep the same channel as ESP-NOW so Box A can still talk to Box B.
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.setHostname(HOSTNAME);
  esp_wifi_set_ps(WIFI_PS_NONE);
  esp_wifi_set_max_tx_power(78); // 19.5 dBm, stronger local AP signal.
  delay(100);

  setEspNowChannel(currentEspNowChannel);

  // Restart SoftAP every time this is requested to make the SSID visible again.
  WiFi.softAPdisconnect(true);
  delay(250);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));

  bool apOk = WiFi.softAP(AP_SSID, AP_PASS, currentEspNowChannel, 0, 8);
  delay(500);
  setEspNowChannel(currentEspNowChannel);

  apRunning = apOk;
  if (apOk) apStartMillis = millis();

  Serial.println("========== Local AP Start boxB ==========");
  Serial.print("AP start: ");
  Serial.println(apOk ? "OK" : "FAILED");
  Serial.print("AP SSID: ");
  Serial.println(AP_SSID);
  Serial.print("AP PASS: ");
  Serial.println(AP_PASS);
  Serial.print("AP channel: ");
  Serial.println(currentEspNowChannel);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Open http://192.168.4.1 . If Box A gateway is not connected, AP will stay active for setup.");

  // v19: Start WebServer only after SoftAP is actually running.
  if (apOk) setupServer();

  // v18: AP and ESP-NOW share one radio. Keep the AP channel as currentEspNowChannel.
  // Do NOT force fallback channel here, otherwise phone can stay connected but 192.168.4.1 may stop responding.
  setEspNowChannel(currentEspNowChannel);
  if (hasGateway) ensureGatewayPeer(gatewayMac);
  ensureBroadcastPeer();
}

void stopAPMode() {
  if (!apRunning) return;
  WiFi.softAPdisconnect(true);
  apRunning = false;

  // Keep STA mode for ESP-NOW after AP is closed.
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
  esp_wifi_set_ps(WIFI_PS_NONE);
  setEspNowChannel(currentEspNowChannel);
  Serial.println("AP stopped after 20 minutes. ESP-NOW remains active.");
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("==============================");
  Serial.println("BOX B v23 fast OFF + offline schedule bypass");
  Serial.println("==============================");

  pinMode(PIN_VALVE, OUTPUT);
  pinMode(PIN_RAIN, INPUT_PULLUP);
  digitalWrite(PIN_VALVE, LOW);

  // v19: Do NOT start WebServer before WiFi.mode().
  // Start it only after WiFi/AP stack is initialized to avoid ESP32-C3 queue assert.
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.setHostname(HOSTNAME);
  esp_wifi_set_max_tx_power(78);
  currentEspNowChannel = loadLastGoodChannel();
  Serial.print("Boot ESP-NOW start channel=");
  Serial.println(currentEspNowChannel);
  setEspNowChannel(currentEspNowChannel);

  // Box B 開機不自動開啟 Setup-boxB AP，避免和 ESP-NOW 頻道互相干擾。
  // 需要本地 AP 時，由網頁按鈕經 Box A 傳 requestLocalAP 再開 20 分鐘。
  Serial.print("STA MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.println("Use this STA MAC in Box A BOX_B_MAC. AP MAC is usually +1 and will NOT work for ESP-NOW STA mode.");
  Serial.print("ESP-NOW channel: ");
  Serial.println(currentEspNowChannel);

  if (MDNS.begin(HOSTNAME)) {
    Serial.print("mDNS: http://");
    Serial.print(HOSTNAME);
    Serial.println(".local");
  }

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed");
    return;
  }

  esp_now_register_recv_cb(onDataRecv);
  esp_now_register_send_cb(onDataSent);

  // ESP32-C3 reliability: apply current search channel after esp_now_init/register.
  setEspNowChannel(currentEspNowChannel);
  ensureBroadcastPeer();

  setupServer();

  Serial.println("boxB Ready");
  Serial.println("ESP-NOW search order: last-good -> 7 -> 1 -> 6 -> 11 -> 8 -> 9 -> 10 -> 12 -> 13 -> 2 -> 3 -> 4 -> 5");
}

void loop() {
  server.handleClient();
  controlLogic();

  if (apRunning && millis() - apStartMillis >= AP_ACTIVE_TIME_MS) {
    stopAPMode();
  }

  if (millis() - lastEspNowDebugPrint >= 5000UL) {
    lastEspNowDebugPrint = millis();
    uint8_t actualCh = 0;
    wifi_second_chan_t second = WIFI_SECOND_CHAN_NONE;
    esp_wifi_get_channel(&actualCh, &second);
    Serial.print("BOX B ESP-NOW debug cfgCh=");
    Serial.print(currentEspNowChannel);
    Serial.print(" actualCh=");
    Serial.print(actualCh);
    Serial.print(" hasGateway=");
    Serial.print(hasGateway);
    Serial.print(" rx=");
    Serial.print(espNowRxCount);
    Serial.print(" txOK=");
    Serial.print(espNowTxOkCount);
    Serial.print(" txFAIL=");
    Serial.println(espNowTxFailCount);
  }

  maybeHopEspNowChannel();

  if (millis() - lastReport >= REPORT_INTERVAL_MS) {
    lastReport = millis();
    sendStatus();
  }
}
