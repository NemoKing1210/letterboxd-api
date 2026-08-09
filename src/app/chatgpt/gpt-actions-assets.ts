import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const GPT_ACTIONS_OPENAPI_PATH = '/openapi-gpt-actions.yaml';
export const PRIVACY_PATH = '/privacy';

const OPENAPI_RELATIVE_PATH = join('docs', 'chatgpt-actions.yaml');

export function resolveGptActionsOpenApiPath(cwd: string = process.cwd()): string {
  return join(cwd, OPENAPI_RELATIVE_PATH);
}

export function loadGptActionsOpenApiYaml(cwd: string = process.cwd()): string | null {
  const path = resolveGptActionsOpenApiPath(cwd);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8');
}

export function renderPrivacyHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Letterboxd API — Privacy</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #111; }
    h1 { font-size: 1.5rem; }
    code { font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Privacy notice</h1>
  <p>
    This service syncs publicly available Letterboxd profile data (films, ratings, diary dates,
    and related metadata) into a database you control, and exposes it through a REST API.
  </p>
  <p>
    When you connect a Custom GPT via Actions, ChatGPT calls this API over HTTPS on your behalf.
    Requests are server-to-server; do not put API keys in query strings.
  </p>
  <p>
    Authentication tokens (<code>AUTH_TOKENS</code>) are secrets you configure. The API operator
    (you or your host) is responsible for access control, retention, and deletion of synced data.
  </p>
  <p>
    This project does not sell personal data. Letterboxd remains the source of truth for profile content;
    respect Letterboxd Terms of Service when scraping or sharing data.
  </p>
</body>
</html>`;
}
