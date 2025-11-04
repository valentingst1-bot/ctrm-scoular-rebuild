(function () {
  // Safe data accessors
  function getFuturesSafe() {
    try { return window.CTRMData.getFutures?.() || []; } catch (e) { return []; }
  }

  function getStateSafe() {
    try { return window.CTRMData.getState?.() || {}; } catch (e) { return {}; }
  }

  const utils = window.CTRMUtils;
  const data = window.CTRMData;
  const router = window.CTRMRouting;
  const charts = window.CTRMCharts;
  const hedge = window.CTRMHedge;
  const ChartJS = window.Chart;

  const snapshotButtons = document.querySelectorAll('.snapshot-toggle .toggle-button');
  const KPI_SELECTORS = {
    mtm: '[data-kpi="mtm"]',
    hedge: '[data-kpi="hedge"]',
    basis: '[data-kpi="basis"]',
    futures: '[data-kpi="futures"]',
    freight: '[data-kpi="freight"]',
    other: '[data-kpi="other"]',
    wc: '[data-kpi="wc"]',
  };
  const views = Array.from(document.querySelectorAll('.view')).reduce((map, viewEl) => {
    map[viewEl.dataset.route] = { el: viewEl };
    return map;
  }, {});
  const navLinks = document.querySelectorAll('.nav-link');
  const traderCommoditySelect = document.querySelector('[data-role="trader-filter-commodity"]');
  const traderModeButtons = document.querySelectorAll('[data-role="trader-mode"] button');
  const traderWindowButtons = document.querySelectorAll('[data-role="trader-window"] button');

  const traderState = {
    commodity: 'All',
    mode: 'live',
    window: '60',
    carryCommodity: '',
  };

  let coverageGaugeIds = [];

  let activeRoute = null;
  let lastRouteContext = null;

  const hedgeView = views['#/hedge']?.el;
  const hedgeOverviewContainer = hedgeView?.querySelector('#hedge-overview');
  const hedgeDetailContainer = hedgeView?.querySelector('#hedge-detail');
  const hedgeActionsCard = hedgeOverviewContainer?.querySelector('[data-role="hedge-actions-card"]');
  const hedgeActionsPlaceholder = document.createElement('div');
  hedgeActionsPlaceholder.dataset.role = 'hedge-actions-placeholder';
  hedgeActionsPlaceholder.style.display = 'contents';
  if (hedgeActionsCard && hedgeActionsCard.parentElement) {
    hedgeActionsCard.parentElement.insertBefore(hedgeActionsPlaceholder, hedgeActionsCard.nextSibling);
  }
  const hedgeDetailTitle = hedgeDetailContainer?.querySelector('[data-role="hedge-detail-title"]');
  const hedgeDetailSubtitle = hedgeDetailContainer?.querySelector('[data-role="hedge-detail-subtitle"]');
  const hedgeDetailPopout = hedgeDetailContainer?.querySelector('[data-role="hedge-popout"]');
  const hedgeDetailKpis = hedgeDetailContainer?.querySelector('[data-role="hedge-detail-kpis"]');
  const hedgeDetailTicketSlot = hedgeDetailContainer?.querySelector('[data-role="hedge-ticket-slot"]');
  const hedgeDetailActionsLog = hedgeDetailContainer?.querySelector('[data-role="actions-log-body"]');
  const detailCardBodies = hedgeDetailContainer ? {
    term: hedgeDetailContainer.querySelector('[data-role="term-structure-card"] .card__body'),
    ladder: hedgeDetailContainer.querySelector('[data-role="exposure-ladder-card"] .card__body'),
    basis: hedgeDetailContainer.querySelector('[data-role="basis-history-card"] .card__body'),
    priceStack: hedgeDetailContainer.querySelector('[data-role="price-stack-body"]'),
    volCorr: hedgeDetailContainer.querySelector('[data-role="vol-corr-body"]'),
    whatIfCard: hedgeDetailContainer.querySelector('[data-role="what-if-card"]'),
    whatIfBoard: hedgeDetailContainer.querySelector('#whatif-board'),
    whatIfBasis: hedgeDetailContainer.querySelector('#whatif-basis'),
    boardLabel: hedgeDetailContainer.querySelector('[data-role="board-label"]'),
    basisLabel: hedgeDetailContainer.querySelector('[data-role="basis-label"]'),
    whatIfChart: hedgeDetailContainer.querySelector('#chart-whatif'),
    whatIfFutures: hedgeDetailContainer.querySelector('[data-role="whatif-futures"]'),
    whatIfBasisValue: hedgeDetailContainer.querySelector('[data-role="whatif-basis"]'),
    whatIfNet: hedgeDetailContainer.querySelector('[data-role="whatif-net"]'),
  } : {};
  const SYMBOL_TO_COMMODITY = {
    ZS: 'Soybeans',
    ZC: 'Corn',
    ZW: 'Wheat',
    RS: 'Canola',
  };

  let detailResizeObserver = null;

  function refreshDetailCharts() {
    if (!ChartJS || typeof ChartJS.getChart !== 'function') return;
    ['chart-term-structure', 'chart-exposure-ladder', 'chart-basis-history', 'chart-whatif'].forEach((id) => {
      const instance = ChartJS.getChart(id);
      if (instance && typeof instance.resize === 'function') {
        instance.resize();
      }
    });
  }

  function ensureDetailResizeObserver() {
    if (!hedgeDetailContainer || typeof ResizeObserver === 'undefined') return;
    if (detailResizeObserver) return;
    detailResizeObserver = new ResizeObserver(() => {
      refreshDetailCharts();
    });
    detailResizeObserver.observe(hedgeDetailContainer);
  }

  function teardownHedgeDetail() {
    if (detailResizeObserver) {
      detailResizeObserver.disconnect();
      detailResizeObserver = null;
    }
  }

  const routeHandlers = {
    '#/trader': {
      render: renderTrader,
      destroy: () => {
        charts.destroyChart('chart-mtm-trend');
        charts.destroyChart('chart-exposure-commodity');
        charts.destroyChart('chart-hedge-physical');
        charts.destroyChart('chart-trader-waterfall');
        charts.destroyChart('chart-carry-curve');
        charts.destroyChart('chart-variance-timeline');
        charts.destroyChart('chart-basis-map');
        coverageGaugeIds.forEach((id) => charts.destroyChart(id));
        coverageGaugeIds = [];
      }
    },
    '#/physical': { render: renderPhysical },
    '#/inventory': {
      render: renderInventory,
      destroy: () => {
        charts.destroyChart('chart-inventory-month');
        charts.destroyChart('chart-quality');
        charts.destroyChart('chart-aging');
      }
    },
    '#/hedge': {
      render: renderHedge,
      destroy: () => {
        teardownHedgeDetail();
        hedge.destroy();
      },
    },
    '#/hedge/:commodity': {
      render: renderHedge,
      destroy: () => {
        teardownHedgeDetail();
        hedge.destroy();
      },
      view: '#/hedge',
    },
    '#/risk': {
      render: renderRisk,
      destroy: () => {
        charts.destroyChart('chart-waterfall');
        charts.destroyChart('chart-carry-spark');
      }
    },
    '#/intel': { render: renderIntel },
    '#/pricing': { render: renderPricing },
    '#/datahub': { render: renderDataHub },
  };

  snapshotButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.snapshot;
      if (key) {
        data.setSnapshot(key);
      }
    });
  });

  if (traderCommoditySelect) {
    traderCommoditySelect.addEventListener('change', (event) => {
      traderState.commodity = event.target.value || 'All';
      if (traderState.commodity !== 'All') {
        traderState.carryCommodity = traderState.commodity;
      }
      renderTrader();
    });
  }

  traderModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'live';
      traderState.mode = mode;
      const snapshotKey = mode === 'monthEnd' ? 'monthEndAug' : 'today';
      data.setSnapshot(snapshotKey);
    });
  });

  traderWindowButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      traderState.window = btn.dataset.window || '60';
      renderTrader();
    });
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      router.navigate(link.getAttribute('href'));
    });
  });

  router.subscribe((ctx) => {
    lastRouteContext = ctx;
    activateRoute(ctx.path, ctx);
  });

  data.subscribe((event) => {
    if (event.type === 'snapshotUpdated' || event.type === 'snapshotChanged') {
      renderActiveView();
    }
    if (event.type === 'inventoryUpdated') {
      if (activeRoute === '#/inventory') renderInventory();
    }
  });

  document.addEventListener('ctrm:dataChanged', () => {
    renderHeader(data.getHeaderSnapshot?.());
    renderHedge(lastRouteContext);
    if (activeRoute === '#/trader') {
      renderTrader();
    }
  });
  document.addEventListener('click', (event) => {
    const matchBtn = event.target.closest('[data-action="match-ticket"]');
    if (matchBtn) {
      data.matchTicket(matchBtn.dataset.id);
    }
    const resetBtn = event.target.closest('[data-action="reset-demo"]');
    if (resetBtn) {
      data.resetDemo();
      renderActiveView();
    }
    const focusBtn = event.target.closest('[data-action="focus-commodity"]');
    if (focusBtn) {
      const commodity = focusBtn.dataset.commodity;
      if (commodity) {
        traderState.commodity = commodity;
        traderState.carryCommodity = commodity;
        if (traderCommoditySelect) {
          traderCommoditySelect.value = commodity;
        }
        renderTrader();
      }
    }
    const alertLink = event.target.closest('[data-action="trader-alert"]');
    if (alertLink) {
      const commodity = alertLink.dataset.commodity;
      if (commodity) {
        traderState.commodity = commodity;
        traderState.carryCommodity = commodity;
        if (traderCommoditySelect) {
          traderCommoditySelect.value = commodity;
        }
      }
      const targetRoute = alertLink.dataset.route;
      if (targetRoute) {
        router.navigate(targetRoute);
      }
      renderTrader();
    }
  });

  const tradeFilters = document.querySelectorAll('.filters [data-filter]');
  tradeFilters.forEach((filter) => {
    filter.addEventListener('change', renderPhysical);
  });

  const hedgeActionsForm = document.getElementById('hedgeForm');
  if (hedgeActionsForm) {
    hedgeActionsForm.addEventListener('change', (e) => {
      const formEl = e.currentTarget;
      if (e.target.name === 'actionType') {
        updateHedgeFormUI(formEl);
      }
      validateAndPreviewHedgeForm(formEl);
    });
    hedgeActionsForm.addEventListener('input', (e) => {
      const formEl = e.currentTarget;
      if (e.target.name === 'percent' || e.target.name === 'percent-display') {
        const percentSlider = formEl.querySelector('[name="percent"]');
        const percentDisplay = formEl.querySelector('[name="percent-display"]');
        if (e.target === percentSlider) {
          percentDisplay.value = percentSlider.value;
        } else {
          percentSlider.value = percentDisplay.value;
        }
      }
      validateAndPreviewHedgeForm(formEl);
    });
    hedgeActionsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formEl = event.currentTarget;
      const formData = new FormData(formEl);
      const actionType = formData.get('actionType');

      if (actionType === 'hedge') {
        const commodity = formData.get('commodity');
        const percent = Number(formData.get('percent'));
        const month = formData.get('month');
        data.hedgeExposure({ commodity, percent, month });
        utils.showToast(`Hedged ${percent}% ${commodity} in ${month}`);
      } else { // roll
        const fromSelect = formEl.querySelector('[name="from"]');
        const selectedOption = fromSelect ? fromSelect.options[fromSelect.selectedIndex] : null;
        const symbol = selectedOption?.dataset.symbol;
        const from = formData.get('from');
        const to = formData.get('to');
        const commodityFromForm = formData.get('commodity');
        const commodity = commodityFromForm || SYMBOL_TO_COMMODITY[symbol] || symbol || 'Hedge';
        data.rollMonth({ commodity, from, to, symbol });
        utils.showToast(`Rolled ${commodity} from ${from} to ${to}`);
      }
      document.dispatchEvent(new CustomEvent('ctrm:dataChanged'));
    });
  }

  function activateRoute(route, ctx) {
    const handler = routeHandlers[route];
    const viewRoute = handler?.view || route;
    if (ctx) {
      lastRouteContext = ctx;
    }

    if (activeRoute === route) {
      renderActiveView(ctx);
      return;
    }

    if (activeRoute && routeHandlers[activeRoute]?.destroy) {
      routeHandlers[activeRoute].destroy();
    }

    Object.values(views).forEach((view) => view.el.setAttribute('hidden', ''));
    const nextView = views[viewRoute] || views['#/trader'];
    if (nextView) {
      nextView.el.removeAttribute('hidden');
    }

    activeRoute = route;

    navLinks.forEach((link) => {
      const isActive = link.dataset.route === viewRoute;
      link.classList.toggle('is-active', isActive);
    });

    renderActiveView(ctx);
  }

  function renderActiveView(ctx) {
    const handler = routeHandlers[activeRoute];
    const context = ctx || lastRouteContext || router.parseRoute(window.location.hash || '#/trader');
    if (handler && handler.render) {
      handler.render(context);
    }
    renderHeader(data.getHeaderSnapshot?.());
  }

  function renderHeader(snapshot) {
    const snap = snapshot || (typeof data.getHeaderSnapshot === 'function' ? data.getHeaderSnapshot() : null);
    if (!snap) return;

    const formatters = {
      mtm: utils.formatMillions,
      hedge: utils.formatPercent,
      basis: utils.formatMillions,
      futures: utils.formatMillions,
      freight: utils.formatMillions,
      other: utils.formatMillions,
      wc: utils.formatMillions,
    };

    const safeText = window.CTRMUtils?.safeText;
    Object.entries(KPI_SELECTORS).forEach(([key, selector]) => {
      const formatter = formatters[key] || ((value) => (value ?? '--'));
      const rawValue = snap[key];
      const value = typeof rawValue === 'number'
        ? rawValue
        : (rawValue !== null && rawValue !== '' && !Number.isNaN(Number(rawValue)) ? Number(rawValue) : rawValue);
      const formatted = formatter(value);
      if (typeof safeText === 'function') {
        window.CTRMUtils.safeText(selector, formatted ?? '--');
      }
    });

    const activeKey = snap.key || (typeof data.getSnapshot === 'function' ? data.getSnapshot().key : undefined);
    snapshotButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.snapshot === activeKey);
    });
  }

  function renderTrader() {
    const bulletinsEl = document.querySelector('[data-role="trader-bulletins"]');
    if (!bulletinsEl) return;

    const toRgba = (hex, alpha = 1) => {
      if (!hex) return `rgba(13, 27, 42, ${alpha})`;
      const normalized = hex.replace('#', '');
      const bigint = parseInt(normalized, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const snapshot = data.getSnapshot();
    const exposure = data.getExposureSummary();
    const commodityList = typeof data.getDashboardCommodityList === 'function'
      ? data.getDashboardCommodityList()
      : Object.keys(exposure.byCommodity || {});

    if (traderState.commodity !== 'All' && !commodityList.includes(traderState.commodity)) {
      traderState.commodity = 'All';
    }

    if (!traderState.carryCommodity || !commodityList.includes(traderState.carryCommodity)) {
      traderState.carryCommodity = traderState.commodity !== 'All'
        ? traderState.commodity
        : (commodityList[0] || '');
    }

    if (traderState.commodity !== 'All') {
      traderState.carryCommodity = traderState.commodity;
    }

    if (traderCommoditySelect) {
      traderCommoditySelect.innerHTML = '';
      ['All', ...commodityList].forEach((commodity) => {
        const option = utils.createElement('option', { text: commodity, attrs: { value: commodity } });
        traderCommoditySelect.appendChild(option);
      });
      traderCommoditySelect.value = traderState.commodity;
    }

    const snapshotKey = snapshot.key || 'today';
    traderState.mode = snapshotKey === 'monthEndAug' ? 'monthEnd' : 'live';
    traderModeButtons.forEach((btn) => {
      const mode = btn.dataset.mode || 'live';
      btn.classList.toggle('is-active', mode === traderState.mode);
    });

    traderWindowButtons.forEach((btn) => {
      const win = btn.dataset.window || '60';
      btn.classList.toggle('is-active', win === String(traderState.window));
    });

    bulletinsEl.innerHTML = '';
    (snapshot.bulletins || []).forEach((bullet) => {
      const li = utils.createElement('li', { text: bullet });
      bulletinsEl.appendChild(li);
    });

    const tickerContainer = document.querySelector('[data-role="live-tickers"]');
    if (tickerContainer) {
      tickerContainer.innerHTML = '';
      const tickers = typeof data.getLiveTickers === 'function' ? data.getLiveTickers() : [];
      tickers.forEach((ticker) => {
        const changeClass = ticker.changePct >= 0 ? 'is-up' : 'is-down';
        const tickerEl = utils.createElement('div', { className: `live-ticker ${changeClass}` });
        tickerEl.innerHTML = `
          <span class="live-ticker__commodity">${ticker.commodity}</span>
          <span class="live-ticker__month">${ticker.month}</span>
          <span class="live-ticker__last">${ticker.last.toFixed(2)}</span>
          <span class="live-ticker__change">${ticker.changePct >= 0 ? '+' : ''}${ticker.changePct.toFixed(2)}%</span>
        `;
        tickerContainer.appendChild(tickerEl);
      });
    }

    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mtmSeries = months.map((_, index) => snapshot.mtmChange + index * 0.4 - 1);
    charts.mountChart('chart-mtm-trend', {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'MTM',
          data: mtmSeries,
          borderColor: '#004bff',
          tension: 0.35,
          fill: {
            target: 'origin',
            above: 'rgba(0, 75, 255, 0.18)'
          },
          pointRadius: 3,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { display: false },
          x: { grid: { display: false } }
        }
      }
    });

    let commodityLabels = Object.keys(exposure.byCommodity || {});
    if (traderState.commodity !== 'All') {
      commodityLabels = commodityLabels.filter((label) => label === traderState.commodity);
    }
    const commodityValues = commodityLabels.map((label) => (exposure.byCommodity[label]?.physical || 0) / 1000);
    const exposureColors = commodityLabels.map((label) => {
      const base = utils.getCommodityColor(label);
      if (traderState.commodity === 'All') return base;
      return label === traderState.commodity ? base : toRgba(base, 0.35);
    });

    charts.mountChart('chart-exposure-commodity', {
      type: 'bar',
      data: {
        labels: commodityLabels,
        datasets: [{
          label: 'Physical (000s)',
          data: commodityValues,
          backgroundColor: exposureColors.length ? exposureColors : ['#004bff']
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(13,27,42,0.08)' } }
        }
      }
    });

    const hedgedValues = commodityLabels.map((label) => exposure.byCommodity[label]?.hedged || 0);
    const physicalTotals = commodityLabels.map((label) => exposure.byCommodity[label]?.physical || 0);
    const hedgeTotal = hedgedValues.reduce((a, b) => a + b, 0);
    const physicalTotal = physicalTotals.reduce((a, b) => a + b, 0);
    const doughnutData = traderState.commodity === 'All'
      ? [hedgeTotal, physicalTotal]
      : [hedgedValues[0] || 0, physicalTotals[0] || 0];

    charts.mountChart('chart-hedge-physical', {
      type: 'doughnut',
      data: {
        labels: ['Hedged', 'Physical'],
        datasets: [{
          data: doughnutData,
          backgroundColor: ['#1ab76c', '#004bff'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    const net = snapshot.basisPL + snapshot.futuresPL + snapshot.freightVar + snapshot.otherPL;
    charts.mountChart('chart-trader-waterfall', {
      type: 'bar',
      data: {
        labels: ['Basis', 'Futures', 'Freight', 'Other', 'Net'],
        datasets: [{
          data: [snapshot.basisPL, snapshot.futuresPL, snapshot.freightVar, snapshot.otherPL, net],
          backgroundColor: ['#1ab76c', '#004bff', '#e03e3e', '#8a5aff', '#1ab76c']
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: (value) => `${value.toFixed(1)} MM` } }
        }
      }
    });

    const heatmapContainer = document.querySelector('[data-role="exposure-heatmap"]');
    if (heatmapContainer) {
      heatmapContainer.innerHTML = '';
      const heatmapData = typeof data.getDashboardHeatmap === 'function' ? data.getDashboardHeatmap() : null;
      if (heatmapData) {
        const relevantRows = traderState.commodity === 'All'
          ? heatmapData.rows
          : heatmapData.rows.filter((row) => row.commodity === traderState.commodity);
        const maxValue = Math.max(1, ...heatmapData.rows.flatMap((row) => row.values.map((cell) => cell.physical)));
        const table = utils.createElement('table', { className: 'heatmap-table' });
        const thead = utils.createElement('thead');
        const headerRow = utils.createElement('tr');
        headerRow.appendChild(utils.createElement('th', { text: 'Commodity' }));
        heatmapData.months.forEach((month) => {
          headerRow.appendChild(utils.createElement('th', { text: month }));
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = utils.createElement('tbody');
        (relevantRows.length ? relevantRows : heatmapData.rows).forEach((row) => {
          const tr = utils.createElement('tr', { attrs: { 'data-commodity': row.commodity } });
          if (traderState.commodity !== 'All' && row.commodity === traderState.commodity) {
            tr.classList.add('is-active');
          }
          tr.appendChild(utils.createElement('th', { text: row.commodity }));
          row.values.forEach((cell) => {
            const intensity = Math.max(0, Math.min(1, cell.physical / maxValue));
            const td = utils.createElement('td', { className: 'heatmap-cell' });
            td.style.setProperty('--heat-intensity', intensity.toString());
            td.innerHTML = `
              <span class="heatmap-cell__value">${cell.physical.toLocaleString()}</span>
              <span class="heatmap-cell__hedge">H ${cell.hedged.toLocaleString()} · U ${cell.unhedged.toLocaleString()}</span>
            `;
            td.setAttribute('title', `${row.commodity} ${cell.month}: Physical ${cell.physical.toLocaleString()} · Hedged ${cell.hedged.toLocaleString()} · Unhedged ${cell.unhedged.toLocaleString()}`);
            if (traderState.commodity !== 'All' && row.commodity !== traderState.commodity) {
              td.classList.add('is-muted');
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        heatmapContainer.appendChild(table);
      } else {
        heatmapContainer.textContent = 'Heatmap unavailable.';
      }
    }

    const carryCommodity = traderState.carryCommodity || commodityList[0] || '';
    const carryData = typeof data.getDashboardCarryCurve === 'function' ? data.getDashboardCarryCurve(carryCommodity) : [];
    const carryLabels = carryData.map((point) => point.label);
    const carryValues = carryData.map((point) => point.value);
    const carrySelect = document.querySelector('[data-role="carry-commodity"]');
    if (carrySelect) {
      carrySelect.innerHTML = '';
      commodityList.forEach((commodity) => {
        const option = utils.createElement('option', { text: commodity, attrs: { value: commodity } });
        carrySelect.appendChild(option);
      });
      if (carryCommodity) {
        carrySelect.value = carryCommodity;
      }
      carrySelect.onchange = (event) => {
        traderState.carryCommodity = event.target.value;
        if (event.target.value) {
          traderState.commodity = event.target.value;
          if (traderCommoditySelect) {
            traderCommoditySelect.value = event.target.value;
          }
        }
        renderTrader();
      };
    }

    charts.mountChart('chart-carry-curve', {
      type: 'line',
      data: {
        labels: carryLabels,
        datasets: [{
          label: 'Carry (¢/bu)',
          data: carryValues,
          borderColor: utils.getCommodityColor(carryCommodity || 'Other'),
          tension: 0.3,
          fill: false,
          pointRadius: 3,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (value) => `${Number(value).toFixed(1)}¢` } }
        }
      }
    });

    const coverageContainer = document.querySelector('[data-role="coverage-gauges"]');
    if (coverageContainer) {
      coverageContainer.innerHTML = '';
      coverageGaugeIds.forEach((id) => charts.destroyChart(id));
      coverageGaugeIds = [];
      const coverageData = typeof data.getHedgeCoverageSnapshot === 'function' ? data.getHedgeCoverageSnapshot() : [];
      const highlightCommodity = traderState.commodity !== 'All' ? traderState.commodity : '';
      coverageData.forEach((entry) => {
        const gaugeId = `coverage-${utils.slug(entry.commodity)}`;
        coverageGaugeIds.push(gaugeId);
        const card = utils.createElement('div', { className: `coverage-card${highlightCommodity && entry.commodity !== highlightCommodity ? ' is-muted' : ''}` });
        const canvas = utils.createElement('canvas', { attrs: { id: gaugeId, width: 120, height: 120 } });
        card.appendChild(canvas);
        card.appendChild(utils.createElement('p', { className: 'coverage-card__label', text: entry.commodity }));
        card.appendChild(utils.createElement('p', { className: 'coverage-card__meta', text: `${Math.round(entry.hedged).toLocaleString()} / ${Math.round(entry.physical).toLocaleString()}` }));
        coverageContainer.appendChild(card);

        const pct = Math.max(0, Math.min(100, entry.coverage));
        const gaugePlugin = {
          id: `centerText-${gaugeId}`,
          afterDraw(chartInstance) {
            const { ctx, chartArea } = chartInstance;
            if (!chartArea) return;
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;
            ctx.save();
            ctx.fillStyle = '#0d1b2a';
            ctx.font = '600 14px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${pct.toFixed(0)}%`, centerX, centerY);
            ctx.restore();
          },
        };

        charts.mountChart(gaugeId, {
          type: 'doughnut',
          data: {
            labels: ['Hedged', 'Unhedged'],
            datasets: [{
              data: [pct, Math.max(0, 100 - pct)],
              backgroundColor: [utils.getCommodityColor(entry.commodity), '#e8edf7'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || '';
                    if (label === 'Hedged') {
                      return `Hedged ${pct.toFixed(1)}%`;
                    }
                    return `Unhedged ${(Math.max(0, 100 - pct)).toFixed(1)}%`;
                  },
                },
              },
            },
          },
          plugins: [gaugePlugin],
        });
      });
    }

    const varianceData = typeof data.getVarianceTimeline === 'function' ? data.getVarianceTimeline(traderState.window) : [];
    const varianceLabels = varianceData.map((point) => point.label);
    const varianceValues = varianceData.map((point) => point.delta);
    const varianceColors = varianceValues.map((value) => (value >= 0 ? '#1ab76c' : '#e03e3e'));

    charts.mountChart('chart-variance-timeline', {
      type: 'bar',
      data: {
        labels: varianceLabels,
        datasets: [{
          data: varianceValues,
          backgroundColor: varianceColors,
          borderRadius: 4,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { ticks: { callback: (value) => `${Number(value).toFixed(1)} MM` } }
        }
      }
    });

    const basisCommodity = traderState.commodity !== 'All'
      ? traderState.commodity
      : (traderState.carryCommodity || commodityList[0] || 'Soybeans');
    const basisData = typeof data.getDashboardBasisMap === 'function' ? data.getDashboardBasisMap(basisCommodity) : null;
    if (basisData) {
      const basisSubtitle = document.querySelector('[data-role="basis-map-subtitle"]');
      if (basisSubtitle) {
        basisSubtitle.textContent = `${basisData.commodity} · basis by zone`;
      }
      const palette = ['#004bff', '#1ab76c', '#ff8c42', '#8a5aff'];
      charts.mountChart('chart-basis-map', {
        type: 'line',
        data: {
          labels: basisData.labels,
          datasets: basisData.datasets.map((dataset, index) => ({
            label: dataset.zone,
            data: dataset.data.map((value) => Number((value * 100).toFixed(2))),
            borderColor: palette[index % palette.length],
            fill: false,
            tension: 0.3,
          })),
        },
        options: {
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: {
              ticks: {
                callback: (value) => `${Number(value).toFixed(1)}¢`,
              },
            },
          },
        },
      });
    }

    const newsList = document.querySelector('[data-role="news-sentiment"]');
    if (newsList) {
      newsList.innerHTML = '';
      const newsItems = typeof data.getNewsSentiment === 'function' ? data.getNewsSentiment() : [];
      newsItems.forEach((item) => {
        const li = utils.createElement('li', { className: 'news-item' });
        if (traderState.commodity !== 'All' && item.commodity === traderState.commodity) {
          li.classList.add('is-active');
        }
        const headline = utils.createElement('button', {
          className: 'news-item__headline',
          text: item.headline,
          attrs: { type: 'button', 'data-action': 'focus-commodity', 'data-commodity': item.commodity }
        });
        const sentimentLabel = item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1);
        const meta = utils.createElement('div', {
          className: 'news-item__meta',
          html: `
            <span class="sentiment-badge sentiment-badge--${item.sentiment}">${sentimentLabel}</span>
            <span class="news-item__source">${item.source}</span>
          `,
        });
        li.appendChild(headline);
        li.appendChild(meta);
        newsList.appendChild(li);
      });
    }

    const alertsContainer = document.querySelector('[data-role="alerts-list"]');
    if (alertsContainer) {
      alertsContainer.innerHTML = '';
      const alerts = typeof data.getDashboardAlerts === 'function' ? data.getDashboardAlerts() : [];
      alerts.forEach((alert) => {
        const badge = utils.createElement('button', {
          className: `alert-pill alert-pill--${alert.severity || 'info'}`,
          text: alert.label,
          attrs: {
            type: 'button',
            'data-action': 'trader-alert',
            'data-route': alert.route || '',
            'data-commodity': alert.commodity || '',
          }
        });
        alertsContainer.appendChild(badge);
      });
    }
  }

  function renderPhysical() {
    const tradesData = data.getTrades();
    const selectCommodity = document.querySelector('[data-filter="commodity"]');
    const selectStatus = document.querySelector('[data-filter="status"]');
    const selectZone = document.querySelector('[data-filter="zone"]');

    populateSelect(selectCommodity, ['Soybeans', 'Corn', 'Wheat', 'Canola']);
    populateSelect(selectStatus, [...new Set(tradesData.map((trade) => trade.status))]);
    populateSelect(selectZone, [...new Set(tradesData.map((trade) => trade.marketZone))]);

    const filters = {
      commodity: selectCommodity.value,
      status: selectStatus.value,
      zone: selectZone.value,
    };

    const filtered = tradesData.filter((trade) => {
      return (
        (!filters.commodity || trade.commodity === filters.commodity) &&
        (!filters.status || trade.status === filters.status) &&
        (!filters.zone || trade.marketZone === filters.zone)
      );
    });

    const tbody = document.querySelector('[data-table="trades"] tbody');
    tbody.innerHTML = '';

    filtered.forEach((trade) => {
      const row = utils.createElement('tr', { attrs: { tabindex: 0, 'data-id': trade.id } });
      row.innerHTML = `
        <td>${trade.id}</td>
        <td>${trade.type}</td>
        <td>${trade.counterparty}</td>
        <td>${trade.commodity}</td>
        <td>${trade.qty.toLocaleString()} ${trade.uom}</td>
        <td>${utils.formatCurrency(trade.price)}</td>
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
    const existingOptions = Array.from(select.querySelectorAll('option')).map((opt) => opt.value);
    values.forEach((value) => {
      if (!existingOptions.includes(value)) {
        const option = utils.createElement('option', { text: value, attrs: { value } });
        select.appendChild(option);
      }
    });
    if (current) {
      select.value = current;
    }
  }

  function showTradeDetail(id) {
    const trade = data.getTradeById(id);
    const detail = document.querySelector('[data-role="trade-detail"] .detail-body');
    if (!trade) {
      detail.textContent = 'Trade not found.';
      return;
    }
    const pricingData = data.getPricing();
    const point = pricingData.pricingPoints.find((p) => p.name === trade.pricingPoint);
    const zone = pricingData.zoneSpreads.find((z) => z.zone === trade.marketZone && z.commodity === trade.commodity);
    const local = (point?.adjustment || 0) + (zone?.spread || 0) + trade.futures;
    detail.innerHTML = '';
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Counterparty</strong><span>${trade.counterparty}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Commodity</strong><span>${trade.commodity}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Quantity</strong><span>${trade.qty.toLocaleString()} ${trade.uom}</span>` }));

    const pricingStack = utils.createElement('div', { className: 'detail-row' });
    pricingStack.innerHTML = `
      <strong>Price Stack</strong>
      <span>${trade.futures.toFixed(2)} futures + ${(point?.adjustment || 0).toFixed(2)} pt + ${(zone?.spread || 0).toFixed(2)} zone = ${local.toFixed(2)} local</span>
    `;
    detail.appendChild(pricingStack);

    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Delivery Window</strong><span>${trade.deliveryWindow}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Market Month</strong><span>${trade.marketMonth}</span>` }));
    detail.appendChild(utils.createElement('div', { className: 'detail-row', html: `<strong>Status</strong><span class="tag">${trade.status}</span>` }));

    const timeline = utils.createElement('div', { className: 'detail-row', html: `<strong>Timeline</strong><span>Priced → Ticketed → Logistics → ${trade.status}</span>` });
    detail.appendChild(timeline);

    const tickets = utils.createElement('div', { className: 'detail-row', html: `<strong>Linked Tickets</strong><span>${trade.id}-T1, ${trade.id}-T2</span>` });
    detail.appendChild(tickets);
  }

  function renderInventory() {
    const inventory = data.getInventory();
    const lotsContainer = document.querySelector('[data-role="inventory-lots"]');
    lotsContainer.innerHTML = '';

    inventory.lotsByElevator.forEach(({ elevator, lots }) => {
      const section = utils.createElement('div', { className: 'quant-tile' });
      section.innerHTML = `<h4>${elevator}</h4>`;
      lots.forEach((lot) => {
        const lotRow = utils.createElement('p', { html: `<strong>${lot.commodity}</strong> · ${lot.qty.toLocaleString()} ${lot.uom} · Age ${lot.age}d · Moist ${lot.moisture}` });
        section.appendChild(lotRow);
      });
      lotsContainer.appendChild(section);
    });

    charts.mountChart('chart-inventory-month', {
      type: 'bar',
      data: {
        labels: inventory.monthExposure.map((m) => m.label),
        datasets: [{ data: inventory.monthExposure.map((m) => m.value), backgroundColor: '#004bff' }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(13,27,42,0.08)' } } } }
    });

    charts.mountChart('chart-quality', {
      type: 'doughnut',
      data: {
        labels: inventory.qualityDistribution.map((q) => q.label),
        datasets: [{ data: inventory.qualityDistribution.map((q) => q.value), backgroundColor: ['#1ab76c', '#004bff', '#ffb545'], borderWidth: 0 }]
      },
      options: { cutout: '60%', plugins: { legend: { position: 'bottom' } } }
    });

    charts.mountChart('chart-aging', {
      type: 'line',
      data: {
        labels: inventory.agingCurve.map((a) => a.label),
        datasets: [{ data: inventory.agingCurve.map((a) => a.value), borderColor: '#8a5aff', tension: 0.35, fill: false }]
      },
      options: { plugins: { legend: { display: false } } }
    });

    const ticketsContainer = document.querySelector('[data-role="open-tickets"]');
    ticketsContainer.innerHTML = '';
    if (inventory.openTickets.length === 0) {
      ticketsContainer.textContent = 'All tickets matched. Exposure clean.';
    } else {
      inventory.openTickets.forEach((ticket) => {
        const row = utils.createElement('div', { className: 'detail-row' });
        row.innerHTML = `<span><strong>${ticket.id}</strong> · ${ticket.action} · ${ticket.qty.toLocaleString()} ${ticket.commodity} (${ticket.zone})</span>`;
        const button = utils.createElement('button', { text: 'Match', attrs: { 'data-action': 'match-ticket', 'data-id': ticket.id } });
        row.appendChild(button);
        ticketsContainer.appendChild(row);
      });
    }
  }

  function updateHedgeFormUI(formEl) {
    const futures = getFuturesSafe();
    const exposure = data.getExposureSummary();
    const actionType = formEl.querySelector('input[name="actionType"]:checked').value;

    const hedgeFields = formEl.querySelector('[data-form-group="hedgeFields"]');
    const rollFields = formEl.querySelector('[data-form-group="rollFields"]');
    const commodityGroup = formEl.querySelector('[data-form-group="commodity"]');

    hedgeFields.hidden = actionType !== 'hedge';
    rollFields.hidden = actionType !== 'roll';
    commodityGroup.hidden = actionType !== 'hedge';

    if (actionType === 'hedge') {
      const commoditySelect = formEl.querySelector('#commoditySelect');
      if (commoditySelect.options.length === 0) {
        const topExposureCommodity = Object.keys(exposure.byCommodity).reduce((a, b) => exposure.byCommodity[a].physical > exposure.byCommodity[b].physical ? a : b);
        Object.keys(exposure.byCommodity).forEach((commodity) => {
          const option = utils.createElement('option', { text: commodity, attrs: { value: commodity } });
          if (commodity === topExposureCommodity) option.selected = true;
          commoditySelect.appendChild(option);
        });
      }

      const monthSelect = formEl.querySelector('#boardMonth');
      if (monthSelect.options.length === 0 && futures.suggestedMonths) {
        futures.suggestedMonths.forEach((suggestion, index) => {
          const option = utils.createElement('option', { text: `${suggestion.month} (${suggestion.board.toFixed(2)})`, attrs: { value: suggestion.month } });
          if (index === 0) option.selected = true;
          monthSelect.appendChild(option);
        });
      }
    } else { // roll
      const fromSelect = formEl.querySelector('#fromMonth');
      if (fromSelect.options.length === 0 && futures.positions) {
        const largestPosition = futures.positions.reduce((a, b) => a.qty > b.qty ? a : b);
        futures.positions.forEach((position) => {
          const option = utils.createElement('option', { text: `${position.symbol} ${position.month}`, attrs: { value: position.month, 'data-symbol': position.symbol } });
          if (position.month === largestPosition.month) option.selected = true;
          fromSelect.appendChild(option);
        });

        const toSelect = formEl.querySelector('#toMonth');
        const liquidMonths = ['Nov-24', 'Dec-24', 'Jan-25', 'Mar-25', 'May-25'];
        const fromIndex = liquidMonths.indexOf(largestPosition.month);
        if (fromIndex !== -1 && fromIndex + 1 < liquidMonths.length) {
          liquidMonths.slice(fromIndex + 1).forEach(month => {
            toSelect.appendChild(utils.createElement('option', { text: month, attrs: { value: month } }));
          });
        }
      }
    }
  }

  function validateAndPreviewHedgeForm(formEl) {
    const formData = new FormData(formEl);
    const actionType = formData.get('actionType');
    const submitButton = formEl.querySelector('button[type="submit"]');
    const previewContainer = formEl.querySelector('[data-role="impact-preview"]');
    let isValid = false;

    const deltaHedgeEl = previewContainer.querySelector('span:nth-child(2)');
    const deltaPnlEl = previewContainer.querySelector('span:nth-child(3)');

    if (actionType === 'hedge') {
      const commodity = formData.get('commodity');
      const percent = Number(formData.get('percent-display'));
      const exposureData = data.getExposureSummary().byCommodity[commodity];
      isValid = percent > 0 && percent <= 100 && !!commodity && !!exposureData;
      if (isValid) {
        const targetQty = (exposureData.physical * (percent / 100));
        const newCoverage = (exposureData.hedged + targetQty) / exposureData.physical;
        deltaHedgeEl.textContent = `Δ Hedge %: ${utils.formatPercent(newCoverage * 100)}`;
        deltaPnlEl.textContent = `Δ Futures P&L: ${utils.formatCurrency(Math.random() * -20000)}`;
      }
    } else { // roll
      const from = formData.get('from');
      const to = formData.get('to');
      isValid = !!from && !!to && from !== to;
      if (isValid) {
        const mtmGain = (Math.random() * 20000) + 5000;
        deltaHedgeEl.textContent = 'Δ Hedge %: unchanged';
        deltaPnlEl.textContent = `Δ Futures P&L: ${utils.formatCurrency(mtmGain)}`;
      }
    }
    submitButton.disabled = !isValid;
    submitButton.textContent = actionType === 'hedge' ? 'Apply Hedge' : 'Apply Roll';
  }
  function restoreActionsTicket() {
    if (!hedgeActionsCard) return;
    if (
      hedgeActionsPlaceholder.parentElement &&
      hedgeActionsCard.parentElement !== hedgeActionsPlaceholder.parentElement
    ) {
      hedgeActionsPlaceholder.parentElement.insertBefore(hedgeActionsCard, hedgeActionsPlaceholder);
    }
  }

  function prepareTicketForCommodity(commodityName) {
    if (!hedgeActionsCard) return null;
    const formEl = hedgeActionsCard.querySelector('#hedgeForm');
    if (!formEl) return null;
    updateHedgeFormUI(formEl);
    const commoditySelect = formEl.querySelector('#commoditySelect');
    if (commoditySelect && commodityName) {
      if (!Array.from(commoditySelect.options).some((opt) => opt.value === commodityName)) {
        commoditySelect.appendChild(utils.createElement('option', { text: commodityName, attrs: { value: commodityName } }));
      }
      commoditySelect.value = commodityName;
    }
    validateAndPreviewHedgeForm(formEl);
    return formEl;
  }

  function renderHedge(ctx) {
    const context = ctx || lastRouteContext || router.parseRoute(window.location.hash || '#/hedge');
    lastRouteContext = context;
    charts.destroyAll();

    const isDetailView = context.path === '#/hedge/:commodity' && context.params?.commodity;

    if (hedgeOverviewContainer) hedgeOverviewContainer.hidden = isDetailView;
    if (hedgeDetailContainer) hedgeDetailContainer.hidden = !isDetailView;

    if (isDetailView) {
      renderHedgeDetail({ commoditySlug: context.params.commodity });
    } else {
      teardownHedgeDetail();
      restoreActionsTicket();
      renderHedgeOverview();
    }
  }

  function renderHedgeOverview() {
    if (!hedgeOverviewContainer) return;
    const rows = data.getExposureByCommodity();
    charts.mountExposureBar('chart-exposure-distribution', rows, {
      onSelectCommodity: ({ commoditySlug }) => router.navigate(`#/hedge/${commoditySlug}`),
    });

    const tbody = hedgeOverviewContainer.querySelector('[data-table="hedge-positions"] tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    rows.forEach((row) => {
      const commoditySlug = utils.slug(row.commodity);
      const hedgePercent = row.physQty > 0 ? (row.hedgedQty / row.physQty) * 100 : 0;
      const avgBasis = typeof row.avgBasis === 'number' ? row.avgBasis.toFixed(2) : '--';
      const tr = utils.createElement('tr', { attrs: { 'data-commodity-slug': commoditySlug } });
      tr.innerHTML = `
        <td>${row.commodity}</td>
        <td>${row.physQty.toLocaleString()}</td>
        <td>${row.hedgedQty.toLocaleString()}</td>
        <td>${utils.formatPercent(hedgePercent)}</td>
        <td>${row.unhedgedQty.toLocaleString()}</td>
        <td>${row.nextMonth}</td>
        <td>${avgBasis}</td>
        <td><a class="open-hedge" href="#/hedge/${commoditySlug}" target="_blank" rel="noopener">Open Hedge</a></td>
      `;
      tbody.appendChild(tr);
    });

    if (!hedgeOverviewContainer.dataset.listenerAttached) {
      hedgeOverviewContainer.addEventListener('click', (event) => {
        const link = event.target.closest('a.open-hedge');
        if (link) return;

        const row = event.target.closest('tr[data-commodity-slug]');
        if (!row) return;

        event.preventDefault();
        const commoditySlug = row.dataset.commoditySlug;
        if (commoditySlug) {
          router.navigate(`#/hedge/${commoditySlug}`);
        }
      });
      hedgeOverviewContainer.dataset.listenerAttached = 'true';
    }

    const formEl = document.getElementById('hedgeForm');
    if (formEl) {
      updateHedgeFormUI(formEl);
      validateAndPreviewHedgeForm(formEl);
    }
  }

  function renderHedgeDetail({ commoditySlug }) {
    if (!hedgeDetailContainer) return;
    const commodityName = utils.unslug(commoditySlug);
    const displayName = commodityName || utils.toTitleCase?.(commoditySlug) || commoditySlug;
    const previousSlug = hedgeDetailContainer.dataset.activeSlug;
    hedgeDetailContainer.dataset.activeSlug = commoditySlug;

    if (previousSlug !== commoditySlug) {
      window.scrollTo(0, 0);
    }
    ensureDetailResizeObserver();

    if (hedgeDetailTitle) {
      hedgeDetailTitle.textContent = `${displayName} Hedge Detail`;
    }
    if (hedgeDetailSubtitle) {
      hedgeDetailSubtitle.textContent = `Live analytics for ${displayName}`;
    }
    if (hedgeDetailPopout) {
      hedgeDetailPopout.href = `#/hedge/${commoditySlug}`;
      hedgeDetailPopout.setAttribute('aria-label', `Open ${displayName} hedge detail in a new window`);
    }

    if (hedgeDetailTicketSlot && hedgeActionsCard) {
      hedgeDetailTicketSlot.innerHTML = '';
      hedgeDetailTicketSlot.appendChild(hedgeActionsCard);
    }

    const formEl = prepareTicketForCommodity(commodityName || displayName);

    if (hedgeDetailKpis) {
      hedgeDetailKpis.querySelectorAll('[data-kpi]').forEach((el) => {
        el.textContent = '--';
      });
    }

    const headerDefaults = {
      physQty: 0,
      hedgedQty: 0,
      hedgePercent: 0,
      unhedgedQty: 0,
      mtm: 0,
      basisPL: 0,
      futuresPL: 0,
    };
    const headerData = data.getHedgeDetailHeader?.(commodityName) || {};
    const headerValues = { ...headerDefaults, ...headerData };
    if (hedgeDetailKpis) {
      Object.entries(headerValues).forEach(([key, value]) => {
        const el = hedgeDetailKpis.querySelector(`[data-kpi="${key}"]`);
        if (!el) return;
        if (key.includes('Percent')) {
          el.textContent = utils.formatPercent(value);
        } else if (key.includes('PL') || key === 'mtm') {
          el.textContent = utils.formatCurrency(value);
        } else if (typeof value === 'number') {
          el.textContent = value.toLocaleString();
        } else {
          el.textContent = value || '--';
        }
      });
    }

    const toggleNoData = (bodyEl, hasData) => {
      if (!bodyEl) return;
      const canvas = bodyEl.querySelector('canvas');
      const caption = bodyEl.querySelector('.no-data');
      if (canvas) canvas.hidden = !hasData;
      if (caption) caption.hidden = !!hasData;
    };

    const fwd = data.getForwardCurve?.(commodityName) || [];
    toggleNoData(detailCardBodies.term, fwd.length > 0);
    if (fwd.length) {
      charts.mountTermStructure('chart-term-structure', fwd);
    }

    const ladder = data.getExposureByMonth?.(commodityName) || [];
    toggleNoData(detailCardBodies.ladder, ladder.length > 0);
    if (ladder.length) {
      charts.mountExposureLadder('chart-exposure-ladder', ladder, {
        onSelectMonth: ({ month }) => {
          if (!formEl) return;
          const monthSelect = formEl.querySelector('[name="month"]');
          if (monthSelect) {
            if (!Array.from(monthSelect.options).some((opt) => opt.value === month)) {
              monthSelect.appendChild(utils.createElement('option', { text: month, attrs: { value: month } }));
            }
            monthSelect.value = month;
            monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const percentSlider = formEl.querySelector('[name="percent"]');
          percentSlider?.focus();
        },
      });
    }

    const basisByZone = data.getBasisHistory?.(commodityName) || {};
    const basisEntries = Object.entries(basisByZone || {}).filter(([, values]) => Array.isArray(values) && values.length > 0);
    toggleNoData(detailCardBodies.basis, basisEntries.length > 0);
    if (basisEntries.length) {
      const labels = basisEntries[0][1].map((point) => new Date(point.date).toLocaleString('default', { month: 'short' }));
      const datasets = basisEntries.map(([zone, values]) => ({
        label: zone,
        data: values.map((point) => point.basis),
      }));
      charts.mountBasisHistory('chart-basis-history', { labels, datasets });
    }

    const priceStack = data.getPriceStack?.(commodityName) || [];
    if (detailCardBodies.priceStack) {
      if (priceStack.length) {
        detailCardBodies.priceStack.innerHTML = priceStack
          .map((entry) => {
            const board = typeof entry.board === 'number' ? entry.board.toFixed(2) : entry.board;
            const point = typeof entry.point === 'number' ? entry.point.toFixed(2) : entry.point;
            const zone = typeof entry.zone === 'number' ? entry.zone.toFixed(2) : entry.zone;
            const local = typeof entry.local === 'number' ? entry.local.toFixed(2) : entry.local;
            return `<p>${entry.month}: <strong>${local}</strong> (${board} + ${point} + ${zone})</p>`;
          })
          .join('');
      } else {
        detailCardBodies.priceStack.innerHTML = '<p class="no-data">No data available</p>';
      }
    }

    if (detailCardBodies.volCorr) {
      const vols = data.getVolCorrelation?.(commodityName) || data.getVolAndCorr?.(commodityName) || { vol30: 0, corr: 0 };
      const volDisplay = vols.volatility || (typeof vols.vol30 === 'number' ? `${vols.vol30}%` : vols.vol30 || '0%');
      const corrRaw = vols.correlation ?? vols.corr ?? 0;
      const corrDisplay = typeof corrRaw === 'number' ? corrRaw.toFixed(2) : corrRaw;
      detailCardBodies.volCorr.innerHTML = `
        <p>30d Vol: <strong>${volDisplay}</strong></p>
        <p>90d Corr: <strong>${corrDisplay}</strong></p>
      `;
    }

    if (detailCardBodies.whatIfCard) {
      if (detailCardBodies.whatIfBoard) detailCardBodies.whatIfBoard.value = '0';
      if (detailCardBodies.whatIfBasis) detailCardBodies.whatIfBasis.value = '0';

      const updateSimulator = () => {
        const boardPct = parseFloat(detailCardBodies.whatIfBoard?.value || '0');
        const basisCents = parseInt(detailCardBodies.whatIfBasis?.value || '0', 10);
        if (detailCardBodies.boardLabel) detailCardBodies.boardLabel.textContent = `${boardPct.toFixed(1)}%`;
        if (detailCardBodies.basisLabel) detailCardBodies.basisLabel.textContent = `${basisCents}¢`;
        const result = data.simulateShock({ commodity: commodityName, boardPct, basisCents }) || {
          futuresDelta: 0,
          basisDelta: 0,
          netDelta: 0,
        };
        if (detailCardBodies.whatIfChart) {
          charts.mountWhatIf(detailCardBodies.whatIfChart, result);
        }
        if (detailCardBodies.whatIfFutures) {
          detailCardBodies.whatIfFutures.textContent = utils.formatCurrencyThousands(result.futuresDelta || 0);
        }
        if (detailCardBodies.whatIfBasisValue) {
          detailCardBodies.whatIfBasisValue.textContent = utils.formatCurrencyThousands(result.basisDelta || 0);
        }
        if (detailCardBodies.whatIfNet) {
          detailCardBodies.whatIfNet.textContent = utils.formatCurrencyThousands(result.netDelta || 0);
        }
      };

      if (!detailCardBodies.whatIfCard.dataset.listenerAttached && detailCardBodies.whatIfCard.addEventListener) {
        detailCardBodies.whatIfCard.addEventListener('input', (event) => {
          if (event.target === detailCardBodies.whatIfBoard || event.target === detailCardBodies.whatIfBasis) {
            updateSimulator();
          }
        });
        detailCardBodies.whatIfCard.dataset.listenerAttached = 'true';
      }

      updateSimulator();
    }

    if (formEl) {
      validateAndPreviewHedgeForm(formEl);
    }

    const actionsLogData = data.getActionsLog?.(commodityName) || [];
    if (hedgeDetailActionsLog) {
      if (actionsLogData.length > 0) {
        hedgeDetailActionsLog.innerHTML = `
          <table class="data-table">
            <thead><tr><th>Timestamp</th><th>Action</th><th>Month</th><th>%/Qty</th><th>Δ P&L</th></tr></thead>
            <tbody>
              ${actionsLogData
                .map((entry) => `
                  <tr>
                    <td>${new Date(entry.ts).toLocaleString()}</td>
                    <td>${entry.type}</td>
                    <td>${entry.month}</td>
                    <td>${entry.value}</td>
                    <td>${utils.formatCurrency(entry.pnlDelta)}</td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        `;
      } else {
        hedgeDetailActionsLog.innerHTML = `<p>No actions logged for ${displayName} yet.</p>`;
      }
    }

    requestAnimationFrame(() => {
      refreshDetailCharts();
    });
  }

  function renderRisk() {
    const snapshot = data.getSnapshot();
    charts.mountChart('chart-waterfall', {
      type: 'bar',
      data: {
        labels: ['Basis', 'Futures', 'Freight', 'Other', 'Net'],
        datasets: [{
          label: 'P&L',
          data: [snapshot.basisPL, snapshot.futuresPL, snapshot.freightVar, snapshot.otherPL, snapshot.basisPL + snapshot.futuresPL + snapshot.freightVar + snapshot.otherPL],
          backgroundColor: ['#1ab76c', '#004bff', '#e03e3e', '#8a5aff', '#1ab76c']
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } }
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
        labels: Array.from({ length: data.getCarrySpark().length }, (_, i) => i + 1),
        datasets: [{ data: data.getCarrySpark(), borderColor: '#004bff', fill: false, tension: 0.35, pointRadius: 0 }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { display: false } } }
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
      const quant = utils.createElement('div', { className: 'quant-tile' });
      quant.innerHTML = `<h4>${tile.label}</h4><p>${tile.value}</p><p>${tile.context}</p>`;
      tiles.appendChild(quant);
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
        <label>Price<input type="number" value="${row.price}" step="0.01"></label>
        <button type="button">Update</button>
      `;
      marketContainer.appendChild(form);
    });

    pricingData.pricingPoints.forEach((row) => {
      const form = utils.createElement('form', { className: 'form-inline' });
      form.innerHTML = `
        <label>Name<input type="text" value="${row.name}" readonly></label>
        <label>Commodity<input type="text" value="${row.commodity}" readonly></label>
        <label>Adjustment<input type="number" value="${row.adjustment}" step="0.01"></label>
        <button type="button">Save</button>
      `;
      pointContainer.appendChild(form);
    });

    pricingData.zoneSpreads.forEach((row) => {
      const form = utils.createElement('form', { className: 'form-inline' });
      form.innerHTML = `
        <label>Zone<input type="text" value="${row.zone}" readonly></label>
        <label>Commodity<input type="text" value="${row.commodity}" readonly></label>
        <label>Spread<input type="number" value="${row.spread}" step="0.01"></label>
        <button type="button">Apply</button>
      `;
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
    Object.keys({ today: true, monthEndAug: true }).forEach((key) => {
      const button = utils.createElement('button', { text: `Load ${key === 'today' ? 'Live' : 'Month-End Aug'}`, attrs: { 'data-snapshot': key } });
      button.addEventListener('click', () => {
        data.setSnapshot(key);
      });
      snapshotContainer.appendChild(button);
    });
  }

  const runHeaderBootstrap = () => renderHeader(data.getHeaderSnapshot?.());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runHeaderBootstrap, { once: true });
  } else {
    runHeaderBootstrap();
  }
})();
