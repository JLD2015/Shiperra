const winston = require('winston');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

// Configure the Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`),
  ),
  transports: [
    new winston.transports.Console(),
    // Add additional transports as per production requirements
  ],
});
function truckInUnknownLocation(registration) {
  return new Promise((resolve, reject) => {
    client.messages
      .create({
        body: `Location Warning: Truck ${registration} is on a new route.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.OWNER_CELLPHONE_NUMBER,
      })
      .then((message) => {
        logger.info('WhatsApp template message sent:', { sid: message.sid });
        resolve();
      })
      .catch((err) => {
        logger.error('Error sending WhatsApp message:', { error: err });
        reject(err);
      });
  });
}

function truckBatteryWarning(registration, V1, V2) {
  return new Promise((resolve, reject) => {
    client.messages
      .create({
        body: `Battery Warning: Truck ${registration} has a possible battery fault. The current battery voltages are ${V1}V and ${V2}V.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.OWNER_CELLPHONE_NUMBER,
      })
      .then((message) => {
        logger.info('WhatsApp template message sent:', { sid: message.sid });
        resolve();
      })
      .catch((err) => {
        logger.error('Error sending WhatsApp message:', { error: err });
        reject(err);
      });
  });
}

function sendWhatsAppMessage(to, from, body) {
  const numberRegex = /^whatsapp:\+\d{11}$/;

  if (!numberRegex.test(to) || !numberRegex.test(from)) {
    throw new Error('Invalid number format. Please provide the numbers in the format: whatsapp:+27825520646');
  }

  return new Promise((resolve, reject) => {
    client.messages
      .create({
        body,
        from, // Your Twilio WhatsApp number
        to, // Recipient's WhatsApp number
      })
      .then((message) => {
        logger.info('WhatsApp message sent:', { sid: message.sid });
        resolve();
      })
      .catch((err) => {
        logger.error('Error sending WhatsApp message:', { error: err });
        reject(err);
      });
  });
}

module.exports = {
  sendWhatsAppMessage,
  truckInUnknownLocation,
  truckBatteryWarning,
};
