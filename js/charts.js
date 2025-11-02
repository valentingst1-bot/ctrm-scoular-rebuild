(function () {
  if (window.Chart) {
    Chart.defaults.font.family = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
    Chart.defaults.color = 'rgba(212, 220, 238, 0.82)';
    Chart.defaults.elements.line.borderJoinStyle = 'round';
    Chart.defaults.elements.line.borderCapStyle = 'round';
    Chart.defaults.elements.line.tension = 0.35;
    Chart.defaults.elements.bar.borderRadius = 6;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.font = {
      size: 11,
    };
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(12, 18, 30, 0.92)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(90, 120, 160, 0.35)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.scales.linear.grid.color = 'rgba(110, 130, 160, 0.16)';
    Chart.defaults.scales.linear.ticks.padding = 6;
    Chart.defaults.scales.category.grid.color = 'rgba(110, 130, 160, 0.08)';
    Chart.defaults.scales.category.ticks.padding = 8;
  }

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

  window.CTRMCharts = {
    mountChart,
    destroyChart,
    destroyAll,
    count: () => registry.size,
  };
})();
