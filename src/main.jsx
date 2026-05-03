import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  LineChart,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/analyze";

const sampleExperiment = {
  process: "Thickness",
  chartType: "imr",
  subgroupSize: 5,
  lsl: 1.9,
  usl: 2.1,
  observations: [
    { sequence: 1, value: 2.03 },
    { sequence: 2, value: 2.01 },
    { sequence: 3, value: 2.02 },
    { sequence: 4, value: 2.02 },
    { sequence: 5, value: 2.01 },
    { sequence: 6, value: 2.02 },
    { sequence: 7, value: 2.01 },
    { sequence: 8, value: 2.02 },
    { sequence: 9, value: 2.01 },
    { sequence: 10, value: 2.02 },
    { sequence: 11, value: 2.02 },
    { sequence: 12, value: 2.02 },
    { sequence: 13, value: 2.02 },
    { sequence: 14, value: 2.02 },
    { sequence: 15, value: 2.0 },
    { sequence: 16, value: 2.01 },
    { sequence: 17, value: 2.01 },
    { sequence: 18, value: 7.0 },
    { sequence: 19, value: 2.01 },
    { sequence: 20, value: 2.0 },
    { sequence: 21, value: 2.02 },
    { sequence: 22, value: 2.01 },
    { sequence: 23, value: 2.02 },
    { sequence: 24, value: 2.01 },
    { sequence: 25, value: 2.02 },
  ],
};

const chartOptions = [
  {
    id: "imr",
    title: "I-MR",
    subtitle: "individual values",
    tooltip: "Use when readings come one at a time, like one thickness, weight, or temperature per check. Upload sequence,value.",
    exampleTitle: "Hot strip thickness readings",
    columns: ["sequence", "value"],
    exampleRows: [
      ["Coil 101", "2.03"],
      ["Coil 102", "2.01"],
      ["Coil 103", "2.02"],
    ],
    sampleHref: "/sample-thickness.csv",
    supported: true,
  },
  {
    id: "xbar-r",
    title: "X-bar/R",
    subtitle: "subgroup range",
    tooltip:
      "Use when operators take small groups of 2-10 readings at each check. Upload sequence,value and set the subgroup size.",
    exampleTitle: "Billet diameter readings, 5 per heat",
    columns: ["sequence", "value"],
    exampleRows: [
      ["Heat 42-1", "150.2"],
      ["Heat 42-2", "149.9"],
      ["Heat 42-3", "150.1"],
    ],
    sampleHref: "/sample-thickness.csv",
    supported: true,
  },
  {
    id: "xbar-s",
    title: "X-bar/S",
    subtitle: "subgroup sigma",
    tooltip:
      "Use when each check has grouped readings and you want variation measured by standard deviation. Upload sequence,value and set subgroup size.",
    exampleTitle: "Plate tensile strength samples",
    columns: ["sequence", "value"],
    exampleRows: [
      ["Plate A-1", "462"],
      ["Plate A-2", "459"],
      ["Plate A-3", "464"],
    ],
    sampleHref: "/sample-thickness.csv",
    supported: true,
  },
  {
    id: "p",
    title: "p Chart",
    subtitle: "fraction defective",
    tooltip:
      "Use for pass/fail inspections when sample size may change. Upload sequence,value,n where value is defective parts and n is inspected parts.",
    exampleTitle: "Rejected galvanized sheets by lot",
    columns: ["sequence", "value", "n"],
    exampleRows: [
      ["Lot 1", "6", "220"],
      ["Lot 2", "4", "180"],
      ["Lot 3", "8", "250"],
    ],
    sampleHref: "/sample-defects.csv",
    supported: true,
  },
  {
    id: "np",
    title: "np Chart",
    subtitle: "defective count",
    tooltip:
      "Use for pass/fail inspections with the same sample size every time. Upload sequence,value where value is defective parts; set sample size.",
    exampleTitle: "Rejected bars, fixed 100 inspected",
    columns: ["sequence", "value"],
    exampleRows: [
      ["Shift A", "3"],
      ["Shift B", "5"],
      ["Shift C", "4"],
    ],
    sampleHref: "/sample-defects.csv",
    supported: true,
  },
  {
    id: "c",
    title: "c Chart",
    subtitle: "defect count",
    tooltip:
      "Use when counting defects on the same size area, part, or opportunity each time. Upload sequence,value where value is defect count.",
    exampleTitle: "Surface defects per steel coil",
    columns: ["sequence", "value"],
    exampleRows: [
      ["Coil 501", "12"],
      ["Coil 502", "9"],
      ["Coil 503", "15"],
    ],
    sampleHref: "/sample-defects.csv",
    supported: true,
  },
  {
    id: "u",
    title: "u Chart",
    subtitle: "defects per unit",
    tooltip:
      "Use when counting defects but the inspected units can change. Upload sequence,value,units where value is defects and units is inspected units.",
    exampleTitle: "Slab defects by inspected meters",
    columns: ["sequence", "value", "units"],
    exampleRows: [
      ["Slab 11", "18", "30"],
      ["Slab 12", "11", "22"],
      ["Slab 13", "20", "35"],
    ],
    sampleHref: "/sample-defects.csv",
    supported: true,
  },
];

