(function () {
  const listeners = new Set();
  const paramRoutes = [
    { pattern: /^#\/hedge\/([\w-]+)$/i, path: '#/hedge/:commodity', params: ['commodity'] },
  ];

  function parseRoute(hash) {
    const currentHash = hash || window.location.hash || '#/trader';
    for (const route of paramRoutes) {
      const match = currentHash.match(route.pattern);
      if (match) {
        const params = route.params.reduce((acc, key, index) => {
          const value = match[index + 1];
          acc[key] = key === 'commodity' ? value.toLowerCase() : value;
          return acc;
        }, {});
        return { path: route.path, params, hash: currentHash };
      }
    }
    return { path: currentHash, params: {}, hash: currentHash };
  }

  function notify(hash) {
    const context = parseRoute(hash);
    listeners.forEach((handler) => handler(context));
  }

  function subscribe(handler) {
    listeners.add(handler);
    handler(parseRoute(window.location.hash || '#/trader'));
    return () => listeners.delete(handler);
  }

  function navigate(hash) {
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      notify(hash);
    }
  }

  window.addEventListener('hashchange', () => notify(window.location.hash));

  window.CTRMRouting = {
    subscribe,
    navigate,
    parseRoute,
  };
})();
