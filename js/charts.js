(function () {
  const registry = new Map();
  const utils = window.CTRMUtils;

  function mountChart(id, config) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    destroyChart(id);
    const instance = new Chart(ctx, config);
    registry.set(id, instance);
    return instance;
  }

  function destroyChart(id) {
    const existing = registry.get(id);
    if (existing) {
      existing.destroy();
      registry.delete(id);
    }
  }

  function destroyAll() {
    Array.from(registry.keys()).forEach(destroyChart);
  }

  function resolveElement(elOrId) {
    if (!elOrId) return null;
    if (typeof elOrId === 'string') return document.getElementById(elOrId);
    return elOrId;
  }

  function mountExposureBar(elOrId, rows, options = {}) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    const totalPhysical = rows.reduce((sum, row) => sum + row.physQty, 0);
    const datasets = rows.map(row => {
      const hedgePercent = row.physQty > 0 ? (row.hedgedQty / row.physQty) * 100 : 0;
      return {
        label: row.commodity,
        data: [row.physQty],
        backgroundColor: window.CTRMUtils.getCommodityColor(row.commodity),
        slug: utils.slug(row.commodity),
        tooltipData: {
          physical: row.physQty.toLocaleString(),
          hedged: row.hedgedQty.toLocaleString(),
          percent: hedgePercent.toFixed(1) + '%'
        }
      };
    });

    return mountChart(el.id, {
      type: 'bar',
      data: {
        labels: ['Exposure'],
        datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, display: false },
          y: { stacked: true, display: false }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = context.dataset.tooltipData;
                return [
                  `Commodity: ${context.dataset.label}`,
                  `Physical: ${data.physical}`,
                  `Hedged: ${data.hedged}`,
                  `Hedge %: ${data.percent}`
                ];
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (typeof options.onSelectCommodity !== 'function') return;
          if (!elements.length) return;
          const datasetIndex = elements[0].datasetIndex;
          const dataset = datasets[datasetIndex];
          options.onSelectCommodity({
            commodity: dataset.label,
            commoditySlug: dataset.slug || utils.slug(dataset.label),
          });
        }
      }
    });
  }
  function mountTermStructure(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    const labels = data.map(d => d.month);
    const prices = data.map(d => d.price);
    return mountChart(el.id, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Futures Price',
          data: prices,
          borderColor: '#004bff',
          tension: 0.1
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: v => `$${v.toFixed(2)}` } } }
      }
    });
  }

  function mountForwardCurve(elOrId, data) {
    return mountTermStructure(elOrId, data);
  }

  function mountExposureLadder(elOrId, data, options = {}) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    const labels = data.map(d => d.month);
    const datasets = [
      { label: 'Hedged', data: data.map(d => d.hedged), backgroundColor: '#1ab76c' },
      { label: 'Unhedged', data: data.map(d => Math.max(0, d.physical - d.hedged)), backgroundColor: '#e03e3e' }
    ];

    const instance = mountChart(el.id, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        scales: { x: { stacked: true }, y: { stacked: true } },
        plugins: { legend: { position: 'bottom' } },
        onClick: (e) => {
          if (typeof options.onSelectMonth !== 'function') return;
          const points = instance.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
          if (points.length) {
            const month = labels[points[0].index];
            options.onSelectMonth({ month, dataset: data[points[0].index] });
          }
        }
      }
    });
    return instance;
  }

  function mountBasisHistory(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    const colors = ['#004bff', '#1ab76c', '#8a5aff'];
    const datasets = data.datasets.map((ds, i) => ({
      ...ds,
      borderColor: colors[i % colors.length],
      fill: false
    }));
    return mountChart(el.id, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { ticks: { callback: v => `${v.toFixed(2)}` } } }
      }
    });
  }

  function mountWhatIf(elOrId, deltas = {}) {
    const el = resolveElement(elOrId);
    if (!el || !el.id) return null;
    const values = [deltas.futuresDelta || 0, deltas.basisDelta || 0, deltas.netDelta || 0];
    const labels = ['Futures Δ', 'Basis Δ', 'Net Δ'];
    return mountChart(el.id, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ['#004bff', '#1ab76c', '#ff8c42'],
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = labels[context.dataIndex] || '';
                const value = context.parsed.x ?? context.parsed;
                return `${label}: ${utils.formatCurrencyThousands(value)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            beginAtZero: true,
            ticks: {
              callback: (value) => utils.formatCurrencyThousands(value),
            },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    });
  }

  function mountPnLWaterfall(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    return mountChart(el.id, {
      type: 'bar',
      data: {
        labels: ['Basis', 'Futures', 'Freight', 'Other', 'Net'],
        datasets: [{
          label: 'P&L',
          data: [data.basisPL, data.futuresPL, data.freightVar, data.otherPL, data.netPL],
          backgroundColor: ['#1ab76c', '#004bff', '#e03e3e', '#8a5aff', '#1ab76c']
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  }

  function mountExposureHeatmap(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    // Note: Chart.js does not have a native heatmap. This is a simplified version using a bubble chart.
    const chartData = [];
    data.commodities.forEach((commodity, i) => {
      data.months.forEach((month, j) => {
        const physical = Math.random() * 100000;
        const hedged = physical * Math.random();
        chartData.push({
          x: j,
          y: i,
          v: physical,
          r: (physical / 100000) * 20,
          tooltip: `${commodity} / ${month}: ${Math.round(physical / 1000)}k (Hedged: ${Math.round(hedged / 1000)}k)`
        });
      });
    });

    return mountChart(el.id, {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Exposure',
          data: chartData,
          backgroundColor: '#004bff'
        }]
      },
      options: {
        scales: {
          y: { ticks: { callback: (value) => data.commodities[value] } },
          x: { ticks: { callback: (value) => data.months[value] } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => context.raw.tooltip
            }
          }
        }
      }
    });
  }

  function mountCarryCurve(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    return mountChart(el.id, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Carry',
          data: data.values,
          borderColor: '#1ab76c',
          tension: 0.35,
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  }

  function mountHedgeCoverageGauges(containerOrId, data) {
    const container = resolveElement(containerOrId);
    if (!container) return;
    container.innerHTML = '';
    Object.entries(data).forEach(([commodity, percentage]) => {
      const gaugeEl = document.createElement('div');
      gaugeEl.className = 'gauge';
      container.appendChild(gaugeEl);
      const canvas = document.createElement('canvas');
      canvas.id = `gauge-${commodity}`;
      gaugeEl.appendChild(canvas);
      const label = document.createElement('p');
      label.textContent = commodity;
      gaugeEl.appendChild(label);

      mountChart(canvas.id, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [percentage, 100 - percentage],
            backgroundColor: [utils.getCommodityColor(commodity), 'rgba(13,27,42,0.08)'],
            borderWidth: 0
          }]
        },
        options: {
          cutout: '80%',
          plugins: { tooltip: { enabled: false }, legend: { display: false } }
        }
      });
    });
  }

  function mountVarianceTimeline(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
    return mountChart(el.id, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Net P&L',
          data: data.values,
          backgroundColor: data.values.map(v => v >= 0 ? '#1ab76c' : '#e03e3e')
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  }

  function mountBasisMap(elOrId, data) {
    const el = resolveElement(elOrId);
    if (!el) return null;
     return mountChart(el.id, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: data.datasets.map((ds, i) => ({
          ...ds,
          borderColor: ['#004bff', '#1ab76c', '#8a5aff'][i % 3],
          fill: false
        }))
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { ticks: { callback: v => `${v.toFixed(2)}` } } }
      }
    });
  }


  window.CTRMCharts = {
    mountChart,
    destroyChart,
    destroyAll,
    mountExposureBar,
    mountTermStructure,
    mountForwardCurve,
    mountExposureLadder,
    mountBasisHistory,
    mountWhatIf,
    mountPnLWaterfall,
    mountExposureHeatmap,
    mountCarryCurve,
    mountHedgeCoverageGauges,
    mountVarianceTimeline,
    mountBasisMap,
  };
})();
