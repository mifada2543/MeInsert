import { el, clear, formatBytes, formatDuration } from './dom.js';
import { icon } from './icons.js';

function previewKind(detection) {
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

export function renderFileCard(container, { file, detection, readResult, previewUrl, status, minimized = false, onToggleMinimize }) {
  clear(container);
  container.classList.toggle('is-minimized', minimized);
  const kind = previewKind(detection);
  const frame = el('div', { className: `preview-frame preview-frame--${kind}`, id: 'previewFrame' });

  if (status === 'loading') {
    frame.append(el('div', { className: 'preview-icon' }, icon(kind === 'pdf' ? 'pdf' : kind === 'image' ? 'image' : kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : 'file')));
  } else if (kind === 'image' && previewUrl) {
    frame.append(el('img', { src: previewUrl, alt: `Pratinjau ${file.name}` }));
  } else if (kind === 'video' && previewUrl) {
    frame.append(el('video', { src: previewUrl, controls: true, preload: 'metadata' }));
  } else if (kind === 'audio' && previewUrl) {
    frame.append(el('audio', { src: previewUrl, controls: true, preload: 'metadata' }));
  } else if (kind === 'pdf' && previewUrl) {
    frame.append(el('iframe', { src: previewUrl, title: `Pratinjau ${file.name}` }));
  } else {
    frame.append(el('div', { className: 'preview-icon' }, icon(kind === 'pdf' ? 'pdf' : 'file')));
  }

  const info = el('div', { className: 'file-info' },
    el('div', { className: 'file-kind' },
      el('span', { className: 'file-badge' },
        el('span', { className: 'chip-dot ' + (detection?.id === 'pdf' ? 'pdf' : detection?.id === 'image' ? 'image' : detection?.id === 'mp4' || detection?.id === 'mkv' ? 'video' : 'audio') }),
        detection?.label || 'File',
      ),
      el('span', { className: 'file-local' }, 'lokal'),
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
    info.append(list);
  }

  const warnings = [];
  if (detection?.warning) warnings.push(detection.warning);
  if (readResult?.warnings?.length) warnings.push(...readResult.warnings);
  if (warnings.length) {
    info.append(el('div', { className: 'file-warning' },
      icon('alert'),
      el('span', { textContent: warnings.join(' ') }),
    ));
  }

  container.append(frame, info);

  if (onToggleMinimize) {
    container.append(el('button', {
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
    ));
  }
}
