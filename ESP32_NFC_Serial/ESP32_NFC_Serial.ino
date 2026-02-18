#include <Wire.h>
#include <Adafruit_PN532.h>

// Custom I2C pins
#define SDA_PIN 4   // D4 on your ESP32
#define SCL_PIN 22  // D22 (standard SCL)

#define PN532_IRQ   (2)
#define PN532_RESET (3) 

// Create PN532 instance
Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

// Scan tracking
String lastNfcId = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 2000; // 2 seconds between scans

// Statistics
int totalScans = 0;
int successfulReads = 0;
int successfulWrites = 0;

void setup() {
  Serial.begin(9600);
  delay(1000);
  
  Serial.println("\n\n╔════════════════════════════════════════╗");
  Serial.println("║   NFC CASHIER SYSTEM - FULL VERSION   ║");
  Serial.println("║   Read & Write Capabilities            ║");
  Serial.println("╚════════════════════════════════════════╝\n");
  
  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  Serial.print("✓ I2C initialized on SDA=D4 (GPIO");
  Serial.print(SDA_PIN);
  Serial.print("), SCL=D22 (GPIO");
  Serial.print(SCL_PIN);
  Serial.println(")");
  
  // Initialize NFC reader
  nfc.begin();
  
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.println("\n╔═══════════════════════════════════╗");
    Serial.println("║  ❌ ERROR: PN532 NOT FOUND!      ║");
    Serial.println("╚═══════════════════════════════════╝");
    Serial.println("\nCheck wiring:");
    Serial.println("  VCC → 3.3V (NOT 5V!)");
    Serial.println("  GND → GND");
    Serial.println("  SDA → D4 (GPIO 4)");
    Serial.println("  SCL → D22 (GPIO 22)");
    Serial.println("\nCheck PN532 mode switches:");
    Serial.println("  SEL0 = OFF");
    Serial.println("  SEL1 = ON (I2C mode)");
    Serial.println("\n⚠️  System halted. Fix wiring and reset ESP32.");
    
    while (1) {
      delay(1000);
    }
  }
  
  // Print version info
  Serial.print("\n✓ Found PN5");
  Serial.print((versiondata >> 24) & 0xFF, HEX);
  Serial.print(" firmware v");
  Serial.print((versiondata >> 16) & 0xFF, DEC);
  Serial.print(".");
  Serial.println((versiondata >> 8) & 0xFF, DEC);
  
  // Configure PN532 to read RFID tags
  nfc.SAMConfig();
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║          SYSTEM READY! ✓               ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println("NFC_READY");
  Serial.println("\n📡 Waiting for NFC tag...\n");
  
  printCommands();
}

void loop() {
  static unsigned long lastHeartbeat = 0;
  
  // Heartbeat every 5 seconds
  if (millis() - lastHeartbeat > 5000) {
    Serial.print("⏱️  Uptime: ");
    Serial.print(millis() / 1000);
    Serial.print("s | Scans: ");
    Serial.print(totalScans);
    Serial.print(" | Reads: ");
    Serial.print(successfulReads);
    Serial.print(" | Writes: ");
    Serial.println(successfulWrites);
    lastHeartbeat = millis();
  }
  
  // Check for serial commands
  if (Serial.available() > 0) {
    handleSerialCommand();
  }
  
  // Check for NFC tag
  uint8_t success;
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;
  
  success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100);
  
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
      return;
    }
    
    lastNfcId = nfcId;
    lastScanTime = currentTime;
    
    // Display scan info
    printScanHeader();
    printTagInfo(uid, uidLength, nfcId);
    
    // Try to read data from tag
    readTagData(uid, uidLength);
    
    // Send to browser
    Serial.print("NFC_SCAN:");
    Serial.println(nfcId);
    
    printScanFooter();
    
    successfulReads++;
    
    delay(500);
  }
  
  delay(50);
}

void handleSerialCommand() {
  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toUpperCase();
  
  if (command == "HELP" || command == "?") {
    printCommands();
  } else if (command == "STATS") {
    printStats();
  } else if (command.startsWith("WRITE:")) {
    // Format: WRITE:Hello World
    String data = command.substring(6);
    Serial.println("\n🔵 Write mode activated. Tap NFC tag to write data...");
    writeToNextTag(data);
  } else if (command == "SCAN") {
    Serial.println("\n🔵 Manual scan requested...");
  } else if (command == "RESET") {
    totalScans = 0;
    successfulReads = 0;
    successfulWrites = 0;
    Serial.println("\n✓ Statistics reset");
  } else {
    Serial.println("❓ Unknown command. Type HELP for commands.");
  }
}

