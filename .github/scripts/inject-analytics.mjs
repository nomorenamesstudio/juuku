// Writes the Umami beacon into site/index.html before it is uploaded.
//
// The website id is not a credential, but this repo is public and MIT, so the tag
// lives in a repository secret (`ANALYTICS_TAG`) rather than in the HTML — the same
// split as the keret page. Nothing here runs locally, and a missing secret only
// means no tracking: the deploy carries on untouched.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'site/index.html';
const HOST = 'https://ramen.nomorenames.studio/script.js';
const DOMAIN = 'juuku.nomorenames.studio';
const MARK = 'data-website-id=';

const raw = (process.env.ANALYTICS_TAG ?? '').trim();
if (!raw) {
  console.log('no ANALYTICS_TAG secret, shipping the page without a beacon');
  process.exit(0);
}

const tag = raw.startsWith('<script')
  ? raw
  : `<script defer src="${HOST}" ${MARK}"${raw}" data-domains="${DOMAIN}" data-do-not-track="true"></script>`;

const html = readFileSync(FILE, 'utf8');
if (html.includes(MARK)) {
  console.log('beacon already in index.html, nothing to do');
  process.exit(0);
}
if (!html.includes('</head>')) {
  console.error('no </head> in ' + FILE + ', refusing to guess where the tag goes');
  process.exit(1);
}

writeFileSync(FILE, html.replace('</head>', tag + '</head>'));
console.log('beacon added to ' + FILE);
