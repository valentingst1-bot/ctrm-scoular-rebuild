(function () {

  const baseSnapshots = {
    today: {
      label: 'Live',
      mtmChange: 2.4,
      hedgeCoverage: 64,
      basisPL: 4.8,
      futuresPL: 3.2,
      freightVar: -0.8,
      otherPL: 0.6,
      workingCapital: 82,
      bulletins: [
        'Soy crush margins expanded 12% on stronger meal demand.',
        'Canadian canola basis tightening in Prairie North zone.',
        'Barge freight easing, reducing exposure on Mississippi lifts.'
      ],
    },
    monthEndAug: {
      label: 'Month End Aug',
      mtmChange: 1.1,
      hedgeCoverage: 71,
      basisPL: 5.4,
      futuresPL: 2.1,
      freightVar: -1.2,
      otherPL: 0.9,
      workingCapital: 95,
      bulletins: [
        'August books locked: wheat carry softened 4¢ across Gulf.',
        'Soy export pace trending 8% above seasonal norms.',
        'Northern Plains basis inverted; review storage strategy.'
      ],
    },
  };

  const trades = [
    {
      id: 'SC-2401',
      counterparty: 'ADM',
      type: 'Purchase',
      commodity: 'Soybeans',
      qty: 55000,
      uom: 'bu',
      price: 13.42,
      basis: 0.24,
      futures: 13.18,
      flat: 13.42,
      deliveryWindow: 'Sep 12 - Sep 20',
      marketMonth: 'Nov-24',
      marketZone: 'Prairie North',
      pricingPoint: 'Fargo Elevator',
      status: 'Open'
    },
    {
      id: 'SC-2402',
      counterparty: 'Cargill',
      type: 'Sale',
      commodity: 'Wheat',
      qty: 42000,
      uom: 'bu',
      price: 7.82,
      basis: 0.32,
      futures: 7.5,
      flat: 7.82,
      deliveryWindow: 'Oct 01 - Oct 15',
      marketMonth: 'Dec-24',
      marketZone: 'Gulf Export',
      pricingPoint: 'Gulf Elevation',
      status: 'Nominated'
    },
    {
      id: 'SC-2403',
      counterparty: 'Louis Dreyfus',
      type: 'Purchase',
      commodity: 'Corn',
      qty: 68000,
      uom: 'bu',
      price: 5.12,
      basis: 0.12,
      futures: 5.0,
      flat: 5.12,
      deliveryWindow: 'Sep 25 - Oct 05',
      marketMonth: 'Dec-24',
      marketZone: 'Mississippi River',
      pricingPoint: 'Memphis Barge',
      status: 'Working'
    },
    {
      id: 'SC-2404',
      counterparty: 'COFCO',
      type: 'Sale',
      commodity: 'Canola',
      qty: 38000,
      uom: 'mt',
      price: 702,
      basis: 22,
      futures: 680,
      flat: 702,
      deliveryWindow: 'Nov 05 - Nov 20',
      marketMonth: 'Jan-25',
      marketZone: 'Pacific Northwest',
      pricingPoint: 'PNW Export',
      status: 'Confirmed'
    },
    {
      id: 'SC-2405',
      counterparty: 'The Andersons',
      type: 'Purchase',
      commodity: 'Corn',
      qty: 48000,
      uom: 'bu',
      price: 5.05,
      basis: 0.09,
      futures: 4.96,
      flat: 5.05,
      deliveryWindow: 'Sep 15 - Sep 22',
      marketMonth: 'Dec-24',
      marketZone: 'Gulf Export',
      pricingPoint: 'Gulf Elevation',
      status: 'Open'
    },
    {
      id: 'SC-2406',
      counterparty: 'Bunge',
      type: 'Sale',
      commodity: 'Soybeans',
      qty: 60000,
      uom: 'bu',
      price: 13.54,
      basis: 0.26,
      futures: 13.28,
      flat: 13.54,
      deliveryWindow: 'Oct 18 - Oct 30',
      marketMonth: 'Nov-24',
      marketZone: 'Prairie North',
      pricingPoint: 'Fargo Elevator',
      status: 'Working'
    },
    {
      id: 'SC-2407',
      counterparty: 'CHS',
      type: 'Purchase',
      commodity: 'Wheat',
      qty: 35000,
      uom: 'bu',
      price: 7.65,
      basis: 0.28,
      futures: 7.37,
      flat: 7.65,
      deliveryWindow: 'Sep 05 - Sep 18',
      marketMonth: 'Dec-24',
      marketZone: 'Northern Plains',
      pricingPoint: 'Bismarck Shuttle',
      status: 'Open'
    },
    {
      id: 'SC-2408',
      counterparty: 'Marubeni',
      type: 'Sale',
      commodity: 'Corn',
      qty: 52000,
      uom: 'bu',
      price: 5.24,
      basis: 0.18,
      futures: 5.06,
      flat: 5.24,
      deliveryWindow: 'Dec 01 - Dec 20',
      marketMonth: 'Mar-25',
      marketZone: 'Gulf Export',
      pricingPoint: 'New Orleans',
      status: 'Confirmed'
    },
    {
      id: 'SC-2409',
      counterparty: 'Gavilon',
      type: 'Purchase',
      commodity: 'Canola',
      qty: 20000,
      uom: 'mt',
      price: 695,
      basis: 18,
      futures: 677,
      flat: 695,
      deliveryWindow: 'Sep 01 - Sep 12',
      marketMonth: 'Nov-24',
      marketZone: 'Prairie South',
      pricingPoint: 'Regina Crush',
      status: 'Working'
    },
    {
      id: 'SC-2410',
      counterparty: 'Tyson Foods',
      type: 'Sale',
      commodity: 'Soybeans',
      qty: 45000,
      uom: 'bu',
      price: 13.61,
      basis: 0.3,
      futures: 13.31,
      flat: 13.61,
      deliveryWindow: 'Nov 10 - Nov 25',
      marketMonth: 'Jan-25',
      marketZone: 'Mississippi River',
      pricingPoint: 'St. Louis Barge',
      status: 'Open'
    },
    {
      id: 'SC-2411',
      counterparty: 'Scoular Feed',
      type: 'Internal',
      commodity: 'Corn',
      qty: 30000,
      uom: 'bu',
      price: 5.08,
      basis: 0.1,
      futures: 4.98,
      flat: 5.08,
      deliveryWindow: 'Sep 08 - Sep 20',
      marketMonth: 'Dec-24',
      marketZone: 'Prairie North',
      pricingPoint: 'Fargo Elevator',
      status: 'Closed'
    },
    {
      id: 'SC-2412',
      counterparty: 'Archer UK',
      type: 'Sale',
      commodity: 'Wheat',
      qty: 33000,
      uom: 'mt',
      price: 274,
      basis: 12,
      futures: 262,
      flat: 274,
      deliveryWindow: 'Oct 20 - Nov 02',
      marketMonth: 'Dec-24',
      marketZone: 'Atlantic Export',
      pricingPoint: 'Norfolk Rail',
      status: 'Nominated'
    }
  ];

  const inventoryLots = [
    {
      id: 'LOT-01',
      elevator: 'Fargo Elevator',
      commodity: 'Soybeans',
      qty: 22000,
      uom: 'bu',
      grade: 'No.1 Yellow',
      moisture: '12.4%',
      protein: '36%',
      received: '2024-08-22',
      marketZone: 'Prairie North'
    },
    {
      id: 'LOT-02',
      elevator: 'Memphis Barge',
      commodity: 'Corn',
      qty: 18000,
      uom: 'bu',
      grade: 'No.2 Yellow',
      moisture: '14.8%',
      protein: '9%',
      received: '2024-08-17',
      marketZone: 'Mississippi River'
    },
    {
      id: 'LOT-03',
      elevator: 'Regina Crush',
      commodity: 'Canola',
      qty: 12000,
      uom: 'mt',
      grade: 'Canola 1 CAN',
      moisture: '9.5%',
      protein: '20%',
      received: '2024-08-02',
      marketZone: 'Prairie South'
    },
    {
      id: 'LOT-04',
      elevator: 'Gulf Elevation',
      commodity: 'Corn',
      qty: 26000,
      uom: 'bu',
      grade: 'No.2 Yellow',
      moisture: '15.1%',
      protein: '8%',
      received: '2024-07-27',
      marketZone: 'Gulf Export'
    },
    {
      id: 'LOT-05',
      elevator: 'Bismarck Shuttle',
      commodity: 'Wheat',
      qty: 16000,
      uom: 'bu',
      grade: 'DNS 14%',
      moisture: '11.2%',
      protein: '14%',
      received: '2024-08-28',
      marketZone: 'Northern Plains'
    }
  ];

  const futuresPositions = [
    { symbol: 'ZS', month: 'Nov-24', qty: -320, avgPrice: 13.25, account: 'INT-HEDGE' },
    { symbol: 'ZS', month: 'Jan-25', qty: -220, avgPrice: 13.42, account: 'INT-HEDGE' },
    { symbol: 'ZC', month: 'Dec-24', qty: -410, avgPrice: 5.09, account: 'INT-HEDGE' },
    { symbol: 'ZW', month: 'Dec-24', qty: -280, avgPrice: 7.48, account: 'INT-HEDGE' },
    { symbol: 'RS', month: 'Nov-24', qty: -180, avgPrice: 688, account: 'INT-HEDGE' },
  ];

  const pricing = {
    marketPrices: [
      { commodity: 'Soybeans', month: 'Nov-24', price: 13.36 },
      { commodity: 'Corn', month: 'Dec-24', price: 5.04 },
      { commodity: 'Wheat', month: 'Dec-24', price: 7.58 },
      { commodity: 'Canola', month: 'Jan-25', price: 701 }
    ],
    pricingPoints: [
      { name: 'Fargo Elevator', commodity: 'Soybeans', adjustment: 0.28 },
      { name: 'Memphis Barge', commodity: 'Corn', adjustment: 0.12 },
      { name: 'Regina Crush', commodity: 'Canola', adjustment: 19 },
      { name: 'Gulf Elevation', commodity: 'Corn', adjustment: 0.31 },
    ],
    zoneSpreads: [
      { zone: 'Prairie North', commodity: 'Soybeans', spread: 0.22 },
      { zone: 'Mississippi River', commodity: 'Corn', spread: 0.18 },
      { zone: 'Gulf Export', commodity: 'Corn', spread: 0.34 },
      { zone: 'Northern Plains', commodity: 'Wheat', spread: 0.27 },
    ]
  };

  const referenceData = {
    commodities: ['Soybeans', 'Corn', 'Wheat', 'Canola'],
    tradeUnits: ['bu', 'mt'],
    elevators: ['Fargo Elevator', 'Memphis Barge', 'Regina Crush', 'Gulf Elevation', 'Bismarck Shuttle'],
  };

  const baseExposureByCommodity = {
    Soybeans: { physical: 165000, hedged: 118000 },
    Corn: { physical: 198000, hedged: 154000 },
    Wheat: { physical: 143000, hedged: 96000 },
    Canola: { physical: 74000, hedged: 55000 }
  };

  const exposures = {
    byCommodity: JSON.parse(JSON.stringify(baseExposureByCommodity)),
    hedgeRatioHistory: [62, 64, 63, 66, 65, 67, 68],
    pnlSensitivity: [ -2.4, -1.8, -1.1, 0, 1.6, 2.8, 3.6 ],
    hedgeMonths: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
  };

  const varianceActivity = [
    { label: 'New', count: 6, delta: 0.8 },
    { label: 'Changed', count: 11, delta: -1.1 },
    { label: 'Closed', count: 9, delta: 0.4 },
    { label: 'Reopened', count: 3, delta: -0.2 },
  ];

  const carrySpark = [420, 430, 425, 437, 440, 452, 448, 455, 460, 466, 462];

  const intelHeadlines = [
    {
      headline: 'Brazil soy planting kicks off amid dry pockets',
      takeaway: 'Early dryness in Mato Grosso is slowing planting pace, but forward sales are still elevated, keeping export competition high into Q1.'
    },
    {
      headline: 'USDA flash sale to China surprises corn market',
      takeaway: 'The sale tightens Gulf balance sheets and supports nearby basis, suggesting we continue to prioritize barge capacity allocation.'
    },
    {
      headline: 'Black Sea corridor tensions resurface',
      takeaway: 'Insurance premiums are widening again, lifting delivered wheat offers and improving domestic milling margins.'
    }
  ];

  const intelQuantTiles = [
    { label: '30d Volatility', value: '22%', context: 'Current vol sits +4% vs long-run.' },
    { label: 'Seasonality', value: 'Bullish', context: '3-yr avg implies +1.2% carry through Oct.' },
    { label: 'Front Spreads', value: '-9¢', context: 'Z/X soy spread keeps inverting on export pull.' },
  ];

  const dailyCarryHeadline = 'Daily inventory carry interest: $452k';

  const adjustments = {
    today: { mtmChange: 0, hedgeCoverage: 0, basisPL: 0, futuresPL: 0, freightVar: 0, otherPL: 0, workingCapital: 0 },
    monthEndAug: { mtmChange: 0, hedgeCoverage: 0, basisPL: 0, futuresPL: 0, freightVar: 0, otherPL: 0, workingCapital: 0 },
  };

  const listeners = new Set();
  let currentSnapshotKey = 'today';

  function recordHedgePoint(label) {
    const totals = Object.values(exposures.byCommodity).reduce((acc, item) => {
      acc.physical += item.physical;
      acc.hedged += item.hedged;
      return acc;
    }, { physical: 0, hedged: 0 });
    const ratio = totals.physical === 0 ? 0 : Math.round((totals.hedged / totals.physical) * 100);
    exposures.hedgeRatioHistory.push(ratio);
    exposures.hedgeMonths.push(label);
  }

  function notify(type, payload) {
    listeners.forEach((fn) => fn({ type, payload }));
  }

  function getActiveSnapshot() {
    return currentSnapshotKey;
  }

  function buildSnapshot(key) {
    const base = baseSnapshots[key];
    const adj = adjustments[key];
    return {
      key,
      label: base.label,
      mtmChange: +(base.mtmChange + adj.mtmChange).toFixed(1),
      hedgeCoverage: Math.min(100, Math.max(0, +(base.hedgeCoverage + adj.hedgeCoverage).toFixed(1))),
      basisPL: +(base.basisPL + adj.basisPL).toFixed(1),
      futuresPL: +(base.futuresPL + adj.futuresPL).toFixed(1),
      freightVar: +(base.freightVar + adj.freightVar).toFixed(1),
      otherPL: +(base.otherPL + adj.otherPL).toFixed(1),
      workingCapital: +(base.workingCapital + adj.workingCapital).toFixed(1),
      bulletins: base.bulletins
    };
  }

  function getSnapshot(key) {
    return buildSnapshot(key || currentSnapshotKey);
  }

  function setSnapshot(key) {
    if (!baseSnapshots[key]) return;
    currentSnapshotKey = key;
    notify('snapshotChanged', { snapshot: getSnapshot(key) });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getTrades() {
    return trades.slice();
  }

  function getTradeById(id) {
    return trades.find((trade) => trade.id === id) || null;
  }

  const openTickets = [
    { id: 'TICK-01', commodity: 'Corn', action: 'Loadout', qty: 12000, zone: 'Gulf Export', pnlImpact: 0.18 },
    { id: 'TICK-02', commodity: 'Soybeans', action: 'Unload', qty: 9000, zone: 'Prairie North', pnlImpact: 0.21 },
    { id: 'TICK-03', commodity: 'Wheat', action: 'Loadout', qty: 7000, zone: 'Northern Plains', pnlImpact: -0.05 },
  ];

  function getInventory() {
    const grouped = window.CTRMUtils.groupBy(inventoryLots, 'elevator');
    const lotsByElevator = Object.entries(grouped).map(([elevator, lots]) => ({
      elevator,
      lots: lots.map((lot) => ({ ...lot, age: window.CTRMUtils.daysBetween(lot.received) }))
    }));

    const monthExposure = [
      { label: 'Sep', value: 88 },
      { label: 'Oct', value: 102 },
      { label: 'Nov', value: 94 },
      { label: 'Dec', value: 86 },
      { label: 'Jan', value: 70 },
    ];

    const qualityDistribution = [
      { label: 'Premium', value: 38 },
      { label: 'Std Grade', value: 52 },
      { label: 'Sub Spec', value: 10 },
    ];

    const agingCurve = [
      { label: '0-15', value: 46 },
      { label: '16-30', value: 32 },
      { label: '31-45', value: 18 },
      { label: '45+', value: 8 },
    ];

    return { lotsByElevator, monthExposure, qualityDistribution, agingCurve, openTickets: openTickets.slice() };
  }

  function getFutures() {
    return {
      positions: futuresPositions.slice(),
      hedgeRatioHistory: exposures.hedgeRatioHistory.slice(),
      hedgeMonths: exposures.hedgeMonths.slice(),
      pnlSensitivity: exposures.pnlSensitivity.slice(),
      suggestedMonths: [
        { commodity: 'Soybeans', month: 'Nov-24', board: 13.38 },
        { commodity: 'Corn', month: 'Dec-24', board: 5.06 },
        { commodity: 'Wheat', month: 'Dec-24', board: 7.61 },
        { commodity: 'Canola', month: 'Jan-25', board: 703 },
      ],
    };
  }

  function getPricing() {
    return JSON.parse(JSON.stringify(pricing));
  }

  function getExposureSummary() {
    return JSON.parse(JSON.stringify(exposures));
  }

  function getVarianceActivity() {
    return varianceActivity.slice();
  }

  function getCarrySpark() {
    return carrySpark.slice();
  }

  function getCarryHeadline() {
    return dailyCarryHeadline;
  }

  function getIntel() {
    return { headlines: intelHeadlines.slice(), tiles: intelQuantTiles.slice() };
  }

  function getReferenceData() {
    return JSON.parse(JSON.stringify(referenceData));
  }

  function updateKpiAdjustment(key, delta) {
    const snap = adjustments[currentSnapshotKey];
    snap[key] += delta;
  }

  function matchTicket(id) {
    const ticketIndex = openTickets.findIndex((ticket) => ticket.id === id);
    if (ticketIndex === -1) return;
    const ticket = openTickets.splice(ticketIndex, 1)[0];
    updateKpiAdjustment('basisPL', ticket.pnlImpact);
    updateKpiAdjustment('mtmChange', ticket.pnlImpact / 4);
    if (exposures.byCommodity[ticket.commodity]) {
      exposures.byCommodity[ticket.commodity].physical = Math.max(0, exposures.byCommodity[ticket.commodity].physical - ticket.qty);
    }
    recordHedgePoint('Match');
    notify('inventoryUpdated', { openTickets: openTickets.slice() });
    notify('snapshotUpdated', { snapshot: getSnapshot() });
  }

  function hedgeExposure({ commodity, percent, month }) {
    const deltaCoverage = Number(percent) / 4;
    updateKpiAdjustment('hedgeCoverage', deltaCoverage);
    updateKpiAdjustment('mtmChange', percent * 0.02);
    const entry = exposures.byCommodity[commodity] || (exposures.byCommodity[commodity] = { physical: 0, hedged: 0 });
    const additional = Math.round(entry.physical * (Number(percent) / 100));
    entry.hedged += additional;
    recordHedgePoint(month || 'Hedge');
    exposures.pnlSensitivity = exposures.pnlSensitivity.map((value, idx) => value + (idx - 3) * 0.1);
    notify('hedgeUpdated', { commodity, percent });
    notify('snapshotUpdated', { snapshot: getSnapshot() });
  }

  function rollMonth({ symbol, from, to }) {
    const position = futuresPositions.find((pos) => pos.symbol === symbol && pos.month === from);
    if (!position) return;
    position.month = to;
    position.avgPrice += 0.08;
    updateKpiAdjustment('futuresPL', 0.4);
    updateKpiAdjustment('mtmChange', 0.2);
    recordHedgePoint(to);
    notify('futuresRolled', { symbol, from, to });
    notify('snapshotUpdated', { snapshot: getSnapshot() });
  }

  function resetDemo() {
    Object.keys(adjustments).forEach((key) => {
      Object.keys(adjustments[key]).forEach((k) => {
        adjustments[key][k] = 0;
      });
    });
    exposures.hedgeRatioHistory = [62, 64, 63, 66, 65, 67, 68];
    exposures.pnlSensitivity = [ -2.4, -1.8, -1.1, 0, 1.6, 2.8, 3.6 ];
    exposures.hedgeMonths = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    exposures.byCommodity = JSON.parse(JSON.stringify(baseExposureByCommodity));
    notify('demoReset');
    notify('snapshotUpdated', { snapshot: getSnapshot() });
  }

  function getExposureByCommodity() {
    const commodities = ['Soybeans', 'Corn', 'Wheat', 'Canola'];
    const futures = getFutures();
    const summary = getExposureSummary();

    return commodities.map(commodity => {
      const exposure = summary.byCommodity[commodity] || { physical: 0, hedged: 0 };
      const physQty = exposure.physical;
      const hedgedQty = exposure.hedged;
      const unhedgedQty = Math.max(0, physQty - hedgedQty);
      const relevantMonth = futures.suggestedMonths.find(m => m.commodity === commodity);

      return {
        commodity: commodity,
        physQty: physQty,
        hedgedQty: hedgedQty,
        unhedgedQty: unhedgedQty,
        avgBasis: Math.random() * 0.2 + 0.1,
        nextMonth: relevantMonth ? relevantMonth.month : 'N/A'
      };
    });
  }
  window.CTRMData = {
    subscribe,
    setSnapshot,
    getSnapshot,
    getTrades,
    getTradeById,
    getInventory,
    getFutures,
    getPricing,
    getExposureSummary,
    getExposureByCommodity,
    getVarianceActivity,
    getCarrySpark,
    getCarryHeadline,
    getIntel,
    getReferenceData,
    matchTicket,
    hedgeExposure,
    rollMonth,
    resetDemo,
  };
})();
