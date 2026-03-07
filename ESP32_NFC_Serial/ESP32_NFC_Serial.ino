#include <Wire.h>
#include <Adafruit_PN532.h>
#include <esp_task_wdt.h>

// ========================================
// PIN CONFIGURATION - USING D2 AND D4
// ========================================
#define SDA_PIN 2   // D2 - I2C Data
#define SCL_PIN 4   // D4 - I2C Clock

// ========================================
// SYSTEM CONFIGURATION
// ========================================
#define WDT_TIMEOUT 10              // Watchdog timeout in seconds
#define SCAN_COOLDOWN 2000          // Milliseconds between duplicate scans
#define HEARTBEAT_INTERVAL 5000     // Heartbeat every 5 seconds
#define NFC_READ_TIMEOUT 50         // NFC read timeout in milliseconds

// ========================================
// GLOBAL OBJECTS
// ========================================
Adafruit_PN532 nfc(SDA_PIN, SCL_PIN);

// ========================================
// STATE VARIABLES
// ========================================
// Scan tracking
String lastNfcId = "";
unsigned long lastScanTime = 0;

// Statistics
int totalScans = 0;
int successfulReads = 0;
int successfulWrites = 0;
int loopCount = 0;
unsigned long lastHeartbeat = 0;

// Operation modes
enum Mode { MODE_SCAN, MODE_READ, MODE_WRITE };
Mode currentMode = MODE_SCAN;

// Write operation state
String pendingWriteData = "";
bool waitingForTag = false;

// ========================================
// SETUP FUNCTION
// ========================================
void setup() {
  // Initialize Serial
  Serial.begin(115200);
  delay(1000);
  
  // Print startup banner
  printBanner();
  
  // Initialize Watchdog Timer
  esp_task_wdt_init(WDT_TIMEOUT, true);
  esp_task_wdt_add(NULL);
  Serial.println("✓ Watchdog timer initialized");
  
  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000); // 100kHz for stability
  
  Serial.print("✓ I2C initialized - SDA: D2 (GPIO");
  Serial.print(SDA_PIN);
  Serial.print("), SCL: D4 (GPIO");
  Serial.print(SCL_PIN);
  Serial.println(")");
  
  // Initialize NFC Reader with retry logic
  if (!initializeNFC()) {
    Serial.println("\n❌ FATAL: Could not initialize PN532!");
    Serial.println("System halted. Check wiring and press RESET.");
    while (1) {
      esp_task_wdt_reset(); // Keep feeding watchdog
      delay(1000);
    }
  }
  
  // Configure PN532
  nfc.SAMConfig();
  Serial.println("✓ PN532 configured");
  
  // System ready
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║       ✓ SYSTEM READY!                 ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println("NFC_READY");
  Serial.println();
  
  printHelp();
}

// ========================================
// MAIN LOOP
// ========================================
void loop() {
  // Reset watchdog timer
  esp_task_wdt_reset();
  
  // Increment loop counter
  loopCount++;
  
  // Send heartbeat
  sendHeartbeat();
  
  // Check for serial commands from browser
  if (Serial.available() > 0) {
    handleSerialCommand();
  }
  
  // Check for NFC tag
  checkForNFCTag();
  
  // Small delay to prevent CPU overload
  delay(50);
}

// ========================================
// NFC INITIALIZATION
// ========================================
bool initializeNFC() {
  Serial.println("\n📡 Initializing PN532 NFC Reader...");
  
  int retries = 0;
  const int maxRetries = 5;
  
  while (retries < maxRetries) {
    nfc.begin();
    delay(100);
    
    uint32_t versiondata = nfc.getFirmwareVersion();
    
    if (versiondata) {
      Serial.print("✓ Found PN5");
      Serial.print((versiondata >> 24) & 0xFF, HEX);
      Serial.print(" - Firmware version ");
      Serial.print((versiondata >> 16) & 0xFF, DEC);
      Serial.print(".");
      Serial.println((versiondata >> 8) & 0xFF, DEC);
      return true;
    }
    
    retries++;
    Serial.print("⚠️  PN532 not responding (Attempt ");
    Serial.print(retries);
    Serial.print("/");
    Serial.print(maxRetries);
    Serial.println(")");
    delay(500);
  }
  
  return false;
}

