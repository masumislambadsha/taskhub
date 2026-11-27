import client from "prom-client";
import type { Queue } from "bullmq";
import Outbox from "@/models/Outbox";

/**
 * Metrics for the worker, served on its internal health port at /metrics.
 * Queue depth, the age of the oldest waiting job and the outbox backlog are read
 * when Prometheus scrapes, so they are never stale.
 */
export function createWorkerMetrics(getQueue: () => Queue | null) {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: "worker" });
  client.collectDefaultMetrics({ register: registry });

  new client.Gauge({
    name: "taskhub_queue_jobs",
    help: "Jobs in the queue by state",
    labelNames: ["queue", "state"] as const,
    registers: [registry],
    async collect() {
      const queue = getQueue();
      if (!queue) return;
      const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
      for (const [state, n] of Object.entries(counts)) this.set({ queue: queue.name, state }, n);
    },
  });

  new client.Gauge({
    name: "taskhub_queue_oldest_waiting_seconds",
    help: "Age of the oldest job waiting to run (0 when none)",
    labelNames: ["queue"] as const,
    registers: [registry],
    async collect() {
      const queue = getQueue();
      if (!queue) return;
      // BullMQ lists waiting jobs newest first, so the oldest is the last one.
      const waiting = await queue.getJobCountByTypes("waiting");
      const job = waiting > 0 ? (await queue.getWaiting(waiting - 1, waiting - 1))[0] : undefined;
      this.set({ queue: queue.name }, job ? Math.max(0, (Date.now() - job.timestamp) / 1000) : 0);
    },
  });

  new client.Gauge({
    name: "taskhub_outbox_pending",
    help: "Outbox messages waiting to be delivered",
    registers: [registry],
    async collect() {
      this.set(await Outbox.countDocuments({ status: "pending" }));
    },
  });
  new client.Gauge({
    name: "taskhub_outbox_oldest_pending_seconds",
    help: "Age of the oldest pending outbox message (0 when none)",
    registers: [registry],
    async collect() {
      const oldest = await Outbox.findOne({ status: "pending" }).sort({ createdAt: 1 }).select("createdAt").lean();
      this.set(oldest ? Math.max(0, (Date.now() - oldest.createdAt.getTime()) / 1000) : 0);
    },
  });

  return registry;
}
