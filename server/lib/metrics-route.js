const crypto = require("node:crypto");

/**
 * Express handler for GET /metrics. Disabled (404) unless METRICS_TOKEN is set,
 * and then it needs that token as a Bearer token.
 */
function metricsRoute(registry) {
  return async (req, res) => {
    const token = process.env.METRICS_TOKEN;
    if (!token) return res.status(404).end();
    const header = req.get("authorization") || "";
    const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    const want = Buffer.from(token);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return res.status(401).end();
    res.set("Content-Type", registry.contentType).send(await registry.metrics());
  };
}

module.exports = { metricsRoute };