const defaultRowsText = [
  "sequence,value",
  ...sampleExperiment.observations.map((row) => `${row.sequence},${row.value}`),
].join("\n");

function fmt(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toFixed(digits);
}

function shortId() {
  return `SPC-${Date.now().toString(36).toUpperCase().slice(-10)}`;
}

function rowsToText(rows) {
  const hasN = rows.some((row) => row.n || row.sampleSize || row.sample_size);
  const hasUnits = rows.some((row) => row.units || row.unitCount || row.unit_count);
  const headers = ["sequence", "value", hasN ? "n" : null, hasUnits ? "units" : null].filter(Boolean);
  return [
    headers.join(","),
    ...rows.map((row, index) =>
      [
        row.label ?? row.sequence ?? index + 1,
        row.value,
        hasN ? row.n ?? row.sampleSize ?? row.sample_size ?? "" : null,
        hasUnits ? row.units ?? row.unitCount ?? row.unit_count ?? "" : null,
      ]
        .filter((value) => value !== null)
        .join(","),
    ),
  ].join("\n");
}

function parseDelimitedRows(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = [];

  const firstParts = lines[0]?.split(/,|\t|;/).map((part) => part.trim().toLowerCase()) || [];
  const hasHeader = firstParts.some((part) => ["sequence", "label", "value", "defects", "defectives", "n", "units"].includes(part));
  const headers = hasHeader ? firstParts : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, index) => {
    const parts = line.split(/,|\t|;/).map((part) => part.trim());
    if (headers.length) {
      const get = (...names) => {
        const headerIndex = headers.findIndex((header) => names.includes(header));
        return headerIndex >= 0 ? parts[headerIndex] : undefined;
      };
      const value = Number(get("value", "defects", "defectives", "count"));
      if (Number.isFinite(value)) {
        const n = Number(get("n", "sample_size", "samplesize", "sample size"));
        const units = Number(get("units", "unit_count", "unitcount", "unit count"));
        rows.push({
          label: String(get("sequence", "label", "id") || rows.length + 1),
          value,
          ...(Number.isFinite(n) ? { n } : {}),
          ...(Number.isFinite(units) ? { units } : {}),
        });
      }
      return;
    }
    const firstNumeric = Number(parts[0]);
    const secondNumeric = Number(parts[1]);
    if (parts.length === 1 && Number.isFinite(firstNumeric)) {
      rows.push({ label: String(rows.length + 1), value: firstNumeric });
      return;
    }
    if (parts.length > 1 && Number.isFinite(secondNumeric)) {
      const n = Number(parts[2]);
      const units = Number(parts[3]);
      rows.push({
        label: parts[0] || String(index + 1),
        value: secondNumeric,
        ...(Number.isFinite(n) ? { n } : {}),
        ...(Number.isFinite(units) ? { units } : {}),
      });
    }
  });

  return rows;
}

function parseJsonFile(text) {
  const parsed = JSON.parse(text);
  const rows = parsed.observations || parsed.rows || parsed.measurements || [];
  return {
    process: parsed.process || "Process",
    chartType: parsed.chartType || "imr",
    subgroupSize: Number(parsed.subgroupSize || 5),
    lsl: parsed.lsl,
    usl: parsed.usl,
    rows: rows
      .map((row, index) => ({
        label: String(row.label ?? row.sequence ?? index + 1),
        value: Number(row.value),
        n: Number(row.n ?? row.sampleSize ?? row.sample_size),
        units: Number(row.units ?? row.unitCount ?? row.unit_count),
      }))
      .filter((row) => Number.isFinite(row.value))
      .map((row) => ({
        label: row.label,
        value: row.value,
        ...(Number.isFinite(row.n) ? { n: row.n } : {}),
        ...(Number.isFinite(row.units) ? { units: row.units } : {}),
      })),
  };
}

