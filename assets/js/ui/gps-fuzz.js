/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el } from './dom.js';
import { t } from '../i18n/index.js';
import { GPS_RADII } from '../core/gps-fuzz.js';
import { labeledInput, openMetadataDialog, toolButton } from './presets.js';

export function openGpsFuzz(apply) {
  const { dialog, body, status, buttons } = openMetadataDialog('gpsFuzz.title');
  const radius = el('select', {}, ...GPS_RADII.map((value) => el('option', { value }, `${value / 1000} km`)));
  body.append(el('p', {}, t('gpsFuzz.hint')), labeledInput('gpsFuzz.radius', radius));
  buttons.prepend(toolButton('presets.apply', () => {
    try {
      if (apply(Number(radius.value))) dialog.close();
      else status.textContent = t('presets.noMatch');
    } catch { status.textContent = t('gpsFuzz.invalid'); }
  }));
}
