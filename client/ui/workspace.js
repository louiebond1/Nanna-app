// Viewport-sized presentation only. All original controls keep their callbacks.
import { h, bigButton } from './components.js';

const saved = new Map();
let current = null;
let frame = 0;
let observer = null;

export const view = (id, title, ...nodes) => ({ id, title, nodes: nodes.flat().filter(Boolean) });

export function workspace({ key, title, banner, description, error, groups, actions = [], actionViews }) {
  observer?.disconnect();
  groups = groups.filter(g => g.nodes.length);
  let memory = saved.get(key);
  if (!memory) { memory = { view: groups[0]?.id, pages: {} }; saved.set(key, memory); }
  if (!groups.some(g => g.id === memory.view)) memory.view = groups[0]?.id;
  const root = h('section', { class: 'workspace', 'aria-label': title });
  const menuButton = bigButton('Menu', () => selectView(memory.view === 'menu' ? groups[0]?.id : 'menu'), { 'aria-label': 'Game menu' });
  const top = h('header', { class: 'workspace-header' }, h('h1', {}, title), menuButton);
  const content = h('div', { class: 'workspace-content' });
  const footer = h('div', { class: 'workspace-actions', 'data-fit-view': groups[0]?.id }, actions);
  const select = h('select', { class: 'workspace-view', 'aria-label': 'Game view', onchange: e => selectView(e.target.value) },
    groups.map(g => h('option', { value: g.id, selected: g.id === memory.view }, g.title)));
  const previous = bigButton('‹', () => changePage(-1), { 'aria-label': 'Previous page', 'data-fit-previous': true });
  const next = bigButton('›', () => changePage(1), { 'aria-label': 'Next page', 'data-fit-next': true });
  const number = h('span', { class: 'workspace-page-number', role: 'status' });
  const navigation = h('nav', { class: 'workspace-navigation', 'aria-label': 'Game views and pages' }, select, previous, number, next);
  const store = h('div', { class: 'workspace-source', 'aria-hidden': 'true', inert: true });
  root.append(top);
  if (banner) root.append(banner);
  if (description) root.append(description);
  root.append(content, footer, navigation, store);
  if (error) {
    const dismiss = () => {
      error.dispatchEvent(new Event('dismiss'));
      root.dispatchEvent(new CustomEvent('dismiss-game-error', { bubbles: true }));
    };
    const dialog = h('dialog', { class: 'workspace-error', 'aria-label': 'Please check your move', onclose: dismiss },
      error, bigButton('OK', () => dialog.close(), { primary: true, block: true }));
    root.append(dialog);
    requestAnimationFrame(() => { if (dialog.isConnected && !dialog.open) dialog.showModal(); });
  }
  const pages = new Map();
  const sources = groups.map(g => {
    const source = h('div', { class: 'workspace-page' }, g.nodes);
    store.append(source);
    return { ...g, source, units: null };
  });

  function selectView(id) {
    if (!pages.has(id)) return;
    memory.view = id;
    paint();
    content.focus({ preventScroll: true });
  }
  function changePage(delta) {
    memory.pages[memory.view] = (memory.pages[memory.view] || 0) + delta;
    paint();
    content.focus({ preventScroll: true });
  }
  function paint() {
    const selected = pages.get(memory.view) || [];
    const index = Math.min(Math.max(0, memory.pages[memory.view] || 0), selected.length - 1);
    memory.pages[memory.view] = Math.max(0, index);
    select.value = memory.view;
    menuButton.textContent = memory.view === 'menu' ? 'Back' : 'Menu';
    menuButton.setAttribute('aria-label', memory.view === 'menu' ? 'Back to game' : 'Game menu');
    for (const [id, list] of pages) list.forEach((p, i) => { p.hidden = id !== memory.view || i !== index; });
    previous.disabled = index <= 0;
    next.disabled = index >= selected.length - 1;
    number.textContent = `${index + 1}/${selected.length || 1}`;
    const inactive = !(actionViews || [groups[0]?.id]).includes(memory.view);
    footer.classList.toggle('workspace-actions-muted', inactive);
    footer.inert = inactive;
    footer.setAttribute('aria-hidden', String(inactive));
    root.dataset.view = memory.view;
  }

  function layout() {
    if (!root.isConnected) return;
    // Reserve action space in every view so changing views cannot move the pager.
    footer.hidden = false;
    footer.classList.toggle('workspace-actions-empty', !actions.length);
    const height = Math.max(80, content.clientHeight);
    root.style.setProperty('--page-height', `${height}px`);
    const focused = document.activeElement;
    pages.clear();
    for (const g of sources) {
      if (!g.units) g.units = flowUnits(g.source);
      const list = [];
      let page, shells, count;
      const start = () => {
        page = h('div', { class: 'workspace-page', 'data-fit-view': g.id, 'data-fit-page': list.length });
        content.append(page); list.push(page); shells = new Map(); count = 0;
      };
      start();
      for (const unit of g.units) {
        const append = () => {
          let parent = page;
          for (const ancestor of unit.trail) {
            if (!shells.has(ancestor)) {
              const shell = ancestor.cloneNode(false);
              shell.removeAttribute('id'); shell.removeAttribute('hidden');
              parent.append(shell); shells.set(ancestor, shell);
            }
            parent = shells.get(ancestor);
          }
          parent.append(unit.node);
        };
        append();
        if (page.scrollHeight > height + 1 && count) {
          unit.node.remove();
          // Empty layout shells must not leave gaps on the previous page.
          for (const shell of [...shells.values()].reverse()) if (!shell.childNodes.length) shell.remove();
          start(); append();
        }
        if (unit.node.getBoundingClientRect().height > 0) count++;
      }
      pages.set(g.id, list);
    }
    for (const old of [...content.children]) if (![...pages.values()].flat().includes(old)) old.remove();
    if (focused && focused !== document.body) {
      const page = focused.closest?.('.workspace-page');
      if (page && pages.has(page.dataset.fitView)) {
        memory.view = page.dataset.fitView;
        memory.pages[memory.view] = Number(page.dataset.fitPage);
      }
    }
    paint();
    root.dataset.fitReady = 'true';
    if (focused?.isConnected && focused !== document.body && document.activeElement !== focused) focused.focus({ preventScroll: true });
  }
  content.tabIndex = -1;
  current = { layout };
  observer = new ResizeObserver(fitWorkspace);
  observer.observe(content);
  return root;
}