// ========================================
// HEARTBEAT
// ========================================
void sendHeartbeat() {
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    Serial.print("⏱️  Uptime: ");
    Serial.print(millis() / 1000);
    Serial.print("s | Loops: ");
    Serial.print(loopCount);
    Serial.print(" | Scans: ");
    Serial.print(totalScans);
    Serial.print(" | Reads: ");
    Serial.print(successfulReads);
    Serial.print(" | Writes: ");
    Serial.println(successfulWrites);
    
    lastHeartbeat = millis();
    loopCount = 0;
  }
}

// ========================================
// SERIAL COMMAND HANDLER
// ========================================
void handleSerialCommand() {
  String command = Serial.readStringUntil('\n');
  command.trim();
  
  if (command.length() == 0) return;
  
  Serial.print("CMD_RECEIVED:");
  Serial.println(command);
  
  // Convert to uppercase for comparison
  String cmd = command;
  cmd.toUpperCase();
  
  if (cmd.startsWith("WRITE:")) {
    handleWriteCommand(command.substring(6));
  }
  else if (cmd == "READ") {
    handleReadCommand();
  }
  else if (cmd == "NORMAL" || cmd == "SCAN") {
    handleNormalCommand();
  }
  else if (cmd == "STATS") {
    printStats();
  }
  else if (cmd == "HELP" || cmd == "?") {
    printHelp();
  }
  else if (cmd == "RESET") {
    resetStats();
  }
  else {
    Serial.print("UNKNOWN_CMD:");
    Serial.println(command);
  }
}

// ========================================
// COMMAND: WRITE
// ========================================
void handleWriteCommand(String data) {
  if (data.length() == 0) {
    Serial.println("ERROR:No data provided");
    return;
  }
  
  if (data.length() > 16) {
    Serial.println("ERROR:Data too long (max 16 chars)");
    return;
  }
  
  pendingWriteData = data;
  currentMode = MODE_WRITE;
  waitingForTag = true;
  
  Serial.println("WRITE_MODE_ACTIVE");
  Serial.print("WRITE_DATA_SET:");
  Serial.println(pendingWriteData);
  Serial.println("STATUS:Tap NFC tag to write");
}

// ========================================
// COMMAND: READ
// ========================================
void handleReadCommand() {
  currentMode = MODE_READ;
  waitingForTag = true;
  
  Serial.println("READ_MODE_ACTIVE");
  Serial.println("STATUS:Tap NFC tag to read");
}

// ========================================
// COMMAND: NORMAL/SCAN
// ========================================
void handleNormalCommand() {
  currentMode = MODE_SCAN;
  waitingForTag = false;
  pendingWriteData = "";
  
  Serial.println("NORMAL_MODE_ACTIVE");
  Serial.println("STATUS:Normal scan mode");
}

// ========================================
// NFC TAG DETECTION
// ========================================
void checkForNFCTag() {
  uint8_t uid[7];
  uint8_t uidLength;
  
  // Try to read NFC tag
  uint8_t success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, NFC_READ_TIMEOUT);
  
  if (!success) {
    return; // No tag detected
  }
  
  // Tag detected!
  totalScans++;
  
  // Convert UID to hex string
  String nfcId = uidToString(uid, uidLength);
  
  // Check for duplicate scan (debounce)
  if (isDuplicateScan(nfcId)) {
    delay(50);
    return;
  }
  
  // Update last scan
  lastNfcId = nfcId;
  lastScanTime = millis();
  
  // Handle based on current mode
  switch (currentMode) {
    case MODE_SCAN:
      handleNormalScan(uid, uidLength, nfcId);
      break;
    case MODE_READ:
      handleReadOperation(uid, uidLength, nfcId);
      break;
    case MODE_WRITE:
      handleWriteOperation(uid, uidLength, nfcId);
      break;
  }
  
  delay(300); // Brief delay after processing
}

