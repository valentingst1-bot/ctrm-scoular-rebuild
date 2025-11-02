(function () {
  const numberFormatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 1,
  });

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  const percentFormatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
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

  function showToast(message, type = 'info') {
    const toast = createElement('div', {
      className: `toast toast--${type}`,
      text: message,
      attrs: {
        role: 'alert',
        'aria-live': 'assertive'
      }
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast--exiting');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  const COMMODITY_COLORS = {
    Soybeans: '#004bff',
    Corn: '#1ab76c',
    Wheat: '#ffc842',
    Canola: '#8a5aff',
    Other: '#cccccc',
  };

  function getCommodityColor(commodity) {
    return COMMODITY_COLORS[commodity] || COMMODITY_COLORS.Other;
  }

  window.CTRMUtils = {
    formatMillions,
    formatCurrency,
    formatPercent,
    groupBy,
    sumBy,
    daysBetween,
    createElement,
    showToast,
    getCommodityColor,
  };
})();
