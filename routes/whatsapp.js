const express = require('express');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { Configuration, OpenAIApi } = require('openai');
const winston = require('winston');
const openAiMessages = require('../openAiConfig/messages');
const openAiFunctions = require('../openAiConfig/functions');
const { sendWhatsAppMessage } = require('../functions/sendWhatsAppMessage');
const truckLocationFunction = require('../functions/truckLocation');
const truckBatteryLevelsFunction = require('../functions/truckBatteryLevels');
const contactHelpFunction = require('../functions/contactHelp');
const makeAppointmentFunction = require('../functions/makeAppointment');

// Configure Winston logger
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: 'logs.log' }),
  ],
});

// Whatsapp and Conversation Histories configuration
const configuration = new Configuration({
  organization: process.env.OPENAI_ORGANISATION,
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const conversationHistoriesFilePath = path.join(__dirname, '..', 'data', 'conversationHistories.json');

let conversationHistories;

function readConversationHistories() {
  try {
    if (fs.existsSync(conversationHistoriesFilePath)) {
      const data = fs.readFileSync(conversationHistoriesFilePath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (err) {
    logger.error('Failed to read conversation histories');
    throw err;
  }
}

try {
  conversationHistories = readConversationHistories();
} catch (err) {
  logger.error('Error reading conversation histories:', err);
  process.exit(1);
}

function saveConversationHistory(sender, message, responseMessage) {
  const conversationHistory = conversationHistories[sender] || [];
  conversationHistory.push({ role: 'user', content: message });
  conversationHistory.push({ role: 'assistant', content: responseMessage });

  // Keep only the 5 most recent user messages
  const userMessages = conversationHistory.filter(
    (item) => item.role === 'user',
  );
  const recentUserMessages = userMessages.slice(-5);

  // Update conversationHistories object with recent user messages and save it to file
  conversationHistories[sender] = recentUserMessages;

  try {
    fs.writeFileSync(
      conversationHistoriesFilePath,
      JSON.stringify(conversationHistories),
      'utf8',
    );
    logger.info('Conversation histories saved to file.');
  } catch (err) {
    logger.error('Error saving conversation histories:', err);
  }
}

function handleGpt4Function(
  functionCallName,
  completionArguments,
  sender,
  recipient,
  message,
) {
  if (functionCallName === 'truckLocation') {
    truckLocationFunction(
      sender,
      completionArguments.registrationNumber,
      (responseMessage) => {
        saveConversationHistory(sender, message, responseMessage);
        logger.info(responseMessage);
        sendWhatsAppMessage(sender, recipient, responseMessage, 'John Doe');
      },
      (error) => {
        logger.error('Error in truckLocationFunction:', error);
      },
    );
  } else if (functionCallName === 'truckBatteryLevels') {
    truckBatteryLevelsFunction(
      sender,
      completionArguments.registrationNumber,
      (responseMessage) => {
        saveConversationHistory(sender, message, responseMessage);
        sendWhatsAppMessage(sender, recipient, responseMessage, 'John Doe');
      },
      (error) => {
        logger.error('Error in truckBatteryLevelsFunction:', error);
      },
    );
  } else if (functionCallName === 'contactHelp') {
    contactHelpFunction(
      completionArguments.issue,
      sender,
      (responseMessage) => {
        saveConversationHistory(sender, message, responseMessage);
        sendWhatsAppMessage(sender, recipient, responseMessage, 'John Doe');
      },
      (error) => {
        logger.error('Error in contactHelpFunction:', error);
      },
    );
  } else if (functionCallName === 'makeAppointment') {
    makeAppointmentFunction(
      completionArguments.date,
      completionArguments.time,
      completionArguments.description,
      (responseMessage) => {
        saveConversationHistory(sender, message, responseMessage);
        sendWhatsAppMessage(sender, recipient, responseMessage, 'John Doe');
      },
      (error) => {
        logger.error('Error in makeAppointmentFunction:', error);
      },
    );
  }
}

/* Routes */

const router = express.Router();

router.get('/', (req, res) => {
  res.send('WhatsApp API is live');
});

router.post(
  '/receivemessage',
  [
    body('Body').notEmpty().trim().withMessage('Message body is required'),
    body('From').notEmpty().trim().withMessage('Sender is required'),
    body('To').notEmpty().trim().withMessage('Recipient is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const message = req.body.Body;
    const sender = req.body.From;
    const recipient = req.body.To;

    // Get the current date and time
    const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ss');

    // Include the current date and time in the user's message
    const userMessage = `Current date and time: ${currentDateTime}\n${message}`;

    try {
      // Send the message to GPT4 to generate a response
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo-0613',
        messages: [
          ...openAiMessages,
          ...(conversationHistories[sender] || []),
          { role: 'user', content: userMessage },
        ],
        functions: [...openAiFunctions],
        function_call: 'auto',
      });

      // Send a response
      const response = completion.data.choices[0].message;

      if (!response.content) {
        // If a function is triggered then the chatGPT response has no content
        const functionCallName = response.function_call.name;
        const completionArguments = JSON.parse(response.function_call.arguments);
        handleGpt4Function(
          functionCallName,
          completionArguments,
          sender,
          recipient,
          message,
        );
      } else {
        // If a function was not triggered
        saveConversationHistory(sender, message, response.content);
        sendWhatsAppMessage(sender, recipient, response.content, 'John Doe');
      }

      res.send('Message received');
    } catch (err) {
      logger.error('Error processing message:', err);
      res.status(500).json({ error: 'An error occurred while processing the message' });
    }
    return null;
  },
);

module.exports = router;
