const functions = [
  {
    name: "contactHelp",
    description:
      "If the user needs help you are not able to provide or wishes to talk to somebody, trigger this function.",
    parameters: {
      type: "object",
      properties: {
        issue: {
          type: "string",
          description:
            "The issue the user is facing. Return the value as follows: A client needs help with ... ",
        },
      },
      required: ["issue"],
    },
  },
  {
    name: "makeAppointment",
    description: "Schedules an a calendar appointment for the user.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "The date for which the user wishes to schedule the appointment. Return in the format dd/mm/yyyy.",
        },
        time: {
          type: "string",
          description:
            "The time the user wishes to schedule the appointment for. Return the time in 24h format.",
        },
        description: {
          type: "string",
          description:
            "The reason the user wishes to schedule the appointment.",
        },
      },
      required: ["date", "time", "description"],
    },
  },
  {
    name: "truckLocation",
    description: "Returns the current location of a truck to the user",
    parameters: {
      type: "object",
      properties: {
        registrationNumber: {
          type: "string",
          description:
            "The registration number of the truck that we want to find the location for, return only the registration number.",
        },
      },
      required: ["registrationNumber"],
    },
  },
  {
    name: "truckBatteryLevels",
    description:
      "Returns the current voltage and ampage of the truck's batteries and indicates what condition they are in",
    parameters: {
      type: "object",
      properties: {
        registrationNumber: {
          type: "string",
          description:
            "The registration number of the truck that we want to check the battery levels for, return only the registration number.",
        },
      },
      required: ["registrationNumber"],
    },
  },
];

module.exports = functions;
