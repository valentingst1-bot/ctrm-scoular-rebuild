(function () {
  const charts = window.CTRMCharts;
  const data = window.CTRMData;
  const router = window.CTRMRouting;
  const utils = window.CTRMUtils;

  function renderExposureBar() {
    const exposure = data.getExposureSummary();
    if (!exposure || !exposure.byCommodity) {
      console.error('Exposure data is not available.');
      return;
    }

    const commodities = Object.keys(exposure.byCommodity);
    const totalPhysical = commodities.reduce((sum, key) => sum + exposure.byCommodity[key].physical, 0);

    if (totalPhysical === 0) {
      // No data to display, maybe hide the chart or show a message
      return;
    }

    const datasets = commodities.map(commodity => {
      const commodityExposure = exposure.byCommodity[commodity];
      const physicalQty = commodityExposure.physical;
      const hedgedQty = commodityExposure.hedged;
      const hedgePercent = physicalQty > 0 ? (hedgedQty / physicalQty) * 100 : 0;
      const physicalNormalized = (physicalQty / totalPhysical) * 100;

      return {
        label: commodity,
        data: [physicalNormalized],
        backgroundColor: utils.getCommodityColor(commodity),
        commodityData: { // Store extra data for tooltip
          physical: physicalQty,
          hedged: hedgedQty,
          percent: hedgePercent,
        }
      };
    });

    charts.mountChart('chart-exposure-distribution', {
      type: 'bar',
      data: {
        labels: ['Exposure'],
        datasets: datasets,
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
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
            display: false
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const dataset = context.dataset;
                const commodity = dataset.label;
                const cData = dataset.commodityData;
                return [
                  `Commodity: ${commodity}`,
                  `Physical Qty: ${cData.physical.toLocaleString()}`,
                  `Hedged Qty: ${cData.hedged.toLocaleString()}`,
                  `Hedge %: ${cData.percent.toFixed(1)}%`
                ];
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const datasetIndex = elements[0].datasetIndex;
            const commodity = datasets[datasetIndex].label;
            router.navigate(`#/hedge/${commodity.toLowerCase()}`);
          }
        }
      }
    });
  }

  function destroy() {
    charts.destroyChart('chart-exposure-distribution');
  }

  window.CTRMHedge = {
    renderExposureBar,
    destroy,
  };

})();
