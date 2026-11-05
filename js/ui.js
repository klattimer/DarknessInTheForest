import { SCHEMA, DEFAULTS } from './config.js';

export function buildPanel(root, config, onChange) {
  root.innerHTML = '';
  const inputs = {};
  for (const g of SCHEMA) {
    const det = document.createElement('details');
    det.open = g.group !== 'Display' || true;
    det.innerHTML = `<summary>${g.group}</summary>`;
    for (const item of g.items) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('label');
      label.textContent = item.label;
      const input = document.createElement('input');
      if (item.type === 'color') input.type = 'color';
      else { input.type = 'number'; input.step = 'any'; }
      input.value = config[item.key];
      input.addEventListener('change', () => {
        if (item.type === 'color') config[item.key] = input.value;
        else {
          const v = parseFloat(input.value);
          if (!Number.isFinite(v)) { input.value = config[item.key]; return; }
          config[item.key] = v;
        }
        onChange(item.key, !!item.live);
      });
      inputs[item.key] = input;
      row.append(label, input);
      if (item.hint) {
        const h = document.createElement('div');
        h.className = 'hint';
        h.textContent = item.hint;
        row.append(h);
      }
      det.append(row);
    }
    root.append(det);
  }
  return inputs;
}

export function exportConfig(config) {
  const blob = new Blob([JSON.stringify({ version: 1, params: config }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dark-forest-config.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Merges only known keys with matching types.
export function importConfig(text, config) {
  const data = JSON.parse(text);
  const params = data.params ?? data;
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof params[key] === typeof DEFAULTS[key] && (typeof params[key] !== 'number' || Number.isFinite(params[key]))) {
      config[key] = params[key];
    }
  }
}
