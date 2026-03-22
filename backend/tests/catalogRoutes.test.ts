import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';

test('skills routes expose registry-backed catalog and detail', async () => {
  const { default: skillRoutes } = await import('../src/routes/skills');
  const app = Fastify();
  await app.register(skillRoutes, { prefix: '/api/agentos' });

  try {
    const skillsResponse = await app.inject({ method: 'GET', url: '/api/agentos/skills' });
    assert.equal(skillsResponse.statusCode, 200);
    const skills = skillsResponse.json();
    assert.ok(Array.isArray(skills));
    assert.ok(skills.length >= 30);

    const webSearch = skills.find((skill: { name?: string }) => skill.name === 'web-search');
    assert.ok(webSearch);
    assert.equal(webSearch.displayName, 'web-search');
    assert.equal(typeof webSearch.source, 'string');
    assert.ok(Array.isArray(webSearch.requiresTools));

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/api/agentos/skills/web-search',
    });
    assert.equal(detailResponse.statusCode, 200);
    const detail = detailResponse.json();
    assert.equal(detail.name, 'web-search');
    assert.equal(detail.enabled, false);
    assert.ok(typeof detail.content === 'string');
    assert.ok(detail.content.includes('# Web Search'));
    assert.ok(!detail.content.startsWith('---'));

    const enableResponse = await app.inject({
      method: 'POST',
      url: '/api/agentos/skills/enable',
      payload: { name: 'web-search' },
    });
    assert.equal(enableResponse.statusCode, 200);

    const activeResponse = await app.inject({ method: 'GET', url: '/api/agentos/skills/active' });
    assert.equal(activeResponse.statusCode, 200);
    const active = activeResponse.json();
    assert.ok(Array.isArray(active));
    assert.ok(active.some((skill: { name?: string }) => skill.name === 'web-search'));
  } finally {
    await app.close();
  }
});

test('agentos routes expose registry-backed extensions, tools, and guardrails', async () => {
  const { default: agentosRoutes } = await import('../src/routes/agentos');
  const app = Fastify();
  await app.register(agentosRoutes, { prefix: '/api/agentos' });

  try {
    const extensionsResponse = await app.inject({ method: 'GET', url: '/api/agentos/extensions' });
    assert.equal(extensionsResponse.statusCode, 200);
    const extensions = extensionsResponse.json();
    assert.ok(Array.isArray(extensions));
    assert.ok(extensions.length >= 50);

    const webchat = extensions.find((extension: { package?: string }) =>
      extension.package === '@framers/agentos-ext-channel-webchat'
    );
    assert.ok(webchat);
    assert.equal(webchat.installed, true);
    assert.equal(webchat.category, 'channels');
    assert.ok(Array.isArray(webchat.platforms));
    assert.ok(webchat.platforms.includes('webchat'));

    const installResponse = await app.inject({
      method: 'POST',
      url: '/api/agentos/extensions/install',
      payload: { package: '@framers/agentos-ext-channel-webchat' },
    });
    assert.equal(installResponse.statusCode, 200);
    assert.equal(installResponse.json().installed, true);

    const toolsResponse = await app.inject({ method: 'GET', url: '/api/agentos/extensions/tools' });
    assert.equal(toolsResponse.statusCode, 200);
    const tools = toolsResponse.json();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.some((tool: { id?: string }) => tool.id === 'webchatChannel'));

    const guardrailsResponse = await app.inject({ method: 'GET', url: '/api/agentos/guardrails' });
    assert.equal(guardrailsResponse.statusCode, 200);
    const guardrails = guardrailsResponse.json();
    assert.equal(guardrails.tier, 'balanced');
    assert.equal(guardrails.packs.length, 5);
    assert.ok(guardrails.packs.every((pack: { installed?: boolean }) => pack.installed === true));

    const configureResponse = await app.inject({
      method: 'POST',
      url: '/api/agentos/guardrails/configure',
      payload: {
        tier: 'paranoid',
        packs: {
          piiRedaction: true,
          mlClassifiers: true,
          topicality: true,
          codeSafety: true,
          groundingGuard: true,
        },
      },
    });
    assert.equal(configureResponse.statusCode, 200);

    const updatedGuardrailsResponse = await app.inject({ method: 'GET', url: '/api/agentos/guardrails' });
    assert.equal(updatedGuardrailsResponse.statusCode, 200);
    const updatedGuardrails = updatedGuardrailsResponse.json();
    assert.equal(updatedGuardrails.tier, 'paranoid');
    assert.ok(
      updatedGuardrails.packs.every((pack: { enabled?: boolean }) => pack.enabled === true)
    );
  } finally {
    await app.close();
  }
});
