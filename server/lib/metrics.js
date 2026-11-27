const client = require("prom-client");

/**
 * Prometheus metrics for a realtime instance. `registry.metrics()` is served at
 * GET /metrics (token-protected, see index.js).
 */
function createMetrics() {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: "realtime" });
  client.collectDefaultMetrics({ register: registry });

  const sockets = new client.Gauge({
    name: "taskhub_sockets_active",
    help: "Connected Socket.io clients on this instance",
    registers: [registry],
  });
  const connections = new client.Counter({
    name: "taskhub_socket_connections_total",
    help: "Socket connections accepted",
    registers: [registry],
  });
  const messages = new client.Counter({
    name: "taskhub_chat_messages_total",
    help: "Chat messages stored and delivered",
    registers: [registry],
  });
  const denied = new client.Counter({
    name: "taskhub_socket_denied_total",
    help: "Socket events refused, by reason",
    labelNames: ["reason"],
    registers: [registry],
  });
  const handlerErrors = new client.Counter({
    name: "taskhub_socket_errors_total",
    help: "Socket handlers that threw",
    registers: [registry],
  });

  return { registry, sockets, connections, messages, denied, handlerErrors };
}

module.exports = { createMetrics };
