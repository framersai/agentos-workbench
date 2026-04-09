import assert from 'node:assert/strict';
import test from 'node:test';

import Fastify from 'fastify';

import forgeRoutes, { WORKBENCH_FORGE_MODE_HEADER } from '../src/routes/forge';

test('forge routes expose explicit demo mode metadata across forge, registry, and test-run flows', async () => {
  const app = Fastify();
  await app.register(forgeRoutes, { prefix: '/api/agency' });

  try {
    const forgeResponse = await app.inject({
      method: 'POST',
      url: '/api/agency/forge',
      payload: {
        description: 'A tool that summarizes a JSON payload.',
        parametersSchema: '{"type":"object"}',
      },
    });
    assert.equal(forgeResponse.statusCode, 200);
    assert.equal(forgeResponse.headers[WORKBENCH_FORGE_MODE_HEADER.toLowerCase()], 'demo');

    const forgePayload = forgeResponse.json();
    assert.equal(forgePayload.mode, 'demo');
    assert.equal(forgePayload.status, 'approved');
    assert.ok(forgePayload.tool?.id);

    const toolsResponse = await app.inject({
      method: 'GET',
      url: '/api/agency/forged-tools',
    });
    assert.equal(toolsResponse.statusCode, 200);
    assert.equal(toolsResponse.headers[WORKBENCH_FORGE_MODE_HEADER.toLowerCase()], 'demo');

    const toolsPayload = toolsResponse.json();
    assert.equal(toolsPayload.mode, 'demo');
    assert.ok(Array.isArray(toolsPayload.tools));
    assert.ok(toolsPayload.tools.length > 0);

    const toolId = forgePayload.tool.id;
    const runResponse = await app.inject({
      method: 'POST',
      url: `/api/agency/forged-tools/${encodeURIComponent(toolId)}/run`,
      payload: {
        city: 'San Francisco',
      },
    });
    assert.equal(runResponse.statusCode, 200);
    assert.equal(runResponse.headers[WORKBENCH_FORGE_MODE_HEADER.toLowerCase()], 'demo');

    const runPayload = runResponse.json();
    assert.equal(runPayload.mode, 'demo');
    assert.equal(runPayload.ok, true);
    assert.equal(runPayload.result.ok, true);
  } finally {
    await app.close();
  }
});

test('forge can generate a real CoinGecko-backed price tool implementation', async () => {
  const app = Fastify();
  await app.register(forgeRoutes, { prefix: '/api/agency' });

  try {
    const forgeResponse = await app.inject({
      method: 'POST',
      url: '/api/agency/forge',
      payload: {
        description: 'A tool that gets the current price of BTC from CoinGecko.',
      },
    });

    assert.equal(forgeResponse.statusCode, 200);
    const forgePayload = forgeResponse.json();
    assert.equal(forgePayload.status, 'approved');
    assert.ok(forgePayload.tool?.id);

    const runResponse = await app.inject({
      method: 'POST',
      url: `/api/agency/forged-tools/${encodeURIComponent(forgePayload.tool.id)}/run`,
      payload: {},
    });

    assert.equal(runResponse.statusCode, 200);
    const runPayload = runResponse.json();
    assert.equal(runPayload.ok, true);
    assert.equal(runPayload.result.ok, true);
    assert.equal(runPayload.result.coinId, 'bitcoin');
    assert.equal(runPayload.result.vsCurrency, 'usd');
    assert.equal(runPayload.result.price, 67245.13);
    assert.equal(runPayload.result.source, 'demo-coingecko');
    assert.equal(runPayload.result.asOf, '2026-04-08T00:00:00Z');
  } finally {
    await app.close();
  }
});
