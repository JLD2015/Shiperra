const { google } = require("googleapis");
const moment = require("moment");
const fs = require("fs");
const serviceAccountKey = JSON.parse(fs.readFileSync("calendarServiceAccountKey.json"));

function convertDateTimeFormat(date, time) {
  // Parse the date and time using Moment.js
  const parsedDate = moment(date, "DD/MM/YYYY");
  const parsedTime = moment(time, "HH:mm");

  // Format the date and time to the desired format
  const formattedDate = parsedDate.format("YYYY-MM-DD");
  const formattedTime = parsedTime.format("HH:mm:ss");

  // Combine the formatted date and time
  const dateTimeString = `${formattedDate}T${formattedTime}`;

  return dateTimeString;
}

function addMinutesToTimeString(timeString, minutesToAdd) {
  // Create a date object with the current date and the provided time string
  const currentDate = moment().format("YYYY-MM-DD");
  const dateTimeString = `${currentDate} ${timeString}`;
  const dateTimeFormat = "YYYY-MM-DD HH:mm";
  const dateTime = moment(dateTimeString, dateTimeFormat);

  // Add minutes to the date-time
  const modifiedDateTime = dateTime.add(minutesToAdd, "minutes");

  // Format the modified date-time to extract the time string
  const modifiedTime = modifiedDateTime.format("HH:mm");

  return modifiedTime;
}

// Google calendar API settings
const calendar = google.calendar({ version: "v3" });

const jwtClient = new google.auth.JWT(
  serviceAccountKey.client_email,
  null,
  serviceAccountKey.private_key,
  ["https://www.googleapis.com/auth/calendar"]
);

function makeAppointment(date, time, description, callback) {
  const endTime = addMinutesToTimeString(time, 30);
  const startTimeString = convertDateTimeFormat(date, time);
  const endTimeString = convertDateTimeFormat(date, endTime);

  console.log("Making appointment");
  console.log(startTimeString);
  console.log(endTimeString);

  jwtClient.authorize((err, tokens) => {
    if (err) {
      console.error("Authorization error:", err);
      return;
    }

    // Create the event to be inserted into the calendar
    const event = {
      summary: "Booking",
      start: {
        dateTime: startTimeString,
        timeZone: "Africa/Johannesburg",
      },
      end: {
        dateTime: endTimeString,
        timeZone: "Africa/Johannesburg",
      },
      description: description,
    };

    // Insert the event into the calendar
    calendar.events.insert(
      {
        auth: jwtClient,
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: event,
      },
      function (error, response) {
        if (error) {
          console.log(error);
          callback("I couldn't create an appointment, please try again.");
        } else {
          callback("I have created an appointment for you.");
        }
      }
    );
  });
}

module.exports = makeAppointment;
