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
  window.CTRMCharts = {
    mountChart,
    destroyChart,
    destroyAll,
    mountExposureBar,
  };
})();
