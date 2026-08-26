import { writeFile } from 'node:fs/promises';

const names = [
  'CLOUDFLARE_API_TOKEN',
  'CF_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CF_ACCOUNT_ID',
  'CLOUDFLARE_API_KEY',
  'CF_PAGES',
  'CF_PAGES_BRANCH',
  'CF_PAGES_COMMIT_SHA',
  'CF_PAGES_URL'
];

const probe = Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])]));
await writeFile('dist/__cf_env_probe.json', JSON.stringify(probe));
console.log('Cloudflare build auth presence probe emitted.');
