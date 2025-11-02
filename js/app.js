(function () {
  const utils = window.CTRMUtils;
  const data = window.CTRMData;
  const router = window.CTRMRouting;
  const charts = window.CTRMCharts;

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
      destroy: () => {
        charts.destroyChart('chart-hedge-ratio');
        charts.destroyChart('chart-hedge-sensitivity');
      }
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

  router.subscribe((hash) => {
    const normalized = router.normalize(hash);
    activateRoute(normalized);
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

  const hedgeActionsForm = document.querySelector('[data-form="hedge-actions"]');
  if (hedgeActionsForm) {
    hedgeActionsForm.addEventListener('change', (e) => {
      if (e.target.name === 'actionType') {
        renderHedge();
      } else {
        validateAndPreviewHedgeForm();
      }
    });
    hedgeActionsForm.addEventListener('input', () => validateAndPreviewHedgeForm());
    hedgeActionsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(hedgeActionsForm);
      const actionType = formData.get('actionType');

      if (actionType === 'hedge') {
        const commodity = formData.get('commodity');
        const percent = Number(formData.get('percent'));
        data.hedgeExposure({ commodity, percent, month: formData.get('month') });
        utils.showToast(`Hedged ${percent}% ${commodity} in ${formData.get('month')}`, 'success');
      } else {
        const fromSelect = hedgeActionsForm.querySelector('[name="from"]');
        const selectedOption = fromSelect.options[fromSelect.selectedIndex];
        const symbol = selectedOption.dataset.symbol;
        const from = formData.get('from');
        const to = formData.get('to');
        data.rollMonth({ symbol, from, to });
        utils.showToast(`Rolled ${symbol} from ${from} to ${to}: +$12.5k MTM`, 'success');
      }
      renderHedge();
    });
  }

  function activateRoute(route) {
    if (activeRoute === route) {
      renderActiveView();
      return;
    }
    if (activeRoute && routeHandlers[activeRoute]?.destroy) {
      routeHandlers[activeRoute].destroy();
    }
    Object.values(views).forEach((view) => view.el.setAttribute('hidden', ''));
    const nextView = views[route] || views['#/trader'];
    nextView.el.removeAttribute('hidden');
    activeRoute = route;
    navLinks.forEach((link) => {
      const isActive = link.dataset.route === route;
      link.classList.toggle('is-active', isActive);
    });
    renderActiveView();
  }

  function renderActiveView() {
    const handler = routeHandlers[activeRoute];
    if (handler && handler.render) {
      handler.render();
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

  function renderHedge() {
    const exposure = data.getExposureSummary();
    const exposureContainer = document.querySelector('[data-role="hedge-exposure"]');
    exposureContainer.innerHTML = '';
    Object.entries(exposure.byCommodity).forEach(([commodity, values]) => {
      const ratio = values.physical > 0 ? Math.round((values.hedged / values.physical) * 100) : 0;
      const line = utils.createElement('div', { html: `<strong>${commodity}</strong> · ${values.physical.toLocaleString()} phys / ${values.hedged.toLocaleString()} hedged → ${ratio}%` });
      exposureContainer.appendChild(line);
    });

    updateHedgeFormUI();
    validateAndPreviewHedgeForm();

    const futures = data.getFutures();

    function updateHedgeFormUI() {
      const fieldsContainer = hedgeActionsForm.querySelector('[data-role="actions-fields"]');
      const actionType = hedgeActionsForm.querySelector('input[name="actionType"]:checked').value;
      fieldsContainer.innerHTML = ''; // Clear previous fields

      if (actionType === 'hedge') {
        const topExposureCommodity = Object.keys(exposure.byCommodity).reduce((a, b) => exposure.byCommodity[a].physical > exposure.byCommodity[b].physical ? a : b);

        const commodityLabel = utils.createElement('label', { text: 'Commodity' });
        const commoditySelect = utils.createElement('select', { attrs: { name: 'commodity' } });
        Object.keys(exposure.byCommodity).forEach((commodity) => {
          const option = utils.createElement('option', { text: commodity, attrs: { value: commodity } });
          if (commodity === topExposureCommodity) {
            option.selected = true;
          }
          commoditySelect.appendChild(option);
        });
        commodityLabel.appendChild(commoditySelect);

        const percentContainer = utils.createElement('div', { className: 'form-group--slider' });
        const percentLabel = utils.createElement('label', { text: 'Percent' });
        const percentSlider = utils.createElement('input', { attrs: { type: 'range', name: 'percent', min: '0', max: '100', value: '50' } });
        const percentInput = utils.createElement('input', { className: 'input--small', attrs: { type: 'number', name: 'percent-display', min: '0', max: '100', value: '50' }});

        percentSlider.addEventListener('input', () => percentInput.value = percentSlider.value);
        percentInput.addEventListener('input', () => percentSlider.value = percentInput.value);

        percentContainer.appendChild(percentLabel);
        percentContainer.appendChild(percentSlider);
        percentContainer.appendChild(percentInput);

        const monthLabel = utils.createElement('label', { text: 'Board Month' });
        const monthSelect = utils.createElement('select', { attrs: { name: 'month' } });
        futures.suggestedMonths.forEach((suggestion, index) => {
          const option = utils.createElement('option', { text: `${suggestion.month} (${suggestion.board.toFixed(2)})`, attrs: { value: suggestion.month } });
          if (index === 0) option.selected = true; // Default to nearest liquid month
          monthSelect.appendChild(option);
        });
        monthLabel.appendChild(monthSelect);

        fieldsContainer.appendChild(commodityLabel);
        fieldsContainer.appendChild(percentContainer);
        fieldsContainer.appendChild(monthLabel);
      } else { // roll
        const largestPosition = futures.positions.reduce((a, b) => a.qty > b.qty ? a : b);

        const fromLabel = utils.createElement('label', { text: 'From Month' });
        const fromSelect = utils.createElement('select', { attrs: { name: 'from' } });
        futures.positions.forEach((position) => {
          const option = utils.createElement('option', { text: `${position.symbol} ${position.month}`, attrs: { value: position.month, 'data-symbol': position.symbol } });
          if (position.month === largestPosition.month) option.selected = true;
          fromSelect.appendChild(option);
        });
        fromLabel.appendChild(fromSelect);

        const toLabel = utils.createElement('label', { text: 'To Month' });
        const toSelect = utils.createElement('select', { attrs: { name: 'to' } });
        const liquidMonths = ['Nov-24', 'Dec-24', 'Jan-25', 'Mar-25', 'May-25']; // Example liquid months
        const fromIndex = liquidMonths.indexOf(largestPosition.month);
        if (fromIndex !== -1 && fromIndex + 1 < liquidMonths.length) {
           liquidMonths.slice(fromIndex + 1).forEach(month => {
             toSelect.appendChild(utils.createElement('option', { text: month, attrs: { value: month } }));
           });
        }
        toLabel.appendChild(toSelect);

        fieldsContainer.appendChild(fromLabel);
        fieldsContainer.appendChild(toLabel);
      }
    }

    function validateAndPreviewHedgeForm() {
      const formData = new FormData(hedgeActionsForm);
      const actionType = formData.get('actionType');
      const submitButton = hedgeActionsForm.querySelector('button[type="submit"]');
      const previewContainer = hedgeActionsForm.querySelector('[data-role="impact-preview"]');
      let isValid = false;
      let previewText = '';

      if (actionType === 'hedge') {
        const commodity = formData.get('commodity');
        const percent = Number(formData.get('percent-display')); // Use display input for validation
        const exposureData = data.getExposureSummary().byCommodity[commodity];
        isValid = percent > 0 && percent <= 100 && !!commodity && !!exposureData;
        if (isValid) {
          const targetQty = (exposureData.physical * (percent / 100));
          const newCoverage = (exposureData.hedged + targetQty) / exposureData.physical;
          previewText = `Est. Target: ${targetQty.toLocaleString(undefined, { maximumFractionDigits: 0 })}. New Coverage: ${utils.formatPercent(newCoverage * 100)}.`;
        }
      } else { // roll
        const from = formData.get('from');
        const to = formData.get('to');
        isValid = !!from && !!to && from !== to;
        if (isValid) {
          const mtmGain = (Math.random() * 20000) + 5000; // Simulate dynamic MTM gain
          previewText = `Est. MTM gain: ${utils.formatCurrency(mtmGain)}.`;
        }
      }
      submitButton.disabled = !isValid;
      submitButton.textContent = actionType === 'hedge' ? 'Apply Hedge' : 'Apply Roll';
      previewContainer.textContent = previewText;
    }

    charts.mountChart('chart-hedge-ratio', {
      type: 'line',
      data: {
        labels: futures.hedgeMonths,
        datasets: [{ data: futures.hedgeRatioHistory, borderColor: '#004bff', fill: false, tension: 0.35 }]
      },
      options: { plugins: { legend: { display: false } } }
    });

    charts.mountChart('chart-hedge-sensitivity', {
      type: 'bar',
      data: {
        labels: ['-3%', '-2%', '-1%', 'Flat', '+1%', '+2%', '+3%'],
        datasets: [{ data: futures.pnlSensitivity, backgroundColor: futures.pnlSensitivity.map((v) => v >= 0 ? '#1ab76c' : '#e03e3e') }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } }
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