function chartLabel(type) {
  return chartOptions.find((option) => option.id === type)?.title || "I-MR";
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function stdDev(values) {
  if (values.length < 2) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function validateDataTemplate(rows, chartType, subgroupSize) {
  if (!rows.length) {
    return { valid: false, message: "No parsed rows" };
  }
  if (["xbar-r", "xbar-s"].includes(chartType)) {
    if (subgroupSize < 2 || subgroupSize > 10) {
      return { valid: false, message: "Subgroup size must be 2-10" };
    }
    if (rows.length < subgroupSize * 2 || rows.length % subgroupSize !== 0) {
      return { valid: false, message: "Rows must form complete subgroups" };
    }
  }
  if (chartType === "p" && rows.some((row) => row.n === undefined)) {
    return { valid: false, message: "p Chart expects n column" };
  }
  if (chartType === "u" && rows.some((row) => row.units === undefined)) {
    return { valid: false, message: "u Chart expects units column" };
  }
  if (chartType === "np" && (!subgroupSize || subgroupSize < 1)) {
    return { valid: false, message: "np Chart expects sample size" };
  }
  return { valid: true, message: "Template matched" };
}

const ruleCatalog = [
  {
    id: "we-1",
    family: "western",
    reason: "Western Electric Rule 1: one point beyond 3 sigma",
    title: "WE 1: Beyond 3 Sigma",
    description: "One point falls outside the control limits. Treat it as an immediate special-cause signal.",
  },
  {
    id: "we-2",
    family: "western",
    reason: "Western Electric Rule 2: two of three points beyond 2 sigma",
    title: "WE 2: Two of Three Beyond 2 Sigma",
    description: "Two of three consecutive points are beyond the 2-sigma zone on the same side of center.",
  },
  {
    id: "we-3",
    family: "western",
    reason: "Western Electric Rule 3: four of five points beyond 1 sigma",
    title: "WE 3: Four of Five Beyond 1 Sigma",
    description: "Four of five consecutive points are beyond the 1-sigma zone on the same side of center.",
  },
  {
    id: "we-4",
    family: "western",
    reason: "Western Electric Rule 4: eight points on one side of center",
    title: "WE 4: Eight on One Side",
    description: "Eight consecutive points sit above or below the center line, suggesting a process shift.",
  },
  {
    id: "nelson-1",
    family: "nelson",
    reason: "Nelson Rule 1: one point beyond 3 sigma",
    title: "Nelson 1: Beyond 3 Sigma",
    description: "One point is more than 3 sigma from center. Investigate material, setup, gauge, or machine condition.",
  },
  {
    id: "nelson-2",
    family: "nelson",
    reason: "Nelson Rule 2: nine points on one side of center",
    title: "Nelson 2: Nine on One Side",
    description: "Nine consecutive points are on the same side of center, a strong sign the process average changed.",
  },
  {
    id: "nelson-3",
    family: "nelson",
    reason: "Nelson Rule 3: six points trending up or down",
    title: "Nelson 3: Six-Point Trend",
    description: "Six consecutive points keep rising or falling, which can indicate wear, drift, or over-adjustment.",
  },
  {
    id: "nelson-4",
    family: "nelson",
    reason: "Nelson Rule 4: fourteen points alternating up and down",
    title: "Nelson 4: Alternating Pattern",
    description: "Fourteen consecutive points alternate up and down, often pointing to sampling, batching, or measurement effects.",
  },
  {
    id: "nelson-5",
    family: "nelson",
    reason: "Nelson Rule 5: two of three points beyond 2 sigma",
    title: "Nelson 5: Two of Three Beyond 2 Sigma",
    description: "Two of three consecutive points are unusually far from center on the same side.",
  },
  {
    id: "nelson-6",
    family: "nelson",
    reason: "Nelson Rule 6: four of five points beyond 1 sigma",
    title: "Nelson 6: Four of Five Beyond 1 Sigma",
    description: "Four of five consecutive points are outside the 1-sigma band on the same side of center.",
  },
  {
    id: "nelson-7",
    family: "nelson",
    reason: "Nelson Rule 7: fifteen points within 1 sigma of center",
    title: "Nelson 7: Too Close to Center",
    description: "Fifteen consecutive points stay within 1 sigma, which can mean stratified data or hidden subgrouping.",
  },
  {
    id: "nelson-8",
    family: "nelson",
    reason: "Nelson Rule 8: eight points outside 1 sigma on both sides",
    title: "Nelson 8: Outside 1 Sigma Both Sides",
    description: "Eight consecutive points avoid the center band and appear on both sides, suggesting mixed sources or over-control.",
  },
];

function MetricCard({ label, value, detail, icon: Icon, tone = "neutral" }) {
  return (
    <section className={`metric-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <Icon size={19} />
    </section>
  );
}

function RuleSignalsGrid({ flags = [] }) {
  const [activeRuleFamily, setActiveRuleFamily] = useState("western");
  const ruleCards = ruleCatalog.map((rule) => {
    const matches = flags.filter((flag) => flag.reasons.includes(rule.reason));
    return { ...rule, matches };
  });
  const familyTabs = [
    { id: "western", label: "Western Electric", count: ruleCards.filter((rule) => rule.family === "western").length },
    { id: "nelson", label: "Nelson", count: ruleCards.filter((rule) => rule.family === "nelson").length },
  ];
  const visibleRules = ruleCards.filter((rule) => rule.family === activeRuleFamily);
  const triggeredInFamily = visibleRules.reduce((count, rule) => count + rule.matches.length, 0);

  return (
    <section className="signals-card">
      <div className="card-heading">
        <h3>Rule Signals</h3>
        <span>{flags.length ? `${flags.length} triggered sample(s)` : "All configured rules clear"}</span>
      </div>
      <div className="rule-tabs" role="tablist" aria-label="SPC rule families">
        {familyTabs.map((tab) => (
          <button
            className={activeRuleFamily === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveRuleFamily(tab.id)}
            role="tab"
            type="button"
            aria-selected={activeRuleFamily === tab.id}
          >
            <span>{tab.label}</span>
            <small>{tab.count} rules</small>
          </button>
        ))}
      </div>
      <div className="rule-family-summary">
        {triggeredInFamily
          ? `${triggeredInFamily} triggered sample(s) in ${activeRuleFamily === "western" ? "Western Electric" : "Nelson"} rules.`
          : `No ${activeRuleFamily === "western" ? "Western Electric" : "Nelson"} rule triggers.`}
      </div>
      <div className="rule-grid">
        {visibleRules.map((rule) => (
          <article className={`rule-card ${rule.matches.length ? "triggered" : "clear"}`} key={rule.id}>
            <div className="rule-topline">
              <strong>{rule.title}</strong>
              <span>{rule.matches.length ? "Triggered" : "Clear"}</span>
            </div>
            <p>{rule.description}</p>
            <div className="rule-points">
              {rule.matches.length ? (
                rule.matches.map((match) => (
                  <span key={`${rule.id}-${match.index}-${match.label}`}>
                    {match.label}: {fmt(match.value, 3)}
                  </span>
                ))
              ) : (
                <span>No matching points</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChartToolCard({ option, active, onSelect }) {
  return (
    <article className={`chart-option ${active ? "active" : ""}`}>
      <button
        className="chart-main"
        onClick={onSelect}
        type="button"
        aria-describedby={`chart-tip-${option.id}`}
        aria-pressed={active}
      >
        <strong>{option.title}</strong>
        <span>{option.subtitle}</span>
      </button>
      <a className="chart-sample-link" href={option.sampleHref} download>
        <Download size={13} />
        Sample CSV
      </a>
      <span className="chart-tooltip" id={`chart-tip-${option.id}`} role="tooltip">
        <span className="tooltip-copy">{option.tooltip}</span>
        <span className="tooltip-example-title">{option.exampleTitle}</span>
        <span className={`tooltip-table cols-${option.columns.length}`} aria-hidden="true">
          <span className="tooltip-row tooltip-head">
            {option.columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </span>
          {option.exampleRows.map((row) => (
            <span className="tooltip-row" key={row.join("-")}>
              {row.map((cell, index) => (
                <span key={`${cell}-${index}`}>{cell}</span>
              ))}
            </span>
          ))}
        </span>
      </span>
    </article>
  );
}

function Chart({ data }) {
  const width = 1020;
  const height = 310;
  const pad = { top: 28, right: 42, bottom: 42, left: 58 };
  const points = data?.points || [];
  const lineValues = [data?.ucl, data?.center, data?.lcl, data?.lsl, data?.usl].filter(
    (value) => value !== null && value !== undefined,
  );
  const rawValues = [...points.map((point) => point.value), ...lineValues];
  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const span = max - min || 1;
  const domainMin = min - span * 0.14;
  const domainMax = max + span * 0.14;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (index) => pad.left + (index / Math.max(points.length - 1, 1)) * plotW;
  const y = (value) => pad.top + ((domainMax - value) / (domainMax - domainMin)) * plotH;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(" ");

  const guide = (value, className, label) => {
    if (value === null || value === undefined) return null;
    const lineY = y(value);
    return (
      <g className={className}>
        <line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} />
        <text x={width - pad.right - 8} y={lineY - 6}>
          {label}
        </text>
      </g>
    );
  };

  return (
    <section className="chart-card">
      <div className="card-heading">
        <h3>Control Chart</h3>
        <span>
          UCL {fmt(data?.ucl, 3)} / CL {fmt(data?.center, 3)} / LCL {fmt(data?.lcl, 3)}
        </span>
      </div>
      <svg className="control-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Control chart">
        <rect className="plot-bg" x={pad.left} y={pad.top} width={plotW} height={plotH} />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const tickValue = domainMax - tick * (domainMax - domainMin);
          const tickY = pad.top + tick * plotH;
          return (
            <g className="axis-line" key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={tickY} y2={tickY} />
              <text x={pad.left - 12} y={tickY + 4}>
                {fmt(tickValue, 2)}
              </text>
            </g>
          );
        })}
        {points.map((_, index) => (
          <line
            className="vertical-grid"
            key={index}
            x1={x(index)}
            x2={x(index)}
            y1={pad.top}
            y2={height - pad.bottom}
          />
        ))}
        {guide(data?.usl, "spec-guide", "USL")}
        {guide(data?.lsl, "spec-guide", "LSL")}
        {guide(data?.ucl, "limit-guide", "UCL")}
        {guide(data?.lcl, "limit-guide", "LCL")}
        {guide(data?.center, "center-guide", "CL")}
        <path className="series" d={path} />
        {points.map((point, index) => (
          <g className="dot" key={`${point.label}-${index}`}>
            <circle cx={x(index)} cy={y(point.value)} r="4" />
            {(index === 0 || index === points.length - 1 || index % 2 === 1) && (
              <text x={x(index)} y={height - 13}>
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </section>
  );
}

function KeyValuePanel({ title, rows }) {
  return (
    <section className="info-card">
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DataPreviewGrid({ rows, chartType, subgroupSize }) {
  const hasN = rows.some((row) => row.n !== undefined);
  const hasUnits = rows.some((row) => row.units !== undefined);
  const templateStatus = validateDataTemplate(rows, chartType, subgroupSize);
  const columns = [
    { key: "label", label: "sequence" },
    { key: "value", label: ["p", "np", "c", "u"].includes(chartType) ? "defects" : "value" },
    ...(hasN ? [{ key: "n", label: "n" }] : []),
    ...(hasUnits ? [{ key: "units", label: "units" }] : []),
  ];
  const previewRows = rows.slice(0, 12);

  return (
    <section className="data-preview">
      <div className="preview-heading">
        <div>
          <h3>Uploaded Data Preview</h3>
          <p>{rows.length ? `${rows.length} rows parsed` : "Upload a file to preview parsed rows"}</p>
        </div>
        <span className={templateStatus.valid ? "valid" : "invalid"}>{chartLabel(chartType)}</span>
      </div>
      <div className={`template-status ${templateStatus.valid ? "valid" : "invalid"}`}>{templateStatus.message}</div>
      <div className="preview-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.length ? (
              previewRows.map((row, index) => (
                <tr key={`${row.label}-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.key === "value" ? fmt(row[column.key], 4) : row[column.key] ?? "-"}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>No rows parsed yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > previewRows.length && <p className="preview-note">Showing first {previewRows.length} rows.</p>}
    </section>
  );
}

function App() {
  const [rowsText, setRowsText] = useState(defaultRowsText);
  const [processName, setProcessName] = useState(sampleExperiment.process);
  const [chartType, setChartType] = useState(sampleExperiment.chartType);
  const [subgroupSize, setSubgroupSize] = useState(sampleExperiment.subgroupSize);
  const [lsl, setLsl] = useState(String(sampleExperiment.lsl));
  const [usl, setUsl] = useState(String(sampleExperiment.usl));
  const [fileName, setFileName] = useState("sample-thickness.csv");
  const [analysis, setAnalysis] = useState(null);
  const [experiment, setExperiment] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(shortId());

  const parsedPreview = useMemo(() => {
    const rows = parseDelimitedRows(rowsText);
    return {
      process: processName || "Process",
      chartType,
      subgroupSize: Number(subgroupSize || 5),
      lsl: lsl === "" ? null : Number(lsl),
      usl: usl === "" ? null : Number(usl),
      rows,
    };
  }, [chartType, lsl, processName, rowsText, subgroupSize, usl]);

  function resetSample() {
    setRowsText(defaultRowsText);
    setProcessName(sampleExperiment.process);
    setChartType(sampleExperiment.chartType);
    setSubgroupSize(sampleExperiment.subgroupSize);
    setLsl(String(sampleExperiment.lsl));
    setUsl(String(sampleExperiment.usl));
    setFileName("sample-thickness.csv");
  }

  function selectChart(nextChartType) {
    setChartType(nextChartType);
    if (["p", "np", "u"].includes(nextChartType) && Number(subgroupSize) < 25) {
      setSubgroupSize(100);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const text = await file.text();
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = parseJsonFile(text);
        setProcessName(parsed.process);
        setChartType(chartOptions.some((option) => option.id === parsed.chartType && option.supported) ? parsed.chartType : "imr");
        setSubgroupSize(parsed.subgroupSize);
        setLsl(parsed.lsl ?? "");
        setUsl(parsed.usl ?? "");
        setRowsText(rowsToText(parsed.rows));
        return;
      }
      setRowsText(text);
    } catch (err) {
      setError(`Could not read ${file.name}: ${err.message}`);
    }
  }

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const nextExperiment = parsedPreview;
      if (nextExperiment.rows.length < 2) {
        throw new Error("Upload a CSV/TXT file with at least two numeric observations.");
      }
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextExperiment),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Analysis failed");
      setExperiment(nextExperiment);
      setAnalysis(payload);
      setRunId(shortId());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runAnalysis();
  }, []);

  const values = experiment?.rows.map((row) => row.value) || [];
  const flagCount = analysis?.flags?.length || 0;
  const cpk = analysis?.capability?.cpk;
  const processStatus = flagCount ? "UNSTABLE" : "STABLE";
  const capabilityStatus = cpk === null || cpk === undefined ? "UNKNOWN" : cpk >= 1.33 ? "CAPABLE" : "NOT_CAPABLE";
  const dataQuality = parsedPreview.rows.length > 1 ? "OK" : "CHECK";
  const alertText = flagCount
    ? `${experiment?.process || "Process"} process needs review due to ${flagCount} SPC rule violation(s).`
    : `${experiment?.process || "Process"} process is currently stable under the selected SPC rules.`;

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">
            <LineChart size={15} />
            Plant Grade SPC/SQC
          </p>
          <h1>Univariate SPC Analysis Dashboard</h1>
          <p className="hero-copy">
            Send manufacturing observations and review stability, capability, control limits, and rule violations.
          </p>
        </div>
        <button className="mode-pill" type="button">
          <FlaskConical size={17} />
          Sync API Mode
        </button>
      </header>

      <section className="dashboard-grid">
        <aside className="input-card">
          <div className="section-heading">
            <div>
              <h2>Experiment Input</h2>
              <p>Upload a CSV, TXT, or JSON file and choose the SPC chart.</p>
            </div>
            <button className="soft-button" type="button" onClick={resetSample}>
              <RotateCcw size={15} />
              Reset
            </button>
          </div>

          <label className="upload-zone">
            <Upload size={24} />
            <strong>Upload measurement file</strong>
            <span>CSV/TXT: sequence,value with optional n or units columns. JSON files are also accepted.</span>
            <input type="file" accept=".csv,.txt,.json" onChange={handleFileUpload} />
          </label>

          <div className="file-pill">
            <FileText size={16} />
            <span>{fileName}</span>
          </div>
          <div className="form-grid">
            <label>
              Process name
              <input value={processName} onChange={(event) => setProcessName(event.target.value)} />
            </label>
            <label>
              Subgroup / sample size
              <input
                type="number"
                min="2"
                max={["xbar-r", "xbar-s"].includes(chartType) ? "10" : "100000"}
                value={subgroupSize}
                disabled={["imr", "c"].includes(chartType)}
                onChange={(event) => setSubgroupSize(Number(event.target.value))}
              />
            </label>
            <label>
              LSL
              <input type="number" step="0.01" value={lsl} onChange={(event) => setLsl(event.target.value)} />
            </label>
            <label>
              USL
              <input type="number" step="0.01" value={usl} onChange={(event) => setUsl(event.target.value)} />
            </label>
          </div>

          <div className="chart-picker" role="radiogroup" aria-label="SPC chart type">
            {chartOptions.map((option) => (
              <ChartToolCard
                active={chartType === option.id}
                key={option.id}
                onSelect={() => selectChart(option.id)}
                option={option}
              />
            ))}
          </div>

          <DataPreviewGrid
            rows={parsedPreview.rows}
            chartType={parsedPreview.chartType}
            subgroupSize={parsedPreview.subgroupSize}
          />
          <div className="input-footer">
            <span>{parsedPreview.rows.length} observations detected</span>
            <span>{chartLabel(parsedPreview.chartType)}</span>
          </div>
          <button className="primary-button" type="button" onClick={runAnalysis} disabled={loading}>
            {loading ? <RefreshCw className="spin" size={17} /> : <Play size={17} />}
            Analyze SPC
          </button>
          {error && (
            <div className="error-banner">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}
        </aside>

        <section className="result-card">
          <div className="section-heading result-heading">
            <div>
              <h2>Analysis Result</h2>
              <p>{runId}</p>
            </div>
          </div>

          <div className={`result-alert ${flagCount ? "danger" : "success"}`}>
            <strong>{alertText}</strong>
            <span>
              {flagCount
                ? "Investigate measurement, machine condition, setup, material change, or sensor drift."
                : "Continue monitoring and keep the current control plan active."}
            </span>
          </div>

          <div className="metric-grid">
            <MetricCard
              label="Process Status"
              value={processStatus}
              detail="SPC rule evaluation"
              icon={flagCount ? ShieldAlert : CheckCircle2}
              tone={flagCount ? "danger" : "success"}
            />
            <MetricCard
              label="Capability"
              value={capabilityStatus}
              detail={`Cpk: ${fmt(cpk, 4)}`}
              icon={Gauge}
              tone={capabilityStatus === "CAPABLE" ? "success" : "danger"}
            />
            <MetricCard
              label="Data Quality"
              value={dataQuality}
              detail={`${parsedPreview.rows.length} observations`}
              icon={CheckCircle2}
              tone={dataQuality === "OK" ? "success" : "warning"}
            />
            <MetricCard
              label="Chart Type"
              value={chartLabel(analysis?.type || chartType).toUpperCase()}
              detail={analysis?.secondaryChart?.title || "moving range"}
              icon={BarChart3}
            />
          </div>

          {analysis && <Chart data={analysis.chart} />}

          <div className="lower-grid">
            <KeyValuePanel
              title="Statistics"
              rows={[
                ["Mean", fmt(analysis?.capability?.mean, 4)],
                ["Median", fmt(median(values), 4)],
                ["Std Dev", fmt(stdDev(values), 6)],
                ["Within Sigma", fmt(analysis?.capability?.withinSigma, 6)],
              ]}
            />
            <KeyValuePanel
              title="Control Limits"
              rows={[
                ["UCL", fmt(analysis?.chart?.ucl, 6)],
                ["CL", fmt(analysis?.chart?.center, 6)],
                ["LCL", fmt(analysis?.chart?.lcl, 6)],
                ["USL / LSL", `${fmt(analysis?.chart?.usl, 3)} / ${fmt(analysis?.chart?.lsl, 3)}`],
              ]}
            />
          </div>

          <RuleSignalsGrid flags={analysis?.flags || []} />
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
