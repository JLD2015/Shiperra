const fs = require('fs').promises;
const fs2 = require('fs');
const path = require('path');
const ss = require('simple-statistics');
const sendPushNotification = require('./sendPushNotification');

const distanceThreshold = 10;
const triggersFilePath = path.join(__dirname, '..', 'data', 'triggers.json');

function calculateDistance(coord1, coord2) {
  const earthRadius = 6371; // Radius of the Earth in kilometers
  const toRadians = (angle) => (angle * Math.PI) / 180;
  const { latitude: lat1, longitude: lon1 } = coord1;
  const { latitude: lat2, longitude: lon2 } = coord2;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;
  return distance;
}

async function writeTriggersFile(data) {
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(triggersFilePath, jsonContent, 'utf-8');
  } catch (error) {
    throw new Error(`Error writing triggers file: ${error.message}`);
  }
}

async function readTriggersFile() {
  try {
    try {
      const fileContent = await fs.readFile(triggersFilePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const initialTriggers = { locationTriggers: {}, batteryTriggers: {} };
        await writeTriggersFile(initialTriggers);
        return initialTriggers;
      }
      throw new Error(`Error reading triggers file: ${error.message}`);
    }
  } catch (error) {
    throw new Error(`Error reading triggers file: ${error.message}`);
  }
}

function readDataFromLocalCache(deviceID) {
  const rootDir = 'data';
  const cacheDir = 'cache';

  // Construct the path to our cache directory
  const fullPath = path.join(__dirname, '..', rootDir, cacheDir);

  const filePath = path.join(fullPath, `${deviceID}.json`);

  // If the file doesn't exist, return an empty array or a relevant message
  if (!fs2.existsSync(filePath)) {
    console.error(`No data found for device ${deviceID} at ${filePath}`);
    return [];
  }

  // Read and parse the data from the file
  const data = JSON.parse(fs2.readFileSync(filePath, 'utf-8'));
  return data;
}

async function monitorMetrics(registration) {
  // Load the truck's metrics for the last 3 days
  const deviceData = readDataFromLocalCache(registration);

  // Extract the voltages and locations arrays
  const coordinatesArray = deviceData.map((entry) => ({
    /* eslint no-underscore-dangle: 0 */
    latitude: entry.location._latitude,
    longitude: entry.location._longitude,
  }));

  const voltagesArray = deviceData.map((entry) => ({
    batteryV1: entry.batteryV1,
    batteryV2: entry.batteryV2,
  }));

  // Make sure the latest coordinates are on a recognised route
  const latestCoordinate = coordinatesArray.pop();

  const isOnRoute = coordinatesArray.some((coordinate) => {
    const distance = calculateDistance(coordinate, latestCoordinate);
    return distance <= distanceThreshold;
  });

  if (!isOnRoute) {
    const currentTime = Date.now();
    const triggers = await readTriggersFile();
    const lastLocationTriggerTime = triggers.locationTriggers[registration] || 0;

    if (currentTime - lastLocationTriggerTime > 12 * 60 * 60 * 1000) {
      sendPushNotification(registration, 'Location Warning', `Truck ${registration} is on a new route.`);
      triggers.locationTriggers[registration] = currentTime;
      await writeTriggersFile(triggers);
    }
  }

  const batteryV1Voltages = voltagesArray.map((voltages) => voltages.batteryV1);
  const batteryV2Voltages = voltagesArray.map((voltages) => voltages.batteryV2);
  const lastBatteryV1Voltage = batteryV1Voltages.pop();
  const lastBatteryV2Voltage = batteryV2Voltages.pop();

  if (batteryV1Voltages.length > 30) {
    const meanV1 = ss.mean(batteryV1Voltages);
    const standardDeviationV1 = ss.standardDeviation(batteryV1Voltages);
    const meanV2 = ss.mean(batteryV2Voltages);
    const standardDeviationV2 = ss.standardDeviation(batteryV2Voltages);

    if (
      lastBatteryV1Voltage < meanV1 - 0.5 * standardDeviationV1
      || lastBatteryV1Voltage > meanV1 + 0.5 * standardDeviationV1
      || lastBatteryV2Voltage < meanV2 - 0.5 * standardDeviationV2
      || lastBatteryV2Voltage > meanV2 + 0.5 * standardDeviationV2
    ) {
      const currentTime = Date.now();
      const triggers = await readTriggersFile();
      const lastBatteryTriggerTime = triggers.batteryTriggers[registration] || 0;

      if (currentTime - lastBatteryTriggerTime > 12 * 60 * 60 * 1000) {
        sendPushNotification(registration, 'Battery Warning', `Truck ${registration} has a possible battery fault. The current battery voltages are ${lastBatteryV1Voltage}V and ${lastBatteryV2Voltage}V.`);
        triggers.batteryTriggers[registration] = currentTime;
        await writeTriggersFile(triggers);
      }
    }
  }
}

module.exports = monitorMetrics;
