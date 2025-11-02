(function () {
  const listeners = new Set();

  function normalize(hash) {
    if (!hash || hash === '#') return '#/trader';
    return hash.startsWith('#') ? hash : `#${hash}`;
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
    const target = normalize(hash);
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      notify(target);
    }
  }

  window.addEventListener('hashchange', () => notify(window.location.hash));

  window.CTRMRouting = {
    subscribe,
    navigate,
    normalize,
  };
})();
