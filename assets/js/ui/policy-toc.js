/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
export function activeSectionIndex(tops, marker, atEnd = false) {
  if (!tops.length) return -1;
  if (atEnd) return tops.length - 1;
  let active = 0;
  for (let index = 0; index < tops.length; index++) {
    if (tops[index] <= marker) active = index;
    else break;
  }
  return active;
}
export function initPolicyToc() {
  const articles = [...document.querySelectorAll('[data-policy-language]')];
  if (!articles.length) return;
  const groups = articles.map((article) => ({ article,
    sections: [...article.querySelectorAll('.policy-section')],
    links: [...article.querySelectorAll('.policy-toc a')],
  }));
  let frame = 0;
  function update() {
    frame = 0;
    const header = document.querySelector('.site-header');
    const anchorOffset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const marker = Math.min(Math.max(anchorOffset, header?.getBoundingClientRect().bottom || 0) + 20, innerHeight * .35);
    const atEnd = scrollY > 0 && Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2;
    for (const { article, sections, links } of groups) {
      const active = article.hidden ? -1 : activeSectionIndex(sections.map((section) => section.getBoundingClientRect().top), marker, atEnd);
      links.forEach((link, index) => {
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('meinsert:languagechange', schedule);
  // Font loading and text reflow can move headings without a scroll event.
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  const main = document.querySelector('.policy-main');
  if (main) resize?.observe(main);
  document.fonts?.ready.then(schedule);
  update();
}
