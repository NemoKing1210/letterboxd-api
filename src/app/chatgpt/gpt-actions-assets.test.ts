import { describe, expect, it } from 'vitest';
import {
  loadGptActionsOpenApiYaml,
  renderPrivacyHtml,
  resolveGptActionsOpenApiPath,
} from './gpt-actions-assets';

describe('gpt-actions-assets', () => {
  it('resolves schema path under docs/', () => {
    expect(resolveGptActionsOpenApiPath('/repo')).toMatch(/docs[/\\]chatgpt-actions\.yaml$/);
  });

  it('loads curated OpenAPI yaml from the repo', () => {
    const yaml = loadGptActionsOpenApiYaml();
    expect(yaml).not.toBeNull();
    expect(yaml).toContain('operationId: getRecommendations');
    expect(yaml).toContain('ApiKeyAuth');
  });

  it('renders a privacy HTML page', () => {
    const html = renderPrivacyHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Privacy notice');
    expect(html).toContain('Custom GPT');
  });
});
