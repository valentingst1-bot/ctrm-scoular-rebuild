(function () {
  const listeners = new Set();
  const routes = [
    { pattern: /#\/hedge\/(\w+)/, name: '#/hedge/:commodity' }
  ];

  function parseQueryString(str) {
    return (str || '').split('&').reduce((acc, pair) => {
      const [key, value] = pair.split('=');
      if (key) acc[decodeURIComponent(key)] = decodeURIComponent(value || '');
      return acc;
    }, {});
  }

  function resolve(hash, search) {
    const queryParams = parseQueryString(search.substring(1));
    for (const route of routes) {
      const match = hash.match(route.pattern);
      if (match) {
        return {
          name: route.name,
          params: { ...queryParams, commodity: match[1] },
          hash: hash
        };
      }
    }
    return { name: hash, params: queryParams, hash: hash };
  }

  function notify() {
    const context = resolve(window.location.hash, window.location.search);
    listeners.forEach((handler) => handler(context));
  }

  function subscribe(handler) {
    listeners.add(handler);
    handler(resolve(window.location.hash || '#/trader', window.location.search));
    return () => listeners.delete(handler);
  }

  function navigate(path) {
    const [hash, search] = path.split('?');
    if (window.location.hash !== hash || window.location.search !== (search ? `?${search}` : '')) {
      window.location = path;
    } else {
      notify();
    }
  }

  window.addEventListener('hashchange', () => notify());

  window.CTRMRouting = {
    subscribe,
    navigate,
  };
})();
