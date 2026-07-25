// PARAM_DEFS からサービスパネル風の UI を組み立てる。
// 値の保持は ParameterStore が持ち、ここは表示と入力の変換だけを行う。

import { PARAM_DEFS } from '../config/DefaultParams.js';

function formatValue(def, value) {
  if (def.type === 'toggle') return value > 0.5 ? 'ON' : 'OFF';
  const digits = def.step < 0.05 ? 2 : 1;
  return value.toFixed(digits) + (def.unit ? ' ' + def.unit : '');
}

function createRow(def, store, registry) {
  const row = document.createElement('div');
  row.className = def.type === 'toggle' ? 'row row--toggle' : 'row';

  const label = document.createElement('label');
  label.className = 'row__label';
  label.textContent = def.label;
  label.htmlFor = 'p-' + def.key;

  const readout = document.createElement('span');
  readout.className = 'row__value';
  readout.textContent = formatValue(def, store.get(def.key));

  const input = document.createElement('input');
  input.id = 'p-' + def.key;
  if (def.type === 'toggle') {
    input.type = 'checkbox';
    input.className = 'row__switch';
    input.checked = store.get(def.key) > 0.5;
    input.addEventListener('change', () => store.set(def.key, input.checked ? 1 : 0));
  } else {
    input.type = 'range';
    input.className = 'row__slider';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(store.get(def.key));
    input.addEventListener('input', () => store.set(def.key, parseFloat(input.value)));
  }

  const head = document.createElement('div');
  head.className = 'row__head';
  head.append(label, readout);
  row.append(head, input);

  registry.set(def.key, { def, input, readout });
  return row;
}

export function buildControlPanel(container, store) {
  const registry = new Map();
  const groups = new Map();

  for (const def of PARAM_DEFS) {
    if (!groups.has(def.group)) groups.set(def.group, []);
    groups.get(def.group).push(def);
  }

  container.innerHTML = '';
  for (const [name, defs] of groups) {
    const section = document.createElement('section');
    section.className = 'group';
    const heading = document.createElement('h2');
    heading.className = 'group__title';
    heading.textContent = name;
    section.append(heading);
    for (const def of defs) section.append(createRow(def, store, registry));
    container.append(section);
  }

  store.subscribe((key, value) => {
    const entry = registry.get(key);
    if (!entry) return;
    entry.readout.textContent = formatValue(entry.def, value);
    if (entry.def.type === 'toggle') entry.input.checked = value > 0.5;
    else if (parseFloat(entry.input.value) !== value) entry.input.value = String(value);
  });

  return registry;
}