// Keep meaningful graphics, forms and individual controls intact. Layout-only
// wrappers may split across pages; the original interactive leaves are moved,
// never cloned, so their handlers and local selections stay intact.
function flowUnits(source) {
  const units = [];
  const visit = (node, trail = []) => {
    if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return;
    const atomic = node.matches('button, p, h1, h2, h3, li, form, svg, input, select, label, .card, .ccard, .dice, .wheel, .lettergrid, .word-entry, .board, .map, .face-big, .field, .character-board, .painted-country-card');
    if (atomic || !node.children.length || (node.querySelector(':scope > label') && node.querySelector(':scope > input, :scope > select'))) {
      units.push({ node, trail }); return;
    }
    if (node.matches('details')) {
      const summary = node.querySelector('summary');
      if (summary) units.push({ node: h('h2', {}, summary.textContent), trail });
      for (const child of node.children) if (child !== summary) visit(child, trail);
      return;
    }
    for (const child of node.children) visit(child, [...trail, node]);
  };
  for (const child of source.children) visit(child);
  return units;
}

export function fitWorkspace() {
  cancelAnimationFrame(frame);
  const height = window.visualViewport?.height || window.innerHeight;
  const keyboard = height < window.innerHeight * .75;
  document.body.classList.toggle('keyboard-mode', keyboard);
  if (keyboard && document.activeElement?.matches('input')) document.body.dataset.keyboardTarget = document.activeElement.id;
  document.documentElement.style.setProperty('--viewport-height', `${height}px`);
  frame = requestAnimationFrame(() => current?.layout());
}
window.addEventListener('resize', fitWorkspace);
window.visualViewport?.addEventListener('resize', fitWorkspace);
