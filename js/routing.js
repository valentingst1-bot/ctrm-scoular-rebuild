(function () {
  const listeners = new Set();

  function normalize(hash) {
    if (!hash || hash === '#') return '#/trader';
    const a = hash.startsWith('#') ? hash : `#${hash}`;

    if (a.startsWith('#/hedge/') && a.length > 8) {
        return '#/hedge/:commodity';
    }
    return a;
  }

  function notify(hash) {
    const normalized = normalize(hash);
    listeners.forEach((handler) => handler(normalized));
  }

  function subscribe(handler) {
    listeners.add(handler);
    handler(normalize(window.location.hash));
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
    normalize,
  };
})();
