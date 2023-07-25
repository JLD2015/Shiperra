require('dotenv').config();
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var trucksRouter = require("./routes/trucks");
var whatsappRouter = require("./routes/whatsapp");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/trucks", trucksRouter);
app.use("/whatsapp", whatsappRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// <========== Interval Functions ==========>
const sendWhatsAppMessage = require("./functions/sendWhatsAppMessage");

// Usage example
const recipientNumber = "whatsapp:+27825520646"; // Recipient's WhatsApp number
const twilioNumber = process.env.TWILIO_PHONE_NUMBER; // Your Twilio WhatsApp number
const messageBody = "Server has restarted";
const clientName = "Marceau"; // Client's name

//sendWhatsAppMessage(recipientNumber, twilioNumber, messageBody, clientName);

module.exports = app;
