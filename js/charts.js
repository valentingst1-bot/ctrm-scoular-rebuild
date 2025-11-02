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

  window.CTRMCharts = {
    mountChart,
    destroyChart,
    destroyAll,
  };
})();
