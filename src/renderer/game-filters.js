'use strict';

// Pure predicates shared by the renderer and regression tests. Filtering never
// changes the library or scans; counts and options come from the full library.
(function (root) {
  const normalized = (value) => String(value || '').normalize('NFKC').trim().toLowerCase();
  const hasDlss = (game) => Boolean(game.cached && (game.cached.hasDlss ?? game.cached.dlss));
  const canInstall = (game) => Boolean(game.cached && (game.cached.installable ?? game.cached.ok));
  const apiKey = (game) => {
    const scan = game.cached;
    if (!scan) return 'pending';
    return scan.dx12 ? 'DirectX 12' : (scan.api || scan.reason || 'unknown');
  };
  const isInstalled = (game, newDlss) => {
    const scan = game && game.cached;
    if (scan && scan.optiscaler) return true;
    return Boolean(scan && scan.addon && (
      scan.bitness === 32 || (scan.dlss && newDlss && scan.dlss === newDlss)
    ));
  };

  function matches(game, filters = {}, newDlss = null) {
    const query = normalized(filters.query);
    if (query && !normalized(game.name).includes(query)) return false;
    const scan = game.cached;
    if (filters.api && filters.api !== 'all') {
      const api = apiKey(game);
      if (filters.api === 'dx11-dx12') {
        if (!['DirectX 11', 'DirectX 12'].includes(api)) return false;
      } else if (api !== filters.api) return false;
    }
    const dlss = filters.dlss || 'all';
    if (dlss === 'ready' && !canInstall(game)) return false;
    if (dlss === 'present' && !hasDlss(game)) return false;
    // Unscanned/failed folders are not evidence that a game lacks DLSS.
    if (dlss === 'absent' && (!canInstall(game) || hasDlss(game))) return false;
    if (dlss === 'installed' && !isInstalled(game, newDlss)) return false;
    if (dlss.startsWith('version:') && (!scan || scan.dlss !== dlss.slice(8))) return false;
    if (filters.addon === 'present' && !(scan && scan.addon)) return false;
    if (filters.addon === 'absent' && (!canInstall(game) || scan.addon)) return false;
    return true;
  }

  function versions(games) {
    return [...new Set(games.map((game) => game.cached && game.cached.dlss).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }

  const api = { matches, versions, hasDlss, canInstall, isInstalled, apiKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.gameFilters = api;
})(typeof window !== 'undefined' ? window : globalThis);
