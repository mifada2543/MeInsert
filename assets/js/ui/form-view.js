import { el, clear, formatBytes } from './dom.js';
import { icon } from './icons.js';
import { asArray, asString, fileBaseName } from '../core/tag-utils.js';

function inputsEqual(a, b, field) {
  if (field.type === 'tags') {
    return JSON.stringify(asArray(a)) === JSON.stringify(asArray(b));
  }
  return asString(a).trim() === asString(b).trim();
}

function fieldIsDirty(field, state) {
  if (state.removedFields.has(field.id)) {
    return asString(state.originalValues[field.id]).trim() !== '';
  }
  return !inputsEqual(state.values[field.id], state.originalValues[field.id], field);
}

function customPlaceholder(adapterId) {
  switch (adapterId) {
    case 'image':
    case 'mp4':
      return 'XMP-photoshop:Credit';
    case 'pdf':
      return 'Department';
    case 'mp3':
      return 'MOOD';
    case 'flac':
      return 'ORGANIZATION';
    case 'mkv':
      return 'DIRECTOR';
    default:
      return 'NamaTag';
  }
}

function customHint(adapterId) {
  switch (adapterId) {
    case 'image':
    case 'mp4':
      return 'Gunakan nama tag native ExifTool. Contoh: XMP-photoshop:Credit atau EXIF:Artist.';
    case 'pdf':
      return 'Tambahkan key Info dictionary PDF. Key standar (Title, Author, Subject, Keywords, Creator, Producer, tanggal) sudah punya field sendiri.';
    case 'mp3':
      return 'Tambahkan frame TXXX ID3. Key adalah deskripsi frame; nilainya teks bebas.';
    case 'flac':
      return 'Tambahkan Vorbis comment. Key akan diubah menjadi huruf kapital.';
    case 'mkv':
      return 'Tambahkan tag Matroska. Key akan diubah menjadi huruf kapital.';
    default:
      return 'Tambahkan metadata kustom sesuai format file.';
  }
}

function buildField(field, state, handlers) {
  const wrapper = el('div', {
    className: `field ${field.type === 'textarea' || field.type === 'tags' ? 'is-full' : ''}`.trim(),
    dataset: { fieldId: field.id },
  });
  const inputId = `field-${field.id}`;
  const head = el('div', { className: 'field-head' },
    el('label', { for: inputId, textContent: field.label }),
    el('span', { className: 'field-native', textContent: field.native || '' }),
    el('span', { className: 'field-dirty', hidden: true, title: 'Field ini berubah' }),
    el('button', {
      className: 'field-clear',
      type: 'button',
      title: 'Hapus nilai field ini',
      'aria-label': `Hapus nilai ${field.label}`,
      on: {
        click: (event) => {
          event.preventDefault();
          handlers.onFieldClear(field.id);
          input.value = '';
          syncField(wrapper, field, state);
        },
      },
    }, icon('x')),
  );

  let input;
  const value = asString(state.values[field.id]);
  const common = {
    id: inputId,
    className: 'field-input',
    autocomplete: 'off',
    spellcheck: field.type === 'text' || field.type === 'textarea' || field.type === 'tags' ? 'true' : 'false',
    value,
    placeholder: field.placeholder || '',
    on: {
      input: (event) => {
        handlers.onFieldChange(field.id, event.target.value);
        syncField(wrapper, field, state);
      },
    },
  };
  if (field.maxLength) common.maxLength = field.maxLength;
  if (field.min !== undefined) common.min = field.min;
  if (field.max !== undefined) common.max = field.max;

  if (field.type === 'textarea') {
    input = el('textarea', common);
    input.value = value;
  } else if (field.type === 'date') {
    input = el('input', { ...common, type: 'date' });
    input.value = value;
  } else if (field.type === 'number') {
    input = el('input', { ...common, type: 'number', inputmode: 'numeric' });
    input.value = value;
  } else {
    input = el('input', { ...common, type: 'text' });
    input.value = value;
  }

  wrapper.append(head, input);
  if (field.helper) wrapper.append(el('p', { className: 'field-helper', textContent: field.helper }));
  syncField(wrapper, field, state);
  return wrapper;
}

function syncField(wrapper, field, state) {
  const dirty = fieldIsDirty(field, state);
  wrapper.classList.toggle('is-dirty', dirty);
  const dot = wrapper.querySelector('.field-dirty');
  if (dot) dot.hidden = !dirty;
}

export function syncFormState(container, state) {
  for (const field of state.adapter.fields) {
    const wrapper = container.querySelector(`[data-field-id="${CSS.escape(field.id)}"]`);
    if (!wrapper) continue;
    const input = wrapper.querySelector('.field-input');
    if (input) input.value = asString(state.values[field.id]);
    syncField(wrapper, field, state);
  }
}

