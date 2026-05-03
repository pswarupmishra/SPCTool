from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import math
import os
from statistics import mean, stdev
from urllib.parse import urlparse


HOST = "127.0.0.1"
PORT = int(os.environ.get("SPC_API_PORT", "8000"))


XBAR_R_CONSTANTS = {
    2: {"A2": 1.880, "D3": 0.000, "D4": 3.267, "d2": 1.128},
    3: {"A2": 1.023, "D3": 0.000, "D4": 2.574, "d2": 1.693},
    4: {"A2": 0.729, "D3": 0.000, "D4": 2.282, "d2": 2.059},
    5: {"A2": 0.577, "D3": 0.000, "D4": 2.114, "d2": 2.326},
    6: {"A2": 0.483, "D3": 0.000, "D4": 2.004, "d2": 2.534},
    7: {"A2": 0.419, "D3": 0.076, "D4": 1.924, "d2": 2.704},
    8: {"A2": 0.373, "D3": 0.136, "D4": 1.864, "d2": 2.847},
    9: {"A2": 0.337, "D3": 0.184, "D4": 1.816, "d2": 2.970},
    10: {"A2": 0.308, "D3": 0.223, "D4": 1.777, "d2": 3.078},
}

XBAR_S_CONSTANTS = {
    2: {"A3": 2.659, "B3": 0.000, "B4": 3.267, "c4": 0.7979},
    3: {"A3": 1.954, "B3": 0.000, "B4": 2.568, "c4": 0.8862},
    4: {"A3": 1.628, "B3": 0.000, "B4": 2.266, "c4": 0.9213},
    5: {"A3": 1.427, "B3": 0.000, "B4": 2.089, "c4": 0.9400},
    6: {"A3": 1.287, "B3": 0.030, "B4": 1.970, "c4": 0.9515},
    7: {"A3": 1.182, "B3": 0.118, "B4": 1.882, "c4": 0.9594},
    8: {"A3": 1.099, "B3": 0.185, "B4": 1.815, "c4": 0.9650},
    9: {"A3": 1.032, "B3": 0.239, "B4": 1.761, "c4": 0.9693},
    10: {"A3": 0.975, "B3": 0.284, "B4": 1.716, "c4": 0.9727},
}


