// k6 "browse" scenario: read-heavy public traffic through Nginx.
//   docker compose --profile loadtest run --rm k6 run /load/browse.js
// Override the target with BASE_URL, and the peak with PEAK_VUS.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://nginx";
const PEAK = Number(__ENV.PEAK_VUS || 100);
const WORDS = ["write", "review", "translate", "survey", "photo", "data", "test", "video"];
const CATEGORIES = ["Writing", "Design", "Data Entry", "Testing"];

export const options = {
  // Ramp up until errors or p95 break the thresholds; the last stage that passed is the sustainable load.
  stages: [
    { duration: "30s", target: Math.round(PEAK / 4) },
    { duration: "1m", target: Math.round(PEAK / 2) },
    { duration: "1m", target: PEAK },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300"],
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function () {
  const page = 1 + Math.floor(Math.random() * 20);
  const list = http.get(`${BASE}/api/v1/tasks?page=${page}&limit=12`, { tags: { name: "task-list" } });
  check(list, { "list 200": (r) => r.status === 200 });

  const found = http.get(`${BASE}/api/v1/tasks?search=${pick(WORDS)}`, { tags: { name: "task-search" } });
  check(found, { "search 200": (r) => r.status === 200 });

  const filtered = http.get(`${BASE}/api/v1/tasks?category=${encodeURIComponent(pick(CATEGORIES))}&minPayout=10`, {
    tags: { name: "task-filter" },
  });
  check(filtered, { "filter 200": (r) => r.status === 200 });

  const tasks = list.status === 200 ? list.json("tasks") : [];
  if (tasks && tasks.length) {
    const t = pick(tasks);
    const detail = http.get(`${BASE}/api/v1/tasks/${t._id}`, { tags: { name: "task-detail" } });
    check(detail, { "detail 200": (r) => r.status === 200 });
  }
  sleep(1 + Math.random() * 2);
}
