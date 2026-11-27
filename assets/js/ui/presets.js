/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, downloadBlob } from './dom.js';
import { t, translated } from '../i18n/index.js';
import { MAX_PRESET_BYTES, presetFromValues, readPresets, savePresets, validatePreset } from '../core/metadata-presets.js';

export function labeledInput(key, input) {
  return el('label', {}, translated(() => t(key)), input);
}

export function toolButton(key, action) {
  return el('button', { type: 'button', className: 'button ghost small', on: { click: action } }, translated(() => t(key)));
}

export function openMetadataDialog(title) {
  const heading = el('h2', { id: 'metadata-tools-title', textContent: translated(() => t(title)) });
  const status = el('p', { role: 'status' });
  const body = el('div', { className: 'field-grid' });
  const buttons = el('div', { className: 'result-controls' });
  const dialog = el('dialog', { className: 'metadata-tools-dialog', 'aria-labelledby': heading.id }, heading, body, status, buttons);
  buttons.append(toolButton('ui.close', () => dialog.close()));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, body, status, buttons };
}

export function openPresets({ getValues, apply }) {
  const { dialog, body, status, buttons } = openMetadataDialog('presets.title');
  const select = el('select');
  const name = el('input', { type: 'text', maxlength: '80' });
  const file = el('input', { type: 'file', accept: '.json,application/json' });
  body.append(labeledInput('presets.saved', select), labeledInput('presets.name', name), labeledInput('presets.import', file));
  const refresh = (chosen = '') => {
    select.replaceChildren(...readPresets().map((item) => el('option', { value: item.name }, item.name)));
    if (chosen) select.value = chosen;
  };
  const current = () => readPresets().find((item) => item.name === select.value);
  const store = (preset) => {
    const persisted = savePresets([preset, ...readPresets().filter((item) => item.name !== preset.name)]);
    refresh(preset.name);
    status.textContent = t(persisted ? 'presets.savedStatus' : 'presets.sessionStatus');
  };
  file.addEventListener('change', async () => {
    const input = file.files?.[0];
    if (!input) return;
    try {
      if (input.size > MAX_PRESET_BYTES) throw new Error('Preset too large');
      store(validatePreset(JSON.parse(await input.text())));
    } catch { status.textContent = t('presets.invalid'); }
    finally { file.value = ''; }
  });
  buttons.prepend(
    toolButton('presets.save', () => {
      try { store(presetFromValues(name.value, getValues())); }
      catch { status.textContent = t('presets.invalid'); }
    }),
    toolButton('presets.apply', () => {
      const preset = current();
      if (!preset) return;
      if (apply(preset)) dialog.close();
      else status.textContent = t('presets.noMatch');
    }),
    toolButton('presets.export', () => {
      const preset = current();
      if (preset) downloadBlob(new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' }), 'meinsert-preset.json');
    }),
    toolButton('presets.delete', () => {
      savePresets(readPresets().filter((item) => item.name !== select.value));
      refresh();
    }),
  );
  refresh();
}
