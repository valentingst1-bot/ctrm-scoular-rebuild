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
  const kpiTiles = document.querySelectorAll('.kpi-tile');
  const views = Array.from(document.querySelectorAll('.view')).reduce((map, viewEl) => {
    map[viewEl.dataset.route] = { el: viewEl };
    return map;
  }, {});
  const navLinks = document.querySelectorAll('.nav-link');

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
      snapshotButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      data.setSnapshot(btn.dataset.snapshot);
      renderHeader();
      renderActiveView();
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
      renderHeader(event.payload?.snapshot);
      renderActiveView();
    }
    if (event.type === 'inventoryUpdated') {
      if (activeRoute === '#/inventory') renderInventory();
    }
  });

  document.addEventListener('ctrm:dataChanged', () => {
    renderHedge(lastRouteContext);
  });
  document.addEventListener('click', (event) => {
    const matchBtn = event.target.closest('[data-action="match-ticket"]');
    if (matchBtn) {
      data.matchTicket(matchBtn.dataset.id);
    }
    const resetBtn = event.target.closest('[data-action="reset-demo"]');
    if (resetBtn) {
      data.resetDemo();
      renderHeader();
      renderActiveView();
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
  }

  function renderHeader(snapshot) {
    const snap = snapshot || data.getSnapshot();
    const formatters = {
      mtmChange: (v) => utils.formatMillions(v),
      hedgeCoverage: (v) => utils.formatPercent(v),
      basisPL: (v) => utils.formatMillions(v),
      futuresPL: (v) => utils.formatMillions(v),
      freightVar: (v) => utils.formatMillions(v),
      otherPL: (v) => utils.formatMillions(v),
      workingCapital: (v) => utils.formatMillions(v),
    };
    kpiTiles.forEach((tile) => {
      const key = tile.dataset.kpi;
      const formatter = formatters[key] || ((value) => value);
      tile.querySelector('.kpi-value').textContent = formatter(snap[key]);
    });
    snapshotButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.snapshot === snap.key);
    });
  }

  function renderTrader() {
    const container = document.querySelector('[data-role="trader-bulletins"]');
    container.innerHTML = '';
    const snapshot = data.getSnapshot();
    snapshot.bulletins.forEach((bullet) => {
      const li = utils.createElement('li', { text: bullet });
      container.appendChild(li);
    });

    const exposure = data.getExposureSummary();
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mtmSeries = months.map((month, index) => snapshot.mtmChange + index * 0.4 - 1);

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

    const commodityLabels = Object.keys(exposure.byCommodity);
    const commodityValues = commodityLabels.map((label) => exposure.byCommodity[label].physical / 1000);

    charts.mountChart('chart-exposure-commodity', {
      type: 'bar',
      data: {
        labels: commodityLabels,
        datasets: [{
          label: 'Physical (000s)',
          data: commodityValues,
          backgroundColor: ['#004bff', '#1ab76c', '#8a5aff', '#ff8c42']
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

    const hedgeValues = commodityLabels.map((label) => exposure.byCommodity[label].hedged);
    const physicalValues = commodityLabels.map((label) => exposure.byCommodity[label].physical);
    const hedgeTotal = hedgeValues.reduce((a, b) => a + b, 0);
    const physicalTotal = physicalValues.reduce((a, b) => a + b, 0);

    charts.mountChart('chart-hedge-physical', {
      type: 'doughnut',
      data: {
        labels: ['Hedged', 'Physical'],
        datasets: [{
          data: [hedgeTotal, physicalTotal],
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
        if (detailCardBodies.whatIfChart) {
          const res = data.simulateShock({ commodity: commodityName, boardPct, basisCents });
          charts.mountWhatIf(detailCardBodies.whatIfChart, res);
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
        renderHeader();
        renderActiveView();
      });
      snapshotContainer.appendChild(button);
    });
  }

  renderHeader();
  renderActiveView();
})();
