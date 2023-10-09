const winston = require('winston');
// eslint-disable-next-line
const { Timestamp, GeoPoint, FieldValue } = require('firebase-admin/firestore');
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

// <========== Get the last timestamp from the cache ==========>
function convertFirebaseTimestampToDate(timestamp) {
  const milliseconds = (timestamp._seconds * 1000) + (timestamp._nanoseconds / 1000000);
  return new Date(milliseconds);
}

function getLastTimestampFromLocalCache(deviceID) {
  const rootDir = 'data';
  const cacheDir = 'cache';

  // Construct the path to our cache directory
  const fullPath = path.join(__dirname, '..', rootDir, cacheDir);
  const filePath = path.join(fullPath, `${deviceID}.json`);

  // If file exists, read the data from the file
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (data.length > 0) {
      // Get the last entry's timestamp
      const lastSavedTimestampObject = data[data.length - 1].timestamp;
      const lastSavedTimestamp = convertFirebaseTimestampToDate(lastSavedTimestampObject);

      return lastSavedTimestamp;
    }
  }

  return null; // Return null if no timestamp is found
}
// <==========>

// Function for recording truck data as it comes in
async function recordTruckData(
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

  // Add a recent route point every 5 minutes
  const lastSavedTimestamp = getLastTimestampFromLocalCache(deviceID);

  const currentTime = new Date();

  // Check if 5 minutes have passed
  if (lastSavedTimestamp) {
    const differenceInMinutes = (currentTime - lastSavedTimestamp) / 60000;

    if (differenceInMinutes > 5) {
      // Get the current routeHistory object
      const snapshot = await deviceRef.get();
      if (snapshot.empty) {
        console.log('No matching documents.');
        return;
      }
      const { routeHistory } = snapshot.data();

      const routeHistoryNew = routeHistory;

      // If route history doesnt exist yet
      if (routeHistoryNew === undefined) {
        await deviceRef.update({
          routeHistory: [new GeoPoint(latitudeFloat, longitudeFloat)],
        });
        // If it does exist we need to append the array
      } else {
        // We need to remove the first item from the array if it is too long
        if (routeHistoryNew.length > 288) {
          routeHistoryNew.shift();
          routeHistoryNew.push(new GeoPoint(latitudeFloat, longitudeFloat));
        // Else we just add the data to the array
        } else {
          routeHistoryNew.push(new GeoPoint(latitudeFloat, longitudeFloat));
        }

        // We need to update the data on Firebase
        await deviceRef.update({
          routeHistory: routeHistoryNew,
        });
      }
    }
  }

  // Update all Firebase values
  deviceRef.update(
    {
      lastTimestamp: Timestamp.fromDate(new Date()),
      lastBatteryV1: batteryV1Float,
      lastBatteryV2: batteryV2Float,
      lastDeviceStatus: deviceStatusInput,
      lastLocation: new GeoPoint(latitudeFloat, longitudeFloat),
    },
  ).then(() => {
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
