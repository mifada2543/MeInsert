/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el } from './dom.js';
import { t, translateSource, translated } from '../i18n/index.js';
import { canFuzzGps, gpsFuzzPatch } from '../core/gps-fuzz.js';
import { openGpsFuzz } from './gps-fuzz.js';
import { presetPatch, fieldsForPreset } from '../core/metadata-presets.js';
import { effectiveValue, nextTrackPatch, replaceBatchText, transformedValue } from '../batch/batch-transform.js';
import { labeledInput, openMetadataDialog, openPresets, toolButton } from './presets.js';

function readyItems(controller) {
  return controller.selectedItems().filter((item) => item.readResult && !item.adapter?.meta?.readOnly);
}

function fieldsFor(item) {
  return fieldsForPreset(item.adapter, item.detection);
}

function applyPatches(controller, patches) {
  const allowed = new Set(readyItems(controller));
  const changed = new Set();
  if (controller.busy()) return false;
  for (const [item, patch, rawRemove] of patches) {
    if (!allowed.has(item) || !Object.keys(patch).length) continue;
    const group = controller.groupMap.get(item.groupKey);
    if (!group) continue;
    if (!changed.has(group.key)) {
      controller.groupHistoryController.end(group.key);
      controller.groupHistoryController.begin(group.key, null);
      changed.add(group.key);
    }
    group.itemPatches ||= {};
    group.itemPatches[item.id] = { ...group.itemPatches[item.id], ...patch };
    if (rawRemove?.length) {
      group.itemRawRemovals ||= {};
      group.itemRawRemovals[item.id] = [...new Set([...(group.itemRawRemovals[item.id] || []), ...rawRemove])];
    }
  }
  for (const key of changed) controller.groupHistoryController.end(key);
  if (changed.size) controller.renderFull();
  return changed.size > 0;
}

function openReplace(controller) {
  const { dialog, body, status, buttons } = openMetadataDialog('batchTools.replace');
  const select = el('select');
  const candidates = new Map();
  for (const item of readyItems(controller)) {
    for (const field of fieldsFor(item)) {
      if (['text', 'textarea', 'tags'].includes(field.type)) candidates.set(field.id, field.label);
    }
  }
  for (const [id, label] of candidates) select.append(el('option', { value: id }, translated(() => translateSource(label))));
  const query = el('input', { type: 'text', maxlength: '128' });
  const replacement = el('input', { type: 'text', maxlength: '512' });
  const regex = el('input', { type: 'checkbox' });
  const caseSensitive = el('input', { type: 'checkbox' });
  body.append(labeledInput('batchTools.field', select), labeledInput('batchTools.query', query),
    labeledInput('batchTools.replacement', replacement), labeledInput('batchTools.regex', regex),
    labeledInput('batchTools.case', caseSensitive));
  const run = toolButton('presets.apply', async () => {
    run.disabled = true;
    const fieldId = select.value;
    const items = readyItems(controller).filter((item) => fieldsFor(item).some((field) => field.id === fieldId));
    const before = items.map((item) => effectiveValue(controller, item, fieldId));
    try {
      const result = await replaceBatchText(before, { query: query.value, replacement: replacement.value,
        regex: regex.checked, caseSensitive: caseSensitive.checked });
      if (!dialog.open) return;
      const changes = items.map((item, index) => {
        const field = fieldsFor(item).find(({ id }) => id === fieldId);
        const value = result[index];
        return [item, value !== before[index] && value.length <= (field.maxLength ?? 10000)
          ? { [fieldId]: transformedValue(field, value) } : {}];
      });
      if (applyPatches(controller, changes)) dialog.close();
      else status.textContent = t('presets.noMatch');
    } catch { status.textContent = t('batchTools.replaceError'); }
    finally { run.disabled = false; }
  });
  buttons.prepend(run);
}

function openTracks(controller) {
  const { dialog, body, status, buttons } = openMetadataDialog('batchTools.number');
  const start = el('input', { type: 'number', min: '1', max: '9999', value: '1' });
  const digits = el('input', { type: 'number', min: '1', max: '4', value: '1' });
  const total = el('input', { type: 'number', min: '1', max: '9999' });
  body.append(labeledInput('batchTools.start', start), labeledInput('batchTools.digits', digits), labeledInput('batchTools.total', total));
  buttons.prepend(toolButton('presets.apply', () => {
    const selected = new Set(readyItems(controller));
    const items = controller.groups.flatMap((group) => group.items)
      .filter((item) => selected.has(item) && fieldsFor(item).some(({ id }) => id === 'track' || id === 'trackNumber'));
    const last = Number(start.value) + items.length - 1;
    if (!start.value || !digits.value || ![start, digits, total].every((input) => input.checkValidity())
      || last > 9999 || (total.value && Number(total.value) < last)) {
      status.textContent = t('batchTools.numberError');
      return;
    }
    const changes = items.map((item, index) => [item,
      nextTrackPatch(fieldsFor(item), Number(start.value) + index, Number(digits.value), Number(total.value))]);
    if (applyPatches(controller, changes)) dialog.close();
    else status.textContent = t('presets.noMatch');
  }));
}

export function mountBatchTools(controller, container) {
  const whenReady = (action) => () => {
    if (!controller.busy() && readyItems(controller).length) action();
  };
  container?.append(
    toolButton('presets.title', whenReady(() => openPresets({
      getValues() {
        const [first] = readyItems(controller);
        const values = controller.collectGroupPayload(first).payload.set;
        return values;
      },
      apply(preset) {
        return applyPatches(controller, readyItems(controller).map((item) => [
          item, presetPatch(preset, item.adapter, item.detection),
        ]));
      },
    }))),
    toolButton('batchTools.replace', whenReady(() => openReplace(controller))),
    toolButton('batchTools.number', whenReady(() => openTracks(controller))),
    toolButton('gpsFuzz.title', whenReady(() => openGpsFuzz((radius) => applyPatches(controller,
      readyItems(controller).filter((item) => canFuzzGps(item.detection, item.readResult)).map((item) => {
        const patch = gpsFuzzPatch(item.readResult, radius);
        return [item, patch.fields, patch.rawRemove];
      }))))),
  );
}
