const sendWhatsAppMessage = require('./sendWhatsAppMessage');

function contactHelp(issue, clientNumber, callback) {
  // Extract phone number
  let cleanedNumber = '';
  const numberRegex = /(\+\d+)/; // Regular expression to match the number including "+"

  const match = numberRegex.exec(clientNumber);
  if (match && match[1]) {
    const extractedNumber = match[1];
    cleanedNumber = extractedNumber;
  } else {
    console.log('No number found.');
  }

  // We want to send a WhatsApp message to the owner asking them to provide assistance
  sendWhatsAppMessage(
    process.env.OWNER_CELLPHONE_NUMBER,
    process.env.TWILIO_PHONE_NUMBER,
    `${issue}, they can be reached at: ${cleanedNumber}`,
    'John Doe',
  );

  const message = "I have sent a message to a member of our team and told them that you need help. They'll get back to you shortly.";
  callback(message);
}

module.exports = contactHelp;
