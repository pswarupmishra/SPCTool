# SPC Tool

A small Statistical Process Control tool with a Python backend and React frontend.

## Run

Install frontend dependencies:

```bash
npm install
```

Start the Python API:

```bash
python3 backend/server.py
```

If port `8000` is busy:

```bash
SPC_API_PORT=8010 python3 backend/server.py
```

Start the React frontend in another terminal:

```bash
npm run dev
```

When using a non-default API port:

```bash
VITE_API_URL=http://127.0.0.1:8010/api/analyze npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Features

- Individuals / moving range analysis
- X-bar / R subgroup analysis
- Control limits and Western Electric style rule flags
- Capability metrics: Cp, Cpk, Pp, Ppk
- CSV paste/import via text area
