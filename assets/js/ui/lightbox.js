/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';

let current = null;

export function isLightboxOpen() {
  return Boolean(current);
}

export function openLightbox({ src, alt = '', caption = '', trigger = null } = {}) {
  if (typeof document === 'undefined' || !src) return null;
  closeLightbox();
  const focusBefore = trigger instanceof HTMLElement
    ? trigger
    : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = null;
  const activePointers = new Map();
  let pinch = null;

  const captionText = (caption || '').trim();
  const captionNode = el('span', {
    className: 'lightbox-caption-text',
    textContent: captionText,
  });
  const isTouch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hintNode = el('span', {
    className: 'lightbox-caption-hint',
    textContent: isTouch
      ? 'Ketuk 2x gambar untuk memperbesar/memperkecil · Seret untuk menggeser · Ketuk × untuk tutup'
      : 'Klik 2x gambar untuk memperbesar/memperkecil · Seret/panah untuk menggeser · Esc untuk tutup',
  });

  const img = el('img', { className: 'lightbox-img', src, alt: alt || 'Pratinjau ukuran penuh', decoding: 'async', draggable: 'false' });
  const panTop = el('div', { className: 'lightbox-pan-fade lightbox-pan-top', 'aria-hidden': 'true' });
  const panBottom = el('div', { className: 'lightbox-pan-fade lightbox-pan-bottom', 'aria-hidden': 'true' });
  const viewport = el('div', { className: 'lightbox-viewport' }, img);
  const stageEl = el('div', { className: 'lightbox-stage' }, viewport, panTop, panBottom);
  const syncStageRatio = () => {
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    if (!nw || !nh) return;
    stageEl.style.setProperty('--lightbox-ratio', `${nw} / ${nh}`);
    stageEl.style.setProperty('--lightbox-ratio-num', String(nw / nh));
    applyTransform();
  };
  img.addEventListener('load', syncStageRatio);

  const applyTransform = () => {
    clampPan();
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    img.classList.toggle('is-zoomed', scale > 1);
    updatePanFades();
  };

  function clampPan() {
    if (scale <= 1) {
      tx = 0;
      ty = 0;
      return;
    }
    // Clip against the *viewport* (inside the 16px mat frame) so zoomed /
    // panned image is clipped to the frame and the checker border stays
    // uniformly visible on all four sides — never covered on one side only.
    const stageRect = viewport.getBoundingClientRect();
    const rect = img.getBoundingClientRect();
    const displayedW = rect.width / scale || 0;
    const displayedH = rect.height / scale || 0;
    const innerW = Math.max(1, stageRect.width);
    const innerH = Math.max(1, stageRect.height);
    const SLACK = 72;
    const maxTx = Math.max(0, (displayedW * scale - innerW) / 2) + SLACK;
    const maxTy = Math.max(0, (displayedH * scale - innerH) / 2) + SLACK;
    tx = Math.max(-maxTx, Math.min(maxTx, tx));
    ty = Math.max(-maxTy, Math.min(maxTy, ty));
    // Edge magnet: snap flush when within 12px of either limit.
    const MAGNET = 12;
    if (maxTx > 0 && maxTx - Math.abs(tx) < MAGNET) tx = Math.sign(tx) * maxTx;
    if (maxTy > 0 && maxTy - Math.abs(ty) < MAGNET) ty = Math.sign(ty) * maxTy;
  }

  function updatePanFades() {
    if (typeof stageEl === 'undefined') return;
    let maxTy = 0;
    try {
      const stageRect = viewport.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      const displayedH = (rect.height / scale) || 0;
      const innerH = Math.max(1, stageRect.height);
      maxTy = Math.max(0, (displayedH * scale - innerH) / 2) + 72;
    } catch { /* ignore measurement errors */ }
    const canGoDown = maxTy > 4 && ty < maxTy - 4;
    const canGoUp = maxTy > 4 && ty > -maxTy + 4;
    panTop.classList.toggle('is-visible', canGoDown);
    panBottom.classList.toggle('is-visible', canGoUp);
    panTop.dataset.remaining = String(Math.round(maxTy - ty));
    panBottom.dataset.remaining = String(Math.round(ty + maxTy));
  }

  // Zoom about the clicked/scrolled point while keeping origin centred.
  // transform-origin trickery breaks the symmetric pan clamp (hence
  // "mentok di tengah"), so we translate instead: the content pixel under
  // the cursor stays exactly under the cursor after scaling.
  const zoomAt = (clientX, clientY, nextScale) => {
    const oldScale = scale;
    const target = Math.min(5, Math.max(1, nextScale));
    if (target === oldScale) {
      applyTransform();
      return;
    }
    const rect = img.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const k = target / oldScale;
    scale = target;
    if (scale === 1) {
      tx = 0;
      ty = 0;
    } else {
      tx += dx * (1 - k);
      ty += dy * (1 - k);
    }
    applyTransform();
  };

  const toggleZoom = (event) => {
    if (scale > 1) {
      scale = 1;
      tx = 0;
      ty = 0;
      applyTransform();
      return;
    }
    const hasPoint = event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
    if (!hasPoint) {
      const rect = img.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 2.4);
      return;
    }
    zoomAt(event.clientX, event.clientY, 2.4);
  };

  const setScale = (next) => {
    scale = Math.min(5, Math.max(1, next));
    if (scale === 1) {
      tx = 0;
      ty = 0;
    }
    applyTransform();
  };

  const zoomInButton = el('button', {
    className: 'lightbox-zoom-btn',
    type: 'button',
    'aria-label': 'Perbesar gambar',
    title: 'Perbesar',
  }, icon('plus'));
  const zoomOutButton = el('button', {
    className: 'lightbox-zoom-btn',
    type: 'button',
    'aria-label': 'Perkecil gambar',
    title: 'Perkecil',
  }, icon('minimize'));
  const resetButton = el('button', {
    className: 'lightbox-zoom-btn',
    type: 'button',
    'aria-label': 'Kembalikan ke ukuran pas',
    title: 'Ukuran pas',
    textContent: '1:1',
  });
  const resetToFit = () => {
    // Pure preview reset: exactly like the file-card thumbnail (contain,
    // centered, no zoom / pan / origin offset) — even if the user had
    // panned to an edge, 1:1 must land here deterministically.
    scale = 1;
    tx = 0;
    ty = 0;
    img.style.transformOrigin = '50% 50%';
    img.style.transition = 'none';
    syncStageRatio();
    applyTransform();
    void img.offsetHeight;
    img.style.transition = '';
    applyTransform();
  };

  for (const [button, action] of [
    [zoomInButton, () => setScale(scale * 1.4)],
    [zoomOutButton, () => setScale(scale * 0.7)],
    [resetButton, resetToFit],
  ]) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      action();
    });
  }

  const closeButton = el('button', {
    className: 'lightbox-close',
    type: 'button',
    'aria-label': 'Tutup pratinjau',
    title: 'Tutup',
  }, icon('x'));

  const controls = el('div', { className: 'lightbox-controls', role: 'group', 'aria-label': 'Kontrol zoom' },
    zoomOutButton, resetButton, zoomInButton);

  const figure = el('figure', { className: 'lightbox-figure' },
    stageEl,
    el('figcaption', { className: 'lightbox-caption' }, captionNode, captionText ? el('span', { className: 'lightbox-caption-sep', textContent: '·' }) : null, hintNode),
    controls,
    closeButton,
  );

  const backdrop = el('div', {
    className: 'lightbox',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': captionText ? `Pratinjau ${captionText}` : 'Pratinjau ukuran penuh',
  }, figure);
  document.body.append(backdrop);

  const cleanup = () => {
    document.removeEventListener('keydown', onKeydown, true);
    document.body.style.overflow = prevOverflow || '';
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    if (current === backdrop) current = null;
    if (focusBefore && typeof focusBefore.focus === 'function') {
      try { focusBefore.focus(); } catch { /* noop */ }
    }
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox();
      return;
    }
    if (event.key && event.key.startsWith('Arrow')) {
      event.preventDefault();
      if (scale <= 1) return;
      const step = event.shiftKey ? 120 : 40;
      if (event.key === 'ArrowUp') ty -= step;
      else if (event.key === 'ArrowDown') ty += step;
      else if (event.key === 'ArrowLeft') tx -= step;
      else if (event.key === 'ArrowRight') tx += step;
      applyTransform();
      return;
    }
    if (event.key === 'Tab') {
      // Focus trap: keep tabbing inside the dialog.
      const focusables = [closeButton, zoomOutButton, resetButton, zoomInButton];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKeydown, true);

  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeLightbox();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target === figure || event.target === figure.querySelector('.lightbox-stage')) {
      closeLightbox();
    }
  });
  // Single click on the image does nothing (so the user can look around
  // without an accidental zoom); only a double-click toggles zoom.
  img.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  img.addEventListener('dblclick', (event) => {
    event.preventDefault();
    toggleZoom(event);
  });
  img.addEventListener('wheel', (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 0.87;
    zoomAt(event.clientX, event.clientY, scale * factor);
  }, { passive: false });
  img.addEventListener('pointerdown', (event) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { img.setPointerCapture(event.pointerId); } catch { /* noop */ }
    if (activePointers.size >= 2) {
      // Second finger down: switch from pan to pinch zoom (works even at 1x,
      // the portrait case that previously felt stuck).
      dragging = null;
      img.classList.remove('is-dragging');
      const [a, b] = [...activePointers.values()];
      pinch = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startScale: scale,
        startMidX: (a.x + b.x) / 2,
        startMidY: (a.y + b.y) / 2,
        startTx: tx,
        startTy: ty,
      };
      return;
    }
    if (scale <= 1) return;
    dragging = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTx: tx, startTy: ty };
    img.classList.add('is-dragging');
  });
  img.addEventListener('pointermove', (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && activePointers.size >= 2) {
      const [a, b] = [...activePointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const startScale = pinch.startScale || scale;
      const next = Math.min(5, Math.max(1, startScale * (dist / (pinch.startDist || 1))));
      const prevScale = scale;
      scale = next;
      if (scale === 1) {
        tx = 0;
        ty = 0;
      } else {
        const rect = img.getBoundingClientRect();
        const dx = midX - (rect.left + rect.width / 2);
        const dy = midY - (rect.top + rect.height / 2);
        const k = scale / prevScale;
        tx += dx * (1 - k) + (midX - pinch.startMidX);
        ty += dy * (1 - k) + (midY - pinch.startMidY);
        pinch.startMidX = midX;
        pinch.startMidY = midY;
      }
      applyTransform();
      return;
    }
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    tx = dragging.startTx + (event.clientX - dragging.startX);
    ty = dragging.startTy + (event.clientY - dragging.startY);
    applyTransform();
  });
  const endDrag = (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinch = null;
    if (dragging && event.pointerId !== dragging.pointerId) return;
    dragging = null;
    img.classList.remove('is-dragging');
  };
  img.addEventListener('pointerup', endDrag);
  img.addEventListener('pointercancel', endDrag);

  current = backdrop;
  backdrop._lightboxCleanup = cleanup;
  applyTransform();
  // Move keyboard focus into the dialog for screen-reader and Esc users.
  closeButton.focus();
  return backdrop;
}

export function closeLightbox() {
  if (!current) return;
  const node = current;
  current = null;
  if (typeof node._lightboxCleanup === 'function') node._lightboxCleanup();
  else if (node.parentNode) node.parentNode.removeChild(node);
}
