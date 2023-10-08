const express = require('express');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
// eslint-disable-next-line
const { GeoPoint } = require('firebase-admin/firestore');
const checkRegularRoutesFunction = require('../functions/monitorMetrics');
const firebaseAdmin = require('../firebase/firebase');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
  ],
});

const router = express.Router();

const db = firebaseAdmin.firestore();

function handleError(res, statusCode, message) {
  logger.error(message);
  res.status(statusCode).json({ error: message });
}

router.get('/', (req, res) => {
  res.send('Trucks API is live');
});

// HTTPS method for getting truck location history
// Utility function to extract GeoPoints from data
const extractGeoPoints = (inputData) => inputData.map((entry) => new GeoPoint(
  /* eslint no-underscore-dangle: 0 */
  entry.location._latitude,
  entry.location._longitude,
));

router.get('/getroutehistory', async (req, res) => {
  const { deviceID } = req.query;

  // Validate the deviceID
  if (!deviceID || typeof deviceID !== 'string') {
    return res.status(400).json({ error: 'Invalid deviceID provided.' });
  }

  // Construct paths for cache directory and target file
  const rootDir = 'data';
  const cacheDir = 'cache';
  const fullPath = path.join(__dirname, '..', rootDir, cacheDir);
  const filePath = path.join(fullPath, `${deviceID}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      console.error(`No data found for device ${deviceID} at ${filePath}`);
      return res.status(404).json({ error: `No data found for device ${deviceID}` });
    }

    // Read and parse the data from the file
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    // Extract GeoPoints and return them
    const geoPoints = extractGeoPoints(data);
    return res.json(geoPoints);
  } catch (error) {
    console.error(`Error retrieving data for device ${deviceID}: ${error.message}`);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// HTTPS method for recording truck data
router.post('/record', (req, res) => {
  const {
    deviceID,
    batteryV1,
    batteryV2,
    latitude,
    longitude,
  } = req.body;

  if (!deviceID || deviceID.trim() === '') {
    return handleError(res, 400, 'deviceID is required');
  }

  if (!/^[A-Za-z0-9]+$/.test(deviceID)) {
    return handleError(res, 400, 'deviceID format is invalid');
  }

  if (!batteryV1 || Number.isNaN(parseFloat(batteryV1))) {
    return handleError(res, 400, 'batteryV1 must be a valid float value');
  }

  if (!batteryV2 || Number.isNaN(parseFloat(batteryV2))) {
    return handleError(res, 400, 'batteryV2 must be a valid float value');
  }

  if (!latitude || Number.isNaN(parseFloat(latitude))) {
    return handleError(res, 400, 'latitude must be a valid float value');
  }

  if (!longitude || Number.isNaN(parseFloat(longitude))) {
    return handleError(res, 400, 'longitude must be a valid float value');
  }

  const batteryV1Float = parseFloat(batteryV1);
  if (batteryV1Float < 0 || batteryV1Float > 100) {
    return handleError(res, 400, 'batteryV1 must be between 0 and 100');
  }

  const batteryV2Float = parseFloat(batteryV2);
  if (batteryV2Float < 0 || batteryV2Float > 100) {
    return handleError(res, 400, 'batteryV2 must be between 0 and 100');
  }

  const latitudeFloat = parseFloat(latitude);
  if (latitudeFloat < -90 || latitudeFloat > 90) {
    return handleError(res, 400, 'latitude must be between -90 and 90');
  }

  const longitudeFloat = parseFloat(longitude);
  if (longitudeFloat < -180 || longitudeFloat > 180) {
    return handleError(res, 400, 'longitude must be between -180 and 180');
  }

  const data = {
    timestamp: new Date().toISOString(),
    batteryV1: batteryV1Float,
    batteryV2: batteryV2Float,
    latitude: latitudeFloat,
    longitude: longitudeFloat,
  };

  const deviceLogRef = db
    .collection('deviceLogs')
    .doc(deviceID)
    .collection('logs');

  deviceLogRef
    .add(data)
    .then(() => {
      logger.info('Data saved to Firestore successfully');
      res.send('Data saved to Firestore successfully');

      // Every time new data comes in we must check whether the truck is on an unrecognised route
      checkRegularRoutesFunction(deviceID);
    })
    .catch((error) => {
      logger.error('Failed to save data to Firestore', error);
      handleError(res, 500, 'Failed to save data to Firestore');
    });
  return null;
});

router.use((err, req, res) => {
  logger.error('An unexpected error occurred');
  handleError(res, 500, 'An unexpected error occurred');
});

module.exports = router;
