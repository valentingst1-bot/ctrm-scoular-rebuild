(function () {
  const CONTRACT_MULTIPLIERS = {
    Soybeans: 5000,
    Corn: 5000,
    Wheat: 5000,
    Canola: 100,
  };

  const SYMBOL_TO_COMMODITY = {
    ZS: 'Soybeans',
    ZC: 'Corn',
    ZW: 'Wheat',
    KE: 'Wheat',
    RS: 'Canola',
  };

  const MONTH_SEQUENCE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function toMillions(value) {
    return Number((value / 1_000_000).toFixed(2));
  }

  function ensureCommodityBucket(collection, commodity) {
    if (!collection[commodity]) {
      collection[commodity] = { physical: 0, hedged: 0 };
    }
    return collection[commodity];
  }

  function getPricing(state, commodity, month, pricingPoint, zone) {
    const market = state.pricing.marketPrices?.[commodity]?.[month] ?? 0;
    const pointAdj = state.pricing.pricingPoints?.[pricingPoint]?.[commodity] ?? 0;
    const zoneAdj = state.pricing.zoneSpreads?.[zone]?.[commodity] ?? 0;
    return {
      board: market,
      pricingPoint: pointAdj,
      zone: zoneAdj,
      local: market + pointAdj + zoneAdj,
    };
  }

  function toBushelEquivalent(qty, commodity, uom) {
    if (commodity === 'Canola') {
      return qty; // already metric tons, treated separately
    }
    return qty; // qty already in bushels for grains
  }

  function bucketAging(days) {
    if (days <= 15) return '0-15d';
    if (days <= 30) return '16-30d';
    if (days <= 60) return '31-60d';
    if (days <= 90) return '61-90d';
    return '90d+';
  }

  function emptyResult() {
    return {
      timestamp: Date.now(),
      aggregates: {
        basisPL: 0,
        futuresPL: 0,
        freightVar: 0,
        otherPL: 0,
        netPL: 0,
        hedgeCoverage: 0,
        workingCapital: 0,
      },
      exposures: {},
      inventory: {
        byMonth: [],
        byQuality: [],
        byAging: [],
      },
      mtmSeries: [],
    };
  }

  function ValuationEngine() {
    this.lastResult = emptyResult();
    this.hedgeHistory = [];
    this.mtmHistory = [];
  }

  ValuationEngine.prototype.evaluate = function evaluate(state) {
    if (!state) {
      this.lastResult = emptyResult();
      return this.lastResult;
    }

    let basisValue = 0;
    let futuresValue = 0;
    let freightValue = 0;
    let inventoryMtm = 0;
    let workingCapitalNotional = 0;

    const exposures = {};
    const monthExposure = new Map();
    const qualityBuckets = new Map();
    const agingBuckets = new Map();

    state.trades.forEach((trade) => {
      const pricing = getPricing(state, trade.commodity, trade.marketMonth, trade.pricingPoint, trade.marketZone);
      const openQty = trade.unpricedQty ?? trade.remainingQty ?? trade.qty;
      const baseQty = toBushelEquivalent(openQty, trade.commodity, trade.uom);
      const bucket = ensureCommodityBucket(exposures, trade.commodity);
      const sign = trade.type === 'Purchase' ? 1 : -1;
      bucket.physical += sign * baseQty;

      const contractLocal = trade.contractLocalPrice ?? pricing.local;
      const delta = pricing.local - contractLocal;
      basisValue += delta * baseQty * sign;

      const accrual = trade.freightAccrual || {};
      if (Number.isFinite(accrual.reserved) || Number.isFinite(accrual.actual)) {
        if (Number.isFinite(accrual.actual)) {
          freightValue += (accrual.reserved || 0) - accrual.actual + (accrual.zoneVariance || 0);
        } else {
          freightValue += (accrual.reserved || 0);
        }
      }

      trade.currentLocalPrice = pricing.local;
      trade.flatPrice = pricing.local + (trade.basis || 0);
    });

    state.inventoryLots.forEach((lot) => {
      const pricing = getPricing(state, lot.commodity, lot.marketMonth, lot.pricingPoint, lot.marketZone);
      const qty = toBushelEquivalent(lot.qty, lot.commodity, lot.uom);
      inventoryMtm += (pricing.local - lot.carryingPrice) * qty;
      workingCapitalNotional += pricing.local * qty;

      const monthKey = lot.marketMonth;
      monthExposure.set(monthKey, (monthExposure.get(monthKey) || 0) + qty);

      qualityBuckets.set(lot.grade, (qualityBuckets.get(lot.grade) || 0) + qty);

      const start = new Date(lot.startDate);
      const ageDays = Math.max(0, Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const agingKey = bucketAging(ageDays);
      agingBuckets.set(agingKey, (agingBuckets.get(agingKey) || 0) + qty);
    });

    state.futuresPositions.forEach((position) => {
      const commodity = position.commodity || SYMBOL_TO_COMMODITY[position.symbol] || 'Soybeans';
      const pricing = getPricing(state, commodity, position.month, position.pricingPoint || position.month, position.marketZone || '');
      const multiplier = CONTRACT_MULTIPLIERS[commodity] || 1;
      const openPnl = (pricing.board - position.avgPrice) * position.qty * multiplier;
      futuresValue += openPnl;

      const bucket = ensureCommodityBucket(exposures, commodity);
      bucket.hedged += -position.qty * multiplier;
    });

    futuresValue += state.adjustments?.futuresRealized || 0;

    const otherValue = (state.adjustments?.other || 0) + inventoryMtm;

    const aggregates = {
      basisPL: toMillions(basisValue),
      futuresPL: toMillions(futuresValue),
      freightVar: toMillions(freightValue),
      otherPL: toMillions(otherValue),
    };
    aggregates.netPL = Number((aggregates.basisPL + aggregates.futuresPL + aggregates.freightVar + aggregates.otherPL).toFixed(2));

    const totalPhysical = Object.values(exposures).reduce((total, bucket) => total + Math.abs(bucket.physical), 0);
    const totalHedged = Object.values(exposures).reduce((total, bucket) => total + Math.abs(bucket.hedged), 0);
    const hedgeCoverage = totalPhysical === 0 ? 0 : Math.min(100, (totalHedged / totalPhysical) * 100);
    aggregates.hedgeCoverage = Number(hedgeCoverage.toFixed(1));

    const workingCapitalBase = state.adjustments?.workingCapitalBase || 0;
    aggregates.workingCapital = Number(((workingCapitalBase + workingCapitalNotional) / 1_000_000).toFixed(2));

    const timestamp = Date.now();

    const inventory = {
      byMonth: Array.from(monthExposure.entries())
        .sort((a, b) => MONTH_SEQUENCE.indexOf(a[0].split('-')[0]) - MONTH_SEQUENCE.indexOf(b[0].split('-')[0]))
        .map(([label, value]) => ({ label, value })),
      byQuality: Array.from(qualityBuckets.entries()).map(([label, value]) => ({ label, value })),
      byAging: Array.from(agingBuckets.entries()).map(([label, value]) => ({ label, value })),
    };

    const mtmSeries = MONTH_SEQUENCE.slice(0, 6).map((label, index) => ({
      label,
      value: Number((aggregates.netPL - 0.6 + index * 0.25).toFixed(2)),
    }));

    this.lastResult = {
      timestamp,
      aggregates,
      exposures,
      inventory,
      mtmSeries,
    };

    this.hedgeHistory.push({ t: timestamp, value: aggregates.hedgeCoverage });
    if (this.hedgeHistory.length > 16) {
      this.hedgeHistory.shift();
    }

    this.mtmHistory.push({ t: timestamp, value: aggregates.netPL });
    if (this.mtmHistory.length > 16) {
      this.mtmHistory.shift();
    }

    return this.lastResult;
  };

  ValuationEngine.prototype.computeAggregates = function computeAggregates() {
    return this.lastResult.aggregates;
  };

  ValuationEngine.prototype.getExposureByCommodity = function getExposureByCommodity() {
    return this.lastResult.exposures;
  };

  ValuationEngine.prototype.getHedgeSeries = function getHedgeSeries() {
    return this.hedgeHistory.slice();
  };

  ValuationEngine.prototype.getMtmSeries = function getMtmSeries() {
    return this.lastResult.mtmSeries;
  };

  ValuationEngine.prototype.getInventoryBreakdown = function getInventoryBreakdown() {
    return this.lastResult.inventory;
  };

  window.CTRMValuationEngine = {
    create() {
      return new ValuationEngine();
    },
  };
})();
