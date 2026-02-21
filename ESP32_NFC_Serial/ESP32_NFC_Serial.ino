#include <Wire.h>
#include <Adafruit_PN532.h>
#include <esp_task_wdt.h>

// Custom I2C pins
#define SDA_PIN 2   // D4
#define SCL_PIN 4  // D22

// Watchdog timeout
#define WDT_TIMEOUT 10

Adafruit_PN532 nfc(SDA_PIN, SCL_PIN);

// Scan tracking
String lastNfcId = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 2000;

// Statistics
int totalScans = 0;
int successfulReads = 0;
int successfulWrites = 0;
int loopCount = 0;

// Command mode
String pendingWriteData = "";
bool writeMode = false;
bool readMode = false;

void setup() {
  Serial.begin(115200);
  
  // Enable watchdog
  esp_task_wdt_init(WDT_TIMEOUT, true);
  esp_task_wdt_add(NULL);
  
  delay(1000);
  
  Serial.println("\n\n╔════════════════════════════════════════╗");
  Serial.println("║   NFC CASHIER - READ/WRITE SYSTEM      ║");
  Serial.println("╚════════════════════════════════════════╝\n");
  
  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  
  Serial.print("✓ I2C initialized on SDA=D4, SCL=D22\n");
  
  // Initialize NFC with retries
  int retries = 0;
  bool nfcInitialized = false;
  
  while (!nfcInitialized && retries < 5) {
    nfc.begin();
    uint32_t versiondata = nfc.getFirmwareVersion();
    
    if (versiondata) {
      Serial.print("✓ Found PN5");
      Serial.print((versiondata >> 24) & 0xFF, HEX);
      Serial.print(" firmware v");
      Serial.print((versiondata >> 16) & 0xFF, DEC);
      Serial.print(".");
      Serial.println((versiondata >> 8) & 0xFF, DEC);
      nfcInitialized = true;
    } else {
      retries++;
      Serial.print("⚠️  Retry ");
      Serial.print(retries);
      Serial.println("/5");
      delay(1000);
    }
  }
  
  if (!nfcInitialized) {
    Serial.println("❌ PN532 NOT FOUND!");
    while (1) {
      esp_task_wdt_reset();
      delay(1000);
    }
  }
  
  nfc.SAMConfig();
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║          SYSTEM READY! ✓               ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println("NFC_READY");
  Serial.println();
}

void loop() {
  esp_task_wdt_reset();
  
  static unsigned long lastHeartbeat = 0;
  loopCount++;
  
  // Heartbeat every 5 seconds
  if (millis() - lastHeartbeat > 5000) {
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
  
  // Check for serial commands from browser
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleCommand(command);
  }
  
  // Check for NFC tag
  uint8_t uid[7];
  uint8_t uidLength;
  
  uint8_t success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50);
  
  if (success) {
    totalScans++;
    
    // Convert UID to hex string
    String nfcId = "";
    for (uint8_t i = 0; i < uidLength; i++) {
      if (uid[i] < 0x10) nfcId += "0";
      nfcId += String(uid[i], HEX);
    }
    nfcId.toUpperCase();
    
    // Prevent duplicate scans
    unsigned long currentTime = millis();
    if (nfcId == lastNfcId && (currentTime - lastScanTime) < SCAN_COOLDOWN) {
      delay(50);
      return;
    }
    
    lastNfcId = nfcId;
    lastScanTime = currentTime;
    
    // Handle based on mode
    if (writeMode) {
      handleWrite(uid, uidLength, nfcId);
    } else if (readMode) {
      handleRead(uid, uidLength, nfcId);
    } else {
      // Normal scan mode - just send to browser
      handleNormalScan(uid, uidLength, nfcId);
    }
    
    delay(300);
  }
  
  delay(50);
}

