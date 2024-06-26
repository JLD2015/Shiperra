const express = require('express');
const mqtt = require('mqtt');
const { recordTruckData } = require('../functions/recordTruckData');

const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

// Establish MQTT connection
const clientId = 'shiperra_server';
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

// Create the client
const client = mqtt.connect('mqtt://mqtt.shiperra.com:1883', {
  clientId,
  username,
  password,
  // ...other options
});

// Subscribe to the trucks topic
const qos = 0;

client.subscribe('/trucks/record', { qos }, (error) => {
  if (error) {
    console.log('MQTT startup failed');
    console.log('subscribe error:', error);
    return;
  }
  console.log('MQTT connected');
  console.log('Subscribe to topic \'/trucks/record\'');
});

client.on('message', (topic, payload) => {
  // Parse data
  if (topic === '/trucks/record') {
    const data = JSON.parse(payload.toString());
    const {
      ID, bat1, bat2, st, lat, long,
    } = data;
    recordTruckData(ID, bat1, bat2, st, lat, long, (status) => {
      // Respond with status
      const replyTopic = '/trucks/record/response';
      const replyPayload = status;
      const replyQos = 0;

      client.publish(replyTopic, replyPayload, { replyQos }, (error) => {
        if (error) {
          console.error(error);
        }
      });
      console.log(status);
    });
  }
});

module.exports = router;
