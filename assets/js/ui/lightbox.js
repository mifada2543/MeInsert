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

  const captionText = (caption || '').trim();
  const captionNode = el('span', {
    className: 'lightbox-caption-text',
    textContent: captionText,
  });
  const hintNode = el('span', {
    className: 'lightbox-caption-hint',
    textContent: 'Klik gambar untuk memperbesar/memperkecil · Esc untuk tutup',
  });

  const img = el('img', { src, alt: alt || 'Pratinjau ukuran penuh', decoding: 'async', draggable: 'false' });

  const applyTransform = () => {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    img.classList.toggle('is-zoomed', scale > 1);
  };

  const toggleZoom = () => {
    if (scale > 1) {
      scale = 1;
      tx = 0;
      ty = 0;
    } else {
      scale = 2.4;
    }
    applyTransform();
  };

  const closeButton = el('button', {
    className: 'lightbox-close',
    type: 'button',
    'aria-label': 'Tutup pratinjau',
    title: 'Tutup',
  }, icon('x'));

  const figure = el('figure', { className: 'lightbox-figure' },
    el('div', { className: 'lightbox-stage' }, img),
    el('figcaption', { className: 'lightbox-caption' }, captionNode, captionText ? el('span', { className: 'lightbox-caption-sep', textContent: '·' }) : null, hintNode),
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
    } else if (event.key === 'Tab') {
      // Focus trap: keep tabbing inside the dialog (close button is the only control).
      const focusables = [closeButton];
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
  img.addEventListener('click', (event) => {
    if (dragging) return;
    event.stopPropagation();
    toggleZoom();
  });
  img.addEventListener('dblclick', (event) => {
    event.preventDefault();
    toggleZoom();
  });
  img.addEventListener('wheel', (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 0.87;
    scale = Math.min(4, Math.max(1, scale * factor));
    if (scale === 1) { tx = 0; ty = 0; }
    applyTransform();
  }, { passive: false });
  img.addEventListener('pointerdown', (event) => {
    if (scale <= 1) return;
    dragging = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTx: tx, startTy: ty };
    img.setPointerCapture(event.pointerId);
    img.classList.add('is-dragging');
  });
  img.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    tx = dragging.startTx + (event.clientX - dragging.startX);
    ty = dragging.startTy + (event.clientY - dragging.startY);
    applyTransform();
  });
  const endDrag = (event) => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    dragging = null;
    img.classList.remove('is-dragging');
    // Suppress the click that follows a drag.
    setTimeout(() => { dragging = null; }, 0);
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
