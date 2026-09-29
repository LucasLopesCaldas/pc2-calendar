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

  // Variáveis de cor do texto calculadas a partir do fundo
  const CSS_TEXT_VARS = {
    work: '--work-fg',
    off: '--off-fg'
  };

  const COLOR_INPUT_IDS = {
    work: 'colorWork',
    off: 'colorOff',
    today: 'colorToday',
    holiday: 'colorHoliday'
  };

  const TYPE_LABELS = { work: 'Trabalho', off: 'Folga' };

  let currentYear = new Date().getFullYear();
  let pattern = [];      // padrão aplicado ao calendário: 'work' | 'off'
  let draftPattern = []; // padrão em edição no painel (só vale após "Aplicar")
  let cycleStartDate = null;
  let firstDayOfWeek = 0; // 0=Sunday, 1=Monday, etc.
  let lastFocusedBeforeModal = null;

  const $ = id => document.getElementById(id);

  // ── Persistence ──
  // Salva apenas o estado aplicado (não o rascunho do painel)
  function saveConfig() {
    const colors = {};
    for (const key of Core.COLOR_KEYS) colors[key] = $(COLOR_INPUT_IDS[key]).value;

    Storage.saveConfig({
      startDate: cycleStartDate ? Core.formatLocalDate(cycleStartDate) : null,
      pattern: pattern,
      firstDayOfWeek: firstDayOfWeek,
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
      draftPattern = pattern.slice();
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
      if (CSS_TEXT_VARS[key]) {
        root.style.setProperty(CSS_TEXT_VARS[key], Core.readableTextColor(colors[key]));
      }
    }
  }

  function renderColorPresets() {
    $('colorPresets').innerHTML = Core.COLOR_PRESETS.map((preset, i) => {
      return `<button type="button" class="color-preset-btn" data-preset="${i}" aria-pressed="false" aria-label="Aplicar paleta ${preset.name}">
        <span class="preset-dots" aria-hidden="true">
          <span style="background:${preset.work}"></span>
          <span style="background:${preset.off}"></span>
          <span style="background:${preset.today}"></span>
          <span style="background:${preset.holiday}"></span>
        </span>
        ${preset.name}
      </button>`;
    }).join('');
  }

  function highlightPreset(index) {
    document.querySelectorAll('.color-preset-btn').forEach((btn, j) => {
      btn.classList.toggle('active', j === index);
      btn.setAttribute('aria-pressed', String(j === index));
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

  // ── Config panel ──
  function setConfigOpen(open) {
    $('configPanel').hidden = !open;
    $('toggleConfigBtn').setAttribute('aria-expanded', String(open));
  }

  function toggleConfig() {
    setConfigOpen($('configPanel').hidden);
  }

  function showError(message) {
    $('configError').textContent = message;
  }

  // ── Pattern builder ──
  function addPatternDay(type) {
    if (draftPattern.length >= Core.MAX_PATTERN_LENGTH) {
      showError(`O padrão pode ter no máximo ${Core.MAX_PATTERN_LENGTH} dias.`);
      return;
    }
    showError('');
    draftPattern.push(type);
    renderPattern();
  }

  function removePatternDay(index) {
    draftPattern.splice(index, 1);
    renderPattern();
    // Mantém o foco na lista ao remover pelo teclado
    const chips = $('patternList').querySelectorAll('.remove-chip');
    if (chips.length) chips[Math.min(index, chips.length - 1)].focus();
  }

  function clearPattern() {
    draftPattern = [];
    renderPattern();
  }

  function renderPattern() {
    $('patternList').innerHTML = draftPattern.map((type, i) => {
      const label = TYPE_LABELS[type];
      return `<li class="pattern-chip ${type}">
        <span class="chip-index" aria-hidden="true">${i + 1}</span>${label}
        <button type="button" class="remove-chip" data-index="${i}" aria-label="Remover dia ${i + 1} (${label})">×</button>
      </li>`;
    }).join('');
  }

  // ── Apply config ──
  function applyConfig() {
    const startDate = Core.parseLocalDate($('startDate').value);
    if (!startDate) {
      showError('Selecione a data de início do ciclo.');
      $('startDate').focus();
      return;
    }
    if (draftPattern.length === 0) {
      showError('Monte o padrão da escala adicionando dias de trabalho e folga.');
      return;
    }

    showError('');
    cycleStartDate = startDate;
    pattern = draftPattern.slice();
    firstDayOfWeek = parseInt($('firstDayOfWeek').value, 10);

    saveConfig();
    renderCalendar();
    setConfigOpen(false);
  }

  // ── Calendar rendering ──
  function formatDays(days) {
    if (days.length === 1) return String(days[0]);
    return days.slice(0, -1).join(', ') + ' e ' + days[days.length - 1];
  }

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
      const monthName = Core.MONTH_NAMES[month];

      html += `<section class="month-card" aria-label="${monthName} de ${currentYear}">`;
      html += `<h3 class="month-title">${monthName}</h3>`;
      html += `<div class="weekday-header" aria-hidden="true">`;
      for (const wd of orderedWeekdays) {
        html += `<div>${wd}</div>`;
      }
      html += `</div>`;
      html += `<div class="days-grid">`;

      // Empty cells before first day
      for (let e = 0; e < startWeekday; e++) {
        html += `<div class="day-cell empty" aria-hidden="true"></div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const key = Core.dateKey(currentYear, month, day);
        const work = Core.isWorkDay(new Date(currentYear, month, day), cycleStartDate, pattern);
        const holidayName = holidays[key];
        const isToday = key === todayKey;

        let classes = 'day-cell';
        const labelParts = [`${day} de ${monthName.toLowerCase()}`];
        if (work === true) { classes += ' work-day'; labelParts.push('trabalho'); }
        else if (work === false) { classes += ' off-day'; labelParts.push('folga'); }
        if (isToday) { classes += ' today'; labelParts.push('hoje'); }
        if (holidayName) { classes += ' holiday-day'; labelParts.push(`feriado: ${holidayName}`); }

        const titleAttr = holidayName ? ` title="${Core.escapeHtml(holidayName)}"` : '';
        const holidayDot = holidayName ? `<span class="holiday-dot" aria-hidden="true"></span>` : '';
        const currentAttr = isToday ? ' aria-current="date"' : '';

        html += `<button type="button" class="${classes}"${titleAttr}${currentAttr} data-date="${key}" aria-label="${Core.escapeHtml(labelParts.join(', '))}">${day}${holidayDot}</button>`;
      }

      html += `</div>`;

      const monthHolidays = Core.getMonthHolidays(currentYear, month);
      if (monthHolidays.length) {
        html += `<ul class="month-holidays">`;
        for (const h of monthHolidays) {
          html += `<li><span class="month-holidays-day">${formatDays(h.days)}</span> ${Core.escapeHtml(h.name)}</li>`;
        }
        html += `</ul>`;
      }

      html += `</section>`;
    }

    $('calendarGrid').innerHTML = html;
  }

  function changeYear(delta) {
    currentYear += delta;
    renderCalendar();
  }

  // ── Day Modal ──
  function isModalOpen() {
    return $('dayModal').classList.contains('active');
  }

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
        <span class="info-icon" aria-hidden="true">📍</span>
        <span>Hoje</span>
      </div>`;
    }

    if (work === true) {
      content += `<div class="modal-info-row work-info">
        <span class="info-icon" aria-hidden="true">💼</span>
        <span>Dia de <strong>Trabalho</strong></span>
      </div>`;
    } else if (work === false) {
      content += `<div class="modal-info-row off-info">
        <span class="info-icon" aria-hidden="true">🏖️</span>
        <span>Dia de <strong>Folga</strong></span>
      </div>`;
    } else {
      content += `<div class="modal-info-row">
        <span class="info-icon" aria-hidden="true">⚙️</span>
        <span>Escala ainda não configurada</span>
      </div>`;
    }

    if (holidayName) {
      for (const hn of holidayName.split(' / ')) {
        content += `<div class="modal-info-row holiday-info">
          <span class="info-icon" aria-hidden="true">🎉</span>
          <span><strong>Feriado:</strong> ${Core.escapeHtml(hn)}</span>
        </div>`;
      }
    }

    lastFocusedBeforeModal = document.activeElement;
    $('modalContent').innerHTML = content;
    $('dayModal').classList.add('active');
    $('dayModal').setAttribute('aria-hidden', 'false');
    $('modalCloseBtn').focus();
  }

  function closeDayModal() {
    if (!isModalOpen()) return;
    $('dayModal').classList.remove('active');
    $('dayModal').setAttribute('aria-hidden', 'true');
    if (lastFocusedBeforeModal && document.contains(lastFocusedBeforeModal)) {
      lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
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
    $('startDate').addEventListener('change', () => showError(''));
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
      if (!isModalOpen()) return;
      if (e.key === 'Escape') {
        closeDayModal();
      } else if (e.key === 'Tab') {
        // O único elemento focável do modal é o botão de fechar
        e.preventDefault();
        $('modalCloseBtn').focus();
      }
    });
  }

  // ── Scroll até hoje ──
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Posição de rolagem que centraliza o elemento na tela (limitada ao documento)
  function centeredScrollY(el) {
    const rect = el.getBoundingClientRect();
    const target = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, Math.min(target, max));
  }

  // Animação própria (em vez de behavior: 'smooth'), que no celular é
  // interrompida pelo navegador durante o carregamento. Para se o usuário
  // interagir com a página.
  function animateScrollTo(targetY, duration, onDone) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    const cancelEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    let startTime = null;
    let cancelled = false;

    const cancel = () => { cancelled = true; };
    const cleanup = () => cancelEvents.forEach(ev => window.removeEventListener(ev, cancel));
    cancelEvents.forEach(ev => window.addEventListener(ev, cancel, { passive: true }));

    function step(now) {
      if (cancelled) { cleanup(); return; }
      if (startTime === null) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(t));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        cleanup();
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(step);
  }

  function highlightToday(cell) {
    cell.classList.remove('today-pulse');
    void cell.offsetWidth; // reinicia a animação CSS
    cell.classList.add('today-pulse');
    cell.addEventListener('animationend', () => cell.classList.remove('today-pulse'), { once: true });
  }

  // Rola até o dia de hoje (se o ano exibido for o atual)
  function scrollToToday(animated) {
    const cell = document.querySelector('.day-cell.today');
    if (!cell) return;
    const targetY = centeredScrollY(cell);
    if (!animated || prefersReducedMotion()) {
      window.scrollTo(0, targetY);
      return;
    }
    // Duração proporcional à distância: 600 ms a 1,4 s
    const duration = Math.min(1400, Math.max(600, Math.abs(targetY - window.scrollY) * 0.4));
    animateScrollTo(targetY, duration, () => highlightToday(cell));
  }

  // ── Init ──
  renderColorPresets();
  bindEvents();
  restoreConfig();
  const configured = !!(cycleStartDate && pattern.length > 0);
  setConfigOpen(!configured);
  renderCalendar();
  // Com o painel aberto (primeira visita) o usuário precisa vê-lo, então não rola
  if (configured) {
    // Impede o navegador de restaurar a posição antiga da recarga: a animação
    // sempre parte do topo
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    // Começa depois do carregamento completo (layout estável) e de uma pausa
    // curta, para o usuário ver o topo antes do movimento
    const start = () => setTimeout(() => scrollToToday(true), 350);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    // Ao voltar pelo histórico/cache (bfcache) a página não recarrega os scripts
    window.addEventListener('pageshow', e => { if (e.persisted) scrollToToday(false); });
  }
})();
