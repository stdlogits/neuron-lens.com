# Security Policy

This policy covers neuron-lens.com: the static site this repository builds, its response headers
(`public/_headers`), and the catalog and media packs it serves from `data.neuron-lens.com`. The analysis behind the
catalog and its Hub release belong to [neuron-lens](https://github.com/stdlogits/neuron-lens), and the
shared design pieces belong to [Ledger](https://github.com/stdlogits/ledger).

## Reporting a vulnerability

Please report security issues privately through a
[private security advisory](https://github.com/stdlogits/neuron-lens.com/security/advisories/new),
not in a public issue.

Please include the address where it happens (every view has one, such as
`https://neuron-lens.com/qwen3-8b/L8/n344`), what you did and what you saw, and your browser. If you
tested a local build rather than the deployed site, say so: the dev server sends none of the
production headers.

A wrong label, a bad translation, or an image or sound with the wrong credit is not a security issue.
Please use the [issue forms](https://github.com/stdlogits/neuron-lens.com/issues/new/choose) for
those.

## Supported versions

Only the build deployed at neuron-lens.com gets fixes.

## What the site does

- No accounts, no server code, and no cookies. The browser's local storage keeps two preferences,
  the theme and whether to show translations, and nothing else.
- Catalog text (labels, example contexts, translations, captions) is always rendered as text, never
  as HTML.
- Each image and sound is cut from a media pack on this origin by a range request and shown from a
  `blob:` URL. The CSP allows scripts only from this origin and Cloudflare Web Analytics' beacon, and
  forbids framing.
- Cloudflare Web Analytics counts visits without cookies.
