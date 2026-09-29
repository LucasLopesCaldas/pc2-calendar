const { test } = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');

const ymd = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

test('Páscoa em anos conhecidos', () => {
  assert.deepStrictEqual(ymd(Core.getEasterDate(2018)), [2018, 4, 1]);
  assert.deepStrictEqual(ymd(Core.getEasterDate(2024)), [2024, 3, 31]);
  assert.deepStrictEqual(ymd(Core.getEasterDate(2025)), [2025, 4, 20]);
  assert.deepStrictEqual(ymd(Core.getEasterDate(2026)), [2026, 4, 5]);
});

test('feriados móveis caem no dia certo (independente de horário de verão)', () => {
  const h2025 = Core.getBrazilianHolidays(2025);
  assert.strictEqual(h2025[Core.dateKey(2025, 2, 3)], 'Carnaval');
  assert.strictEqual(h2025[Core.dateKey(2025, 2, 4)], 'Carnaval');
  assert.strictEqual(h2025[Core.dateKey(2025, 2, 2)], undefined);
  assert.strictEqual(h2025[Core.dateKey(2025, 3, 18)], 'Sexta-feira Santa');
  assert.strictEqual(h2025[Core.dateKey(2025, 3, 20)], 'Páscoa');
  assert.strictEqual(h2025[Core.dateKey(2025, 5, 19)], 'Corpus Christi');

  const h2018 = Core.getBrazilianHolidays(2018);
  assert.strictEqual(h2018[Core.dateKey(2018, 1, 12)], 'Carnaval');
  assert.strictEqual(h2018[Core.dateKey(2018, 1, 13)], 'Carnaval');
});

test('feriados no mesmo dia são concatenados', () => {
  // 2019: Páscoa 21/04 coincide com Tiradentes
  assert.strictEqual(Core.getBrazilianHolidays(2019)[Core.dateKey(2019, 3, 21)], 'Tiradentes / Páscoa');
});

test('Dia da Consciência Negra só a partir de 2024', () => {
  assert.strictEqual(Core.getBrazilianHolidays(2023)[Core.dateKey(2023, 10, 20)], undefined);
  assert.strictEqual(Core.getBrazilianHolidays(2024)[Core.dateKey(2024, 10, 20)], 'Dia da Consciência Negra');
});

test('isWorkDay: 12×36 alterna, inclusive antes da data de início', () => {
  const start = new Date(2026, 0, 1);
  const p = ['work', 'off'];
  assert.strictEqual(Core.isWorkDay(new Date(2026, 0, 1), start, p), true);
  assert.strictEqual(Core.isWorkDay(new Date(2026, 0, 2), start, p), false);
  assert.strictEqual(Core.isWorkDay(new Date(2025, 11, 31), start, p), false);
  assert.strictEqual(Core.isWorkDay(new Date(2025, 11, 30), start, p), true);
});

test('isWorkDay: 5×2 ao longo de meses com mudança de horário', () => {
  const start = new Date(2025, 0, 6);
  const p = ['work', 'work', 'work', 'work', 'work', 'off', 'off'];
  // 180 dias depois = múltiplo de 7 + 5 → folga
  assert.strictEqual(Core.isWorkDay(Core.addDays(start, 180), start, p), false);
  assert.strictEqual(Core.isWorkDay(Core.addDays(start, 175), start, p), true);
});

test('isWorkDay sem escala configurada retorna null', () => {
  assert.strictEqual(Core.isWorkDay(new Date(), null, ['work']), null);
  assert.strictEqual(Core.isWorkDay(new Date(), new Date(), []), null);
});

test('getOrderedWeekdays respeita o primeiro dia da semana', () => {
  assert.deepStrictEqual(Core.getOrderedWeekdays(1), ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
});

test('parseLocalDate rejeita datas inexistentes e formatos inválidos', () => {
  assert.deepStrictEqual(ymd(Core.parseLocalDate('2024-02-29')), [2024, 2, 29]);
  assert.strictEqual(Core.parseLocalDate('2026-02-31'), null);
  assert.strictEqual(Core.parseLocalDate('2025-02-29'), null);
  assert.strictEqual(Core.parseLocalDate('01/01/2026'), null);
  assert.strictEqual(Core.parseLocalDate(undefined), null);
});

test('parseConfig aceita config válida (inclusive antiga, sem version)', () => {
  const c = Core.parseConfig(JSON.stringify({
    startDate: '2026-01-01', pattern: ['work', 'off'], firstDayOfWeek: 1,
    colors: { work: '#e94560', off: '#0f3460', today: '#53d769', holiday: '#ff9800' }
  }));
  assert.strictEqual(c.version, 1);
  assert.strictEqual(c.startDate, '2026-01-01');
  assert.deepStrictEqual(c.pattern, ['work', 'off']);
  assert.strictEqual(c.firstDayOfWeek, 1);
  assert.strictEqual(c.colors.work, '#e94560');
});

test('parseConfig descarta campos inválidos individualmente', () => {
  const c = Core.parseConfig(JSON.stringify({
    startDate: '2026-02-31',
    pattern: ['work', 'ferias'],
    firstDayOfWeek: 7,
    colors: { work: 'red;background:url(x)', off: '#0f3460' }
  }));
  assert.strictEqual(c.startDate, null);
  assert.strictEqual(c.pattern, null);
  assert.strictEqual(c.firstDayOfWeek, null);
  assert.strictEqual(c.colors.work, null);
  assert.strictEqual(c.colors.off, '#0f3460');
  assert.strictEqual(c.colors.today, null);
});

test('parseConfig rejeita padrão longo demais e JSON quebrado', () => {
  const long = Array(Core.MAX_PATTERN_LENGTH + 1).fill('work');
  assert.strictEqual(Core.parseConfig(JSON.stringify({ pattern: long })).pattern, null);
  assert.strictEqual(Core.parseConfig('{quebrado'), null);
  assert.strictEqual(Core.parseConfig('null'), null);
});

test('shortHolidayLabel usa o primeiro nome, até 10 caracteres', () => {
  assert.strictEqual(Core.shortHolidayLabel('Natal'), 'Natal');
  assert.strictEqual(Core.shortHolidayLabel('Tiradentes / Páscoa'), 'Tiradentes');
  assert.strictEqual(Core.shortHolidayLabel('Confraternização Universal'), 'Confratern');
});
