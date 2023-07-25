const admin = require('firebase-admin');
const winston = require('winston');

const db = admin.firestore();

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

const truckBatteryLevels = async (phoneNumber, registrationNumber, callback) => {
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
  const { batteryV1, batteryV2 } = deviceLog; // Destructuring the battery voltage values
  callback(`Truck ${registrationNumber} currently has the following battery levels:\nBattery 1: ${batteryV1}V\nBattery 2: ${batteryV2}V`);
};

module.exports = truckBatteryLevels;