// ========================================
// MODE: NORMAL SCAN
// ========================================
void handleNormalScan(uint8_t uid[], uint8_t uidLength, String nfcId) {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║       🎯 NFC TAG DETECTED             ║");
  Serial.println("╚════════════════════════════════════════╝");
  
  Serial.print("📌 UID Length: ");
  Serial.print(uidLength);
  Serial.println(" bytes");
  
  Serial.print("📌 UID (Hex):  ");
  printUidHex(uid, uidLength);
  
  Serial.print("📌 UID (String): ");
  Serial.println(nfcId);
  
  // Identify card type
  printCardType(uidLength);
  
  // Send to browser
  Serial.print("NFC_SCAN:");
  Serial.println(nfcId);
  
  Serial.println("╚════════════════════════════════════════╝\n");
  
  successfulReads++;
}

// ========================================
// MODE: READ OPERATION
// ========================================
void handleReadOperation(uint8_t uid[], uint8_t uidLength, String nfcId) {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║       📖 READ OPERATION               ║");
  Serial.println("╚════════════════════════════════════════╝");
  
  Serial.print("NFC_ID:");
  Serial.println(nfcId);
  
  uint8_t data[16];
  bool readSuccess = false;
  String cardType = "";
  
  // Try MIFARE Classic first
  uint8_t keyA[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
  uint8_t block = 4;
  
  if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 0, keyA)) {
    if (nfc.mifareclassic_ReadDataBlock(block, data)) {
      readSuccess = true;
      cardType = "MIFARE";
      Serial.println("✓ MIFARE Classic detected");
    }
  }
  
  // Try NTAG if MIFARE failed
  if (!readSuccess) {
    if (nfc.ntag2xx_ReadPage(4, data)) {
      readSuccess = true;
      cardType = "NTAG";
      Serial.println("✓ NTAG card detected");
    }
  }
  
  if (readSuccess) {
    Serial.print("READ_SUCCESS:");
    Serial.println(cardType);
    
    // Send hex data
    Serial.print("DATA_HEX:");
    for (int i = 0; i < 16; i++) {
      if (data[i] < 0x10) Serial.print("0");
      Serial.print(data[i], HEX);
    }
    Serial.println();
    
    // Send ASCII data
    Serial.print("DATA_ASCII:");
    for (int i = 0; i < 16; i++) {
      if (data[i] >= 32 && data[i] <= 126) {
        Serial.print((char)data[i]);
      } else {
        Serial.print(".");
      }
    }
    Serial.println();
    
    successfulReads++;
  } else {
    Serial.println("READ_FAILED");
    Serial.println("ERROR:Could not read from tag");
  }
  
  Serial.println("╚════════════════════════════════════════╝\n");
  
  // Return to normal mode
  currentMode = MODE_SCAN;
  waitingForTag = false;
  Serial.println("NORMAL_MODE_ACTIVE");
}

