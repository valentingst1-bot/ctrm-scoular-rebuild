(function () {
  const registry = new Map();

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

  function mountExposureBar(el, rows) {
    const totalPhysical = rows.reduce((sum, row) => sum + row.physQty, 0);
    const datasets = rows.map(row => {
      const hedgePercent = row.physQty > 0 ? (row.hedgedQty / row.physQty) * 100 : 0;
      return {
        label: row.commodity,
        data: [row.physQty],
        backgroundColor: window.CTRMUtils.getCommodityColor(row.commodity),
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
        }
      }
    });
  }
  function mountForwardCurve(el, data) {
    const labels = data.map(d => d.month);
    const prices = data.map(d => d.price);
    mountChart(el.id, {
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

  function mountExposureLadder(el, data, { onSelectMonth }) {
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
            const points = instance.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
            if (points.length) {
                const month = labels[points[0].index];
                onSelectMonth(month);
            }
        }
      }
    });
  }

  function mountBasisHistory(el, data) {
    const colors = ['#004bff', '#1ab76c', '#8a5aff'];
    const datasets = data.datasets.map((ds, i) => ({
      ...ds,
      borderColor: colors[i % colors.length],
      fill: false
    }));
    mountChart(el.id, {
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

  function mountWhatIf(el, data) {
      mountChart(el.id, {
          type: 'bar',
          data: {
              labels: ['Futures Δ', 'Basis Δ', 'Net Δ'],
              datasets: [{
                  data: [data.futuresDelta, data.basisDelta, data.netDelta],
                  backgroundColor: ['#004bff', '#1ab76c', '#ff8c42']
              }]
          },
          options: {
              indexAxis: 'y',
              plugins: { legend: { display: false } },
              scales: { x: { ticks: { callback: v => utils.formatCurrency(v, 0) } } }
          }
      });
  }

  window.CTRMCharts = {
    mountChart,
    destroyChart,
    destroyAll,
    mountExposureBar,
    mountForwardCurve,
    mountExposureLadder,
    mountBasisHistory,
    mountWhatIf,
  };
})();
