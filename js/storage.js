// Persistência da configuração no localStorage (sem DOM).
(function (root) {
  'use strict';

  const STORAGE_KEY = 'pc2-calendar-config';

  // localStorage pode lançar exceção (modo anônimo, cookies bloqueados)
  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* segue sem persistir */ }
  }

  // Retorna a configuração validada por PC2Core.parseConfig, ou null
  function loadConfig() {
    const saved = storageGet(STORAGE_KEY);
    if (!saved) return null;
    const config = root.PC2Core.parseConfig(saved);
    if (!config) console.warn('Configuração salva inválida, ignorando.');
    return config;
  }

  function saveConfig(config) {
    storageSet(STORAGE_KEY, JSON.stringify({ version: root.PC2Core.CONFIG_VERSION, ...config }));
  }

  root.PC2Storage = { loadConfig, saveConfig };
})(window);
