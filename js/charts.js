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
    if (!el) return;
    const chartId = 'exposureBar';
    destroyChart(chartId);

    const totalPhysical = rows.reduce((sum, row) => sum + row.physQty, 0);

    const datasets = rows.map((row, index) => {
        const palette = ['#004bff', '#1ab76c', '#8a5aff', '#ff8c42'];
        return {
            label: row.commodity,
            data: [row.physQty],
            backgroundColor: palette[index % palette.length],
            barPercentage: 1.0,
            categoryPercentage: 1.0,
        };
    });

    const instance = new Chart(el, {
        type: 'bar',
        data: {
            labels: ['Exposure'],
            datasets: datasets,
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    stacked: true,
                    display: false,
                },
                y: {
                    stacked: true,
                    display: false,
                }
            },
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const row = rows[context.datasetIndex];
                            const hedgePercent = row.physQty > 0 ? (row.hedgedQty / row.physQty) * 100 : 0;
                            return [
                                `${row.commodity}`,
                                `Physical: ${row.physQty.toLocaleString()}`,
                                `Hedged: ${row.hedgedQty.toLocaleString()}`,
                                `Hedge %: ${hedgePercent.toFixed(1)}%`
                            ];
                        }
                    }
                }
            }
        }
    });
    registry.set(chartId, instance);
  }

  window.CTRMCharts = {
    mountChart,
    destroyChart,
    destroyAll,
    mountExposureBar,
  };
})();
