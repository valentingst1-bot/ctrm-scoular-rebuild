(function () {
  const utils = window.CTRMUtils;
  const data = window.CTRMData;
  const router = window.CTRMRouting;
  const charts = window.CTRMCharts;

  const body = document.body;
  const sparkKeys = ['mtmChange', 'hedgeCoverage', 'basisPL', 'futuresPL', 'freightVar', 'otherPL', 'workingCapital'];
  const sparkHistory = sparkKeys.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
  const commodityPalette = {
    Soybeans: '#4c8dfb',
    Corn: '#53c38c',
    Wheat: '#f6c85f',
    Canola: '#ff7a7a',
    Other: '#8a79ff',
  };
  const sparkColors = {
    mtmChange: '#4c8dfb',
    hedgeCoverage: '#53c38c',
    basisPL: '#7f9cff',
    futuresPL: '#f6c85f',
    freightVar: '#ff7a7a',
    otherPL: '#8a79ff',
    workingCapital: '#55c0cf',
  };
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let previousAggregates = null;
  let varianceFilter = 'All';
  let currentTradeId = null;
  let compactMode = false;

  const snapshotButtons = document.querySelectorAll('.snapshot-toggle .toggle-button');
  const kpiTiles = document.querySelectorAll('.kpi-tile');
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const views = Array.from(document.querySelectorAll('.view')).reduce((map, view) => {
    map[view.dataset.route] = view;
    return map;
  }, {});

  const tradeFilters = document.querySelectorAll('.filters [data-filter]');
  const hedgePercentForm = document.querySelector('[data-form="hedge-percent"]');
  const rollForm = document.querySelector('[data-form="roll-month"]');
  const toastStack = document.querySelector('[data-role="toast-stack"]');
  const debugDrawer = document.querySelector('[data-role="debug-drawer"]');
  const debugRecomputeBtn = debugDrawer.querySelector('[data-action="debug-recompute"]');
  const debugCloseBtn = debugDrawer.querySelector('[data-action="debug-close"]');
  const scenarioSlider = document.querySelector('[data-role="scenario-slider"]');
  const scenarioOutput = document.querySelector('[data-role="scenario-output"]');
  const hedgeLogList = document.querySelector('[data-role="hedge-log"]');
  const varianceSummaryTable = document.querySelector('[data-role="variance-summary"]');
  const varianceDetailContainer = document.querySelector('[data-role="variance-detail"]');
  const priceLadderContainer = document.querySelector('[data-role="price-ladder"]');
  const copyTradeButton = document.querySelector('[data-action="copy-trade-id"]');
  const systemHealthList = document.querySelector('[data-role="health-list"]');

  let activeRoute = '#/trader';
  let debugEnabled = false;

  const routeHandlers = {
    '#/trader': {
      render: renderTrader,
      destroy: () => {
        charts.destroyChart('chart-trader-waterfall');
        charts.destroyChart('chart-trader-heatmap');
        charts.destroyChart('chart-trader-hedge-ladder');
      },
    },
    '#/physical': {
      render: renderPhysical,
      destroy: () => {
        charts.destroyChart('chart-physical-status');
      },
    },
    '#/inventory': {
      render: renderInventory,
      destroy: () => {
        charts.destroyChart('chart-inventory-month');
        charts.destroyChart('chart-quality');
        charts.destroyChart('chart-aging');
        charts.destroyChart('chart-quality-scatter');
      },
    },
    '#/hedge': {
      render: renderHedge,
      destroy: () => {
        charts.destroyChart('chart-hedge-ratio');
        charts.destroyChart('chart-term-structure');
        charts.destroyChart('chart-hedge-ladder');
      },
    },
    '#/risk': {
      render: renderRisk,
      destroy: () => {
        charts.destroyChart('chart-waterfall');
        charts.destroyChart('chart-carry-spark');
      },
    },
    '#/intel': {
      render: renderIntel,
      destroy: () => {
        charts.destroyChart('chart-intel-vol');
        charts.destroyChart('chart-intel-seasonality');
        charts.destroyChart('chart-intel-spread');
      },
    },
    '#/pricing': { render: renderPricing },
    '#/datahub': { render: renderDataHub },
  };

  function parseHash(hash) {
    const [path, query] = hash.split('?');
    const normalizedRoute = router.normalize(path || '');
    const debug = (query || '').split('&').includes('debug=1');
    return { route: normalizedRoute, debug };
  }

  function navigateWithDebug(route) {
    const target = debugEnabled ? `${route}?debug=1` : route;
    router.navigate(target);
  }

  snapshotButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.classList.contains('is-active')) return;
      data.setSnapshot(button.dataset.snapshot);
    });
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigateWithDebug(link.dataset.route);
    });
  });

  tradeFilters.forEach((filter) => {
    filter.addEventListener('change', renderPhysical);
  });

  hedgePercentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(hedgePercentForm);
    data.hedgeExposure({
      commodity: formData.get('commodity'),
      percent: Number(formData.get('percent')),
      month: formData.get('month'),
    });
  });

  rollForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(rollForm);
    data.rollMonth({
      symbol: formData.get('symbol'),
      from: formData.get('from'),
      to: formData.get('to'),
    });
  });

  document.addEventListener('click', (event) => {
    const matchBtn = event.target.closest('[data-action="match-ticket"]');
    if (matchBtn) {
      data.matchTicket(matchBtn.dataset.id);
    }

    const resetBtn = event.target.closest('[data-action="reset-demo"]');
    if (resetBtn) {
      data.resetDemo();
    }

    const revertBtn = event.target.closest('[data-action="pricing-revert"]');
    if (revertBtn) {
      data.revertPricing();
    }

    const targetHedgeBtn = event.target.closest('[data-action="target-hedge"]');
    if (targetHedgeBtn) {
      const commodity = targetHedgeBtn.dataset.commodity;
      const month = targetHedgeBtn.dataset.month;
      data.hedgeExposure({ commodity, percent: 80, month });
    }

    const headerRecompute = event.target.closest('[data-action="header-recompute"]');
    if (headerRecompute) {
      data.forceRecompute();
      pushToast('Manual recompute triggered.');
    }

    const compactToggle = event.target.closest('[data-action="toggle-compact"]');
    if (compactToggle) {
      compactMode = !compactMode;
      body.classList.toggle('is-compact', compactMode);
    }

    const forceRender = event.target.closest('[data-action="force-render"]');
    if (forceRender) {
      data.forceRecompute();
    }
  });

  if (copyTradeButton) {
    copyTradeButton.addEventListener('click', async () => {
      if (!currentTradeId) return;
      try {
        await navigator.clipboard.writeText(currentTradeId);
        pushToast(`Copied ${currentTradeId}`);
      } catch (error) {
        pushToast('Clipboard unavailable');
      }
    });
  }

  if (varianceSummaryTable) {
    varianceSummaryTable.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-bucket]');
      if (!row) return;
      varianceFilter = row.dataset.bucket;
      renderRisk();
    });
  }

  if (scenarioSlider) {
    scenarioSlider.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      data.setScenarioShock(value);
      updateScenarioOutput();
    });
  }

  debugRecomputeBtn.addEventListener('click', () => {
    if (data.forceRecompute) {
      data.forceRecompute();
      pushToast('Manual recompute requested.');
    }
  });

  debugCloseBtn.addEventListener('click', () => {
    debugEnabled = false;
    router.navigate(activeRoute);
  });

  data.subscribe((event) => {
    if (event.type === 'ctrm:dataChanged' || event.type === 'ctrm:snapshotChanged') {
      renderHeader();
      renderActiveView();
      if (event.payload?.toast) {
        pushToast(event.payload.toast);
      }
      if (debugEnabled) {
        updateDebugDrawer();
      }
    }
  });

  router.subscribe((hash) => {
    const { route, debug } = parseHash(hash);
    debugEnabled = debug;
    setDebugDrawer(debugEnabled);
    activateRoute(route);
  });

  function updateSparkline(key, value) {
    const history = sparkHistory[key];
    if (!history) return;
    history.push(Number(value || 0));
    if (history.length > 16) history.shift();
    charts.mountChart(`spark-${key}`, {
      type: 'line',
      data: {
        labels: history.map((_, index) => index + 1),
        datasets: [
          {
            data: history,
            borderColor: sparkColors[key] || '#4c8dfb',
            backgroundColor: (sparkColors[key] || '#4c8dfb') + '33',
            borderWidth: 1.6,
            pointRadius: 0,
            fill: {
              target: 'origin',
              above: (sparkColors[key] || '#4c8dfb') + '22',
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });
  }

  function updateScenarioOutput() {
    if (!scenarioOutput) return;
    const scenario = data.getScenarioResult();
    const impact = utils.formatDelta(scenario.impact || 0, { unit: 'mm' });
    scenarioOutput.textContent = `Shock ${Number(scenario.shock || 0).toFixed(1)}% → Impact ${impact}`;
  }

  function setDebugDrawer(enabled) {
    if (!debugDrawer) return;
    if (enabled) {
      debugDrawer.hidden = false;
      updateDebugDrawer();
    } else {
      debugDrawer.hidden = true;
    }
  }

  function updateDebugDrawer() {
    if (!debugDrawer || debugDrawer.hidden) return;
    const state = data.getDebugState();
    debugDrawer.querySelector('[data-debug="snapshot"]').textContent = state.snapshot;
    debugDrawer.querySelector('[data-debug="net"]').textContent = utils.formatMillions(state.aggregates.netPL);
    debugDrawer.querySelector('[data-debug="charts"]').textContent = state.charts;
    const formatted = new Date(state.lastEvent).toLocaleTimeString();
    debugDrawer.querySelector('[data-debug="event"]').textContent = formatted;
  }

  function pushToast(message) {
    if (!toastStack) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastStack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  function activateRoute(route) {
    if (!routeHandlers[route]) {
      route = '#/trader';
    }
    if (activeRoute === route) {
      renderActiveView();
      return;
    }
    if (activeRoute && routeHandlers[activeRoute]?.destroy) {
      routeHandlers[activeRoute].destroy();
    }
    Object.values(views).forEach((view) => view.setAttribute('hidden', 'hidden'));
    const nextView = views[route];
    if (nextView) {
      nextView.removeAttribute('hidden');
    }
    activeRoute = route;
    navLinks.forEach((link) => {
      const isActive = link.dataset.route === route;
      link.classList.toggle('is-active', isActive);
    });
    renderActiveView();
  }

  function renderActiveView() {
    const handler = routeHandlers[activeRoute];
    if (handler?.render) {
      handler.render();
    }
  }

  function renderHeader() {
    const aggregates = data.getAggregates();
    const snapshot = data.getSnapshot();
    const sourceKeys = {
      mtmChange: 'netPL',
      hedgeCoverage: 'hedgeCoverage',
      basisPL: 'basisPL',
      futuresPL: 'futuresPL',
      freightVar: 'freightVar',
      otherPL: 'otherPL',
      workingCapital: 'workingCapital',
    };
    const formatters = {
      mtmChange: utils.formatMillions,
      hedgeCoverage: utils.formatPercent,
      basisPL: utils.formatMillions,
      futuresPL: utils.formatMillions,
      freightVar: utils.formatMillions,
      otherPL: utils.formatMillions,
      workingCapital: utils.formatMillions,
    };
    const deltaUnits = {
      hedgeCoverage: 'percent',
    };
    kpiTiles.forEach((tile) => {
      const key = tile.dataset.kpi;
      const source = sourceKeys[key];
      const value = aggregates[source];
      const prev = previousAggregates ? previousAggregates[source] : undefined;
      const formatter = formatters[key] || ((val) => val);
      tile.querySelector('.kpi-value').textContent = formatter(value);
      const deltaElement = tile.querySelector('.kpi-delta');
      if (deltaElement) {
        const diff = typeof prev === 'number' ? value - prev : 0;
        deltaElement.textContent = utils.formatDelta(diff, { unit: deltaUnits[key] || 'mm' });
        deltaElement.dataset.direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
      }
      updateSparkline(key, value);
    });
    previousAggregates = { ...aggregates };
    snapshotButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.snapshot === snapshot.key);
    });
  }

  function renderTrader() {
    const bulletins = document.querySelector('[data-role="trader-bulletins"]');
    bulletins.innerHTML = '';
    data.getSnapshot().bulletins.forEach((headline) => {
      bulletins.appendChild(utils.createElement('li', { text: headline }));
    });

    const debugState = data.getDebugState();
    const timestampLabel = document.querySelector('[data-role="last-updated"]');
    if (timestampLabel) {
      const formatted = debugState.lastEvent ? new Date(debugState.lastEvent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      timestampLabel.textContent = `Last updated ${formatted}`;
    }

    const aggregates = data.getAggregates();
    charts.mountChart('chart-trader-waterfall', {
      type: 'bar',
      data: {
        labels: ['Basis', 'Futures', 'Freight', 'Other', 'Net'],
        datasets: [
          {
            label: 'P&L',
            data: [aggregates.basisPL, aggregates.futuresPL, aggregates.freightVar, aggregates.otherPL, aggregates.netPL],
            backgroundColor: ['#7f9cff', '#4c8dfb', '#ff7a7a', '#8a79ff', '#53c38c'],
            borderSkipped: false,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(100,130,160,0.18)' } },
        },
      },
    });

    const exposure = data.getExposureSummary();
    const heatmapRecords = exposure.heatmap || [];
    const months = Array.from(new Set(heatmapRecords.map((item) => item.month))).sort(
      (a, b) => monthOrder.indexOf(a.split('-')[0]) - monthOrder.indexOf(b.split('-')[0])
    );
    const commodities = Array.from(new Set(heatmapRecords.map((item) => item.commodity)));
    const heatmapDatasets = commodities.map((commodity) => ({
      label: commodity,
      data: months.map((month) => {
        const entry = heatmapRecords.find((record) => record.commodity === commodity && record.month === month);
        return entry ? Number((entry.unhedged / 1000).toFixed(2)) : 0;
      }),
      backgroundColor: (commodityPalette[commodity] || commodityPalette.Other) + 'bb',
      borderRadius: 4,
    }));

    charts.mountChart('chart-trader-heatmap', {
      type: 'bar',
      data: { labels: months, datasets: heatmapDatasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: 'rgba(100,130,160,0.16)' } },
        },
      },
    });

    const ladder = exposure.ladder || [];
    charts.mountChart('chart-trader-hedge-ladder', {
      type: 'bar',
      data: {
        labels: ladder.map((entry) => entry.month),
        datasets: [
          {
            label: 'Physical',
            data: ladder.map((entry) => Number((entry.physical / 1000).toFixed(2))),
            backgroundColor: '#4c8dfb',
          },
          {
            label: 'Hedged',
            data: ladder.map((entry) => Number((Math.min(Math.abs(entry.hedged), Math.abs(entry.physical)) / 1000).toFixed(2))),
            backgroundColor: '#53c38c',
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: 'rgba(100,130,160,0.18)' } },
        },
      },
    });

    const driversList = document.querySelector('[data-role="top-drivers"]');
    driversList.innerHTML = '';
    data.getTopDrivers().forEach((driver) => {
      const item = utils.createElement('li');
      item.innerHTML = `<span>${driver.label}</span><span>${utils.formatMillions(driver.value)}</span>`;
      driversList.appendChild(item);
    });
  }

  function renderPhysical() {
    const trades = data.getTrades();
    const selectCommodity = document.querySelector('[data-filter="commodity"]');
    const selectStatus = document.querySelector('[data-filter="status"]');
    const selectZone = document.querySelector('[data-filter="zone"]');

    populateSelect(selectCommodity, ['', ...new Set(trades.map((trade) => trade.commodity))]);
    populateSelect(selectStatus, ['', ...new Set(trades.map((trade) => trade.status))]);
    populateSelect(selectZone, ['', ...new Set(trades.map((trade) => trade.marketZone))]);

    const filters = {
      commodity: selectCommodity.value,
      status: selectStatus.value,
      zone: selectZone.value,
    };

    const filtered = trades.filter((trade) => (
      (!filters.commodity || trade.commodity === filters.commodity) &&
      (!filters.status || trade.status === filters.status) &&
      (!filters.zone || trade.marketZone === filters.zone)
    ));

    const tbody = document.querySelector('[data-table="trades"] tbody');
    tbody.innerHTML = '';

    filtered.forEach((trade) => {
      const row = utils.createElement('tr', { attrs: { tabindex: 0, 'data-id': trade.id } });
      row.innerHTML = `
        <td>${trade.id}</td>
        <td>${trade.type}</td>
        <td>${trade.counterparty}</td>
        <td>${trade.commodity}</td>
        <td>${trade.unpricedQty.toLocaleString()} ${trade.uom}</td>
        <td>${utils.formatCurrency(trade.currentLocalPrice || trade.contractLocalPrice)}</td>
        <td>${trade.deliveryWindow}</td>
        <td><span class="tag">${trade.status}</span></td>
      `;
      row.addEventListener('click', () => showTradeDetail(trade.id));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showTradeDetail(trade.id);
        }
      });
      tbody.appendChild(row);
    });

    const emptyState = document.querySelector('.physical-table .empty-state');
    if (emptyState) {
      emptyState.hidden = filtered.length > 0;
    }

    if (currentTradeId) {
      if (filtered.some((trade) => trade.id === currentTradeId)) {
        showTradeDetail(currentTradeId);
      } else {
        resetTradeDetail();
      }
    }

    const metrics = data.getPhysicalMetrics();
    const ribbonValues = {
      openQty: `${(metrics.openQty || 0).toLocaleString()} ${metrics.openQty ? 'bu' : ''}`,
      avgBasis: `${utils.formatNumber(metrics.avgBasis || 0, 3)}`,
      avgLocal: utils.formatCurrency(metrics.avgLocal || 0),
      deliveryWindow: metrics.weightedDelivery || '--',
    };
    document.querySelectorAll('.mini-kpi').forEach((tile) => {
      const key = tile.dataset.metric;
      tile.querySelector('p').textContent = ribbonValues[key] ?? '--';
    });

    const distribution = data.getStatusDistribution();
    charts.mountChart('chart-physical-status', {
      type: 'bar',
      data: {
        labels: distribution.map((entry) => entry.status),
        datasets: [
          {
            label: 'Open Qty',
            data: distribution.map((entry) => Number((entry.qty / 1000).toFixed(2))),
            backgroundColor: '#4c8dfb',
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(100,130,160,0.16)' } },
        },
      },
    });

    if (!filtered.find((trade) => trade.id === currentTradeId)) {
      resetTradeDetail();
    }
  }

  function populateSelect(select, values) {
    const current = select.value;
    select.innerHTML = '';
    values.forEach((value) => {
      const label = value || 'All';
      select.appendChild(utils.createElement('option', { text: label, attrs: { value } }));
    });
    select.value = current;
  }

  function resetTradeDetail() {
    const detail = document.querySelector('[data-role="trade-detail"] .detail-body');
    const timeline = document.querySelector('[data-role="trade-timeline"]');
    if (detail) {
      detail.textContent = 'Select a trade to view full context.';
    }
    if (timeline) {
      timeline.innerHTML = '';
    }
    if (priceLadderContainer) {
      priceLadderContainer.textContent = 'Select a trade.';
    }
    if (copyTradeButton) {
      copyTradeButton.hidden = true;
      copyTradeButton.dataset.trade = '';
    }
    currentTradeId = null;
  }

  function renderPriceLadder(trade) {
    if (!priceLadderContainer) return;
    if (!trade) {
      priceLadderContainer.textContent = 'Select a trade.';
      return;
    }
    const pricing = data.getPricing();
    const boardRow = pricing.marketPrices.find((row) => row.commodity === trade.commodity && row.month === trade.marketMonth);
    const pointRow = pricing.pricingPoints.find((row) => row.name === trade.pricingPoint && row.commodity === trade.commodity);
    const zoneRow = pricing.zoneSpreads.find((row) => row.zone === trade.marketZone && row.commodity === trade.commodity);
    const board = boardRow ? boardRow.price : trade.futuresPrice;
    const point = pointRow ? pointRow.adjustment : 0;
    const zone = zoneRow ? zoneRow.spread : 0;
    const basis = trade.basis || 0;
    const local = Number((board + point + zone).toFixed(2));
    const flat = Number((local + basis).toFixed(2));
    priceLadderContainer.innerHTML = `
      <div><strong>Board</strong> ${board.toFixed(2)}</div>
      <div><strong>Pricing Point</strong> ${point >= 0 ? '+' : ''}${point.toFixed(2)}</div>
      <div><strong>Zone Spread</strong> ${zone >= 0 ? '+' : ''}${zone.toFixed(2)}</div>
      <div><strong>Local</strong> ${local.toFixed(2)}</div>
      <div><strong>Basis</strong> ${basis >= 0 ? '+' : ''}${basis.toFixed(2)}</div>
      <div><strong>Flat</strong> ${flat.toFixed(2)}</div>
    `;
  }

  function renderTradeTimeline(trade) {
    const timeline = document.querySelector('[data-role="trade-timeline"]');
    if (!timeline) return;
    timeline.innerHTML = '';
    const stages = ['Created', 'Priced', 'Scheduled', 'Execution', 'Closed'];
    const stageIndex = {
      Open: 1,
      Working: 2,
      Nominated: 2,
      Confirmed: 3,
      Closed: 4,
    };
    const progress = stageIndex[trade.status] ?? 1;
    stages.forEach((stage, index) => {
      const reached = index <= progress;
      const item = utils.createElement('li', {
        html: `<strong>${stage}</strong><span>${reached ? 'Complete' : 'Pending'}</span>`,
      });
      timeline.appendChild(item);
    });
  }

  function showTradeDetail(id) {
    const trade = data.getTradeById(id);
    const detail = document.querySelector('[data-role="trade-detail"] .detail-body');
    if (!trade) {
      detail.textContent = 'Trade not found.';
      return;
    }
    currentTradeId = trade.id;
    if (copyTradeButton) {
      copyTradeButton.hidden = false;
      copyTradeButton.dataset.trade = trade.id;
    }

    detail.innerHTML = '';
    detail.appendChild(
      utils.createElement('div', {
        className: 'detail-row',
        html: `<strong>Counterparty</strong><span>${trade.counterparty}</span>`,
      })
    );
    detail.appendChild(
      utils.createElement('div', {
        className: 'detail-row',
        html: `<strong>Commodity</strong><span>${trade.commodity}</span>`,
      })
    );
    detail.appendChild(
      utils.createElement('div', {
        className: 'detail-row',
        html: `<strong>Quantity</strong><span>${(trade.unpricedQty ?? trade.qty).toLocaleString()} ${trade.uom}</span>`,
      })
    );
    detail.appendChild(
      utils.createElement('div', {
        className: 'detail-row',
        html: `<strong>Delivery</strong><span>${trade.deliveryWindow}</span>`,
      })
    );
    detail.appendChild(
      utils.createElement('div', {
        className: 'detail-row',
        html: `<strong>Status</strong><span class="tag">${trade.status}</span>`,
      })
    );
    detail.appendChild(
      utils.createElement('div', {
        className: 'detail-row',
        html: `<strong>Market Month</strong><span>${trade.marketMonth}</span>`,
      })
    );

    const freightReserved = trade.freightAccrual?.reserved || 0;
    const freightActual = trade.freightAccrual?.actual || 0;
    detail.appendChild(utils.createElement('div', {
      className: 'detail-row',
      html: `<strong>Freight</strong><span>Reserved ${utils.formatMillions(freightReserved / 1_000_000)} | Actual ${freightActual ? utils.formatMillions(freightActual / 1_000_000) : 'Pending'}</span>`,
    }));

    renderPriceLadder(trade);
    renderTradeTimeline(trade);
  }

  function renderInventory() {
    const inventory = data.getInventory();
    const lotsContainer = document.querySelector('[data-role="inventory-lots"]');
    lotsContainer.innerHTML = '';
    inventory.lotsByElevator.forEach(({ elevator, lots }) => {
      const block = utils.createElement('div', { className: 'quant-tile' });
      block.innerHTML = `<h4>${elevator}</h4>`;
      lots.forEach((lot) => {
        block.appendChild(utils.createElement('p', { html: `<strong>${lot.commodity}</strong> · ${lot.qty.toLocaleString()} ${lot.uom} · Grade ${lot.grade} · Age ${lot.age}d` }));
      });
      lotsContainer.appendChild(block);
    });

    charts.mountChart('chart-inventory-month', {
      type: 'bar',
      data: {
        labels: inventory.monthExposure.map((entry) => entry.label),
        datasets: [{ data: inventory.monthExposure.map((entry) => entry.value / 1000), backgroundColor: '#3a7afe' }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } },
    });

    charts.mountChart('chart-quality', {
      type: 'doughnut',
      data: {
        labels: inventory.qualityDistribution.map((entry) => entry.label),
        datasets: [{ data: inventory.qualityDistribution.map((entry) => entry.value), backgroundColor: ['#55b689', '#3a7afe', '#ffc66b'], borderWidth: 0 }],
      },
      options: { cutout: '60%', plugins: { legend: { position: 'bottom' } } },
    });

    charts.mountChart('chart-aging', {
      type: 'bar',
      data: {
        labels: inventory.agingHistogram.map((entry) => entry.label),
        datasets: [{ data: inventory.agingHistogram.map((entry) => Number((entry.value / 1000).toFixed(2))), backgroundColor: '#8a79ff' }],
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(110,130,160,0.16)' } } } },
    });

    const scatterData = inventory.qualityScatter.map((lot) => ({
      x: lot.moisture,
      y: lot.protein,
      r: Math.max(4, Math.min(18, Math.sqrt(lot.qty) / 80)),
      label: `${lot.commodity} · ${lot.qty.toLocaleString()}`,
    }));
    charts.mountChart('chart-quality-scatter', {
      type: 'bubble',
      data: {
        datasets: [
          {
            label: 'Lots',
            data: scatterData,
            backgroundColor: scatterData.map(() => 'rgba(76, 141, 251, 0.35)'),
            borderColor: scatterData.map(() => '#4c8dfb'),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Moisture %' }, grid: { color: 'rgba(110,130,160,0.16)' } },
          y: { title: { display: true, text: 'Protein %' }, grid: { color: 'rgba(110,130,160,0.16)' } },
        },
      },
    });

    const capacityContainer = document.querySelector('[data-role="capacity-util"]');
    if (capacityContainer) {
      capacityContainer.innerHTML = '';
      inventory.capacity.forEach((entry) => {
        const card = utils.createElement('div', { className: 'capacity-card' });
        card.innerHTML = `
          <h4>${entry.elevator}</h4>
          <p>${entry.used.toLocaleString()} of ${entry.capacity.toLocaleString()}</p>
          <p>${entry.pct}% utilized</p>
        `;
        capacityContainer.appendChild(card);
      });
    }

    const ticketsContainer = document.querySelector('[data-role="open-tickets"]');
    ticketsContainer.innerHTML = '';
    if (inventory.openTickets.length === 0) {
      ticketsContainer.textContent = 'All tickets matched. Exposure clean.';
    } else {
      inventory.openTickets.forEach((ticket) => {
        const row = utils.createElement('div', { className: 'detail-row' });
        row.innerHTML = `<span><strong>${ticket.id}</strong> · ${ticket.tradeId} · ${ticket.qty.toLocaleString()} ${ticket.uom} · ${ticket.marketZone}</span>`;
        const button = utils.createElement('button', { text: 'Match', attrs: { 'data-action': 'match-ticket', 'data-id': ticket.id, title: `Impact ${utils.formatMillions(ticket.impact)}` } });
        row.appendChild(button);
        ticketsContainer.appendChild(row);
      });
    }
  }

  function renderHedge() {
    const exposure = data.getExposureSummary();
    const futures = data.getFutures();
    const commoditySelect = hedgePercentForm.querySelector('select[name="commodity"]');
    const previousCommodity = commoditySelect.value;
    commoditySelect.innerHTML = '';
    Object.keys(exposure.byCommodity).forEach((commodity) => {
      commoditySelect.appendChild(utils.createElement('option', { text: commodity, attrs: { value: commodity } }));
    });
    if (previousCommodity && Object.prototype.hasOwnProperty.call(exposure.byCommodity, previousCommodity)) {
      commoditySelect.value = previousCommodity;
    }

    const selectedCommodity =
      commoditySelect.value || commoditySelect.options[0]?.value || Object.keys(exposure.byCommodity)[0];

    const monthSelect = hedgePercentForm.querySelector('select[name="month"]');
    const previousMonth = monthSelect.value;
    monthSelect.innerHTML = '';
    futures.suggestedMonths
      .filter((suggestion) => !selectedCommodity || suggestion.commodity === selectedCommodity)
      .forEach((suggestion) => {
        monthSelect.appendChild(
          utils.createElement('option', {
            text: `${suggestion.month} (${suggestion.board.toFixed(2)})`,
            attrs: { value: suggestion.month },
          })
        );
      });
    if (previousMonth && Array.from(monthSelect.options).some((option) => option.value === previousMonth)) {
      monthSelect.value = previousMonth;
    }
    const defaultMonth = monthSelect.value || monthSelect.options[0]?.value || futures.suggestedMonths[0]?.month || '';

    const exposureContainer = document.querySelector('[data-role="hedge-exposure"]');
    exposureContainer.innerHTML = '';
    Object.entries(exposure.byCommodity).forEach(([commodity, values]) => {
      const coverage = values.physical === 0 ? 0 : Math.round((values.hedged / values.physical) * 100);
      const commoditySuggestion = futures.suggestedMonths.find((row) => row.commodity === commodity);
      const monthTarget = commoditySuggestion ? commoditySuggestion.month : defaultMonth;
      const block = utils.createElement('p', {
        html: `<strong>${commodity}</strong> · ${values.physical.toLocaleString()} phys / ${values.hedged.toLocaleString()} hedged → ${coverage}%`,
      });
      const action = utils.createElement('button', {
        text: 'Target 80%',
        attrs: { 'data-action': 'target-hedge', 'data-commodity': commodity, 'data-month': monthTarget },
      });
      block.appendChild(action);
      exposureContainer.appendChild(block);
    });

    const symbolSelect = rollForm.querySelector('select[name="symbol"]');
    const fromSelect = rollForm.querySelector('select[name="from"]');
    const toSelect = rollForm.querySelector('select[name="to"]');
    symbolSelect.innerHTML = '';
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    futures.positions.forEach((position) => {
      if (!Array.from(symbolSelect.options).find((opt) => opt.value === position.symbol)) {
        symbolSelect.appendChild(utils.createElement('option', { text: position.symbol, attrs: { value: position.symbol } }));
      }
      fromSelect.appendChild(utils.createElement('option', { text: position.month, attrs: { value: position.month } }));
    });
    futures.suggestedMonths.forEach((suggestion) => {
      toSelect.appendChild(utils.createElement('option', { text: `${suggestion.month}`, attrs: { value: suggestion.month } }));
    });

    charts.mountChart('chart-hedge-ratio', {
      type: 'line',
      data: {
        labels: futures.hedgeMonths.length ? futures.hedgeMonths : ['Now'],
        datasets: [{ data: futures.hedgeRatioHistory.length ? futures.hedgeRatioHistory : [data.getAggregates().hedgeCoverage], borderColor: '#3a7afe', tension: 0.35, fill: false }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { suggestedMin: 0, suggestedMax: 100 } } },
    });

    const termStructure = data.getTermStructure(selectedCommodity);
    charts.mountChart('chart-term-structure', {
      type: 'line',
      data: {
        labels: termStructure.map((point) => point.month),
        datasets: [
          {
            label: `${selectedCommodity} Board`,
            data: termStructure.map((point) => point.price),
            borderColor: '#4c8dfb',
            fill: false,
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const ladder = exposure.ladder || [];
    charts.mountChart('chart-hedge-ladder', {
      type: 'bar',
      data: {
        labels: ladder.map((entry) => entry.month),
        datasets: [
          {
            label: 'Physical',
            data: ladder.map((entry) => Number((entry.physical / 1000).toFixed(2))),
            backgroundColor: '#4c8dfb',
          },
          {
            label: 'Hedged',
            data: ladder.map((entry) => Number((Math.min(Math.abs(entry.hedged), Math.abs(entry.physical)) / 1000).toFixed(2))),
            backgroundColor: '#53c38c',
          },
        ],
      },
      options: { scales: { x: { stacked: true }, y: { stacked: true } } },
    });

    if (scenarioSlider) {
      const scenario = data.getScenarioResult();
      scenarioSlider.value = Number(scenario.shock || 0);
    }
    updateScenarioOutput();

    if (hedgeLogList) {
      hedgeLogList.innerHTML = '';
      data.getHedgeLog().forEach((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        hedgeLogList.appendChild(utils.createElement('li', { text: `${time} · ${entry.message}` }));
      });
    }
  }

  function renderRisk() {
    const aggregates = data.getAggregates();
    const net = aggregates.netPL;
    charts.mountChart('chart-waterfall', {
      type: 'bar',
      data: {
        labels: ['Basis', 'Futures', 'Freight', 'Other', 'Net'],
        datasets: [
          {
            label: 'P&L',
            data: [aggregates.basisPL, aggregates.futuresPL, aggregates.freightVar, aggregates.otherPL, net],
            backgroundColor: ['#7f9cff', '#4c8dfb', '#ff7a7a', '#8a79ff', '#53c38c'],
            borderSkipped: false,
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    });

    if (varianceSummaryTable) {
      const summaryData = data.getVarianceActivity();
      const aggregatesRow = {
        bucket: 'All',
        count: summaryData.reduce((sum, item) => sum + item.count, 0),
        delta: summaryData.reduce((sum, item) => sum + item.delta, 0),
      };
      const rows = [aggregatesRow, ...summaryData.map((item) => ({ bucket: item.label, count: item.count, delta: item.delta }))];
      const availableBuckets = rows.map((row) => row.bucket);
      if (!availableBuckets.includes(varianceFilter)) {
        varianceFilter = 'All';
      }

      let tbody = varianceSummaryTable.tBodies[0];
      if (!tbody) {
        tbody = document.createElement('tbody');
        varianceSummaryTable.appendChild(tbody);
      }
      tbody.innerHTML = '';
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.dataset.bucket = row.bucket;
        tr.innerHTML = `
          <td>${row.bucket}</td>
          <td>${row.count}</td>
          <td>${utils.formatMillions(row.delta)}</td>
        `;
        const isActive = varianceFilter === row.bucket || (row.bucket === 'All' && varianceFilter === 'All');
        tr.classList.toggle('is-active', isActive);
        tbody.appendChild(tr);
      });
    }

    if (varianceDetailContainer) {
      const details = data.getVarianceDetails(varianceFilter);
      varianceDetailContainer.innerHTML = '';
      if (!details.length) {
        varianceDetailContainer.appendChild(utils.createElement('p', { className: 'empty-state', text: 'No variance items.' }));
      } else {
        const table = utils.createElement('table', { className: 'data-table' });
        table.innerHTML = '<thead><tr><th>ID</th><th>Bucket</th><th>Description</th><th>Δ P&L</th></tr></thead>';
        const tbody = document.createElement('tbody');
        details.forEach((item) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.bucket}</td>
            <td>${item.description}</td>
            <td>${utils.formatMillions(item.pnl)}</td>
          `;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        varianceDetailContainer.appendChild(table);
      }
    }

    const badge = document.querySelector('[data-role="correlation-badge"]');
    if (badge) {
      const correlation = data.getCorrelationBadge();
      badge.textContent = `Correlation ${correlation.value}`;
      badge.dataset.tone = correlation.tone;
    }

    const carryHeadline = document.querySelector('[data-role="carry-headline"]');
    if (carryHeadline) {
      carryHeadline.textContent = data.getCarryHeadline();
    }

    const spark = data.getCarrySpark();
    charts.mountChart('chart-carry-spark', {
      type: 'line',
      data: {
        labels: spark.map((_, index) => index + 1),
        datasets: [
          {
            data: spark,
            borderColor: '#4c8dfb',
            fill: false,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } },
    });
  }

  function renderIntel() {
    const intel = data.getIntel();
    const timelineList = document.querySelector('[data-role="intel-timeline"]');
    const volCard = document.querySelector('[data-role="intel-vol"]');
    const seasonalityCard = document.querySelector('[data-role="intel-seasonality"]');
    const spreadCard = document.querySelector('[data-role="intel-spread"]');
    const sentimentCard = document.querySelector('[data-role="intel-sentiment"]');

    if (timelineList) {
      timelineList.innerHTML = '';
      intel.timeline.forEach((item) => {
        const li = utils.createElement('li');
        const dateLabel = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        li.innerHTML = `
          <time datetime="${item.date}">${dateLabel}</time>
          <div>
            <strong>${item.headline}</strong>
            <p>${item.takeaway}</p>
          </div>
        `;
        timelineList.appendChild(li);
      });
    }

    const vol = intel.factors.volatility;
    const ceiling = Math.max(vol.current, vol.average) * 1.4;
    charts.mountChart('chart-intel-vol', {
      type: 'doughnut',
      data: {
        labels: ['Current', 'Buffer'],
        datasets: [
          {
            data: [vol.current, Math.max(0.1, ceiling - vol.current)],
            backgroundColor: ['#4c8dfb', 'rgba(28, 35, 49, 0.8)'],
            borderWidth: 0,
          },
        ],
      },
      options: { cutout: '72%', plugins: { legend: { display: false } } },
    });
    if (volCard) {
      let meta = volCard.querySelector('.factor-meta');
      if (!meta) {
        meta = utils.createElement('p', { className: 'factor-meta' });
        volCard.appendChild(meta);
      }
      meta.textContent = `Current ${vol.current}% vs avg ${vol.average}%`;
    }

    const seasonality = intel.factors.seasonality;
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    charts.mountChart('chart-intel-seasonality', {
      type: 'line',
      data: {
        labels: monthLabels.slice(0, seasonality.length),
        datasets: [
          {
            data: seasonality,
            borderColor: '#53c38c',
            backgroundColor: '#53c38c33',
            fill: 'origin',
            pointRadius: 0,
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    });
    if (seasonalityCard) {
      let meta = seasonalityCard.querySelector('.factor-meta');
      if (!meta) {
        meta = utils.createElement('p', { className: 'factor-meta' });
        seasonalityCard.appendChild(meta);
      }
      meta.textContent = 'Indexed seasonal curve';
    }

    const spreads = intel.factors.spreads;
    charts.mountChart('chart-intel-spread', {
      type: 'bar',
      data: {
        labels: spreads.labels,
        datasets: [
          {
            data: spreads.values,
            backgroundColor: '#f6c85f',
            borderRadius: 6,
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    });
    if (spreadCard) {
      let meta = spreadCard.querySelector('.factor-meta');
      if (!meta) {
        meta = utils.createElement('p', { className: 'factor-meta' });
        spreadCard.appendChild(meta);
      }
      meta.textContent = 'Front vs deferred board';
    }

    if (sentimentCard) {
      sentimentCard.dataset.tone = intel.factors.sentiment.label.toLowerCase();
      const labelEl = sentimentCard.querySelector('.sentiment-label');
      const contextEl = sentimentCard.querySelector('.sentiment-context');
      if (labelEl) labelEl.textContent = intel.factors.sentiment.label;
      if (contextEl) contextEl.textContent = `Score ${intel.factors.sentiment.score}`;
    }
  }

  function renderPricing() {
    const pricingData = data.getPricing();
    const surfaceTable = document.querySelector('[data-role="price-surface"]');
    const pointContainer = document.querySelector('[data-role="pricing-points"]');
    const zoneContainer = document.querySelector('[data-role="pricing-zones"]');

    if (surfaceTable) {
      surfaceTable.innerHTML = '';
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.appendChild(utils.createElement('th', { text: 'Commodity' }));
      pricingData.surface.months.forEach((month) => {
        headerRow.appendChild(utils.createElement('th', { text: month }));
      });
      thead.appendChild(headerRow);
      surfaceTable.appendChild(thead);

      const tbody = document.createElement('tbody');
      pricingData.surface.commodities.forEach((commodity) => {
        const tr = document.createElement('tr');
        const lead = utils.createElement('th', { text: commodity });
        tr.appendChild(lead);
        pricingData.surface.months.forEach((month, index) => {
          const td = document.createElement('td');
          const input = document.createElement('input');
          input.type = 'number';
          input.step = '0.01';
          const value = pricingData.surface.values[commodity]?.[index];
          input.value = value == null ? '' : Number(value).toFixed(2);
          input.addEventListener('change', () => {
            pushToast(`Surface updated: ${commodity} ${month}`);
            data.updateMarketPrice({ commodity, month, value: input.value });
          });
          td.appendChild(input);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      surfaceTable.appendChild(tbody);
    }

    if (pointContainer) {
      pointContainer.innerHTML = '';
      const table = utils.createElement('table', { className: 'data-table data-table--editable' });
      table.innerHTML = '<thead><tr><th>Name</th><th>Commodity</th><th>Adjustment</th><th></th></tr></thead>';
      const tbody = document.createElement('tbody');
      pricingData.pricingPoints.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.name}</td><td>${row.commodity}</td>`;
        const valueCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        const pointValue = Number(row.adjustment);
        input.value = Number.isFinite(pointValue) ? pointValue.toFixed(2) : '0.00';
        valueCell.appendChild(input);
        tr.appendChild(valueCell);
        const actionCell = document.createElement('td');
        const button = utils.createElement('button', { text: 'Apply' });
        button.addEventListener('click', () => {
          pushToast(`Pricing point ${row.name} saved`);
          data.updatePricingPoint({ name: row.name, commodity: row.commodity, value: input.value });
        });
        actionCell.appendChild(button);
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      pointContainer.appendChild(table);
    }

    if (zoneContainer) {
      zoneContainer.innerHTML = '';
      const table = utils.createElement('table', { className: 'data-table data-table--editable' });
      table.innerHTML = '<thead><tr><th>Zone</th><th>Commodity</th><th>Spread</th><th></th></tr></thead>';
      const tbody = document.createElement('tbody');
      pricingData.zoneSpreads.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.zone}</td><td>${row.commodity}</td>`;
        const valueCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        const spreadValue = Number(row.spread);
        input.value = Number.isFinite(spreadValue) ? spreadValue.toFixed(2) : '0.00';
        valueCell.appendChild(input);
        tr.appendChild(valueCell);
        const actionCell = document.createElement('td');
        const button = utils.createElement('button', { text: 'Apply' });
        button.addEventListener('click', () => {
          pushToast(`Zone ${row.zone} spread updated`);
          data.updateZoneSpread({ zone: row.zone, commodity: row.commodity, value: input.value });
        });
        actionCell.appendChild(button);
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      zoneContainer.appendChild(table);
    }
  }

  function renderDataHub() {
    const ref = data.getReferenceData();
    const refContainer = document.querySelector('[data-role="reference-data"]');
    if (refContainer) {
      refContainer.innerHTML = '';
      Object.entries(ref).forEach(([key, values]) => {
        const block = utils.createElement('div', { className: 'quant-tile' });
        block.innerHTML = `<h4>${key}</h4><p>${values.join(', ')}</p>`;
        refContainer.appendChild(block);
      });
    }

    const snapshotContainer = document.querySelector('[data-role="snapshot-loader"]');
    if (snapshotContainer) {
      snapshotContainer.innerHTML = '';
      const options = [
        { key: 'today', label: 'Live' },
        { key: 'monthEndAug', label: 'Month-End Aug' },
      ];
      const active = data.getSnapshot().key;
      options.forEach((item) => {
        const button = utils.createElement('button', { text: item.label, attrs: { 'data-snapshot': item.key } });
        button.classList.toggle('is-active', active === item.key);
        button.addEventListener('click', () => data.setSnapshot(item.key));
        snapshotContainer.appendChild(button);
      });
    }

    if (systemHealthList) {
      systemHealthList.innerHTML = '';
      const health = data.getSystemHealth();
      const entries = [
        { label: 'Snapshot', value: health.snapshot },
        { label: 'Chart count', value: health.chartCount },
        { label: 'Events', value: health.eventCount },
        { label: 'Avg render (ms)', value: health.avgRender },
        { label: 'Last event', value: health.lastEvent ? new Date(health.lastEvent).toLocaleTimeString() : '--' },
        { label: 'Last reason', value: health.lastReason || '--' },
        { label: 'Scenario shock', value: `${Number(health.scenarioShock).toFixed(1)}%` },
        { label: 'Hedge log entries', value: health.hedgeLog },
      ];
      entries.forEach((entry) => {
        const item = utils.createElement('li');
        item.innerHTML = `<strong>${entry.label}</strong><span>${entry.value}</span>`;
        systemHealthList.appendChild(item);
      });
      const healthContainer = document.querySelector('[data-role="system-health"]');
      if (healthContainer) {
        healthContainer.dataset.snapshot = health.snapshot;
      }
    }
  }

  data.setScenarioShock(0);
  if (scenarioSlider) {
    scenarioSlider.value = 0;
  }
  updateScenarioOutput();

  renderHeader();
  renderActiveView();
})();
