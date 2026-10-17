// Exercise the public view selector and pager before using an off-page control.
// This does not invoke app internals, bypass callbacks or change server state.
export function installWorkspaceNavigation(page) {
  const locatorPrototype = Object.getPrototypeOf(page.locator('body'));
  const pagePrototype = Object.getPrototypeOf(page);
  if (locatorPrototype.__workspaceNavigation) return;
  locatorPrototype.__workspaceNavigation = true;
  const originalClick = locatorPrototype.click;
  const originalSelect = locatorPrototype.selectOption;
  const dismissError = async locator => {
    const p = locator.page();
    const dialog = p.locator('dialog.workspace-error[open]');
    if (!await dialog.count()) return;
    const withinDialog = await locator.first().evaluate(e => !!e.closest('dialog.workspace-error')).catch(() => false);
    if (!withinDialog) await originalClick.call(dialog.getByRole('button', { name: 'OK', exact: true }));
  };
  const checkFit = async p => {
    await p.waitForFunction(() => !document.querySelector('.workspace') || document.querySelector('.workspace').dataset.fitReady === 'true');
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const problem = await p.evaluate(() => {
      if (!document.body.classList.contains('workspace-mode')) return null;
      if (document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1) return 'game page needs scrolling';
      const page = document.querySelector('.workspace-content .workspace-page:not([hidden])');
      if (page && page.scrollHeight > page.clientHeight + 1) return `game content overflows: ${page.scrollHeight}/${page.clientHeight}`;
      return null;
    });
    if (problem) throw new Error(problem);
  };
  const reveal = async (locator, attempt = 0) => {
    if (attempt > 8) throw new Error(`Control stayed hidden after using view/pager: ${locator}`);
    await locator.page().evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const target = await locator.elementHandle({ timeout: 5000 });
    if (!target) return;
    const position = await target.evaluate(e => {
      const p = e.closest('.workspace-content .workspace-page');
      const a = e.closest('.workspace-actions');
      return p ? { view: p.dataset.fitView, page: Number(p.dataset.fitPage) } : a ? { view: a.dataset.fitView, page: null } : null;
    });
    if (!position) return;
    const p = locator.page();
    if (await p.locator('.workspace-view').inputValue() !== position.view) await originalSelect.call(p.locator('.workspace-view'), position.view);
    if (position.page === null) return;
    for (let i = 0; i < 100; i++) {
      const active = await p.locator('.workspace-content .workspace-page:visible').getAttribute('data-fit-page');
      if (Number(active) === position.page) {
        await p.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        if (!await locator.isVisible()) {
          const current = await locator.elementHandle({ timeout: 5000 });
          if (current) return reveal(locator, attempt + 1);
        }
        return;
      }
      await originalClick.call(p.locator(Number(active) < position.page ? '[data-fit-next]' : '[data-fit-previous]'));
    }
    throw new Error('Control could not be reached through the game pager');
  };
  for (const method of ['click', 'fill', 'selectOption']) {
    const original = locatorPrototype[method];
    locatorPrototype[method] = async function(...args) {
      await dismissError(this); await reveal(this);
      const result = await original.apply(this, args);
      if (method === 'click') await checkFit(this.page());
      return result;
    };
    const originalPage = pagePrototype[method];
    pagePrototype[method] = async function(selector, ...args) {
      await dismissError(this.locator(selector).first());
      await reveal(this.locator(selector).first());
      const result = await originalPage.call(this, selector, ...args);
      if (method === 'click') await checkFit(this);
      return result;
    };
  }
  const originalWait = pagePrototype.waitForSelector;
  pagePrototype.waitForSelector = async function(selector, options = {}) {
    if (options.state === 'hidden' || options.state === 'detached') return originalWait.call(this, selector, options);
    await originalWait.call(this, selector, { ...options, state: 'attached' });
    await dismissError(this.locator(selector).first());
    await reveal(this.locator(selector).first());
    return originalWait.call(this, selector, options);
  };
}
