/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t, translated } from '../i18n/index.js';
import { el, clear, formatBytes } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openLightbox } from '../ui/lightbox.js';
import { previewKind } from '../ui/file-card.js';
import { buildOfficePreview } from '../ui/office-preview.js';
import { formatDuration } from './batch-limits.js';
import { durationOf } from './batch-item.js';
export class BatchPreview {
  previewKindOf(item) {
    const kind = previewKind(item?.detection);
    if (kind !== 'file') return kind;
    const type = item?.file?.type || '';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';
    return 'file';
  }
  previewSignatureFor(item) {
    const kind = this.previewKindOf(item);
    return `${item.id}:${kind}`;
  }
  releasePreview() {
    const host = this.els.batchPreview;
    host?.querySelectorAll('video, audio').forEach((media) => media.pause());
    const frame = host?.querySelector('iframe');
    if (frame) frame.src = 'about:blank';
    if (this.previewCoverUrl) URL.revokeObjectURL(this.previewCoverUrl);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewItemId = null;
    this.previewUrl = null;
    this.previewCoverUrl = null;
    this.previewNode = null;
    this.previewSignature = '';
    this.previewFile = null;
    this.previewCoverBytes = null;
    this.previewCoverMime = '';
    if (host) clear(host);
  }
  pausePreview() {
    this.els.batchPreview?.querySelectorAll('video, audio').forEach((media) => media.pause());
  }
  ensurePreview(item) {
    const signature = this.previewSignatureFor(item);
    if (this.previewNode && this.previewItemId === item.id && this.previewSignature === signature && this.previewFile === item.file) {
      if (this.previewKindOf(item) === 'audio') this.refreshPreviewCover(item);
      return this.previewNode;
    }
    this.releasePreview();
    const kind = this.previewKindOf(item);
    this.previewItemId = item.id;
    this.previewSignature = signature;
    this.previewFile = item.file;
    this.previewUrl = this.createPreviewUrl(item, kind);
    if (kind === 'audio') {
      this.previewCoverUrl = this.createCoverUrl(item);
      this.previewCoverBytes = item.readResult?.coverBytes;
      this.previewCoverMime = item.readResult?.cover?.mimeType || 'image/jpeg';
    }
    this.previewNode = this.buildPreview(item, kind);
    return this.previewNode;
  }
  createPreviewUrl(item, kind) {
    if (kind === 'office') return null;
    if (kind === 'pdf' && item.file.type !== 'application/pdf') {
      return URL.createObjectURL(new Blob([item.file], { type: 'application/pdf' }));
    }
    return URL.createObjectURL(item.file);
  }
  createCoverUrl(item) {
    const bytes = item.readResult?.coverBytes;
    if (!bytes || !(bytes.byteLength || bytes.length)) return null;
    const mime = item.readResult?.cover?.mimeType || 'image/jpeg';
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }
  refreshPreviewCover(item) {
    const bytes = item.readResult?.coverBytes;
    const mime = item.readResult?.cover?.mimeType || 'image/jpeg';
    if (bytes === this.previewCoverBytes && mime === this.previewCoverMime) return;
    const cover = this.previewNode.querySelector('.batch-preview-cover');
    if (!cover) return;
    const previousUrl = this.previewCoverUrl;
    this.previewCoverUrl = this.createCoverUrl(item);
    this.previewCoverBytes = bytes;
    this.previewCoverMime = mime;
    cover.replaceWith(this.buildPreviewCover(item));
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }
  buildPreviewCover(item) {
    const cover = el('div', { className: 'batch-preview-cover' });
    if (!this.previewCoverUrl) {
      cover.append(icon('audio'), el('span', { textContent: translated(() => t('ui.noCover')) }));
      return cover;
    }
    const coverImg = el('img', { src: this.previewCoverUrl, alt: translated(() => `Cover ${item.file.name}`), decoding: 'async' });
    coverImg.addEventListener('error', () => cover.replaceChildren(icon('audio'), el('span', { textContent: translated(() => t('ui.noCover')) })));
    cover.append(el('button', {
      className: 'batch-preview-cover-zoom',
      type: 'button',
      title: translated(() => t('ui.clickToEnlargeCover')),
      'aria-label': translated(() => t('ui.enlargeCoverOf', { v0: item.file.name })),
      on: { click: () => openLightbox({
        src: this.previewCoverUrl,
        alt: `Cover ${item.file.name}`,
        caption: `Cover · ${item.file.name}`,
      }) },
    }, coverImg, el('span', { className: 'cover-zoom-badge', 'aria-hidden': 'true' }, icon('expand'))));
    return cover;
  }
  renderPreview(item) {
    const host = this.els.batchPreview;
    if (!host) return;
    const visible = this.detailTab !== 'raw';
    host.hidden = !visible;
    if (!visible) {
      this.pausePreview();
      return;
    }
    const node = this.ensurePreview(item);
    if (!host.contains(node)) host.replaceChildren(node);
  }
  buildPreview(item, kind) {
    const info = item.readResult?.info || {};
    const stage = el('div', { className: `batch-preview-stage batch-preview-stage--${kind}` });
    const wrap = el('div', { className: 'batch-preview-inner' });
    if (kind === 'image' || kind === 'video') this.setPreviewRatio(stage, info.width, info.height);
    if (kind === 'image') {
      const img = el('img', { src: this.previewUrl, alt: translated(() => (t('ui.preview', { v0: item.file.name }))), decoding: 'async' });
      img.addEventListener('load', () => this.setPreviewRatio(stage, img.naturalWidth, img.naturalHeight));
      img.addEventListener('error', () => stage.replaceChildren(this.previewFallback(item, 'Gambar tidak bisa ditampilkan di browser ini.')));
      const zoom = el('button', {
        className: 'batch-preview-zoom',
        type: 'button',
        title: translated(() => (t('ui.clickToEnlarge'))),
        'aria-label': translated(() => (t('ui.enlargePreviewOf', { v0: item.file.name }))),
        on: {
          click: () => {
            const dims = info.width && info.height ? ` · ${info.width} × ${info.height}` : '';
            openLightbox({
              src: this.previewUrl,
              alt: `Pratinjau ${item.file.name}`,
              caption: `${item.file.name}${dims}`,
            });
          },
        },
      }, img, el('span', { className: 'preview-zoom-badge', 'aria-hidden': 'true' }, icon('expand')));
      stage.append(zoom);
    } else if (kind === 'video') {
      const video = el('video', {
        src: this.previewUrl,
        controls: true,
        preload: 'metadata',
        playsinline: true,
        'aria-label': translated(() => (t('ui.videoPreviewOf', { v0: item.file.name }))),
      });
      video.addEventListener('loadedmetadata', () => this.setPreviewRatio(stage, video.videoWidth, video.videoHeight));
      video.addEventListener('error', () => stage.replaceChildren(this.previewFallback(item, 'Video tidak bisa diputar di browser ini.')));
      stage.append(video);
    } else if (kind === 'audio') {
      const cover = this.buildPreviewCover(item);
      const copy = el('div', { className: 'batch-preview-audio-copy' },
        el('p', { textContent: translated(() => (this.previewDetail(item, kind))) }),
        el('audio', {
          src: this.previewUrl,
          controls: true,
          preload: 'metadata',
          'aria-label': translated(() => (t('ui.playAudio', { v0: item.file.name }))),
        }),
      );
      stage.append(cover, copy);
    } else if (kind === 'pdf') {
      stage.append(el('iframe', { src: this.previewUrl, title: translated(() => (t('ui.pdfPreviewOf', { v0: item.file.name }))) }));
    } else if (kind === 'office') {
      stage.append(buildOfficePreview({ file: item.file, detection: item.detection, readResult: item.readResult }));
    } else {
      stage.append(this.previewFallback(item, 'Format file ini belum bisa dipratinjau.'));
    }
    const meta = el('div', { className: 'batch-preview-meta' },
      el('span', { className: 'batch-preview-kind' },
        icon(this.previewIcon(kind)),
        el('span', { textContent: translated(() => (item.detection?.label || this.previewKindLabel(kind))) }),
      ),
      el('span', { className: 'batch-preview-detail', textContent: translated(() => (this.previewDetail(item, kind))) }),
      this.previewUrl
        ? el('a', { className: 'batch-preview-open', href: this.previewUrl, target: '_blank', rel: 'noopener', textContent: translated(() => (t('ui.openInANewTab'))) })
        : null,
    );
    wrap.append(stage, meta);
    if (kind === 'pdf') {
      wrap.append(el('p', { className: 'batch-preview-note', textContent: translated(() => (t('ui.ifThePreviewIsBlankOpenThePDFIn'))) }));
    }
    return wrap;
  }
  setPreviewRatio(stage, width, height) {
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    stage.style.setProperty('--batch-preview-ratio', `${w} / ${h}`);
    stage.style.setProperty('--batch-preview-ratio-num', String(w / h));
  }
  previewDetail(item, kind) {
    const info = item.readResult?.info || {};
    const parts = [];
    if ((kind === 'image' || kind === 'video') && info.width && info.height) parts.push(`${info.width} × ${info.height}`);
    if ((kind === 'video' || kind === 'audio') && durationOf(item)) parts.push(formatDuration(durationOf(item)));
    if (kind === 'pdf' && info.pages) parts.push(`${info.pages} halaman`);
    if (!parts.length) parts.push(formatBytes(item.file.size));
    return parts.join(' · ');
  }
  previewKindLabel(kind) {
    return { image: 'Gambar', video: 'Video', audio: 'Audio', pdf: 'PDF', file: 'File' }[kind] || 'File';
  }
  previewIcon(kind) {
    return kind === 'file' ? 'file' : kind;
  }
  previewFallback(item, message) {
    return el('div', { className: 'batch-preview-fallback' },
      el('span', { className: 'batch-preview-fallback-icon' }, icon(this.previewIcon(this.previewKindOf(item)))),
      el('div', {},
        el('h3', { textContent: translated(() => (t('ui.previewUnavailable'))) }),
        el('p', { textContent: translated(() => (message)) }),
        el('a', { href: this.previewUrl, target: '_blank', rel: 'noopener', textContent: translated(() => (t('ui.openFileInANewTab'))) }),
      ),
    );
  }
}