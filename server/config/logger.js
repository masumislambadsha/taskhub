const pino = require("pino");

// JSON logs to stdout. Never log message contents; user and room IDs are fine.
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "realtime" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      "authorization",
      "cookie",
      "headers.authorization",
      "headers.cookie",
      "*.headers.authorization",
      "*.headers.cookie",
      "password",
      "token",
      "otp",
      "secret",
      "*.password",
      "*.token",
      "*.otp",
      "*.secret",
    ],
    censor: "[Redacted]",
  },
});

module.exports = logger;
