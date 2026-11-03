// Lantern theme script. Plain ES2022, no build step, loaded with `defer`.
//
// Everything here is progressive enhancement: the variant picker is links, the product
// form posts to /cart/add, the cart icon is a link to /cart. The custom elements below
// take over when they are defined and leave the markup alone when they are not.

// ---- Collection sorting (part 2) ----
document.querySelectorAll('#SortBy').forEach((select) => {
  select.addEventListener('change', () => select.form.requestSubmit());
});

// ---- Helpers ----
const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

function announce(text) {
  const region = document.querySelector('[data-live-region]');
  if (region) region.textContent = text;
}

// Replace every [data-swap] region in `root` with its counterpart in `doc`.
function swapRegions(root, doc) {
  root.querySelectorAll('[data-swap]').forEach((el) => {
    const next = doc.querySelector(`[data-swap="${el.dataset.swap}"]`);
    if (next) el.replaceWith(next);
  });
}

// The two sections the cart changes: the drawer (a static section, id "cart-drawer") and
// the header, whose id comes from its section group and is printed on the <header>.
function cartSections() {
  const header = document.querySelector('[data-header-section]')?.dataset.headerSection;
  return ['cart-drawer', header].filter(Boolean);
}

// Apply the `sections` object a Cart API call returned.
function renderCartSections(sections) {
  if (!sections) return;
  const drawer = document.querySelector('cart-drawer');
  if (sections['cart-drawer'] && drawer) {
    const open = drawer.querySelector('dialog')?.open;
    const next = parse(sections['cart-drawer']).querySelector('cart-drawer');
    drawer.replaceChildren(...next.children);
    if (open) drawer.querySelector('dialog').setAttribute('open', '');
  }
  const headerId = cartSections()[1];
  if (headerId && sections[headerId]) {
    const count = parse(sections[headerId]).querySelector('[data-cart-count]');
    const current = document.querySelector('[data-cart-count]');
    if (count && current) current.replaceWith(count);
  }
}

// ---- <variant-picker>: option links fetch the section for the new selection ----
class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-option-value-id]');
      if (!link || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      this.select(link);
    });
  }

  async select(link) {
    const section = this.closest('[data-section-id]');
    // One value id per option: the clicked one for its option, the current one elsewhere.
    const ids = [...this.querySelectorAll('fieldset')].map((fieldset) => {
      const chosen = fieldset.contains(link) ? link : fieldset.querySelector('a[aria-current="true"]');
      return chosen?.dataset.optionValueId;
    });
    const url = `${section.dataset.productUrl}?option_values=${ids.join(',')}&section_id=${section.dataset.sectionId}`;
    section.setAttribute('aria-busy', 'true');
    try {
      const html = await (await fetch(url)).text();
      const doc = parse(html);
      const next = doc.querySelector('[data-section-id]');
      swapRegions(section, doc);
      const variantId = section.querySelector('[data-swap="variant-id"]')?.value;
      if (variantId) history.replaceState({}, '', `${section.dataset.productUrl}?variant=${variantId}`);
      const media = next?.dataset.featuredMedia;
      if (media && media !== section.dataset.featuredMedia) {
        section.dataset.featuredMedia = media;
        document.getElementById(`media-${media}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      location.href = link.href; // the no-JavaScript path, if the fetch failed
    } finally {
      section.removeAttribute('aria-busy');
    }
  }
}
customElements.define('variant-picker', VariantPicker);

// ---- <product-form>: add to cart over the Cart API, then open the drawer ----
class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
  }

  async submit() {
    const button = this.form.querySelector('[type="submit"]');
    const error = this.querySelector('[data-form-error]');
    const body = new FormData(this.form);
    body.append('sections', cartSections().join(','));
    body.append('sections_url', location.pathname);
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    error.hidden = true;
    error.classList.add('hidden');
    try {
      const response = await fetch(this.dataset.addUrl, { method: 'POST', body, headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) {
        // 422 with a description: "All 3 Indigo / 16" x 16" are in your cart." and the like.
        error.textContent = data.description ?? data.message;
        error.classList.remove('hidden');
        return;
      }
      renderCartSections(data.sections);
      announce(`Added to cart: ${data.product_title}`);
      document.querySelector('cart-drawer')?.open();
    } finally {
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
  }
}
customElements.define('product-form', ProductForm);

// ---- <cart-drawer>: a <dialog> fed by the Cart API's bundled sections ----
class CartDrawer extends HTMLElement {
  connectedCallback() {
    document.querySelectorAll('[data-cart-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
      });
    });
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-drawer-close]')) this.close();
      const step = event.target.closest('[data-quantity-step]');
      if (step) {
        const input = step.parentElement.querySelector('[data-quantity-input]');
        input.value = Math.max(0, Number(input.value) + Number(step.dataset.quantityStep));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (event.target.closest('[data-line-remove]')) this.change(event.target.closest('[data-line]').dataset.line, 0);
    });
    this.addEventListener('change', (event) => {
      const input = event.target.closest('[data-quantity-input]');
      if (input) this.change(input.closest('[data-line]').dataset.line, Number(input.value));
    });
    // Click on the backdrop closes: the dialog itself is the target there, not a child.
    this.addEventListener('click', (event) => {
      if (event.target === this.querySelector('dialog')) this.close();
    });
  }

  open() {
    const dialog = this.querySelector('dialog');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-drawer-close]')?.focus();
  }

  close() {
    this.querySelector('dialog')?.close();
  }

  async change(line, quantity) {
    const dialog = this.querySelector('dialog');
    const error = this.querySelector('[data-drawer-error]');
    dialog.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(this.dataset.changeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line, quantity, sections: cartSections(), sections_url: location.pathname }),
      });
      const data = await response.json();
      if (!response.ok) {
        error.textContent = data.description ?? data.message;
        error.classList.remove('hidden');
        return;
      }
      renderCartSections(data.sections);
      announce(`Cart updated, ${data.item_count} items`);
    } finally {
      this.querySelector('dialog')?.removeAttribute('aria-busy');
    }
  }
}
customElements.define('cart-drawer', CartDrawer);

// ---- <predictive-search>: the header's search dialog, results from /search/suggest ----
class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('#PredictiveResults');
    this.querySelector('[data-search-open]').addEventListener('click', (event) => {
      event.preventDefault();
      this.dialog.showModal();
      this.input.focus();
    });
    this.querySelector('[data-search-close]').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    let timer;
    this.input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.search(), 250);
    });
  }

  async search() {
    const q = this.input.value.trim();
    this.controller?.abort();
    if (q.length < 2) {
      this.results.replaceChildren();
      this.input.setAttribute('aria-expanded', 'false');
      return;
    }
    this.controller = new AbortController();
    const url = `${this.dataset.url}?q=${encodeURIComponent(q)}&section_id=predictive-search&resources[type]=product,collection,article&resources[limit]=4&resources[options][unavailable_products]=last`;
    try {
      const html = await (await fetch(url, { signal: this.controller.signal })).text();
      const section = parse(html).querySelector('#shopify-section-predictive-search');
      this.results.replaceChildren(...section.children);
      this.input.setAttribute('aria-expanded', 'true');
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    }
  }
}
customElements.define('predictive-search', PredictiveSearch);

// ---- Language selector: the localization form submits itself on change ----
document.querySelectorAll('[data-localization-select]').forEach((select) => {
  select.addEventListener('change', () => select.form.requestSubmit());
});
