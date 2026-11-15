const express = require("express");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", (_req, res) => {
  // readyState 1 = connected
  const mongoConnected = mongoose.connection.readyState === 1;
  res.status(mongoConnected ? 200 : 503).json({
    status: mongoConnected ? "ok" : "error",
    service: "taskhub-realtime",
    mongo: mongoConnected ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

module.exports = router;
