const express = require("express");
const mongoose = require("mongoose");

const { getVersion } = require("../lib/version");

const router = express.Router();

router.get("/", (_req, res) => {
  // readyState 1 = connected
  const mongoConnected = mongoose.connection.readyState === 1;
  res.status(mongoConnected ? 200 : 503).json({
    status: mongoConnected ? "ok" : "error",
    service: "taskhub-realtime",
    version: getVersion(),
    mongo: mongoConnected ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

module.exports = router;