// ========================================
// MODE: WRITE OPERATION
// ========================================
void handleWriteOperation(uint8_t uid[], uint8_t uidLength, String nfcId) {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║       ✍️  WRITE OPERATION             ║");
  Serial.println("╚════════════════════════════════════════╝");
  
  Serial.print("NFC_ID:");
  Serial.println(nfcId);
  Serial.print("WRITING:");
  Serial.println(pendingWriteData);
  
  // Prepare data buffer
  uint8_t data[16];
  memset(data, 0, 16);
  
  int len = min((int)pendingWriteData.length(), 16);
  for (int i = 0; i < len; i++) {
    data[i] = pendingWriteData[i];
  }
  
  bool writeSuccess = false;
  String cardType = "";
  
  // Try MIFARE Classic first
  uint8_t keyA[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
  uint8_t block = 4;
  
  if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 0, keyA)) {
    if (nfc.mifareclassic_WriteDataBlock(block, data)) {
      writeSuccess = true;
      cardType = "MIFARE";
      Serial.println("✓ MIFARE Classic write successful");
    }
  }
  
  // Try NTAG if MIFARE failed
  if (!writeSuccess) {
    if (nfc.ntag2xx_WritePage(4, data)) {
      writeSuccess = true;
      cardType = "NTAG";
      Serial.println("✓ NTAG write successful");
    }
  }
  
  if (writeSuccess) {
    Serial.print("WRITE_SUCCESS:");
    Serial.println(cardType);
    successfulWrites++;
  } else {
    Serial.println("WRITE_FAILED");
    Serial.println("ERROR:Could not write to tag");
  }
  
  Serial.println("╚════════════════════════════════════════╝\n");
  
  // Return to normal mode
  currentMode = MODE_SCAN;
  waitingForTag = false;
  pendingWriteData = "";
  Serial.println("NORMAL_MODE_ACTIVE");
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Convert UID to hex string
String uidToString(uint8_t uid[], uint8_t uidLength) {
  String nfcId = "";
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) nfcId += "0";
    nfcId += String(uid[i], HEX);
  }
  nfcId.toUpperCase();
  return nfcId;
}

// Check if this is a duplicate scan
bool isDuplicateScan(String nfcId) {
  return (nfcId == lastNfcId && (millis() - lastScanTime) < SCAN_COOLDOWN);
}

// Print UID in hex format
void printUidHex(uint8_t uid[], uint8_t uidLength) {
  for (uint8_t i = 0; i < uidLength; i++) {
    Serial.print("0x");
    if (uid[i] < 0x10) Serial.print("0");
    Serial.print(uid[i], HEX);
    if (i < uidLength - 1) Serial.print(" ");
  }
  Serial.println();
}

// Print card type based on UID length
void printCardType(uint8_t uidLength) {
  Serial.print("📌 Type: ");
  if (uidLength == 4) {
    Serial.println("MIFARE Classic 1K / NTAG");
  } else if (uidLength == 7) {
    Serial.println("MIFARE Ultralight / NTAG");
  } else {
    Serial.println("Unknown");
  }
}

// ========================================
// STATISTICS & INFO
// ========================================
void printStats() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║            STATISTICS                  ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.print("║ Uptime:        ");
  Serial.print(millis() / 1000);
  Serial.println(" seconds");
  Serial.print("║ Total Scans:   ");
  Serial.println(totalScans);
  Serial.print("║ Reads:         ");
  Serial.println(successfulReads);
  Serial.print("║ Writes:        ");
  Serial.println(successfulWrites);
  Serial.print("║ Current Mode:  ");
  switch (currentMode) {
    case MODE_SCAN: Serial.println("SCAN"); break;
    case MODE_READ: Serial.println("READ"); break;
    case MODE_WRITE: Serial.println("WRITE"); break;
  }
  Serial.println("╚════════════════════════════════════════╝\n");
}

void resetStats() {
  totalScans = 0;
  successfulReads = 0;
  successfulWrites = 0;
  Serial.println("STATS_RESET");
  Serial.println("✓ Statistics reset to zero");
}

void printHelp() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║        AVAILABLE COMMANDS              ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.println("║ WRITE:text   Write text to NFC tag    ║");
  Serial.println("║ READ         Read from NFC tag         ║");
  Serial.println("║ NORMAL       Return to scan mode       ║");
  Serial.println("║ STATS        Show statistics           ║");
  Serial.println("║ RESET        Reset statistics          ║");
  Serial.println("║ HELP         Show this help            ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println("\nExamples:");
  Serial.println("  WRITE:USER123");
  Serial.println("  WRITE:participant1@example.com");
  Serial.println("  READ\n");
}

void printBanner() {
  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║  ESP32 NFC CASHIER SYSTEM v3.0        ║");
  Serial.println("║  Full Read/Write + Web Integration    ║");
  Serial.println("║                                        ║");
  Serial.println("║  Pins: D2 (SDA), D4 (SCL)             ║");
  Serial.println("╚════════════════════════════════════════╝\n");
}