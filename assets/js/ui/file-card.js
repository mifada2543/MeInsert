/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, clear, formatBytes, formatDuration } from './dom.js';
import { icon } from './icons.js';
import { coverAcceptFor } from '../core/image-utils.js';
import { openLightbox } from './lightbox.js';
export function previewKind(detection) {
  if (!detection) return 'file';
  if (detection.id === 'image') return 'image';
  if (detection.id === 'pdf') return 'pdf';
  if (detection.id === 'mp4' && detection.subtype !== 'm4a') return 'video';
  if (detection.id === 'mkv') return 'video';
  if (detection.id === 'mp3' || detection.id === 'flac' || detection.id === 'ogg' || detection.subtype === 'm4a') return 'audio';
  return 'file';
}
function statRows(file, detection, readResult) {
  const rows = [
    ['Format', detection?.label || 'Tidak dikenali'],
    ['Ukuran', formatBytes(file.size)],
  ];
  const info = readResult?.info || {};
  if (info.width && info.height) rows.push(['Dimensi', `${info.width} × ${info.height}`]);
  if (info.pages) rows.push(['Halaman', `${info.pages}`]);
  if (info.duration) {
    const duration = formatDuration(info.duration);
    if (duration) rows.push(['Durasi', duration]);
  }
  if (info.sampleRate) rows.push(['Sample rate', `${Math.round(Number(info.sampleRate) / 1000)} kHz`]);
  if (info.channels) rows.push(['Channel', `${info.channels}`]);
  if (info.codec) rows.push(['Codec', String(info.codec).toUpperCase()]);
  if (info.videoCodec) rows.push(['Video', String(info.videoCodec).toUpperCase()]);
  if (info.audioCodec) rows.push(['Audio', String(info.audioCodec).toUpperCase()]);
  return rows;
}
function setMediaRatio(frame, width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
  frame.style.setProperty('--media-ratio', `${w} / ${h}`);
  frame.style.setProperty('--media-ratio-num', String(w / h));
}
function coverBadge(cover) {
  if (cover?.action === 'set') return { text: 'Akan diganti', className: 'is-set' };
  if (cover?.action === 'remove') return { text: 'Akan dihapus', className: 'is-remove' };
  if (cover?.original) return { text: 'Ada', className: 'is-ok' };
  return { text: 'Kosong', className: '' };
}
function coverLabel(cover) {
  const source = cover?.action === 'set' ? cover.chosen : cover?.original;
  if (!source) return '';
  const parts = [];
  if (source.name) parts.push(source.name);
  if (source.size) parts.push(formatBytes(source.size));
  return parts.join(' · ');
}
function coverHint(cover) {
  if (cover?.action === 'remove') return 'Thumbnail akan dihapus saat metadata disimpan.';
  if (cover?.action === 'set') {
    const label = coverLabel(cover);
    return label ? `Terpilih: ${label}` : 'Gambar baru siap dipasang.';
  }
  const label = coverLabel(cover);
  if (label) return `Terpasang: ${label}`;
  return 'Belum ada thumbnail. Seret gambar ke kotak ini atau klik untuk memilih.';
}
function hasDraggedFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}
function buildAudioStage({ cover, previewUrl, detectionId, onCoverChooseFile, onCoverRemove, onCoverUndo, resumeAt }) {
  const input = el('input', {
    type: 'file',
    accept: coverAcceptFor(detectionId),
    hidden: true,
    'aria-hidden': 'true',
    tabindex: '-1',
    on: {
      change: (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) onCoverChooseFile(file);
      },
    },
  });
  const pick = () => input.click();
  const badge = coverBadge(cover);
  const coverButton = el('button', {
    className: 'audio-cover',
    type: 'button',
    title: 'Seret gambar ke sini atau klik untuk memilih',
    'aria-label': cover?.previewUrl ? 'Ganti thumbnail audio' : 'Pilih thumbnail audio',
    on: { click: pick },
  },
    cover?.previewUrl
      ? el('img', { src: cover.previewUrl, alt: 'Thumbnail audio' })
      : el('span', { className: 'audio-cover-empty' },
          icon('image'),
          el('span', { textContent: 'Belum ada thumbnail' }),
        ),
  );
  let dragDepth = 0;
  coverButton.addEventListener('dragenter', (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    coverButton.classList.add('is-dragover');
  });
  coverButton.addEventListener('dragover', (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  coverButton.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) coverButton.classList.remove('is-dragover');
  });
  coverButton.addEventListener('drop', (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    coverButton.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) onCoverChooseFile(file);
  });
  const coverZoom = el('button', {
    className: 'audio-cover-zoom',
    type: 'button',
    title: 'Klik untuk perbesar thumbnail',
    'aria-label': 'Perbesar thumbnail audio',
    hidden: !(cover?.previewUrl),
    on: {
      click: (event) => {
        event.stopPropagation();
        openLightbox({
          src: cover.previewUrl,
          alt: 'Thumbnail audio',
          caption: coverLabel(cover) || 'Thumbnail audio',
        });
      },
    },
  }, icon('expand'));
  const coverBox = el('div', { className: 'audio-cover-wrap' }, coverButton, coverZoom);
  const showRemove = cover?.action !== 'remove' && Boolean(cover?.original || cover?.chosen || cover?.action === 'set');
  const actions = el('div', { className: 'audio-cover-actions' },
    el('button', {
      className: 'button ghost small',
      type: 'button',
      on: { click: pick },
    }, icon('plus'), 'Pilih gambar…'),
    el('button', {
      className: 'button ghost danger small',
      type: 'button',
      hidden: !showRemove,
      on: { click: onCoverRemove },
    }, icon('trash'), 'Hapus thumbnail'),
    onCoverUndo
      ? el('button', {
          className: 'button ghost small',
          type: 'button',
          hidden: cover?.action === 'keep',
          on: { click: onCoverUndo },
        }, 'Batalkan')
      : null,
  );
  const audio = el('audio', { src: previewUrl, controls: true, preload: 'metadata' });
  if (resumeAt > 0) {
    audio.addEventListener('loadedmetadata', () => {
      try {
        audio.currentTime = Math.min(resumeAt, audio.duration || resumeAt);
      } catch {
      }
    }, { once: true });
  }
  const stage = el('div', { className: 'audio-stage' },
    el('div', { className: 'audio-cover-head' },
      el('div', { className: 'audio-cover-title' },
        el('span', { textContent: 'Thumbnail / Sampul' }),
        el('span', { className: `cover-badge ${badge.className}`.trim(), textContent: badge.text }),
      ),
      actions,
    ),
    el('div', { className: 'audio-body' },
      coverBox,
      el('div', { className: 'audio-player' },
        audio,
        el('p', { className: 'audio-cover-hint', textContent: coverHint(cover) }),
      ),
    ),
  );
  stage.append(input);
  return stage;
}
export function setCardMinimized(container, minimized) {
  container.classList.toggle('is-minimized', minimized);
  const button = container.querySelector('.preview-toggle');
  if (!button) return;
  const label = minimized ? 'Tampilkan' : 'Kecilkan';
  const description = minimized ? 'Tampilkan pratinjau' : 'Kecilkan pratinjau';
  button.setAttribute('aria-expanded', String(!minimized));
  button.setAttribute('aria-label', description);
  button.title = description;
  const text = button.querySelector('.preview-toggle-label');
  if (text) text.textContent = label;
  const iconSlot = button.querySelector('.preview-toggle-icon');
  if (iconSlot) iconSlot.replaceChildren(icon(minimized ? 'expand' : 'minimize'));
}
export function renderFileCard(container, {
  file,
  detection,
  readResult,
  previewUrl,
  status,
  minimized = false,
  onToggleMinimize,
  cover = null,
  onCoverChooseFile,
  onCoverRemove,
  onCoverUndo,
}) {
  const previousAudio = container.querySelector('audio');
  const resumeAt = previousAudio ? previousAudio.currentTime : 0;
  clear(container);
  container.classList.toggle('is-minimized', minimized);
  const kind = previewKind(detection);
  const frame = el('div', { className: `preview-frame preview-frame--${kind}`, id: 'previewFrame' });
  const info = readResult?.info || {};
  if (kind === 'image' || kind === 'video') {
    setMediaRatio(frame, info.width, info.height);
  }
  if (status === 'loading') {
    frame.append(el('div', { className: 'preview-icon' }, icon(kind === 'pdf' ? 'pdf' : kind === 'image' ? 'image' : kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : 'file')));
  } else if (kind === 'image' && previewUrl) {
    const img = el('img', {
      src: previewUrl,
      alt: `Pratinjau ${file.name}`,
      on: {
        load: () => setMediaRatio(frame, img.naturalWidth, img.naturalHeight),
      },
    });
    const zoom = el('button', {
      className: 'preview-zoom',
      type: 'button',
      title: 'Klik untuk perbesar',
      'aria-label': `Perbesar pratinjau ${file.name}`,
      on: {
        click: () => {
          const dims = info.width && info.height ? `${info.width} × ${info.height}` : '';
          openLightbox({
            src: previewUrl,
            alt: `Pratinjau ${file.name}`,
            caption: dims ? `${file.name} · ${dims}` : file.name,
          });
        },
      },
    }, img, el('span', { className: 'preview-zoom-badge', 'aria-hidden': 'true' }, icon('expand')));
    frame.append(zoom);
  } else if (kind === 'video' && previewUrl) {
    const video = el('video', {
      src: previewUrl,
      controls: true,
      preload: 'metadata',
      on: {
        loadedmetadata: () => setMediaRatio(frame, video.videoWidth, video.videoHeight),
      },
    });
    frame.append(video);
  } else if (kind === 'audio' && previewUrl) {
    if (onCoverChooseFile) {
      frame.append(buildAudioStage({
        cover: cover ? { ...cover, previewUrl: cover.previewUrl || null } : null,
        previewUrl,
        detectionId: detection?.id,
        onCoverChooseFile,
        onCoverRemove,
        onCoverUndo,
        resumeAt,
      }));
    } else {
      frame.append(el('audio', { src: previewUrl, controls: true, preload: 'metadata' }));
    }
  } else if (kind === 'pdf' && previewUrl) {
    frame.append(el('iframe', { src: previewUrl, title: `Pratinjau ${file.name}` }));
  } else {
    frame.append(el('div', { className: 'preview-icon' }, icon(kind === 'pdf' ? 'pdf' : 'file')));
  }
  const toggleButton = onToggleMinimize
    ? el('button', {
        className: 'preview-toggle',
        type: 'button',
        'aria-expanded': String(!minimized),
        'aria-controls': 'previewFrame',
        'aria-label': minimized ? 'Tampilkan pratinjau' : 'Kecilkan pratinjau',
        title: minimized ? 'Tampilkan pratinjau' : 'Kecilkan pratinjau',
        on: { click: onToggleMinimize },
      },
        el('span', { className: 'preview-toggle-icon' }, icon(minimized ? 'expand' : 'minimize')),
        el('span', { className: 'preview-toggle-label', textContent: minimized ? 'Tampilkan' : 'Kecilkan' }),
      )
    : null;
  const infoBlock = el('div', { className: 'file-info' },
    el('div', { className: 'file-kind' },
      el('span', { className: 'file-badge' },
        el('span', { className: 'chip-dot ' + (detection?.id === 'pdf' ? 'pdf' : detection?.id === 'image' ? 'image' : detection?.id === 'mp4' || detection?.id === 'mkv' ? 'video' : 'audio') }),
        detection?.label || 'File',
      ),
      el('span', { className: 'file-kind-aside' },
        el('span', { className: 'file-local' }, 'lokal'),
        toggleButton,
      ),
    ),
    el('h2', { className: 'file-name', title: file.name, textContent: file.name }),
    el('p', { className: 'file-sub', textContent: `${detection?.mime || file.type || 'application/octet-stream'} · ${formatBytes(file.size)}` }),
  );
  if (readResult) {
    const list = el('dl', { className: 'meta-list' });
    for (const [label, value] of statRows(file, detection, readResult)) {
      list.append(el('div', { className: 'meta-row' },
        el('dt', { textContent: label }),
        el('dd', { textContent: value }),
      ));
    }
    infoBlock.append(list);
  }
  const warnings = [];
  if (detection?.warning) warnings.push(detection.warning);
  if (readResult?.warnings?.length) warnings.push(...readResult.warnings);
  if (warnings.length) {
    infoBlock.append(el('div', { className: 'file-warning' },
      icon('alert'),
      el('span', { textContent: warnings.join(' ') }),
    ));
  }
  container.append(frame, infoBlock);
}
