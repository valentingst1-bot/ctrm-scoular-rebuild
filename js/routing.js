(function () {
  const listeners = new Set();
  const routes = [
    { pattern: /#\/hedge\/(\w+)/, name: '#/hedge/:commodity' }
  ];

  function resolve(hash) {
    for (const route of routes) {
      const match = hash.match(route.pattern);
      if (match) {
        return {
          name: route.name,
          params: { commodity: match[1] },
          hash: hash
        };
      }
    }
    return { name: hash, params: {}, hash: hash };
  }

  function notify(hash) {
    const context = resolve(hash);
    listeners.forEach((handler) => handler(context));
  }

  function subscribe(handler) {
    listeners.add(handler);
    handler(resolve(window.location.hash || '#/trader'));
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
  };
})();