void handleCommand(String command) {
  command.toUpperCase();
  
  Serial.print("CMD_RECEIVED:");
  Serial.println(command);
  
  if (command.startsWith("WRITE:")) {
    // Format: WRITE:data to write
    pendingWriteData = command.substring(6);
    writeMode = true;
    readMode = false;
    Serial.println("WRITE_MODE_ACTIVE");
    Serial.print("WRITE_DATA_SET:");
    Serial.println(pendingWriteData);
  } 
  else if (command == "READ") {
    readMode = true;
    writeMode = false;
    Serial.println("READ_MODE_ACTIVE");
  }
  else if (command == "NORMAL") {
    writeMode = false;
    readMode = false;
    Serial.println("NORMAL_MODE_ACTIVE");
  }
  else if (command == "STATS") {
    printStats();
  }
  else {
    Serial.print("UNKNOWN_CMD:");
    Serial.println(command);
  }
}

void handleNormalScan(uint8_t uid[], uint8_t uidLength, String nfcId) {
  Serial.println("\n🎯 TAG_DETECTED");
  Serial.print("NFC_SCAN:");
  Serial.println(nfcId);
  
  successfulReads++;
}

String bytesToAscii(uint8_t *data, uint8_t length) {
  String result = "";
  for (uint8_t i = 0; i < length; i++) {
    // Only add printable characters (Space through ~)
    if (data[i] >= 32 && data[i] <= 126) {
      result += (char)data[i];
    }
  }
  return result;
}

void handleRead(uint8_t *uid, uint8_t uidLength, String nfcId) {
  uint8_t data[16]; // Buffer to hold 16 bytes of data
  
  // Try to read Block 4 (Standard for MIFARE Classic)
  // Note: Authenticate first if using MIFARE Classic!
  uint8_t success = nfc.mifareclassic_ReadDataBlock(4, data);

  if (success) {
    String asciiName = bytesToAscii(data, 16);
    Serial.print("USER_NAME:");
    Serial.println(asciiName);
    
    // If you want a numeric version of that string:
    // long userNum = asciiName.toInt(); 
  } else {
    // If Classic fails, try NTAG2xx (common for stickers/round tags)
    success = nfc.ntag2xx_ReadPage(4, data);
    if (success) {
      String asciiName = bytesToAscii(data, 16);
      Serial.print("USER_NAME:");
      Serial.println(asciiName);
    }
  }
}

void handleWrite(uint8_t uid[], uint8_t uidLength, String nfcId) {
  Serial.println("\n✍️  WRITE_OPERATION");
  Serial.print("NFC_ID:");
  Serial.println(nfcId);
  Serial.print("WRITING:");
  Serial.println(pendingWriteData);
  
  // Prepare data buffer
  uint8_t data[16];
  memset(data, 0, 16);
  
  int len = min((unsigned int)pendingWriteData.length(), 16U);
  for (int i = 0; i < len; i++) {
    data[i] = pendingWriteData[i];
  }
  
  bool writeSuccess = false;
  
  // Try MIFARE Classic first
  uint8_t keyA[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
  uint8_t block = 4;
  
  if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 0, keyA)) {
    if (nfc.mifareclassic_WriteDataBlock(block, data)) {
      writeSuccess = true;
      Serial.println("WRITE_SUCCESS:MIFARE");
    }
  } else {
    // Try NTAG
    if (nfc.ntag2xx_WritePage(4, data)) {
      writeSuccess = true;
      Serial.println("WRITE_SUCCESS:NTAG");
    }
  }
  
  if (writeSuccess) {
    successfulWrites++;
  } else {
    Serial.println("WRITE_FAILED");
  }
  
  // Exit write mode
  writeMode = false;
  pendingWriteData = "";
  Serial.println("NORMAL_MODE_ACTIVE");
}

void printStats() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║            STATISTICS                  ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.print("║ Uptime: ");
  Serial.print(millis() / 1000);
  Serial.println(" sec");
  Serial.print("║ Total Scans: ");
  Serial.println(totalScans);
  Serial.print("║ Reads: ");
  Serial.println(successfulReads);
  Serial.print("║ Writes: ");
  Serial.println(successfulWrites);
  Serial.println("╚════════════════════════════════════════╝");
}