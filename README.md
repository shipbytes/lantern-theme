# Lantern

A Shopify theme built from scratch for the shipbytes.dev series *Build a Shopify theme from scratch, with Liquid*. One commit per part.

- Liquid, JSON templates, section groups, theme blocks
- Tailwind CSS compiled to a static stylesheet (`npm run build`), theme settings mapped to CSS variables
- No build step required to run the theme: `assets/theme.css` is committed

```
npm install
npm run watch            # rebuild assets/theme.css as Liquid files change
shopify theme dev        # local preview against your development store
shopify theme check
```
