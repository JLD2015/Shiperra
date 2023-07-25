const admin = require('firebase-admin');
const { Client } = require('@googlemaps/google-maps-services-js');
const winston = require('winston');

const db = admin.firestore();
const client = new Client({ apiKey: process.env.GOOGLE_MAPS_API_KEY });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple(),
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

const getUserByPhoneNumber = async (phoneNumber) => {
  const usersRef = db.collection('users');
  const query = usersRef.where('phoneNumber', '==', phoneNumber);
  const snapshot = await query.get();

  if (snapshot.empty) {
    const errorMessage = 'User not found for the provided phone number.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return snapshot.docs[0].data();
};

const getLatestDeviceLog = async (registrationNumber) => {
  const deviceLogsRef = db
    .collection('deviceLogs')
    .doc(registrationNumber)
    .collection('logs');

  const snapshot = await deviceLogsRef
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    const errorMessage = 'No device logs available for the truck.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return snapshot.docs[0].data();
};

const reverseGeocode = async ({ latitude, longitude }) => {
  const reverseGeocodeRequest = {
    params: {
      latlng: `${latitude},${longitude}`,
      key: process.env.GOOGLE_MAPS_API_KEY,
    },
  };

  try {
    const response = await client.geocode(reverseGeocodeRequest);
    const { results } = response.data;

    if (results.length === 0) {
      const errorMessage = "Unable to determine the truck's location.";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    return results[0];
  } catch (error) {
    logger.error('Error getting reverse geocode:', error);
    throw error;
  }
};

const getDistanceToNearestTown = async (origin, destination) => {
  const distanceMatrixRequest = {
    params: {
      origins: [origin],
      destinations: [destination],
      key: process.env.GOOGLE_MAPS_API_KEY,
    },
  };

  try {
    const response = await client.distancematrix(distanceMatrixRequest);
    const results = response.data.rows[0].elements;

    if (results.length === 0) {
      const errorMessage = 'Unable to calculate the distance to the nearest town.';
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    return results[0].distance.text;
  } catch (error) {
    logger.error('Error getting distance to nearest town:', error);
    throw error;
  }
};

const formatTruckLocation = async ({ address, timestamp }) => {
  const nearestTown = address.address_components.find(
    (component) => component.types.includes('locality')
      && component.types.includes('political'),
  );

  const townName = nearestTown ? nearestTown.long_name : 'unknown town';

  try {
    const distance = await getDistanceToNearestTown(
      `${address.geometry.location.lat},${address.geometry.location.lng}`,
      townName,
    );

    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
    });

    return `Your truck was last seen near ${address.formatted_address} roughly ${distance} away from ${townName} at ${formattedTimestamp}`;
  } catch (error) {
    logger.error('Error formatting truck location:', error);
    throw error;
  }
};

const truckLocation = async (phoneNumber, registrationNumber, callback) => {
  try {
    if (!phoneNumber || !phoneNumber.match(/^whatsapp:\+\d{10,14}$/)) {
      const errorMessage = 'Invalid phone number format. Please provide a valid WhatsApp phone number.';
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!registrationNumber || typeof registrationNumber !== 'string') {
      const errorMessage = 'Invalid registration number. Please provide a valid truck registration number.';
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const cleanedPhoneNumber = phoneNumber.replace('whatsapp:', '');
    const user = await getUserByPhoneNumber(cleanedPhoneNumber);

    if (!user) {
      const errorMessage = "Sorry, your details couldn't be found in the system.";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!user.devices.includes(registrationNumber)) {
      const errorMessage = `Sorry, truck ${registrationNumber} is not registered to your phone number.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const deviceLog = await getLatestDeviceLog(registrationNumber);

    const address = await reverseGeocode(deviceLog);

    const formattedString = await formatTruckLocation({
      address,
      timestamp: deviceLog.timestamp,
    });

    callback(formattedString);
  } catch (error) {
    logger.error('Error executing truckLocation:', error);
    callback(error.message);
  }
};

module.exports = truckLocation;
