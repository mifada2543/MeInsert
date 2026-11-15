/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t, translateSource, translated } from '../i18n/index.js';
import { el, clear, formatBytes, qs } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';
import { STANDARD_FIELDS, crossFormatPatch } from '../core/format-map.js';
import { formatDuration } from './batch-limits.js';
import { durationOf, fileIconName, groupKey, isSelectedItem, statusClass, statusLabel, tagCountOf } from './batch-item.js';
import { groupFieldChangeKey, groupRemoveChangeKey, groupResetChangeKey } from './batch-history.js';
export class BatchGroupsView {
  rebuildGroups() {
    const previous = new Map(this.groups.map((group) => [group.key, group]));
    const map = new Map();
    for (const item of this.items) {
      const key = groupKey(item);
      let group = map.get(key);
      if (!group) {
        const fields = typeof item.adapter?.fieldsFor === 'function'
          ? item.adapter.fieldsFor(item.detection.subtype)
          : (item.adapter?.fields || []);
        const existing = previous.get(key);
        group = existing || {
          key,
          detection: item.detection,
          adapter: item.adapter,
          category: item.category,
          label: item.detection?.label || 'Format lain',
          items: [],
          fields,
          values: Object.fromEntries(fields.map((field) => [field.id, ''])),
          remove: new Set(),
          open: true,
        };
        group.detection = item.detection;
        group.adapter = item.adapter;
        group.category = item.category;
        group.label = item.detection?.label || 'Format lain';
        group.fields = fields;
        group.items = [];
        map.set(key, group);
      }
      item.groupKey = key;
      group.items.push(item);
    }
    const order = { image: 0, pdf: 1, mp3: 2, flac: 2, ogg: 2, mp4: 3, mkv: 3 };
    this.groups = [...map.values()].sort((a, b) => (order[a.detection?.id] ?? 9) - (order[b.detection?.id] ?? 9) || a.label.localeCompare(b.label));
    this.groupMap = map;
    // Grup yang hilang (mis. setelah reset) tidak boleh menyisakan riwayat
    // basi; grup yang masih ada tetap memakai objek grup yang sama, jadi
    // riwayatnya tetap konsisten.
    for (const key of [...(this.groupHistories?.keys() || [])]) {
      if (!map.has(key)) this.groupHistories.delete(key);
    }
  }
  renderCrossForm() {
    const hasItems = this.items.length > 0;
    this.els.batchCross.hidden = !hasItems;
    this.els.batchCrossToggle.disabled = !hasItems;
    this.els.batchCrossToggle.checked = this.crossEnabled;
    this.els.batchCrossBody.hidden = !this.crossEnabled;
    clear(this.els.batchCrossFields);
    for (const field of STANDARD_FIELDS) {
      this.els.batchCrossFields.append(this.renderBatchField(this.cross, field));
    }
  }
  crossPatchFor(item) {
    if (!this.crossEnabled) return { set: {}, remove: [] };
    const group = this.groupMap.get(item.groupKey);
    const availableFields = new Set((group?.fields || []).map((field) => field.id));
    return crossFormatPatch({
      detectionId: item.detection?.id,
      availableFields,
      values: this.cross.values,
      removed: [...this.cross.remove],
    });
  }
  renderGroups() {
    clear(this.els.batchGroups);
    for (const group of this.groups) {
      const section = el('section', { className: 'batch-group', dataset: { groupKey: group.key } });
      const toggle = el('button', { className: 'batch-group-toggle', type: 'button', 'aria-expanded': String(group.open) },
        icon('chevron', 'batch-group-chevron'),
        el('span', { className: 'batch-group-title', textContent: translated(() => (group.label)) }),
        el('span', { className: 'batch-group-meta', textContent: translated(() => (t('ui.files', { v0: group.items.length }))) }),
      );
      toggle.addEventListener('click', () => {
        group.open = !group.open;
        toggle.setAttribute('aria-expanded', String(group.open));
        body.hidden = !group.open;
      });
      const select = el('input', { type: 'checkbox', className: 'batch-group-select-input', 'aria-label': translated(() => (t('ui.selectAllFiles', { v0: group.label }))) });
      const selectWrap = el('label', { className: 'batch-group-select' }, select, el('span', { textContent: translated(() => (t('ui.selectAll'))) }));
      select.addEventListener('change', () => {
        for (const item of group.items) {
          if (this.isLocked(item) || item.status === 'error') continue;
          item.included = select.checked;
          item.excluded = !select.checked;
          if (select.checked) item.skipReason = '';
        }
        this.updateAllRows();
        this.renderLimits();
        this.syncApply();
      });
      const undoBtn = el('button', {
        className: 'button ghost small',
        type: 'button',
        dataset: { groupAction: 'undo' },
        on: { click: () => this.undoGroup(group) },
      }, icon('undo'));
      const redoBtn = el('button', {
        className: 'button ghost small',
        type: 'button',
        dataset: { groupAction: 'redo' },
        on: { click: () => this.redoGroup(group) },
      }, icon('redo'));
      bindTranslation(undoBtn, 'aria-label', () => (t('ui.undoGroupChange', { v0: group.label })));
      bindTranslation(undoBtn, 'title', () => (t('ui.undoGroupChange', { v0: group.label })));
      bindTranslation(redoBtn, 'aria-label', () => (t('ui.redoGroupChange', { v0: group.label })));
      bindTranslation(redoBtn, 'title', () => (t('ui.redoGroupChange', { v0: group.label })));
      const head = el('div', { className: 'batch-group-head' }, toggle, selectWrap, undoBtn, redoBtn);
      const body = el('div', { className: 'batch-group-body', hidden: !group.open });
      const list = el('div', { className: 'batch-file-list' });
      for (const item of group.items) list.append(this.renderRow(item));
      list.append(this.renderAddTile());
      body.append(list);
      if (group.adapter) body.append(this.renderGroupForm(group));
      else body.append(el('p', { className: 'batch-group-note', textContent: translated(() => (t('ui.thisFormatIsNotSupportedYetTheFileWill'))) }));
      section.append(head, body);
      this.els.batchGroups.append(section);
      this.updateGroupHeader(group);
    }
  }
  renderRow(item) {
    const row = el('div', { className: `batch-file ${statusClass(item)}`, dataset: { itemId: item.id } });
    const checkbox = el('input', { type: 'checkbox', className: 'batch-file-checkbox', 'aria-label': translated(() => (t('ui.include', { v0: item.file.name }))) });
    checkbox.checked = isSelectedItem(item);
    checkbox.disabled = this.isLocked(item) || item.status === 'error';
    checkbox.addEventListener('change', () => {
      if (checkbox.disabled) return;
      item.included = checkbox.checked;
      item.excluded = !checkbox.checked;
      if (checkbox.checked) item.skipReason = '';
      this.renderLimits();
      this.updateGroupHeaders();
      this.syncApply();
    });
    const main = el('button', { className: 'batch-file-main', type: 'button' });
    main.addEventListener('click', () => this.openDetail(item.id));
    main.append(
      el('span', { className: 'batch-file-icon' }, icon(fileIconName(item))),
      el('span', { className: 'batch-file-copy' },
        el('span', { className: 'batch-file-name', textContent: item.file.name }),
        el('span', { className: 'batch-file-meta', textContent: translated(() => (this.metaLine(item))) }),
      ),
      el('span', { className: `batch-file-status ${statusClass(item)}`, textContent: translated(() => (statusLabel(item))) }),
    );
    const progress = el('span', { className: 'batch-file-progress' }, el('span', { style: { width: `${item.progress || 0}%` } }));
    row.append(el('label', { className: 'batch-file-check' }, checkbox), main, progress);
    return row;
  }
  metaLine(item) {
    const parts = [formatBytes(item.file.size), item.detection?.label || 'Tidak dikenal'];
    const duration = durationOf(item);
    if (duration) parts.push(formatDuration(duration));
    if (item.readResult) parts.push(t('ui.tags', { v0: tagCountOf(item) }));
    if (item.warnings?.length) parts.push(t('ui.notes', { v0: item.warnings.length }));
    if (item.skipReason && item.status !== 'done') parts.push(translateSource(item.skipReason));
    return parts.join(' · ');
  }
  isLocked(item) {
    return Boolean(item?.limitLocked) || item?.status === 'error';
  }
  renderAddTile() {
    const tile = el('button', {
      className: 'batch-add-tile',
      type: 'button',
      title: translated(() => (t('ui.addFilesToBatch'))),
      disabled: this.busy(),
    },
      icon('plus'),
      el('span', { textContent: translated(() => (t('ui.addFiles'))) }),
      el('small', { textContent: translated(() => (t('ui.newFilesAutomaticallyJoinTheMatchingFormatGroup'))) }),
    );
    tile.addEventListener('click', () => {
      if (this.busy()) {
        showToast('Tunggu proses selesai atau batalkan dulu.', 'info', 3200);
        return;
      }
      this.els.batchAddFileInput.click();
    });
    return tile;
  }
  renderGroupForm(group) {
    const form = el('div', { className: 'batch-group-form' });
    form.append(el('div', { className: 'batch-form-head' },
      el('div', {},
        el('h2', { textContent: translated(() => (t('ui.edit', { v0: group.label }))) }),
        el('p', { textContent: translated(() => (t('ui.emptyFieldsAreLeftUnchangedUseTheRemoveButton'))) }),
      ),
      el('button', {
        className: 'button ghost small',
        type: 'button',
        on: {
          click: () => {
            // Catat state SEBELUM dikosongkan supaya undo bisa mengembalikannya.
            this.groupHistoryController.end(group.key);
            this.groupHistoryController.begin(group.key, groupResetChangeKey(group.key));
            for (const field of group.fields) group.values[field.id] = '';
            group.remove.clear();
            this.groupHistoryController.end(group.key);
            const replacement = this.renderGroupForm(group);
            form.replaceWith(replacement);
            this.updateGroupHistoryButtons(group);
            this.syncApply();
          },
        },
      }, translated(() => (t('ui.clearInputs')))),
    ));
    const grid = el('div', { className: 'field-grid batch-field-grid' });
    for (const field of group.fields) grid.append(this.renderBatchField(group, field));
    form.append(grid);
    return form;
  }
  renderBatchField(group, field) {
    const hasHistory = group !== this.cross;
    const wrapper = el('div', { className: `field batch-field ${field.type === 'textarea' || field.type === 'tags' ? 'is-full' : ''}`.trim(), dataset: { fieldId: field.id } });
    const inputId = `batch-${group.key.replace(/[^a-z0-9]/gi, '-')}-${field.id}`;
    const removeToggle = el('button', {
      className: 'batch-remove-toggle',
      type: 'button',
      'aria-pressed': String(group.remove.has(field.id)),
      title: translated(() => (t('ui.removeTag', { v0: translateSource(field.label) }))),
      'aria-label': translated(() => (t('ui.removeTag', { v0: translateSource(field.label) }))),
    }, icon('trash'));
    const head = el('div', { className: 'field-head' },
      el('label', { for: inputId, textContent: translated(() => (field.label)) }),
      el('span', { className: 'field-native', textContent: field.native || '' }),
      removeToggle,
    );
    const inputValue = group.values[field.id] || '';
    const common = {
      id: inputId,
      className: 'field-input',
      autocomplete: 'off',
      spellcheck: 'false',
      value: inputValue,
      placeholder: translated(() => (field.placeholder || '')),
      on: {
        blur: () => { if (hasHistory) this.groupHistoryController.end(group.key); },
        input: (event) => {
          if (hasHistory) this.groupHistoryController.begin(group.key, groupFieldChangeKey(group.key, field.id));
          group.values[field.id] = event.target.value;
          this.updateGroupHistoryButtons(group);
          this.syncApply();
        },
      },
    };
    if (field.maxLength) common.maxLength = field.maxLength;
    if (field.min !== undefined) common.min = field.min;
    if (field.max !== undefined) common.max = field.max;
    let input;
    if (field.type === 'textarea') {
      input = el('textarea', common);
      input.value = inputValue;
    } else if (field.type === 'date') input = el('input', { ...common, type: 'date' });
    else if (field.type === 'number') input = el('input', { ...common, type: 'number', inputmode: 'numeric' });
    else input = el('input', { ...common, type: 'text' });
    const syncDisabled = () => {
      const active = group.remove.has(field.id);
      removeToggle.classList.toggle('is-active', active);
      removeToggle.setAttribute('aria-pressed', String(active));
      input.disabled = active;
      wrapper.classList.toggle('is-removing', active);
    };
    removeToggle.addEventListener('click', () => {
      if (hasHistory) {
        this.groupHistoryController.end(group.key);
        this.groupHistoryController.begin(group.key, groupRemoveChangeKey(group.key, field.id));
      }
      if (group.remove.has(field.id)) group.remove.delete(field.id);
      else group.remove.add(field.id);
      if (hasHistory) this.groupHistoryController.end(group.key);
      syncDisabled();
      this.updateGroupHistoryButtons(group);
      this.syncApply();
    });
    if (field.helper) wrapper.append(head, input, el('p', { className: 'field-helper', textContent: translated(() => (field.helper)) }));
    else wrapper.append(head, input);
    syncDisabled();
    return wrapper;
  }
  /** Stack undo/redo milik satu grup format (dibuat saat pertama dipakai). */
  groupHistory(key) {
    return this.groupHistoryController.history(key);
  }
  /** Seksi DOM grup format yang sedang tampil. */
  groupSection(group) {
    return this.els.batchGroups?.querySelector(`[data-group-key="${CSS.escape(group.key)}"]`) || null;
  }
  /**
   * Perbarui status nonaktif tombol undo/redo milik satu grup. Dipanggil
   * setiap kali header grup dibangun ulang maupun setiap ada perubahan.
   */
  updateGroupHistoryButtons(group) {
    const section = this.groupSection(group);
    if (!section) return;
    const busy = this.busy();
    const undoBtn = section.querySelector('[data-group-action="undo"]');
    const redoBtn = section.querySelector('[data-group-action="redo"]');
    if (undoBtn) undoBtn.disabled = busy || !this.groupHistoryController.canUndo(group.key);
    if (redoBtn) redoBtn.disabled = busy || !this.groupHistoryController.canRedo(group.key);
  }
  /**
   * Render ulang HANYA form milik grup ini — daftar grup lain (dan fokus
   * caret di dalamnya) tidak boleh ikut tersentuh.
   */
  refreshGroupForm(group) {
    const section = this.groupSection(group);
    const oldForm = section?.querySelector('.batch-group-form');
    oldForm?.replaceWith(this.renderGroupForm(group));
  }
  /** Batalkan perubahan terakhir pada grup ini saja. */
  undoGroup(group) {
    if (!group || this.busy()) return false;
    if (!this.groupHistoryController.undo(group.key)) return false;
    this.refreshGroupForm(group);
    this.updateGroupHistoryButtons(group);
    this.syncApply();
    return true;
  }
  /** Ulangi perubahan yang dibatalkan pada grup ini saja. */
  redoGroup(group) {
    if (!group || this.busy()) return false;
    if (!this.groupHistoryController.redo(group.key)) return false;
    this.refreshGroupForm(group);
    this.updateGroupHistoryButtons(group);
    this.syncApply();
    return true;
  }
  updateAllRows() {
    for (const item of this.items) this.updateRow(item);
    this.updateGroupHeaders();
  }
  updateRow(item) {
    const row = qs(`[data-item-id="${CSS.escape(item.id)}"]`, this.els.batchGroups);
    if (!row) return;
    row.className = `batch-file ${statusClass(item)}`;
    const checkbox = row.querySelector('.batch-file-checkbox');
    checkbox.checked = isSelectedItem(item);
    checkbox.disabled = this.isLocked(item) || item.status === 'error';
    bindTranslation(checkbox, 'title', () => (item.skipReason || ''));
    const status = row.querySelector('.batch-file-status');
    bindTranslation(status, 'textContent', () => (statusLabel(item)));
    status.className = `batch-file-status ${statusClass(item)}`;
    bindTranslation(row.querySelector('.batch-file-meta'), 'textContent', () => (this.metaLine(item)));
    row.querySelector('.batch-file-progress span').style.width = `${item.progress || 0}%`;
  }
  updateGroupHeaders() {
    for (const group of this.groups) this.updateGroupHeader(group);
  }
  updateGroupHeader(group) {
    const section = qs(`[data-group-key="${CSS.escape(group.key)}"]`, this.els.batchGroups);
    if (!section) return;
    const selected = group.items.filter(isSelectedItem).length;
    const meta = section.querySelector('.batch-group-meta');
    if (meta) bindTranslation(meta, 'textContent', () => (t('ui.selected', { v0: selected, v1: group.items.length, v2: formatBytes(group.items.reduce((sum, item) => sum + item.file.size, 0)) })));
    const checkbox = section.querySelector('.batch-group-select-input');
    if (checkbox) {
      const selectable = group.items.filter((item) => !this.isLocked(item) && item.status !== 'error');
      const checked = selectable.filter(isSelectedItem).length;
      checkbox.checked = selectable.length > 0 && checked === selectable.length;
      checkbox.indeterminate = checked > 0 && checked < selectable.length;
    }
    this.updateGroupHistoryButtons(group);
  }
}
