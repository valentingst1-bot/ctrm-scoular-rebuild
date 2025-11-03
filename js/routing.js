(function () {
  const listeners = new Set();

  function resolve(hash) {
    let path = hash;
    if (!path || path === '#') {
      path = '#/trader';
    } else if (!path.startsWith('#')) {
      path = '#' + path;
    }

    const context = { name: path, params: {}, hash: path };

    const hedgeDetailMatch = path.match(/^#\/hedge\/([\w\-]+)$/);
    if (hedgeDetailMatch) {
      context.name = '#/hedge/:commodity';
      context.params.commodity = hedgeDetailMatch[1];
    }

    return context;
  }

  function notify(hash) {
    const context = resolve(hash);
    listeners.forEach((handler) => handler(context));
  }

  function subscribe(handler) {
    listeners.add(handler);
    handler(resolve(window.location.hash));
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
