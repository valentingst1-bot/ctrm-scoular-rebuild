(function () {
  const numberFormatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 1,
  });

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const percentFormatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  });

  const decimalFormatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  function formatMillions(value) {
    if (typeof value !== 'number') return '--';
    return `${numberFormatter.format(value)} MM`;
  }

  function formatCurrency(value) {
    if (typeof value !== 'number') return '--';
    return currencyFormatter.format(value);
  }

  function formatPercent(value) {
    if (typeof value !== 'number') return '--';
    return percentFormatter.format(value / 100);
  }

  function formatNumber(value, digits = 2) {
    if (typeof value !== 'number') return '--';
    return Number(value.toFixed(digits)).toString();
  }

  function formatDelta(value, options = {}) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0';
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const magnitude = Math.abs(value);
    if (options.unit === 'percent') {
      return `${sign}${decimalFormatter.format(magnitude)}%`;
    }
    if (options.unit === 'mm') {
      return `${sign}${decimalFormatter.format(magnitude)} MM`;
    }
    return `${sign}${decimalFormatter.format(magnitude)}`;
  }

  function groupBy(list, key) {
    return list.reduce((acc, item) => {
      const group = item[key] ?? 'Other';
      acc[group] = acc[group] || [];
      acc[group].push(item);
      return acc;
    }, {});
  }

  function sumBy(list, key) {
    return list.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  }

  function daysBetween(start) {
    const startDate = new Date(start);
    const now = new Date();
    const diff = now.getTime() - startDate.getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }

  function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([attr, value]) => {
        if (value !== undefined && value !== null) {
          el.setAttribute(attr, value);
        }
      });
    }
    return el;
  }

  window.CTRMUtils = {
    formatMillions,
    formatCurrency,
    formatPercent,
    formatNumber,
    formatDelta,
    groupBy,
    sumBy,
    daysBetween,
    createElement,
  };
})();
