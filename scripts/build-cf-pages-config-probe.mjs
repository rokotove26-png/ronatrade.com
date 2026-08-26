import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tmp = await mkdtemp(join(tmpdir(), 'rona-cf-pages-config-'));
const result = {
  project: 'rona-trade-public',
  command_completed: false,
  command_status: null,
  config_generated: false,
  form_dedupe_binding_present: false,
  form_dedupe_namespace_id: null,
  mailer_service_binding_present: false,
  mailer_service_name: null,
  auth_error: false,
};

try {
  const p = spawnSync(
    'npx',
    ['--yes', 'wrangler@latest', 'pages', 'download', 'config', 'rona-trade-public', '--force'],
    {
      cwd: tmp,
      env: process.env,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    },
  );

  result.command_completed = !p.error;
  result.command_status = typeof p.status === 'number' ? p.status : null;
  const diagnostic = `${p.stdout || ''}\n${p.stderr || ''}`;
  result.auth_error = /not authenticated|authentication|api token|login|oauth|unauthorized|permission/i.test(diagnostic) && p.status !== 0;

  const files = await readdir(tmp);
  const configName = files.find((name) => /^wrangler\.(?:toml|jsonc?|json)$/i.test(name));
  if (configName) {
    result.config_generated = true;
    const text = await readFile(join(tmp, configName), 'utf8');

    const formBlock = text.match(/(?:binding\s*=\s*["']FORM_DEDUPE["'][\s\S]{0,500}?id\s*=\s*["']([a-f0-9-]{16,})["'])|(?:["']binding["']\s*:\s*["']FORM_DEDUPE["'][\s\S]{0,500}?["']id["']\s*:\s*["']([a-f0-9-]{16,})["'])/i);
    if (formBlock) {
      result.form_dedupe_binding_present = true;
      result.form_dedupe_namespace_id = formBlock[1] || formBlock[2] || null;
    } else if (/FORM_DEDUPE/.test(text)) {
      result.form_dedupe_binding_present = true;
    }

    const mailerBlock = text.match(/(?:binding\s*=\s*["']MAILER["'][\s\S]{0,300}?service\s*=\s*["']([^"']+)["'])|(?:["']binding["']\s*:\s*["']MAILER["'][\s\S]{0,300}?["']service["']\s*:\s*["']([^"']+)["'])/i);
    if (mailerBlock) {
      result.mailer_service_binding_present = true;
      result.mailer_service_name = mailerBlock[1] || mailerBlock[2] || null;
    } else if (/MAILER/.test(text)) {
      result.mailer_service_binding_present = true;
    }
  }
} finally {
  await writeFile('dist/__cf_pages_config_probe.json', JSON.stringify(result));
  await rm(tmp, { recursive: true, force: true });
}