def clean_number(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def parse_rows(rows):
    values = []
    for index, row in enumerate(rows):
        value = clean_number(row.get("value"))
        if value is None:
            continue
        parsed = {
            "index": index + 1,
            "label": str(row.get("label") or index + 1),
            "value": value,
        }
        n = clean_number(row.get("n") or row.get("sampleSize") or row.get("sample_size"))
        units = clean_number(row.get("units") or row.get("unitCount") or row.get("unit_count"))
        if n is not None:
            parsed["n"] = n
        if units is not None:
            parsed["units"] = units
        values.append(parsed)
    return values


def round_or_none(value, digits=4):
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def capability(values, within_sigma, lsl, usl):
    raw_values = [item["value"] for item in values]
    overall_sigma = stdev(raw_values) if len(raw_values) > 1 else None
    center = mean(raw_values) if raw_values else None

    def cp_like(sigma):
        if sigma is None or sigma <= 0 or lsl is None or usl is None:
            return None
        return (usl - lsl) / (6 * sigma)

    def cpk_like(sigma):
        if sigma is None or sigma <= 0 or center is None:
            return None
        distances = []
        if usl is not None:
            distances.append((usl - center) / (3 * sigma))
        if lsl is not None:
            distances.append((center - lsl) / (3 * sigma))
        return min(distances) if distances else None

    return {
        "mean": round_or_none(center),
        "withinSigma": round_or_none(within_sigma),
        "overallSigma": round_or_none(overall_sigma),
        "cp": round_or_none(cp_like(within_sigma)),
        "cpk": round_or_none(cpk_like(within_sigma)),
        "pp": round_or_none(cp_like(overall_sigma)),
        "ppk": round_or_none(cpk_like(overall_sigma)),
    }


def rule_flags(points, center, sigma, ucl, lcl):
    flags = []
    if sigma is None or sigma <= 0:
        return flags

    values = [point["value"] for point in points]

    def same_side(window):
        return all(item > center for item in window) or all(item < center for item in window)

    def beyond_sigma(value, width):
        return abs(value - center) > width * sigma

    def same_side_beyond(window, width, needed):
        high = sum(1 for item in window if item > center + width * sigma)
        low = sum(1 for item in window if item < center - width * sigma)
        return high >= needed or low >= needed

    def alternating(window):
        return all((window[i] - window[i - 1]) * (window[i + 1] - window[i]) < 0 for i in range(1, len(window) - 1))

    for index, value in enumerate(values):
        reasons = []
        if value > ucl or value < lcl:
            reasons.append("Western Electric Rule 1: one point beyond 3 sigma")
            reasons.append("Nelson Rule 1: one point beyond 3 sigma")

        if index >= 2:
            window = values[index - 2 : index + 1]
            if same_side_beyond(window, 2, 2):
                reasons.append("Western Electric Rule 2: two of three points beyond 2 sigma")
                reasons.append("Nelson Rule 5: two of three points beyond 2 sigma")

        if index >= 4:
            window = values[index - 4 : index + 1]
            if same_side_beyond(window, 1, 4):
                reasons.append("Western Electric Rule 3: four of five points beyond 1 sigma")
                reasons.append("Nelson Rule 6: four of five points beyond 1 sigma")

        if index >= 7:
            window = values[index - 7 : index + 1]
            if same_side(window):
                reasons.append("Western Electric Rule 4: eight points on one side of center")

        if index >= 7:
            window = values[index - 7 : index + 1]
            if all(beyond_sigma(item, 1) for item in window) and any(item > center for item in window) and any(
                item < center for item in window
            ):
                reasons.append("Nelson Rule 8: eight points outside 1 sigma on both sides")

        if index >= 8:
            window = values[index - 8 : index + 1]
            if same_side(window):
                reasons.append("Nelson Rule 2: nine points on one side of center")

        if index >= 5:
            window = values[index - 5 : index + 1]
            if all(window[i] < window[i + 1] for i in range(5)) or all(
                window[i] > window[i + 1] for i in range(5)
            ):
                reasons.append("Nelson Rule 3: six points trending up or down")

        if index >= 13:
            window = values[index - 13 : index + 1]
            if alternating(window):
                reasons.append("Nelson Rule 4: fourteen points alternating up and down")

        if index >= 14:
            window = values[index - 14 : index + 1]
            if all(abs(item - center) < sigma for item in window):
                reasons.append("Nelson Rule 7: fifteen points within 1 sigma of center")

        if reasons:
            flags.append(
                {
                    "index": points[index]["index"],
                    "label": points[index]["label"],
                    "value": round_or_none(value),
                    "reasons": reasons,
                }
            )
    return flags


def individuals_analysis(values, lsl, usl):
    raw_values = [item["value"] for item in values]
    center = mean(raw_values)
    moving_ranges = [
        abs(raw_values[index] - raw_values[index - 1])
        for index in range(1, len(raw_values))
    ]
    mr_bar = mean(moving_ranges) if moving_ranges else 0
    sigma = mr_bar / 1.128 if mr_bar else 0
    ucl = center + 3 * sigma
    lcl = center - 3 * sigma

    mr_ucl = 3.267 * mr_bar
    mr_points = [
        {
            "index": values[index]["index"],
            "label": values[index]["label"],
            "value": moving_ranges[index - 1],
        }
        for index in range(1, len(values))
    ]

    return {
        "type": "imr",
        "chart": {
            "title": "Individuals Chart",
            "points": values,
            "center": round_or_none(center),
            "ucl": round_or_none(ucl),
            "lcl": round_or_none(lcl),
            "lsl": lsl,
            "usl": usl,
        },
        "secondaryChart": {
            "title": "Moving Range Chart",
            "points": mr_points,
            "center": round_or_none(mr_bar),
            "ucl": round_or_none(mr_ucl),
            "lcl": 0,
        },
        "capability": capability(values, sigma, lsl, usl),
        "flags": rule_flags(values, center, sigma, ucl, lcl),
    }


def subgroup_values(values, subgroup_size):
    return [
        values[index : index + subgroup_size]
        for index in range(0, len(values), subgroup_size)
        if len(values[index : index + subgroup_size]) == subgroup_size
    ]


def xbar_r_analysis(values, subgroup_size, lsl, usl):
    constants = XBAR_R_CONSTANTS[subgroup_size]
    groups = subgroup_values(values, subgroup_size)
    xbar_points = []
    range_points = []
    for index, group in enumerate(groups):
        group_values = [item["value"] for item in group]
        label = f"{group[0]['label']}-{group[-1]['label']}"
        xbar_points.append({"index": index + 1, "label": label, "value": mean(group_values)})
        range_points.append(
            {
                "index": index + 1,
                "label": label,
                "value": max(group_values) - min(group_values),
            }
        )

    xbar_bar = mean([point["value"] for point in xbar_points])
    r_bar = mean([point["value"] for point in range_points])
    xbar_ucl = xbar_bar + constants["A2"] * r_bar
    xbar_lcl = xbar_bar - constants["A2"] * r_bar
    r_ucl = constants["D4"] * r_bar
    r_lcl = constants["D3"] * r_bar
    sigma = r_bar / constants["d2"] if r_bar else 0

    return {
        "type": "xbar-r",
        "subgroupSize": subgroup_size,
        "chart": {
            "title": "X-bar Chart",
            "points": xbar_points,
            "center": round_or_none(xbar_bar),
            "ucl": round_or_none(xbar_ucl),
            "lcl": round_or_none(xbar_lcl),
            "lsl": lsl,
            "usl": usl,
        },
        "secondaryChart": {
            "title": "Range Chart",
            "points": range_points,
            "center": round_or_none(r_bar),
            "ucl": round_or_none(r_ucl),
            "lcl": round_or_none(r_lcl),
        },
        "capability": capability(values, sigma, lsl, usl),
        "flags": rule_flags(xbar_points, xbar_bar, sigma / math.sqrt(subgroup_size), xbar_ucl, xbar_lcl),
    }


def xbar_s_analysis(values, subgroup_size, lsl, usl):
    constants = XBAR_S_CONSTANTS[subgroup_size]
    groups = subgroup_values(values, subgroup_size)
    xbar_points = []
    s_points = []
    for index, group in enumerate(groups):
        group_values = [item["value"] for item in group]
        label = f"{group[0]['label']}-{group[-1]['label']}"
        xbar_points.append({"index": index + 1, "label": label, "value": mean(group_values)})
        s_points.append(
            {
                "index": index + 1,
                "label": label,
                "value": stdev(group_values),
            }
        )

    xbar_bar = mean([point["value"] for point in xbar_points])
    s_bar = mean([point["value"] for point in s_points])
    xbar_ucl = xbar_bar + constants["A3"] * s_bar
    xbar_lcl = xbar_bar - constants["A3"] * s_bar
    s_ucl = constants["B4"] * s_bar
    s_lcl = constants["B3"] * s_bar
    sigma = s_bar / constants["c4"] if s_bar else 0

    return {
        "type": "xbar-s",
        "subgroupSize": subgroup_size,
        "chart": {
            "title": "X-bar Chart",
            "points": xbar_points,
            "center": round_or_none(xbar_bar),
            "ucl": round_or_none(xbar_ucl),
            "lcl": round_or_none(xbar_lcl),
            "lsl": lsl,
            "usl": usl,
        },
        "secondaryChart": {
            "title": "S Chart",
            "points": s_points,
            "center": round_or_none(s_bar),
            "ucl": round_or_none(s_ucl),
            "lcl": round_or_none(s_lcl),
        },
        "capability": capability(values, sigma, lsl, usl),
        "flags": rule_flags(xbar_points, xbar_bar, sigma / math.sqrt(subgroup_size), xbar_ucl, xbar_lcl),
    }


def attribute_capability(points, sigma=None):
    raw_values = [item["value"] for item in points]
    return {
        "mean": round_or_none(mean(raw_values) if raw_values else None),
        "withinSigma": round_or_none(sigma),
        "overallSigma": round_or_none(stdev(raw_values) if len(raw_values) > 1 else None),
        "cp": None,
        "cpk": None,
        "pp": None,
        "ppk": None,
    }


def p_chart_analysis(values, sample_size):
    rows = []
    for item in values:
        n = item.get("n") or sample_size
        if n <= 0:
            continue
        defects = item["value"]
        if defects < 0 or defects > n:
            raise ValueError("p chart defect counts must be between 0 and sample size.")
        rows.append({**item, "n": n, "defects": defects, "value": defects / n})

    if len(rows) < 2:
        raise ValueError("p chart needs at least two valid rows.")

    total_defects = sum(item["defects"] for item in rows)
    total_sample = sum(item["n"] for item in rows)
    p_bar = total_defects / total_sample
    average_n = mean([item["n"] for item in rows])
    sigma = math.sqrt(p_bar * (1 - p_bar) / average_n) if average_n and p_bar < 1 else 0
    ucl = min(1, p_bar + 3 * sigma)
    lcl = max(0, p_bar - 3 * sigma)

    return {
        "type": "p",
        "chart": {
            "title": "p Chart",
            "points": rows,
            "center": round_or_none(p_bar),
            "ucl": round_or_none(ucl),
            "lcl": round_or_none(lcl),
            "lsl": None,
            "usl": None,
        },
        "secondaryChart": {"title": "Fraction Defective", "points": [], "center": None, "ucl": None, "lcl": None},
        "capability": attribute_capability(rows, sigma),
        "flags": rule_flags(rows, p_bar, sigma, ucl, lcl),
    }


def np_chart_analysis(values, sample_size):
    if sample_size <= 0:
        raise ValueError("np chart requires a positive sample size.")
    points = []
    for item in values:
        defects = item["value"]
        if defects < 0 or defects > sample_size:
            raise ValueError("np chart defect counts must be between 0 and sample size.")
        points.append(item)

    total_defects = sum(item["value"] for item in points)
    p_bar = total_defects / (sample_size * len(points))
    center = sample_size * p_bar
    sigma = math.sqrt(sample_size * p_bar * (1 - p_bar)) if p_bar < 1 else 0
    ucl = center + 3 * sigma
    lcl = max(0, center - 3 * sigma)

    return {
        "type": "np",
        "chart": {
            "title": "np Chart",
            "points": points,
            "center": round_or_none(center),
            "ucl": round_or_none(ucl),
            "lcl": round_or_none(lcl),
            "lsl": None,
            "usl": None,
        },
        "secondaryChart": {"title": "Defective Count", "points": [], "center": None, "ucl": None, "lcl": None},
        "capability": attribute_capability(points, sigma),
        "flags": rule_flags(points, center, sigma, ucl, lcl),
    }


def c_chart_analysis(values):
    points = []
    for item in values:
        if item["value"] < 0:
            raise ValueError("c chart defect counts cannot be negative.")
        points.append(item)

    c_bar = mean([item["value"] for item in points])
    sigma = math.sqrt(c_bar)
    ucl = c_bar + 3 * sigma
    lcl = max(0, c_bar - 3 * sigma)

    return {
        "type": "c",
        "chart": {
            "title": "c Chart",
            "points": points,
            "center": round_or_none(c_bar),
            "ucl": round_or_none(ucl),
            "lcl": round_or_none(lcl),
            "lsl": None,
            "usl": None,
        },
        "secondaryChart": {"title": "Defect Count", "points": [], "center": None, "ucl": None, "lcl": None},
        "capability": attribute_capability(points, sigma),
        "flags": rule_flags(points, c_bar, sigma, ucl, lcl),
    }


def u_chart_analysis(values, default_units):
    rows = []
    for item in values:
        units = item.get("units") or item.get("n") or default_units
        if units <= 0:
            continue
        defects = item["value"]
        if defects < 0:
            raise ValueError("u chart defect counts cannot be negative.")
        rows.append({**item, "units": units, "defects": defects, "value": defects / units})

    if len(rows) < 2:
        raise ValueError("u chart needs at least two valid rows.")

    total_defects = sum(item["defects"] for item in rows)
    total_units = sum(item["units"] for item in rows)
    u_bar = total_defects / total_units
    average_units = mean([item["units"] for item in rows])
    sigma = math.sqrt(u_bar / average_units) if average_units and u_bar else 0
    ucl = u_bar + 3 * sigma
    lcl = max(0, u_bar - 3 * sigma)

    return {
        "type": "u",
        "chart": {
            "title": "u Chart",
            "points": rows,
            "center": round_or_none(u_bar),
            "ucl": round_or_none(ucl),
            "lcl": round_or_none(lcl),
            "lsl": None,
            "usl": None,
        },
        "secondaryChart": {"title": "Defects per Unit", "points": [], "center": None, "ucl": None, "lcl": None},
        "capability": attribute_capability(rows, sigma),
        "flags": rule_flags(rows, u_bar, sigma, ucl, lcl),
    }


def analyze(payload):
    values = parse_rows(payload.get("rows", []))
    if len(values) < 2:
        return {"error": "At least two numeric measurements are required."}, 400

    chart_type = payload.get("chartType", "imr")
    subgroup_size = int(payload.get("subgroupSize") or 5)
    lsl = clean_number(payload.get("lsl"))
    usl = clean_number(payload.get("usl"))

    if chart_type in ("xbar-r", "xbar-s"):
        constants = XBAR_R_CONSTANTS if chart_type == "xbar-r" else XBAR_S_CONSTANTS
        if subgroup_size not in constants:
            return {"error": "Subgroup size must be between 2 and 10."}, 400
        if len(values) < subgroup_size * 2:
            return {"error": "Subgroup analysis needs at least two complete subgroups."}, 400
        if chart_type == "xbar-s":
            return xbar_s_analysis(values, subgroup_size, lsl, usl), 200
        return xbar_r_analysis(values, subgroup_size, lsl, usl), 200

    try:
        if chart_type == "p":
            return p_chart_analysis(values, subgroup_size), 200
        if chart_type == "np":
            return np_chart_analysis(values, subgroup_size), 200
        if chart_type == "c":
            return c_chart_analysis(values), 200
        if chart_type == "u":
            return u_chart_analysis(values, subgroup_size), 200
    except ValueError as exc:
        return {"error": str(exc)}, 400

    return individuals_analysis(values, lsl, usl), 200


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if urlparse(self.path).path == "/api/health":
            self._send(200, {"status": "ok"})
            return
        self._send(404, {"error": "Not found"})

    def do_POST(self):
        if urlparse(self.path).path != "/api/analyze":
            self._send(404, {"error": "Not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length) or "{}")
            result, status = analyze(payload)
            self._send(status, result)
        except Exception as exc:
            self._send(500, {"error": str(exc)})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    print(f"SPC API running at http://{HOST}:{PORT}")
    server.serve_forever()
