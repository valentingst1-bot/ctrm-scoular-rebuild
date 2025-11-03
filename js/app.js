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

  const snapshotButtons = document.querySelectorAll('.snapshot-toggle .toggle-button');
  const kpiTiles = document.querySelectorAll('.kpi-tile');
  const views = Array.from(document.querySelectorAll('.view')).reduce((map, viewEl) => {
    map[viewEl.dataset.route] = { el: viewEl };
    return map;
  }, {});
  const navLinks = document.querySelectorAll('.nav-link');

  let activeRoute = null;

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
      destroy: hedge.destroy,
    },
    '#/hedge/:commodity': {
        render: renderHedge,
        destroy: hedge.destroy,
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
    activateRoute(ctx.name, ctx);
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

  document.addEventListener('ctrm:dataChanged', renderHedge);
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
        const selectedOption = fromSelect.options[fromSelect.selectedIndex];
        const symbol = selectedOption.dataset.symbol;
        const from = formData.get('from');
        const to = formData.get('to');
        data.rollMonth({ symbol, from, to });
        utils.showToast(`Rolled ${symbol} from ${from} to ${to}`);
      }
      document.dispatchEvent(new CustomEvent('ctrm:dataChanged'));
    });
  }

  function activateRoute(route, ctx) {
    const handler = routeHandlers[route];
    const viewRoute = handler?.view || route;

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
    if (handler && handler.render) {
      handler.render(ctx);
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
  function renderHedge(ctx) {
    const isDetailView = ctx && ctx.params && ctx.params.commodity;
    const overviewView = document.querySelector('[data-view-mode="overview"]');
    const detailView = document.querySelector('[data-view-mode="detail"]');

    overviewView.hidden = isDetailView;
    detailView.hidden = !isDetailView;

    if (isDetailView) {
      renderHedgeDetail(ctx.params.commodity);
    } else {
      renderHedgeOverview();
    }
  }

  function renderHedgeOverview() {
    const rows = data.getExposureByCommodity();
    charts.mountExposureBar(document.getElementById('chart-exposure-distribution'), rows);

    const tbody = document.querySelector('[data-table="hedge-positions"] tbody');
    tbody.innerHTML = '';
    rows.forEach(row => {
      const tr = utils.createElement('tr', { attrs: { 'data-commodity': row.commodity.toLowerCase() } });
      const hedgePercent = row.physQty > 0 ? (row.hedgedQty / row.physQty) * 100 : 0;
      tr.innerHTML = `
        <td>${row.commodity}</td>
        <td>${row.physQty.toLocaleString()}</td>
        <td>${row.hedgedQty.toLocaleString()}</td>
        <td>${utils.formatPercent(hedgePercent)}</td>
        <td>${row.unhedgedQty.toLocaleString()}</td>
        <td>${row.nextMonth}</td>
        <td>${utils.formatCurrency(row.avgBasis, 2)}</td>
        <td><button class="btn open-hedge" data-commodity="${row.commodity.toLowerCase()}">Open Hedge</button></td>
      `;
      tbody.appendChild(tr);
    });

    const overviewContainer = document.querySelector('[data-view-mode="overview"]');
    if (!overviewContainer.dataset.listenerAttached) {
      overviewContainer.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('tr');
        const button = target.closest('.open-hedge');
        if (row || button) {
          event.preventDefault();
          const commodity = row ? row.dataset.commodity : button.dataset.commodity;
          router.navigate('#/hedge/' + commodity);
        }
      });
      overviewContainer.dataset.listenerAttached = 'true';
    }

    const formEl = document.getElementById('hedgeForm');
    updateHedgeFormUI(formEl);
    validateAndPreviewHedgeForm(formEl);
  }

  function renderHedgeDetail(commodity) {
    const detailView = document.querySelector('[data-view-mode="detail"]');
    const commodityTitle = commodity.charAt(0).toUpperCase() + commodity.slice(1);

    detailView.innerHTML = `
      <div class="detail-header">
        <a href="#/hedge" class="back-link">&larr; Back to Overview</a>
        <div class="detail-header__main">
          <h2>${commodityTitle} Hedge Detail</h2>
        </div>
        <div class="kpi-strip kpi-strip--mini" data-role="detail-kpis">
          <article class="kpi-tile kpi-tile--mini"><h3>Physical</h3><p data-kpi="physQty">--</p></article>
          <article class="kpi-tile kpi-tile--mini"><h3>Hedged</h3><p data-kpi="hedgedQty">--</p></article>
          <article class="kpi-tile kpi-tile--mini"><h3>Hedge %</h3><p data-kpi="hedgePercent">--</p></article>
          <article class="kpi-tile kpi-tile--mini"><h3>Unhedged</h3><p data-kpi="unhedgedQty">--</p></article>
          <article class="kpi-tile kpi-tile--mini"><h3>MTM</h3><p data-kpi="mtm">--</p></article>
          <article class="kpi-tile kpi-tile--mini"><h3>Basis P&L</h3><p data-kpi="basisPL">--</p></article>
          <article class="kpi-tile kpi-tile--mini"><h3>Futures P&L</h3><p data-kpi="futuresPL">--</p></article>
        </div>
      </div>
      <div class="view-grid hedge-detail-grid">
        <div class="card" data-role="action-ticket-container">
          <header class="card__header"><h3>Action Ticket</h3></header>
          <div class="card__body">
            <form id="hedgeFormDetail" class="hedge-form">
              <div class="form-group" role="radiogroup" aria-labelledby="action-type-label-detail">
                <span id="action-type-label-detail" class="form-label">Action</span>
                <div class="form-group--radios">
                  <label><input type="radio" name="actionType" value="hedge" checked> Hedge</label>
                  <label><input type="radio" name="actionType" value="roll"> Roll</label>
                </div>
              </div>
              <div data-form-group="commodity">
                <label class="form-label" for="commoditySelectDetail">Commodity</label>
                <select id="commoditySelectDetail" name="commodity" disabled>
                  <option>${commodityTitle}</option>
                </select>
                <input type="hidden" name="commodity" value="${commodity}">
              </div>
              <div data-form-group="hedgeFields">
                <label class="form-label" for="hedgePercentDetail">Hedge %</label>
                <div class="form-group--slider">
                  <input type="range" id="hedgePercentDetail" name="percent" min="0" max="100" value="25">
                  <input type="number" name="percent-display" min="0" max="100" value="25" class="input--small">
                </div>
                <label class="form-label" for="boardMonthDetail">Board Month</label>
                <select id="boardMonthDetail" name="month"></select>
              </div>
              <div data-form-group="rollFields" hidden>
                 <p>Roll functionality is not implemented in this view.</p>
              </div>
              <button type="submit" class="button--primary" disabled>Apply</button>
              <div class="impact-preview" data-role="impact-preview">
                 <p><strong>Impact Preview</strong></p>
                 <span>Δ Hedge %: --</span>
                 <span>Δ Futures P&L: --</span>
              </div>
            </form>
          </div>
        </div>
        <div class="hedge-detail-analytics-grid">
          <div class="card">
            <header class="card__header"><h3>Forward Curve</h3></header>
            <div class="card__body"><canvas id="chart-forward-curve" height="200"></canvas></div>
          </div>
          <div class="card">
            <header class="card__header"><h3>Exposure Ladder</h3></header>
            <div class="card__body"><canvas id="chart-exposure-ladder" height="200"></canvas></div>
          </div>
          <div class="card">
            <header class="card__header"><h3>Basis History</h3></header>
            <div class="card__body"><canvas id="chart-basis-history" height="200"></canvas></div>
          </div>
          <div class="card">
            <header class="card__header"><h3>Price Stack</h3></header>
            <div class="card__body" data-role="price-stack-viz"><p>Price stack visualization...</p></div>
          </div>
          <div class="card">
            <header class="card__header"><h3>Volatility & Correlation</h3></header>
            <div class="card__body" data-role="vol-corr-viz"><p>Vol & Corr gauges...</p></div>
          </div>
          <div class="card">
            <header class="card__header"><h3>What-If Simulator</h3></header>
            <div class="card__body" data-role="what-if-sim">
              <div class="form-group--slider">
                <label for="boardShock">Board Shock (%)</label>
                <input type="range" id="boardShock" name="boardShock" min="-3" max="3" value="0" step="0.1">
                <span class="value-label">0.0%</span>
              </div>
              <div class="form-group--slider">
                <label for="basisShock">Basis Shock (¢)</label>
                <input type="range" id="basisShock" name="basisShock" min="-30" max="30" value="0" step="1">
                <span class="value-label">0¢</span>
              </div>
              <div class="what-if-results" data-role="what-if-results">
                 <p><strong>Projected Impact</strong></p>
                 <span>Δ Futures P&L: $0</span>
                 <span>Δ Basis P&L: $0</span>
                 <span>Δ Net P&L: $0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="card full-width">
         <header class="card__header"><h3>Actions Log: ${commodityTitle}</h3></header>
         <div class="card__body">
           <table class="data-table" data-table="actions-log">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Month</th>
                  <th>%/Qty</th>
                  <th>Δ P&L</th>
                </tr>
              </thead>
              <tbody><tr><td colspan="5">No actions logged yet.</td></tr></tbody>
           </table>
         </div>
      </div>
    `;

    // --- Data Population ---
    const headerData = data.getHedgeDetailHeader(commodity);
    const kpiContainer = detailView.querySelector('[data-role="detail-kpis"]');
    Object.entries(headerData).forEach(([key, value]) => {
      const el = kpiContainer.querySelector(`[data-kpi="${key}"]`);
      if (el) {
        if (key.includes('Percent')) el.textContent = utils.formatPercent(value);
        else if (key.includes('PL') || key.includes('mtm')) el.textContent = utils.formatCurrency(value);
        else el.textContent = value.toLocaleString();
      }
    });

    const forwardCurveData = data.getForwardCurve(commodity);
    charts.mountForwardCurveChart(detailView.querySelector('#chart-forward-curve'), forwardCurveData);

    const exposureLadderData = data.getExposureByMonth(commodity);
    charts.mountExposureLadderChart(detailView.querySelector('#chart-exposure-ladder'), exposureLadderData);

    const basisHistoryData = data.getBasisHistory(commodity);
    const basisChartData = {
        labels: basisHistoryData[Object.keys(basisHistoryData)[0]].map(d => new Date(d.date).toLocaleString('default', { month: 'short' })),
        datasets: Object.entries(basisHistoryData).map(([zone, data]) => ({
            label: zone,
            data: data.map(d => d.basis)
        }))
    };
    charts.mountBasisHistoryChart(detailView.querySelector('#chart-basis-history'), basisChartData);

    const priceStackData = data.getPriceStack(commodity);
    const priceStackContainer = detailView.querySelector('[data-role="price-stack-viz"]');
    priceStackContainer.innerHTML = priceStackData.map(d => `
        <p>${d.month}: <strong>${d.local.toFixed(2)}</strong> (${d.board.toFixed(2)} + ${d.point.toFixed(2)} + ${d.zone.toFixed(2)})</p>
    `).join('');

    const volCorrData = data.getVolAndCorr(commodity);
    const volCorrContainer = detailView.querySelector('[data-role="vol-corr-viz"]');
    volCorrContainer.innerHTML = `<p>30d Vol: <strong>${volCorrData.volatility}</strong> | 90d Corr(B,B): <strong>${volCorrData.correlation}</strong></p>`;

    const actionsLogData = data.getActionsLog(commodity);
    const actionsLogTbody = detailView.querySelector('[data-table="actions-log"] tbody');
    actionsLogTbody.innerHTML = actionsLogData.map(a => `
        <tr>
            <td>${a.timestamp}</td>
            <td>${a.action}</td>
            <td>${a.month}</td>
            <td>${a.qty}</td>
            <td>${utils.formatCurrency(a.pnl)}</td>
        </tr>
    `).join('');


    // --- Simulator ---
    const simulator = detailView.querySelector('[data-role="what-if-sim"]');
    const boardSlider = simulator.querySelector('[name="boardShock"]');
    const basisSlider = simulator.querySelector('[name="basisShock"]');

    function updateSimulator() {
        const boardPct = parseFloat(boardSlider.value);
        const basisCents = parseInt(basisSlider.value);
        simulator.querySelector('.value-label:nth-of-type(1)').textContent = `${boardPct.toFixed(1)}%`;
        simulator.querySelector('.value-label:nth-of-type(2)').textContent = `${basisCents}¢`;

        const { futuresDelta, basisDelta, netDelta } = data.simulateShock({
            commodity,
            boardPct,
            basisCents
        });

        const results = simulator.querySelector('[data-role="what-if-results"]');
        results.querySelector('span:nth-of-type(1)').textContent = `Δ Futures P&L: ${utils.formatCurrency(futuresDelta)}`;
        results.querySelector('span:nth-of-type(2)').textContent = `Δ Basis P&L: ${utils.formatCurrency(basisDelta)}`;
        results.querySelector('span:nth-of-type(3)').textContent = `Δ Net P&L: ${utils.formatCurrency(netDelta)}`;
    }

    simulator.addEventListener('input', updateSimulator);
    updateSimulator();

    // --- Action Ticket ---
    const formEl = detailView.querySelector('#hedgeFormDetail');
    updateHedgeFormUI(formEl); // Re-use for month population
    validateAndPreviewHedgeForm(formEl);

    formEl.addEventListener('input', () => validateAndPreviewHedgeForm(formEl));
    formEl.addEventListener('change', () => validateAndPreviewHedgeForm(formEl));
    formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(formEl);
        const commodity = formData.get('commodity');
        const percent = Number(formData.get('percent'));
        const month = formData.get('month');
        data.hedgeExposure({ commodity, percent, month });
        utils.showToast(`Hedged ${percent}% ${commodity} in ${month}`);
        document.dispatchEvent(new CustomEvent('ctrm:dataChanged', { detail: { commodity }}));
    });

    // --- Chart Interaction ---
    const ladderChart = charts.mountExposureLadderChart(detailView.querySelector('#chart-exposure-ladder'), exposureLadderData);
    if (ladderChart) {
      ladderChart.options.onClick = (e) => {
          const points = ladderChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
          if (points.length) {
              const month = ladderChart.data.labels[points[0].index];
              const monthSelect = formEl.querySelector('[name="month"]');
              monthSelect.value = month;
              utils.showToast(`Selected ${month} in Action Ticket.`);
          }
      };
      ladderChart.update();
    }
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
