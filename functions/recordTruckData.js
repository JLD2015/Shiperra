const winston = require('winston');
// eslint-disable-next-line
const { Timestamp, GeoPoint } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const firebaseAdmin = require('../firebase/firebase');

const db = firebaseAdmin.firestore();
const checkRegularRoutesFunction = require('./monitorMetrics');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
  ],
});

// <========== Save Data Locally ==========>

// Convert Firestore timestamp to milliseconds
function convertTimestampToMilliseconds(timestampObj) {
  /* eslint no-underscore-dangle: 0 */
  return (timestampObj._seconds * 1000) + (timestampObj._nanoseconds / 1e6);
}

function saveDataToLocalCache(deviceID, data) {
  const rootDir = 'data';
  const cacheDir = 'cache';
  const threeDaysInMilliseconds = 3 * 24 * 60 * 60 * 1000;

  // Construct the path to our cache directory
  const fullPath = path.join(__dirname, '..', rootDir, cacheDir);

  // Ensure the cache directory exists
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const filePath = path.join(fullPath, `${deviceID}.json`);
  let currentData = [];

  // If file exists, read the current data from the file
  if (fs.existsSync(filePath)) {
    currentData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  // Filter out data entries older than 3 days
  const now = Date.now();
  currentData = currentData.filter((entry) => {
    const entryTime = convertTimestampToMilliseconds(entry.timestamp);
    return now - entryTime <= threeDaysInMilliseconds;
  });

  // Add new data to the array
  currentData.push(data);

  // Write updated data back to file
  fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));

  // console.log(`Data for device ${deviceID} saved locally at ${filePath}`);
}

// Function for recording truck data as it comes in
function recordTruckData(
  deviceID,
  batteryV1,
  batteryV2,
  deviceStatusInput,
  latitude,
  longitude,
  callback,
) {
  // <========== Validate Variables ==========>
  // Make sure deviceID is present
  if (!deviceID || deviceID.trim() === '') {
    callback('deviceID is required');
  }

  // Make sure deviceID is alphanumeric
  if (!/^[A-Za-z0-9]+$/.test(deviceID)) {
    callback('deviceID format is invalid');
  }

  // Make sure batteryV1 is present and is a float
  if (!batteryV1 || Number.isNaN(parseFloat(batteryV1))) {
    callback('batteryV1 must be a valid float value');
  }

  // Make sure batteryV2 is present and is a float
  if (!batteryV2 || Number.isNaN(parseFloat(batteryV2))) {
    callback('batteryV2 must be a valid float value');
  }

  // Make sure status is present
  if (!deviceStatusInput) {
    callback('Please provide device status');
  }

  // Make sure latitude is present and is a float
  if (!latitude || Number.isNaN(parseFloat(latitude))) {
    callback('latitude must be a valid float value');
  }

  // Make sure longitude is present and is a float
  if (!longitude || Number.isNaN(parseFloat(longitude))) {
    callback('longitude must be a valid float value');
  }

  // Make sure batteryV1 format makes sense
  const batteryV1Float = parseFloat(batteryV1);
  if (batteryV1Float < 0 || batteryV1Float > 100) {
    callback('batteryV1 must be between 0 and 100');
  }

  // Make sure batteryV2 format makes sense
  const batteryV2Float = parseFloat(batteryV2);
  if (batteryV2Float < 0 || batteryV2Float > 100) {
    callback('batteryV2 must be between 0 and 100');
  }

  // Make sure latitude format makes sense
  const latitudeFloat = parseFloat(latitude);
  if (latitudeFloat < -90 || latitudeFloat > 90) {
    callback('latitude must be between -90 and 90');
  }

  // Make sure longitude format makes sense
  const longitudeFloat = parseFloat(longitude);
  if (longitudeFloat < -180 || longitudeFloat > 180) {
    callback('longitude must be between -180 and 180');
  }

  // <========== Record Data ==========>
  const mostRecentData = {
    lastTimestamp: Timestamp.fromDate(new Date()),
    lastBatteryV1: batteryV1Float,
    lastBatteryV2: batteryV2Float,
    lastDeviceStatus: deviceStatusInput,
    lastLocation: new GeoPoint(latitudeFloat, longitudeFloat),
  };

  const data = {
    timestamp: Timestamp.fromDate(new Date()),
    batteryV1: batteryV1Float,
    batteryV2: batteryV2Float,
    deviceStatus: deviceStatusInput,
    location: new GeoPoint(latitudeFloat, longitudeFloat),
  };

  const deviceRef = db
    .collection('deviceLogs')
    .doc(deviceID);

  const deviceLogRef = db
    .collection('deviceLogs')
    .doc(deviceID)
    .collection('logs');

  deviceRef.set(mostRecentData).then(() => {
    deviceLogRef
      .add(data)
      .then(() => {
        logger.info('Data saved to Firestore successfully');
        callback('success');

        // <========== Save incomming data to local cache ==========>
        saveDataToLocalCache(deviceID, data);

        // <========== Check Incomming Data ==========>

        checkRegularRoutesFunction(deviceID);
      })
      .catch((error) => {
        logger.error('Failed to save data to Firestore', error);
        callback('Failed to save data to Firestore');
      });
    return null;
  }).catch((error) => {
    logger.error('Failed to save data to Firestore', error);
    callback('Failed to save data to Firestore');
  });
}

module.exports = { recordTruckData };
