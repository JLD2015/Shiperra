const winston = require('winston');
const { Timestamp, GeoPoint } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebase/firebase');

const db = firebaseAdmin.firestore();
const checkRegularRoutesFunction = require('./monitorMetrics');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
  ],
});

function recordTruckData(deviceID, batteryV1, batteryV2, latitude, longitude, callback) {
  if (!deviceID || deviceID.trim() === '') {
    callback('deviceID is required');
  }

  if (!/^[A-Za-z0-9]+$/.test(deviceID)) {
    callback('deviceID format is invalid');
  }

  if (!batteryV1 || Number.isNaN(parseFloat(batteryV1))) {
    callback('batteryV1 must be a valid float value');
  }

  if (!batteryV2 || Number.isNaN(parseFloat(batteryV2))) {
    callback('batteryV2 must be a valid float value');
  }

  if (!latitude || Number.isNaN(parseFloat(latitude))) {
    callback('latitude must be a valid float value');
  }

  if (!longitude || Number.isNaN(parseFloat(longitude))) {
    callback('longitude must be a valid float value');
  }

  const batteryV1Float = parseFloat(batteryV1);
  if (batteryV1Float < 0 || batteryV1Float > 100) {
    callback('batteryV1 must be between 0 and 100');
  }

  const batteryV2Float = parseFloat(batteryV2);
  if (batteryV2Float < 0 || batteryV2Float > 100) {
    callback('batteryV2 must be between 0 and 100');
  }

  const latitudeFloat = parseFloat(latitude);
  if (latitudeFloat < -90 || latitudeFloat > 90) {
    callback('latitude must be between -90 and 90');
  }

  const longitudeFloat = parseFloat(longitude);
  if (longitudeFloat < -180 || longitudeFloat > 180) {
    callback('longitude must be between -180 and 180');
  }

  // Record entry
  const mostRecentData = {
    lastTimestamp: Timestamp.fromDate(new Date()),
    lastBatteryV1: batteryV1Float,
    lastBatteryV2: batteryV2Float,
    lastLocation: new GeoPoint(latitudeFloat, longitudeFloat),
  };

  const data = {
    timestamp: Timestamp.fromDate(new Date()),
    batteryV1: batteryV1Float,
    batteryV2: batteryV2Float,
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

        // Every time new data comes in we must check whether the truck is on an unrecognised route
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