void writeToNextTag(String data) {
  Serial.println("⏳ Waiting for tag...");
  
  // Wait for tag (blocking)
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;
  
  unsigned long startWait = millis();
  while (millis() - startWait < 30000) { // 30 second timeout
    uint8_t success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100);
    
    if (success) {
      Serial.println("✓ Tag detected! Writing data...");
      
      // Write to NDEF block (block 4 for MIFARE Classic)
      // For NTAG cards, typically page 4+
      
      uint8_t blockNumber = 4; // Start block
      uint8_t dataBuffer[16];
      
      // Prepare data (max 16 bytes per block)
      memset(dataBuffer, 0, 16);
      int dataLen = (data.length() < 16) ? data.length() : 16;
      data.getBytes(dataBuffer, dataLen + 1);
      
      // Try to authenticate (for MIFARE Classic)
      uint8_t keyA[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
      success = nfc.mifareclassic_AuthenticateBlock(uid, uidLength, blockNumber, 0, keyA);
      
      if (success) {
        // Write data
        success = nfc.mifareclassic_WriteDataBlock(blockNumber, dataBuffer);
        
        if (success) {
          Serial.println("✅ Write successful!");
          Serial.print("Written: ");
          Serial.println(data);
          successfulWrites++;
        } else {
          Serial.println("❌ Write failed!");
        }
      } else {
        // Try NTAG write (for NTAG213/215/216)
        Serial.println("MIFARE auth failed, trying NTAG write...");
        
        // NTAG uses pages instead of blocks
        // Page 4 is usually safe to write to
        uint8_t page = 4;
        success = nfc.ntag2xx_WritePage(page, dataBuffer);
        
        if (success) {
          Serial.println("✅ NTAG Write successful!");
          Serial.print("Written: ");
          Serial.println(data);
          successfulWrites++;
        } else {
          Serial.println("❌ NTAG Write failed!");
        }
      }
      
      return;
    }
    
    delay(100);
  }
  
  Serial.println("⏱️  Timeout - no tag detected");
}

void readTagData(uint8_t uid[], uint8_t uidLength) {
  Serial.println("\n📖 Reading tag data...");
  
  // Try MIFARE Classic first
  uint8_t blockNumber = 4;
  uint8_t keyA[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
  uint8_t dataBuffer[16];
  
  uint8_t success = nfc.mifareclassic_AuthenticateBlock(uid, uidLength, blockNumber, 0, keyA);
  
  if (success) {
    Serial.println("✓ MIFARE Classic detected");
    success = nfc.mifareclassic_ReadDataBlock(blockNumber, dataBuffer);
    
    if (success) {
      Serial.println("✓ Block 4 data:");
      printHexData(dataBuffer, 16);
      printAsciiData(dataBuffer, 16);
    } else {
      Serial.println("❌ Read failed");
    }
  } else {
    // Try NTAG read
    Serial.println("Trying NTAG read...");
    
    uint8_t pageBuffer[32];
    success = nfc.ntag2xx_ReadPage(4, pageBuffer);
    
    if (success) {
      Serial.println("✓ NTAG card detected");
      Serial.println("✓ Page 4-7 data:");
      printHexData(pageBuffer, 16); // First 4 pages
      printAsciiData(pageBuffer, 16);
    } else {
      Serial.println("❌ Could not read data (card may be empty or locked)");
    }
  }
}

void printScanHeader() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║       🎯 NFC TAG DETECTED!            ║");
  Serial.println("╚════════════════════════════════════════╝");
}

void printScanFooter() {
  Serial.println("╚════════════════════════════════════════╝\n");
}

void printTagInfo(uint8_t uid[], uint8_t uidLength, String nfcId) {
  Serial.print("📌 UID Length: ");
  Serial.print(uidLength);
  Serial.println(" bytes");
  
  Serial.print("📌 UID (Hex):  ");
  for (uint8_t i = 0; i < uidLength; i++) {
    Serial.print("0x");
    if (uid[i] < 0x10) Serial.print("0");
    Serial.print(uid[i], HEX);
    if (i < uidLength - 1) Serial.print(" ");
  }
  Serial.println();
  
  Serial.print("📌 UID (String): ");
  Serial.println(nfcId);
  
  // Determine card type
  if (uidLength == 4) {
    Serial.println("📌 Type: MIFARE Classic 1K / NTAG");
  } else if (uidLength == 7) {
    Serial.println("📌 Type: MIFARE Ultralight / NTAG");
  } else {
    Serial.println("📌 Type: Unknown");
  }
}

void printHexData(uint8_t data[], int length) {
  Serial.print("   Hex: ");
  for (int i = 0; i < length; i++) {
    if (data[i] < 0x10) Serial.print("0");
    Serial.print(data[i], HEX);
    Serial.print(" ");
    if ((i + 1) % 8 == 0) Serial.print(" ");
  }
  Serial.println();
}

void printAsciiData(uint8_t data[], int length) {
  Serial.print("   ASCII: ");
  for (int i = 0; i < length; i++) {
    if (data[i] >= 32 && data[i] <= 126) {
      Serial.print((char)data[i]);
    } else {
      Serial.print(".");
    }
  }
  Serial.println();
}

void printCommands() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║          AVAILABLE COMMANDS            ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.println("║ HELP         - Show this help          ║");
  Serial.println("║ STATS        - Show statistics         ║");
  Serial.println("║ SCAN         - Manual scan trigger     ║");
  Serial.println("║ WRITE:text   - Write text to next tag ║");
  Serial.println("║ RESET        - Reset statistics        ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println("\nExample: WRITE:USER123");
  Serial.println("         WRITE:Hello World\n");
}

void printStats() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║            STATISTICS                  ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.print("║ Total Scans:      ");
  Serial.println(totalScans);
  Serial.print("║ Successful Reads: ");
  Serial.println(successfulReads);
  Serial.print("║ Successful Writes: ");
  Serial.println(successfulWrites);
  Serial.print("║ Uptime:           ");
  Serial.print(millis() / 1000);
  Serial.println(" seconds");
  Serial.println("╚════════════════════════════════════════╝\n");
}