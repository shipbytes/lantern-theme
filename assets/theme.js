// Lantern theme script.

// Collection sorting: the select submits its form on change; without JavaScript the
// <noscript> Apply button does the same.
document.querySelectorAll('#SortBy').forEach((select) => {
  select.addEventListener('change', () => select.form.requestSubmit());
});
