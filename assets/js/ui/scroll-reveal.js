/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
const REVEAL_ATTR = 'data-reveal';
const DELAY_ATTR = 'data-reveal-delay';
const READY_CLASS = 'js-reveal-ready';
const VISIBLE_CLASS = 'is-visible';
const PROGRESS_CLASS = 'scroll-progress';
const STAGGER_MS = 80;
let initialised = false;
function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function supportsTimeline(value) {
  return typeof CSS !== 'undefined'
    && typeof CSS.supports === 'function'
    && CSS.supports(`animation-timeline: ${value}`);
}
function tagTargets() {
  const seen = new Set();
  function tag(node, delay) {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (!node.hasAttribute(REVEAL_ATTR)) node.setAttribute(REVEAL_ATTR, '');
    const explicit = node.getAttribute(DELAY_ATTR);
    const resolved = explicit !== null ? Number(explicit) || 0 : delay;
    if (explicit === null && resolved) node.setAttribute(DELAY_ATTR, String(resolved));
    node.style.setProperty('--reveal-delay', `${resolved}ms`);
  }
  document.querySelectorAll('.hero-copy > *').forEach((node, index) => tag(node, index * STAGGER_MS));
  document.querySelectorAll('.format-chips').forEach((node) => tag(node, 4 * STAGGER_MS));
  document.querySelectorAll('.mode-cards .mode-card').forEach((node, index) => tag(node, index * STAGGER_MS));
  document.querySelectorAll(`[${REVEAL_ATTR}]`).forEach((node) => tag(node, 0));
  return [...seen];
}
function showElement(node) {
  if (node.classList.contains(VISIBLE_CLASS)) return;
  const usesTransform = !node.classList.contains('mode-card');
  node.style.willChange = usesTransform ? 'opacity, transform' : 'opacity';
  node.classList.add(VISIBLE_CLASS);
  let done = false;
  const clear = () => {
    if (done) return;
    done = true;
    node.style.willChange = '';
    node.removeEventListener('transitionend', clear);
  };
  node.addEventListener('transitionend', clear);
  setTimeout(clear, 800);
}
function initProgress() {
  const bar = document.createElement('div');
  bar.className = PROGRESS_CLASS;
  bar.setAttribute('aria-hidden', 'true');
  document.body?.append(bar);
  if (!bar.isConnected || supportsTimeline('scroll()')) return;
  let ticking = false;
  const update = () => {
    const root = document.documentElement;
    const max = root.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${ratio})`;
    ticking = false;
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  update();
}
export function initScrollReveal() {
  if (initialised || typeof document === 'undefined') return;
  initialised = true;
  if (prefersReducedMotion()) return;
  const targets = tagTargets();
  const cssTimeline = supportsTimeline('view()');
  let observer = null;
  if (!cssTimeline && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target;
        showElement(node);
        observer.unobserve(node);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  }
  document.documentElement.classList.add(READY_CLASS);
  if (observer) {
    targets.forEach((node) => observer.observe(node));
  } else if (!cssTimeline) {
    targets.forEach(showElement);
  }
  initProgress();
}