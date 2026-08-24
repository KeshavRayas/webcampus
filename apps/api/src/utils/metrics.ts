import type { NextFunction, Request, Response } from "express";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  register,
} from "prom-client";

collectDefaultMetrics({ prefix: "node_" });

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

function resolveRoute(req: Request): string {
  const routePath = req.route?.path ?? req.baseUrl;
  if (!routePath) return "unmatched";
  return req.baseUrl ? `${req.baseUrl}${routePath}` : String(routePath);
}

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.path === "/metrics") return next();

  const endTimer = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = resolveRoute(req);
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    endTimer(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}

export async function renderMetrics(): Promise<string> {
  return register.metrics();
}

export { register, contentType as metricsContentType } from "prom-client";
