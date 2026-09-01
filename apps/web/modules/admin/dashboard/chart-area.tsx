"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import * as React from "react";

const data = [
  { label: "Jan", workload: 34, trend: 40 },
  { label: "Feb", workload: 38, trend: 46 },
  { label: "Mar", workload: 52, trend: 50 },
  { label: "Apr", workload: 56, trend: 58 },
  { label: "May", workload: 68, trend: 66 },
  { label: "Jun", workload: 72, trend: 74 },
  { label: "Jul", workload: 82, trend: 78 },
  { label: "Aug", workload: 76, trend: 84 },
];
const ranges = { "90d": data, "30d": data.slice(-5), "7d": data.slice(-3) };
type RangeKey = keyof typeof ranges;

export function ChartAreaInteractive() {
  const [range, setRange] = React.useState<RangeKey>("90d");
  const values = ranges[range];
  const points = values.map((item, index) => ({
    ...item,
    x: values.length === 1 ? 330 : 40 + (index / (values.length - 1)) * 580,
    y: 190 - item.trend * 1.55,
  }));
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const area = `${line} L ${lastPoint?.x ?? 620},190 L ${firstPoint?.x ?? 40},190 Z`;

  return (
    <Card className="admin-dashboard-chart @container/card">
      <CardHeader>
        <div>
          <CardTitle>Campus activity</CardTitle>
          <CardDescription>
            People, systems, and academic operations
          </CardDescription>
        </div>
        <CardAction>
          <Select
            value={range}
            onValueChange={(value) => setRange(value as RangeKey)}
          >
            <SelectTrigger className="w-40" aria-label="Select a time range">
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="gap 8 grid lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.6fr)] lg:items-center">
          <section className="admin-ring-panel">
            <div className="admin-chart-kicker">Operational coverage</div>
            <div className="admin-ring-wrap">
              <div className="admin-ring-visual">
                <div className="admin-ring-center">
                  <strong>68%</strong>
                  <span>overall</span>
                </div>
              </div>
            </div>
            <div className="admin-ring-legend">
              <span>
                <i className="admin-legend-dot opacity-30" />
                Students <b>82%</b>
              </span>
              <span>
                <i className="admin-legend-dot opacity-55" />
                Faculty <b>68%</b>
              </span>
              <span>
                <i className="admin-legend-dot" />
                Systems <b>54%</b>
              </span>
            </div>
          </section>
          <section className="admin-composed-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="admin-chart-kicker">Activity trend</div>
                <p className="text-muted-foreground mt-1 text-sm">
                  A composed view of usage and workload
                </p>
              </div>
              <div className="admin-chart-total">
                <strong>{values[values.length - 1]?.trend ?? 0}%</strong>
                <span>current</span>
              </div>
            </div>
            <div className="admin-composed-chart-wrap">
              <svg
                viewBox="0 0 660 230"
                role="img"
                aria-label="Composed activity chart"
              >
                <defs>
                  <linearGradient
                    id="admin-area-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--foreground)"
                      stopOpacity=".16"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--foreground)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                {[45, 90, 135, 180].map((y) => (
                  <line
                    key={y}
                    x1="40"
                    x2="620"
                    y1={y}
                    y2={y}
                    className="admin-chart-grid-line"
                  />
                ))}
                <path d={area} fill="url(#admin-area-fill)" />
                {points.map((point, index) => (
                  <rect
                    key={index}
                    x={point.x - 13}
                    y={190 - point.workload * 1.55}
                    width="26"
                    height={point.workload * 1.55}
                    rx="13"
                    className="admin-chart-bar"
                  />
                ))}
                <path d={line} fill="none" className="admin-chart-line" />
                {points.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    className="admin-chart-point"
                  />
                ))}
                {points.map((point, index) => (
                  <text
                    key={index}
                    x={point.x}
                    y="215"
                    textAnchor="middle"
                    className="admin-chart-axis-label"
                  >
                    {point.label}
                  </text>
                ))}
              </svg>
            </div>
            <div className="admin-composed-legend">
              <span>
                <i className="admin-legend-swatch admin-legend-swatch-bar" />
                Workload
              </span>
              <span>
                <i className="admin-legend-swatch admin-legend-swatch-line" />
                Activity trend
              </span>
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
