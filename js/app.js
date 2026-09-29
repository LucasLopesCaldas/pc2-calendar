// Interface: estado, renderização e eventos.
(function () {
  'use strict';

  const Core = window.PC2Core;
  const Storage = window.PC2Storage;

  const CSS_COLOR_VARS = {
    work: '--work-bg',
    off: '--off-bg',
    today: '--today-border',
    holiday: '--holiday-bg'
  };

  const COLOR_INPUT_IDS = {
    work: 'colorWork',
    off: 'colorOff',
    today: 'colorToday',
    holiday: 'colorHoliday'
  };

  let currentYear = new Date().getFullYear();
  let pattern = []; // array of 'work' | 'off'
  let cycleStartDate = null;
  let firstDayOfWeek = 0; // 0=Sunday, 1=Monday, etc.

  const $ = id => document.getElementById(id);

  // ── Persistence ──
  function saveConfig() {
    const colors = {};
    for (const key of Core.COLOR_KEYS) colors[key] = $(COLOR_INPUT_IDS[key]).value;

    Storage.saveConfig({
      startDate: $('startDate').value,
      pattern: pattern,
      firstDayOfWeek: parseInt($('firstDayOfWeek').value, 10),
      colors: colors
    });
  }

  function restoreConfig() {
    const config = Storage.loadConfig();
    if (!config) return;

    if (config.startDate) {
      $('startDate').value = config.startDate;
      cycleStartDate = Core.parseLocalDate(config.startDate);
    }

    if (config.pattern) {
      pattern = config.pattern;
      renderPattern();
    }

    if (config.firstDayOfWeek !== null) {
      firstDayOfWeek = config.firstDayOfWeek;
      $('firstDayOfWeek').value = config.firstDayOfWeek;
    }

    applyColors(config.colors);
  }

  // ── Colors ──
  // Aplica as cores informadas (ignora valores null) nos inputs e nas variáveis CSS
  function applyColors(colors) {
    const root = document.documentElement;
    for (const key of Core.COLOR_KEYS) {
      if (!colors[key]) continue;
      $(COLOR_INPUT_IDS[key]).value = colors[key];
      root.style.setProperty(CSS_COLOR_VARS[key], colors[key]);
    }
  }

  function renderColorPresets() {
    $('colorPresets').innerHTML = Core.COLOR_PRESETS.map((preset, i) => {
      return `<button class="color-preset-btn" data-preset="${i}" aria-label="Aplicar paleta ${preset.name}">
        <div class="preset-dots">
          <span style="background:${preset.work}"></span>
          <span style="background:${preset.off}"></span>
          <span style="background:${preset.today}"></span>
          <span style="background:${preset.holiday}"></span>
        </div>
        ${preset.name}
      </button>`;
    }).join('');
  }

  function highlightPreset(index) {
    document.querySelectorAll('.color-preset-btn').forEach((btn, j) => {
      btn.classList.toggle('active', j === index);
    });
  }

  function applyColorPreset(index) {
    applyColors(Core.COLOR_PRESETS[index]);
    highlightPreset(index);
    saveConfig();
    renderCalendar();
  }

  function updateColors() {
    const colors = {};
    for (const key of Core.COLOR_KEYS) colors[key] = $(COLOR_INPUT_IDS[key]).value;
    applyColors(colors);
    highlightPreset(-1);
    saveConfig();
    renderCalendar();
  }

  // ── First day of week ──
  function updateFirstDay() {
    firstDayOfWeek = parseInt($('firstDayOfWeek').value, 10);
    saveConfig();
    renderCalendar();
  }

  // ── Config panel toggle ──
  function toggleConfig() {
    const panel = $('configPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }

  // ── Pattern builder ──
  function addPatternDay(type) {
    if (pattern.length >= Core.MAX_PATTERN_LENGTH) {
      alert(`O padrão pode ter no máximo ${Core.MAX_PATTERN_LENGTH} dias.`);
      return;
    }
    pattern.push(type);
    renderPattern();
  }

  function removePatternDay(index) {
    pattern.splice(index, 1);
    renderPattern();
  }

  function clearPattern() {
    pattern = [];
    renderPattern();
  }

  function renderPattern() {
    $('patternList').innerHTML = pattern.map((type, i) => {
      const label = type === 'work' ? 'Trabalho' : 'Folga';
      return `<span class="pattern-chip ${type}">
        ${label}
        <span class="remove-chip" data-index="${i}">×</span>
      </span>`;
    }).join('');
  }

  // ── Apply config ──
  function applyConfig() {
    const startDate = Core.parseLocalDate($('startDate').value);
    if (!startDate) {
      alert('Selecione a data de início do ciclo.');
      return;
    }
    if (pattern.length === 0) {
      alert('Monte o padrão da escala adicionando dias de trabalho e folga.');
      return;
    }

    cycleStartDate = startDate;
    firstDayOfWeek = parseInt($('firstDayOfWeek').value, 10);

    saveConfig();
    renderCalendar();
    $('configPanel').style.display = 'none';
  }

  // ── Calendar rendering ──
  function renderCalendar() {
    $('yearLabel').textContent = currentYear;

    const today = new Date();
    const todayKey = Core.dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const holidays = Core.getHolidaysForYear(currentYear);
    const orderedWeekdays = Core.getOrderedWeekdays(firstDayOfWeek);

    let html = '';

    for (let month = 0; month < 12; month++) {
      const rawWeekday = new Date(currentYear, month, 1).getDay(); // 0=Sun
      const startWeekday = ((rawWeekday - firstDayOfWeek) + 7) % 7;
      const daysInMonth = new Date(currentYear, month + 1, 0).getDate();

      html += `<div class="month-card">`;
      html += `<div class="month-title">${Core.MONTH_NAMES[month]}</div>`;
      html += `<div class="weekday-header">`;
      for (const wd of orderedWeekdays) {
        html += `<div>${wd}</div>`;
      }
      html += `</div>`;
      html += `<div class="days-grid">`;

      // Empty cells before first day
      for (let e = 0; e < startWeekday; e++) {
        html += `<div class="day-cell empty"></div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const key = Core.dateKey(currentYear, month, day);
        const work = Core.isWorkDay(new Date(currentYear, month, day), cycleStartDate, pattern);
        const holidayName = holidays[key];

        let classes = 'day-cell';
        if (work === true) classes += ' work-day';
        else if (work === false) classes += ' off-day';
        if (key === todayKey) classes += ' today';
        if (holidayName) classes += ' holiday-day';

        const titleAttr = holidayName ? ` title="${Core.escapeHtml(holidayName)}"` : '';
        const holidayLabel = holidayName
          ? `<span class="holiday-label">${Core.escapeHtml(Core.shortHolidayLabel(holidayName))}</span>`
          : '';

        html += `<div class="${classes}"${titleAttr} data-date="${key}">${day}${holidayLabel}</div>`;
      }

      html += `</div></div>`;
    }

    $('calendarGrid').innerHTML = html;
  }

  function changeYear(delta) {
    currentYear += delta;
    renderCalendar();
  }

  // ── Day Modal ──
  function openDayModal(year, month, day) {
    const date = new Date(year, month, day);
    const work = Core.isWorkDay(date, cycleStartDate, pattern);
    const holidayName = Core.getHolidaysForYear(year)[Core.dateKey(year, month, day)];
    const today = new Date();
    const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    const weekdayName = Core.WEEKDAY_LONG[date.getDay()];

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month + 1).padStart(2, '0');

    let content = `<div class="modal-date" id="modalDateLabel">${dayStr}/${monthStr}/${year}</div>`;
    content += `<div class="modal-weekday">${weekdayName}</div>`;

    if (isToday) {
      content += `<div class="modal-info-row today-info">
        <span class="info-icon">📍</span>
        <span>Hoje</span>
      </div>`;
    }

    if (work === true) {
      content += `<div class="modal-info-row work-info">
        <span class="info-icon">💼</span>
        <span>Dia de <strong>Trabalho</strong></span>
      </div>`;
    } else if (work === false) {
      content += `<div class="modal-info-row off-info">
        <span class="info-icon">🏖️</span>
        <span>Dia de <strong>Folga</strong></span>
      </div>`;
    }

    if (holidayName) {
      for (const hn of holidayName.split(' / ')) {
        content += `<div class="modal-info-row holiday-info">
          <span class="info-icon">🎉</span>
          <span><strong>Feriado:</strong> ${Core.escapeHtml(hn)}</span>
        </div>`;
      }
    }

    $('modalContent').innerHTML = content;
    $('dayModal').classList.add('active');
  }

  function closeDayModal() {
    $('dayModal').classList.remove('active');
  }

  // ── Events ──
  function bindEvents() {
    $('toggleConfigBtn').addEventListener('click', toggleConfig);
    $('firstDayOfWeek').addEventListener('change', updateFirstDay);
    document.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => addPatternDay(btn.dataset.add));
    });
    $('clearPatternBtn').addEventListener('click', clearPattern);
    $('applyConfigBtn').addEventListener('click', applyConfig);
    for (const key of Core.COLOR_KEYS) {
      $(COLOR_INPUT_IDS[key]).addEventListener('change', updateColors);
    }
    $('prevYearBtn').addEventListener('click', () => changeYear(-1));
    $('nextYearBtn').addEventListener('click', () => changeYear(1));

    $('patternList').addEventListener('click', e => {
      const chip = e.target.closest('.remove-chip');
      if (chip) removePatternDay(Number(chip.dataset.index));
    });

    $('colorPresets').addEventListener('click', e => {
      const btn = e.target.closest('.color-preset-btn');
      if (btn) applyColorPreset(Number(btn.dataset.preset));
    });

    $('calendarGrid').addEventListener('click', e => {
      const cell = e.target.closest('.day-cell[data-date]');
      if (!cell) return;
      const [y, m, d] = cell.dataset.date.split('-').map(Number);
      openDayModal(y, m, d);
    });

    // Fecha ao clicar fora do modal, no ×, ou com Escape
    $('dayModal').addEventListener('click', e => {
      if (e.target === $('dayModal')) closeDayModal();
    });
    $('modalCloseBtn').addEventListener('click', closeDayModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDayModal();
    });
  }

  // ── Init ──
  renderColorPresets();
  bindEvents();
  restoreConfig();

  if (cycleStartDate && pattern.length > 0) {
    $('configPanel').style.display = 'none';
  }
  renderCalendar();
})();
