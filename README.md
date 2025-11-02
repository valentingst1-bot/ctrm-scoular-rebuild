# Scoular CTRM Prototype

A single-page vanilla HTML/CSS/JS experience that simulates the core workflows of an agriculture Commodity Trading & Risk Management (CTRM) cockpit for Scoular. The experience is framework-free, loads in a single document, and uses Chart.js via CDN for data visualization.

## Features

- **Hash-based routing** across Trader, Physical, Inventory, Hedge, Risk, Intel, Pricing, and Data Hub workspaces.
- **Live vs. Month-end snapshot toggle** that instantly rebinds KPIs and charts to different datasets.
- **Interactive dashboards** with mini cards, Chart.js visualizations, and a terminal-inspired UI polish.
- **Physical trade management** with filtering, rich detail panel, and in-line pricing stack.
- **Inventory cockpit** showing lot health, exposure charts, and actionable open ticket matching.
- **Deterministic valuation engine** driving MTM, basis, futures, freight, and hedge coverage metrics.
- **Hedge workbench** to simulate hedging percentages, rolls, and their impact on KPIs and ratios in real time.
- **Risk and P&L analytics** including waterfall view, variance cards, and carry sparkline synced to valuation outputs.
- **Market intel digest** with qualitative headlines and quantitative signals.
- **Pricing administration** mock forms for month-end mark maintenance with instant recalculation.
- **Data hub and observability** tools including snapshot loaders, reset controls, toast notifications, and a debug drawer (`#debug=1`).

## Getting started

1. Clone this repository or download it locally.
2. Open `index.html` in any modern desktop browser (Chrome, Edge, Safari, Firefox).
3. Navigate using the sidebar or hash URLs (e.g. `#/hedge`) to explore each workspace.

No build tooling or dependencies are required beyond the bundled HTML, CSS, and JavaScript files.
