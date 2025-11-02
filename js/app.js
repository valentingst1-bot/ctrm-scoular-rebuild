(function () {
  const utils = window.CTRMUtils;
  const data = window.CTRMData;
  const router = window.CTRMRouting;
  const charts = window.CTRMCharts;

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

  let activeRoute = '#/trader';
  let debugEnabled = false;

  const routeHandlers = {
    '#/trader': {
      render: renderTrader,
      destroy: () => {
        charts.destroyChart('chart-mtm-trend');
        charts.destroyChart('chart-exposure-commodity');
        charts.destroyChart('chart-hedge-physical');
      },
    },
    '#/physical': { render: renderPhysical },
    '#/inventory': {
      render: renderInventory,
      destroy: () => {
        charts.destroyChart('chart-inventory-month');
        charts.destroyChart('chart-quality');
        charts.destroyChart('chart-aging');
      },
    },
    '#/hedge': {
      render: renderHedge,
      destroy: () => {
        charts.destroyChart('chart-hedge-ratio');
        charts.destroyChart('chart-hedge-sensitivity');
      },
    },
    '#/risk': {
      render: renderRisk,
      destroy: () => {
        charts.destroyChart('chart-waterfall');
        charts.destroyChart('chart-carry-spark');
      },
    },
    '#/intel': { render: renderIntel },
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
  });

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
    const mapping = {
      mtmChange: aggregates.netPL,
      hedgeCoverage: aggregates.hedgeCoverage,
      basisPL: aggregates.basisPL,
      futuresPL: aggregates.futuresPL,
      freightVar: aggregates.freightVar,
      otherPL: aggregates.otherPL,
      workingCapital: aggregates.workingCapital,
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
    kpiTiles.forEach((tile) => {
      const key = tile.dataset.kpi;
      const formatter = formatters[key] || ((value) => value);
      tile.querySelector('.kpi-value').textContent = formatter(mapping[key]);
    });
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

    const mtmSeries = data.getMtmSeries();
    charts.mountChart('chart-mtm-trend', {
      type: 'line',
      data: {
        labels: mtmSeries.map((point) => point.label),
        datasets: [{
          label: 'Net MTM',
          data: mtmSeries.map((point) => point.value),
          borderColor: '#3a7afe',
          tension: 0.35,
          fill: {
            target: 'origin',
            above: 'rgba(58, 122, 254, 0.16)',
          },
          pointRadius: 2,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });

    const exposure = data.getExposureSummary();
    const commodities = Object.keys(exposure.byCommodity);
    const physicalValues = commodities.map((key) => exposure.byCommodity[key].physical / 1000);

    charts.mountChart('chart-exposure-commodity', {
      type: 'bar',
      data: {
        labels: commodities,
        datasets: [{
          label: 'Physical (000s)',
          data: physicalValues,
          backgroundColor: '#55b689',
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });

    const hedgeTotals = commodities.reduce((acc, key) => {
      acc.hedged += exposure.byCommodity[key].hedged;
      acc.physical += exposure.byCommodity[key].physical;
      return acc;
    }, { hedged: 0, physical: 0 });

    charts.mountChart('chart-hedge-physical', {
      type: 'doughnut',
      data: {
        labels: ['Hedged', 'Physical'],
        datasets: [{
          data: [hedgeTotals.hedged, hedgeTotals.physical],
          backgroundColor: ['#55b689', '#3a7afe'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '68%',
        plugins: { legend: { position: 'bottom' } },
      },
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

    document.querySelector('.empty-state').hidden = filtered.length > 0;
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

  function showTradeDetail(id) {
    const trade = data.getTradeById(id);
    const detail = document.querySelector('[data-role="trade-detail"] .detail-body');
    if (!trade) {
      detail.textContent = 'Trade not found.';
      return;
    }
    const pricing = data.getPricing();
    const board = pricing.marketPrices.find((row) => row.commodity === trade.commodity && row.month === trade.marketMonth);
    const point = pricing.pricingPoints.find((row) => row.name === trade.pricingPoint && row.commodity === trade.commodity);
    const zone = pricing.zoneSpreads.find((row) => row.zone === trade.marketZone && row.commodity === trade.commodity);
    const localNow = trade.currentLocalPrice || trade.contractLocalPrice;
    const futuresNow = board ? board.price : trade.futuresPrice;
    const pointAdj = point ? point.adjustment : 0;
    const zoneAdj = zone ? zone.spread : 0;

    detail.innerHTML = '';
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Counterparty</strong><span>${trade.counterparty}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Commodity</strong><span>${trade.commodity}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Quantity</strong><span>${trade.unpricedQty.toLocaleString()} ${trade.uom}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Price Stack</strong><span>${futuresNow.toFixed(2)} board + ${pointAdj.toFixed(2)} point + ${zoneAdj.toFixed(2)} zone = ${localNow.toFixed(2)} local</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Delivery Window</strong><span>${trade.deliveryWindow}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Market Month</strong><span>${trade.marketMonth}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Status</strong><span class="tag">${trade.status}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Freight</strong><span>Accrual ${utils.formatMillions((trade.freightAccrual?.reserved || 0) / 1_000_000)} | Actual ${trade.freightAccrual?.actual ? utils.formatMillions((trade.freightAccrual.actual) / 1_000_000) : 'Pending'}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Timeline</strong><span>Origination → Pricing → Logistics → ${trade.status}</span>` }));
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
      type: 'line',
      data: {
        labels: inventory.agingCurve.map((entry) => entry.label),
        datasets: [{ data: inventory.agingCurve.map((entry) => entry.value), borderColor: '#8a79ff', tension: 0.35, fill: false }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const ticketsContainer = document.querySelector('[data-role="open-tickets"]');
    ticketsContainer.innerHTML = '';
    if (inventory.openTickets.length === 0) {
      ticketsContainer.textContent = 'All tickets matched. Exposure clean.';
    } else {
      inventory.openTickets.forEach((ticket) => {
        const row = utils.createElement('div', { className: 'detail-row' });
        row.innerHTML = `<span><strong>${ticket.id}</strong> · ${ticket.tradeId} · ${ticket.qty.toLocaleString()} ${ticket.uom} · ${ticket.marketZone}</span>`;
        const button = utils.createElement('button', { text: 'Match', attrs: { 'data-action': 'match-ticket', 'data-id': ticket.id } });
        row.appendChild(button);
        ticketsContainer.appendChild(row);
      });
    }
  }

  function renderHedge() {
    const exposure = data.getExposureSummary();
    const exposureContainer = document.querySelector('[data-role="hedge-exposure"]');
    exposureContainer.innerHTML = '';
    Object.entries(exposure.byCommodity).forEach(([commodity, values]) => {
      const coverage = values.physical === 0 ? 0 : Math.round((values.hedged / values.physical) * 100);
      exposureContainer.appendChild(utils.createElement('p', { html: `<strong>${commodity}</strong> · ${values.physical.toLocaleString()} phys / ${values.hedged.toLocaleString()} hedged → ${coverage}%` }));
    });

    const futures = data.getFutures();
    const commoditySelect = hedgePercentForm.querySelector('select[name="commodity"]');
    commoditySelect.innerHTML = '';
    Object.keys(exposure.byCommodity).forEach((commodity) => {
      commoditySelect.appendChild(utils.createElement('option', { text: commodity, attrs: { value: commodity } }));
    });

    const monthSelect = hedgePercentForm.querySelector('select[name="month"]');
    monthSelect.innerHTML = '';
    futures.suggestedMonths.forEach((suggestion) => {
      monthSelect.appendChild(utils.createElement('option', { text: `${suggestion.commodity} ${suggestion.month} (${suggestion.board.toFixed(2)})`, attrs: { value: suggestion.month } }));
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

    charts.mountChart('chart-hedge-sensitivity', {
      type: 'bar',
      data: {
        labels: ['-3%', '-2%', '-1%', 'Flat', '+1%', '+2%', '+3%'],
        datasets: [{ data: futures.pnlSensitivity, backgroundColor: futures.pnlSensitivity.map((value) => (value >= 0 ? '#55b689' : '#ff6f6f')) }],
      },
      options: { plugins: { legend: { display: false } } },
    });
  }

  function renderRisk() {
    const aggregates = data.getAggregates();
    const net = aggregates.netPL;
    const spark = data.getCarrySpark();
    charts.mountChart('chart-waterfall', {
      type: 'bar',
      data: {
        labels: ['Basis', 'Futures', 'Freight', 'Other', 'Net'],
        datasets: [{
          label: 'P&L',
          data: [aggregates.basisPL, aggregates.futuresPL, aggregates.freightVar, aggregates.otherPL, net],
          backgroundColor: ['#55b689', '#3a7afe', '#ff6f6f', '#8a79ff', '#55b689'],
        }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const varianceContainer = document.querySelector('[data-role="variance-cards"]');
    varianceContainer.innerHTML = '';
    data.getVarianceActivity().forEach((item) => {
      const card = utils.createElement('div', { className: 'quant-tile' });
      card.innerHTML = `<h4>${item.label}</h4><p>${item.count} events</p><p>${utils.formatMillions(item.delta)}</p>`;
      varianceContainer.appendChild(card);
    });

    document.querySelector('[data-role="carry-headline"]').textContent = data.getCarryHeadline();
    charts.mountChart('chart-carry-spark', {
      type: 'line',
      data: {
        labels: spark.map((_, index) => index + 1),
        datasets: [{ data: spark, borderColor: '#3a7afe', fill: false, tension: 0.35, pointRadius: 0 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } },
    });
  }

  function renderIntel() {
    const intel = data.getIntel();
    const headlines = document.querySelector('[data-role="intel-headlines"]');
    const tiles = document.querySelector('[data-role="intel-quants"]');
    headlines.innerHTML = '';
    tiles.innerHTML = '';
    intel.headlines.forEach((item) => {
      const card = utils.createElement('div', { className: 'quant-tile' });
      card.innerHTML = `<h4>${item.headline}</h4><p>${item.takeaway}</p>`;
      headlines.appendChild(card);
    });
    intel.tiles.forEach((tile) => {
      const card = utils.createElement('div', { className: 'quant-tile' });
      card.innerHTML = `<h4>${tile.label}</h4><p>${tile.value}</p><p>${tile.context}</p>`;
      tiles.appendChild(card);
    });
  }

  function renderPricing() {
    const pricingData = data.getPricing();
    const marketContainer = document.querySelector('[data-role="pricing-market"]');
    const pointContainer = document.querySelector('[data-role="pricing-points"]');
    const zoneContainer = document.querySelector('[data-role="pricing-zones"]');
    marketContainer.innerHTML = '';
    pointContainer.innerHTML = '';
    zoneContainer.innerHTML = '';

    pricingData.marketPrices.forEach((row) => {
      const form = utils.createElement('form', { className: 'form-inline' });
      form.innerHTML = `
        <label>Commodity<input type="text" value="${row.commodity}" readonly></label>
        <label>Month<input type="text" value="${row.month}" readonly></label>
        <label>Price<input type="number" step="0.01" value="${row.price}"></label>
        <button type="button">Update</button>
      `;
      form.querySelector('button').addEventListener('click', () => {
        const value = form.querySelector('input[type="number"]').value;
        data.updateMarketPrice({ commodity: row.commodity, month: row.month, value });
      });
      marketContainer.appendChild(form);
    });

    pricingData.pricingPoints.forEach((row) => {
      const form = utils.createElement('form', { className: 'form-inline' });
      form.innerHTML = `
        <label>Name<input type="text" value="${row.name}" readonly></label>
        <label>Commodity<input type="text" value="${row.commodity}" readonly></label>
        <label>Adjustment<input type="number" step="0.01" value="${row.adjustment}"></label>
        <button type="button">Save</button>
      `;
      form.querySelector('button').addEventListener('click', () => {
        const value = form.querySelector('input[type="number"]').value;
        data.updatePricingPoint({ name: row.name, commodity: row.commodity, value });
      });
      pointContainer.appendChild(form);
    });

    pricingData.zoneSpreads.forEach((row) => {
      const form = utils.createElement('form', { className: 'form-inline' });
      form.innerHTML = `
        <label>Zone<input type="text" value="${row.zone}" readonly></label>
        <label>Commodity<input type="text" value="${row.commodity}" readonly></label>
        <label>Spread<input type="number" step="0.01" value="${row.spread}"></label>
        <button type="button">Apply</button>
      `;
      form.querySelector('button').addEventListener('click', () => {
        const value = form.querySelector('input[type="number"]').value;
        data.updateZoneSpread({ zone: row.zone, commodity: row.commodity, value });
      });
      zoneContainer.appendChild(form);
    });
  }

  function renderDataHub() {
    const ref = data.getReferenceData();
    const refContainer = document.querySelector('[data-role="reference-data"]');
    refContainer.innerHTML = '';
    Object.entries(ref).forEach(([key, values]) => {
      const block = utils.createElement('div', { className: 'quant-tile' });
      block.innerHTML = `<h4>${key}</h4><p>${values.join(', ')}</p>`;
      refContainer.appendChild(block);
    });

    const snapshotContainer = document.querySelector('[data-role="snapshot-loader"]');
    snapshotContainer.innerHTML = '';
    [
      { key: 'today', label: 'Live' },
      { key: 'monthEndAug', label: 'Month-End Aug' },
    ].forEach((item) => {
      const button = utils.createElement('button', { text: `Load ${item.label}`, attrs: { 'data-snapshot': item.key } });
      button.addEventListener('click', () => data.setSnapshot(item.key));
      snapshotContainer.appendChild(button);
    });
  }

  renderHeader();
  renderActiveView();
})();
