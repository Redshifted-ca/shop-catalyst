#include <Wire.h>
#include <Adafruit_PN532.h>

// Hardware configuration
#define SDA_PIN 21
#define SCL_PIN 22

Adafruit_PN532 nfc(SDA_PIN, SCL_PIN);

String lastNfcId = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 2000; // 2 seconds between scans

void setup() {
  Serial.begin(19200);
  delay(100);
  
  Serial.println("NFC_READY"); // Signal to browser that system is ready
  
  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize NFC reader
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  
  if (!versiondata) {
    Serial.println("NFC_ERROR:Reader not found");
    while (1) {
      delay(1000);
    }
  }
  
  // Configure PN532 to read RFID tags
  nfc.SAMConfig();
  
  Serial.println("NFC_READY");
}

void loop() {
  uint8_t success;
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;
  
  // Check for NFC tag
  success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100);
  
  if (success) {
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
    
    // Send to browser in a structured format
    Serial.print("NFC_SCAN:");
    Serial.println(nfcId);
    
    // Wait a bit before next scan
    delay(500);
  }
  
  delay(50);
}