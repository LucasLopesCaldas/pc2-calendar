// Lógica pura do calendário (sem DOM). Carregado como script clássico no
// navegador (expõe window.PC2Core) e via require() nos testes do Node.
(function (root) {
  'use strict';

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const WEEKDAY_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const COLOR_KEYS = ['work', 'off', 'today', 'holiday'];

  const COLOR_PRESETS = [
    { name: 'Padrão', work: '#e94560', off: '#0f3460', today: '#53d769', holiday: '#ff9800' },
    { name: 'Oceano', work: '#0077b6', off: '#023e8a', today: '#00f5d4', holiday: '#f77f00' },
    { name: 'Floresta', work: '#2d6a4f', off: '#1b4332', today: '#95d5b2', holiday: '#e76f51' },
    { name: 'Lavanda', work: '#7b2cbf', off: '#3c096c', today: '#c77dff', holiday: '#ffbe0b' },
    { name: 'Pôr do Sol', work: '#e63946', off: '#1d3557', today: '#a8dadc', holiday: '#f1fa8c' },
    { name: 'Monocromático', work: '#495057', off: '#212529', today: '#adb5bd', holiday: '#ffc300' },
    { name: 'Neon', work: '#ff006e', off: '#240046', today: '#3a86ff', holiday: '#ffbe0b' },
    { name: 'Terra', work: '#bc6c25', off: '#283618', today: '#606c38', holiday: '#dda15e' },
  ];

  const MAX_PATTERN_LENGTH = 60;
  const CONFIG_VERSION = 1;
  const HEX_COLOR = /^#[0-9a-f]{6}$/i;
  const LIGHT_TEXT = '#ffffff';
  const DARK_TEXT = '#0f0f1a';

  // ── Datas ──
  // Soma por dias do calendário (não por ms) para não sofrer com horário de verão
  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  function dateKey(year, month, day) {
    return `${year}-${month}-${day}`; // month 0-based
  }

  // 'YYYY-MM-DD' → Date local; null se o formato ou a data forem inválidos (ex.: 2026-02-31)
  function parseLocalDate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  // Date → 'YYYY-MM-DD' (data local)
  function formatLocalDate(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // ── Feriados brasileiros ──
  function getEasterDate(year) {
    // Meeus/Jones/Butcher algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  // Retorna { 'Y-M-D' (mês 0-based): 'Nome' } — nomes no mesmo dia separados por ' / '
  function getBrazilianHolidays(year) {
    const holidays = {};

    function addHoliday(date, name) {
      const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
      holidays[key] = holidays[key] ? holidays[key] + ' / ' + name : name;
    }

    // Fixed holidays
    addHoliday(new Date(year, 0, 1), 'Confraternização Universal');
    addHoliday(new Date(year, 3, 21), 'Tiradentes');
    addHoliday(new Date(year, 4, 1), 'Dia do Trabalho');
    addHoliday(new Date(year, 8, 7), 'Independência do Brasil');
    addHoliday(new Date(year, 9, 12), 'Nossa Sra. Aparecida');
    addHoliday(new Date(year, 10, 2), 'Finados');
    addHoliday(new Date(year, 10, 15), 'Proclamação da República');
    // Feriado nacional a partir de 2024 (Lei 14.759/2023)
    if (year >= 2024) addHoliday(new Date(year, 10, 20), 'Dia da Consciência Negra');
    addHoliday(new Date(year, 11, 25), 'Natal');

    // Moveable holidays based on Easter
    const easter = getEasterDate(year);
    addHoliday(addDays(easter, -48), 'Carnaval');
    addHoliday(addDays(easter, -47), 'Carnaval');
    addHoliday(addDays(easter, -2), 'Sexta-feira Santa');
    addHoliday(easter, 'Páscoa');
    addHoliday(addDays(easter, 60), 'Corpus Christi');

    return holidays;
  }

  const holidaysCache = {};

  function getHolidaysForYear(year) {
    if (!holidaysCache[year]) {
      holidaysCache[year] = getBrazilianHolidays(year);
    }
    return holidaysCache[year];
  }

  // ── Escala ──
  // true = trabalho, false = folga, null = escala não configurada
  function isWorkDay(date, startDate, pattern) {
    if (!startDate || !pattern || pattern.length === 0) return null;

    const msPerDay = 86400000;
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let diffDays = Math.round((target - start) / msPerDay);

    // Handle modulo for negative numbers (dates before start)
    diffDays = ((diffDays % pattern.length) + pattern.length) % pattern.length;

    return pattern[diffDays] === 'work';
  }

  function getOrderedWeekdays(firstDayOfWeek) {
    const ordered = [];
    for (let i = 0; i < 7; i++) {
      ordered.push(WEEKDAY_SHORT[(firstDayOfWeek + i) % 7]);
    }
    return ordered;
  }

  function isValidPattern(pattern) {
    return Array.isArray(pattern) && pattern.length > 0 && pattern.length <= MAX_PATTERN_LENGTH &&
      pattern.every(p => p === 'work' || p === 'off');
  }

  // ── Configuração salva ──
  // Valida o JSON salvo campo a campo; campos inválidos viram null.
  // Retorna null se o JSON for ilegível.
  function parseConfig(raw) {
    let c;
    try {
      c = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!c || typeof c !== 'object') return null;

    const colors = {};
    for (const key of COLOR_KEYS) {
      const value = c.colors && c.colors[key];
      colors[key] = typeof value === 'string' && HEX_COLOR.test(value) ? value : null;
    }

    return {
      version: CONFIG_VERSION,
      startDate: parseLocalDate(c.startDate) ? c.startDate : null,
      pattern: isValidPattern(c.pattern) ? c.pattern.slice() : null,
      firstDayOfWeek: Number.isInteger(c.firstDayOfWeek) && c.firstDayOfWeek >= 0 && c.firstDayOfWeek <= 6
        ? c.firstDayOfWeek : null,
      colors: colors
    };
  }

  // ── Texto ──
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
              .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Feriados de um mês agrupados por nome, na ordem do calendário:
  // [{ name: 'Carnaval', days: [16, 17] }, ...]
  function getMonthHolidays(year, month) {
    const holidays = getHolidaysForYear(year);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const groups = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const names = holidays[dateKey(year, month, day)];
      if (!names) continue;
      for (const name of names.split(' / ')) {
        const group = groups.find(g => g.name === name);
        if (group) group.days.push(day);
        else groups.push({ name, days: [day] });
      }
    }
    return groups;
  }

  // ── Cores ──
  function relativeLuminance(hex) {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  // Cor de texto sobre o fundo informado: branco enquanto tiver contraste
  // mínimo de 3:1 (mantém o visual das paletas); em fundos claros, escuro
  function readableTextColor(backgroundHex) {
    const contrastWithWhite = 1.05 / (relativeLuminance(backgroundHex) + 0.05);
    return contrastWithWhite >= 3 ? LIGHT_TEXT : DARK_TEXT;
  }

  const PC2Core = {
    MONTH_NAMES, WEEKDAY_SHORT, WEEKDAY_LONG, COLOR_KEYS, COLOR_PRESETS,
    MAX_PATTERN_LENGTH, CONFIG_VERSION,
    addDays, dateKey, parseLocalDate, formatLocalDate,
    getEasterDate, getBrazilianHolidays, getHolidaysForYear,
    isWorkDay, getOrderedWeekdays, isValidPattern, parseConfig,
    getMonthHolidays, readableTextColor, escapeHtml
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PC2Core;
  } else {
    root.PC2Core = PC2Core;
  }
})(typeof window !== 'undefined' ? window : globalThis);