function renderCustomRows(list, state, handlers) {
  clear(list);
  if (!state.customRows.length) {
    list.append(el('div', { className: 'custom-empty', textContent: 'Belum ada tag kustom. Tambahkan jika perlu.' }));
    return;
  }
  for (const row of state.customRows) {
    const keyInput = el('input', {
      className: 'custom-key',
      type: 'text',
      value: row.key || '',
      placeholder: customPlaceholder(state.adapter.meta.id),
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': 'Nama tag kustom',
      on: {
        input: (event) => handlers.onCustomChange(row.uid, 'key', event.target.value),
      },
    });
    const valueInput = el('input', {
      type: 'text',
      value: row.value || '',
      placeholder: 'Nilai',
      autocomplete: 'off',
      'aria-label': 'Nilai tag kustom',
      on: {
        input: (event) => handlers.onCustomChange(row.uid, 'value', event.target.value),
      },
    });
    const remove = el('button', {
      className: 'custom-delete',
      type: 'button',
      title: 'Hapus tag kustom',
      'aria-label': `Hapus tag ${row.key || 'kustom'}`,
      on: {
        click: () => {
          handlers.onCustomDelete(row.uid);
          renderCustomRows(list, state, handlers);
        },
      },
    }, icon('trash'));
    list.append(el('div', {
      className: 'custom-row',
      title: row.originalKey ? 'Tag sudah ada di file' : 'Tag baru',
    }, keyInput, valueInput, remove));
  }
}

function coverFileLabel(cover) {
  if (!cover) return '';
  const parts = [];
  if (cover.name) parts.push(cover.name);
  if (cover.size) parts.push(formatBytes(cover.size));
  return parts.join(' · ');
}

export function renderCoverBlock(adapter, state, handlers) {
  const original = state.coverOriginal;
  const action = state.coverAction;
  const chosen = state.coverChosen;
  const previewUrl = state.coverPreviewUrl;
  const hasImage = Boolean(previewUrl);
  const badge = action === 'set'
    ? { text: 'Akan diganti', className: 'is-set' }
    : action === 'remove'
      ? { text: 'Akan dihapus', className: 'is-remove' }
      : original
        ? { text: 'Ada', className: 'is-ok' }
        : { text: 'Kosong', className: '' };

  let hint = 'JPEG, PNG, atau WebP, maks. 10 MB.';
  if (action === 'set' && chosen) {
    hint = `Terpilih: ${coverFileLabel({ name: chosen.name, size: chosen.data?.byteLength })}`;
  } else if (original) {
    hint = `Terpasang: ${coverFileLabel(original)}`;
  }

  const preview = el('div', { className: 'cover-preview', dataset: { coverPreview: '' } },
    hasImage
      ? el('img', { src: previewUrl, alt: 'Pratinjau thumbnail' })
      : el('div', { className: 'cover-placeholder' },
          icon('image'),
          el('span', { textContent: original && !previewUrl ? 'Cover ada (pratinjau tidak tersedia)' : 'Belum ada thumbnail' }),
        ),
  );

  const input = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    hidden: true,
    'aria-hidden': 'true',
    tabindex: '-1',
    on: {
      change: (event) => {
        const file = event.target.files?.[0];
        if (file) handlers.onCoverChooseFile(file);
      },
    },
  });

  const choose = el('button', {
    className: 'button ghost',
    type: 'button',
    on: { click: () => input.click() },
  }, icon('plus'), 'Pilih gambar…');

  const remove = el('button', {
    className: 'button ghost danger',
    type: 'button',
    hidden: !(action !== 'remove' && (original || chosen || action === 'set')),
    on: { click: () => handlers.onCoverRemove() },
  }, icon('trash'), 'Hapus thumbnail');

  const undo = el('button', {
    className: 'button ghost',
    type: 'button',
    hidden: action === 'keep',
    on: { click: () => handlers.onCoverUndo() },
  }, 'Batalkan');

  return el('section', { className: 'cover-block' },
    el('div', { className: 'cover-head' },
      el('div', {},
        el('h2', { textContent: 'Thumbnail / Sampul' }),
        el('p', { textContent: 'Gambar sampul di-embed ke dalam file (MP3: APIC, FLAC/Ogg: METADATA_BLOCK_PICTURE, MP4: covr, MKV: attachment). Tidak semua pemutar menampilkannya.' }),
      ),
      el('span', { className: `cover-badge ${badge.className}`.trim(), textContent: badge.text }),
    ),
    el('div', { className: 'cover-body' },
      preview,
      el('div', { className: 'cover-actions' },
        choose,
        remove,
        undo,
        el('p', { className: 'cover-hint', textContent: hint }),
        input,
      ),
    ),
  );
}

export function renderForm(container, { adapter, sections, state, handlers }) {
  clear(container);
  let index = 0;
  for (const section of sections) {
    const sectionFields = adapter.fields.filter((field) => field.section === section.id);
    if (!sectionFields.length) continue;
    index += 1;
    const block = el('section', { className: 'form-section' },
      el('div', { className: 'section-head' },
        el('div', {},
          el('h2', { textContent: section.title }),
          section.description ? el('p', { textContent: section.description }) : null,
        ),
        el('span', { className: 'section-index', textContent: String(index).padStart(2, '0') }),
      ),
      el('div', { className: 'field-grid' }, ...sectionFields.map((field) => buildField(field, state, handlers))),
    );
    container.append(block);
  }

  if (adapter.meta?.cover && handlers.onCoverChooseFile) {
    container.append(renderCoverBlock(adapter, state, handlers));
  }

  const list = el('div', { className: 'custom-list' });
  const addButton = el('button', {
    className: 'button ghost small',
    type: 'button',
    on: {
      click: () => {
        handlers.onAddCustom();
        renderCustomRows(list, state, handlers);
      },
    },
  }, icon('plus'), 'Tambah tag');
  container.append(el('section', { className: 'custom-block' },
    el('div', { className: 'custom-head' },
      el('div', {},
        el('h2', { textContent: 'Tag kustom' }),
        el('p', { textContent: customHint(adapter.meta.id) }),
      ),
      addButton,
    ),
    list,
  ));
  renderCustomRows(list, state, handlers);
}
