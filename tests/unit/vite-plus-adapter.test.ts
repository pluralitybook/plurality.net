import { expect, test, vi } from 'vite-plus/test';
import type { ConfigEnv, Plugin } from 'vite';
import path from 'node:path';
import type * as NodeChildProcess from 'node:child_process';
import viteConfig from '../../vite.config';
import {
  buildAstroSite,
  createAstroBuildBridge,
  createAstroDevProxy,
  isAstroDevCommand,
  runPagefind,
  startAstroDevServer,
} from '../../src/lib/vitePlusAdapter';

const execFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeChildProcess>();
  return { ...actual, execFileSync: execFileSyncMock };
});

async function resolvePluginConfig(plugin: Plugin, environment: ConfigEnv): Promise<unknown> {
  if (typeof plugin.config !== 'function') {
    throw new Error('Expected a Vite config hook');
  }
  return Reflect.apply(plugin.config, undefined, [{}, environment]);
}

test('only real development activates the Astro dev bridge', () => {
  expect(isAstroDevCommand({ command: 'serve', mode: 'development' })).toBe(true);
  expect(isAstroDevCommand({ command: 'serve', mode: 'test' })).toBe(false);
  expect(
    isAstroDevCommand({
      command: 'serve',
      mode: 'production',
      isPreview: true,
    })
  ).toBe(false);
  expect(isAstroDevCommand({ command: 'build', mode: 'production' })).toBe(false);
});

test('direct vp dev uses the site port for local Worker probing', () => {
  expect(viteConfig.server).toMatchObject({
    host: '127.0.0.1',
    port: 4321,
  });
});

test('Astro dev proxy preserves HTTP and WebSocket forwarding', async () => {
  const plugin = createAstroDevProxy({
    startAstro: async () => ({
      address: { port: 8787 },
      stop: async () => {},
    }),
  });
  const config = (await resolvePluginConfig(plugin, {
    command: 'serve',
    mode: 'development',
    isPreview: false,
  } as ConfigEnv)) as {
    server: {
      hmr: boolean;
      proxy: Record<string, { target: string; ws: boolean }>;
    };
  };

  expect(config.server.hmr).toBe(false);
  expect(config.server.proxy['/']).toMatchObject({
    target: 'http://127.0.0.1:8787',
    ws: true,
  });
});

test('Astro dev proxy is a no-op outside real dev commands', async () => {
  const plugin = createAstroDevProxy({
    startAstro: async () => {
      throw new Error('Astro dev server should not start for this command');
    },
  });

  expect(
    await resolvePluginConfig(plugin, {
      command: 'build',
      mode: 'production',
      isPreview: false,
    } as ConfigEnv)
  ).toBeUndefined();
});

test("Astro dev proxy stops the proxied server when Vite+'s server closes", async () => {
  let stopped = false;
  const plugin = createAstroDevProxy({
    startAstro: async () => ({
      address: { port: 8787 },
      stop: async () => {
        stopped = true;
      },
    }),
  });
  await resolvePluginConfig(plugin, {
    command: 'serve',
    mode: 'development',
    isPreview: false,
  } as ConfigEnv);

  const closeHandlers: Array<() => void> = [];
  const httpServer = {
    once: (event: string, handler: () => void) => {
      if (event === 'close') closeHandlers.push(handler);
    },
  };
  if (typeof plugin.configureServer !== 'function') {
    throw new Error('Expected a configureServer hook');
  }
  Reflect.apply(plugin.configureServer, undefined, [{ httpServer }]);
  for (const handler of closeHandlers) handler();
  await Promise.resolve();

  expect(stopped).toBe(true);
});

test('Astro build bridge runs Astro then Pagefind and marks every environment built', async () => {
  const calls: string[] = [];
  const plugin = createAstroBuildBridge({
    buildAstro: async () => {
      calls.push('astro');
    },
    runPagefind: async () => {
      calls.push('pagefind');
    },
  });
  const config = (await resolvePluginConfig(plugin, {
    command: 'build',
    mode: 'production',
    isPreview: false,
  } as ConfigEnv)) as {
    builder: {
      buildApp(builder: { environments: Record<string, { isBuilt: boolean }> }): Promise<void>;
    };
  };
  const environments = {
    client: { isBuilt: false },
    prerender: { isBuilt: false },
  };

  await config.builder.buildApp({ environments });

  expect(calls).toEqual(['astro', 'pagefind']);
  expect(Object.values(environments).every((environment) => environment.isBuilt)).toBe(true);
});

test('Astro build bridge marks environments built when Pagefind runs synchronously', async () => {
  const calls: string[] = [];
  const plugin = createAstroBuildBridge({
    buildAstro: async () => {
      calls.push('astro');
    },
    runPagefind: () => {
      calls.push('pagefind');
    },
  });
  const config = (await resolvePluginConfig(plugin, {
    command: 'build',
    mode: 'production',
    isPreview: false,
  } as ConfigEnv)) as {
    builder: {
      buildApp(builder: { environments: Record<string, { isBuilt: boolean }> }): Promise<void>;
    };
  };
  const environments = { client: { isBuilt: false } };

  await config.builder.buildApp({ environments });

  expect(calls).toEqual(['astro', 'pagefind']);
  expect(environments.client.isBuilt).toBe(true);
});

test('Astro build bridge is inactive for non-build Vite commands', async () => {
  const plugin = createAstroBuildBridge({
    buildAstro: async () => {},
    runPagefind: async () => {},
  });

  expect(
    await resolvePluginConfig(plugin, {
      command: 'serve',
      mode: 'development',
      isPreview: false,
    } as ConfigEnv)
  ).toBeUndefined();
});

test('Astro build bridge propagates a failing Astro build without running Pagefind', async () => {
  const calls: string[] = [];
  const plugin = createAstroBuildBridge({
    buildAstro: async () => {
      calls.push('astro');
      throw new Error('Astro build failed');
    },
    runPagefind: async () => {
      calls.push('pagefind');
    },
  });
  const config = (await resolvePluginConfig(plugin, {
    command: 'build',
    mode: 'production',
    isPreview: false,
  } as ConfigEnv)) as {
    builder: {
      buildApp(builder: { environments: Record<string, { isBuilt: boolean }> }): Promise<void>;
    };
  };
  const environments = { client: { isBuilt: false } };

  await expect(config.builder.buildApp({ environments })).rejects.toThrow('Astro build failed');
  expect(calls).toEqual(['astro']);
  expect(environments.client.isBuilt).toBe(false);
});

test('runPagefind indexes the given directory via the injected executor', () => {
  const calls: string[] = [];
  runPagefind('/tmp/example-dist', (cwd) => {
    calls.push(cwd);
  });

  expect(calls).toEqual(['/tmp/example-dist']);
});

test('runPagefind defaults to the project root when no directory is given', () => {
  const calls: string[] = [];
  runPagefind(undefined, (cwd) => {
    calls.push(cwd);
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatch(/plurality\.net\/?$/);
});

test("runPagefind's default executor runs the local pagefind bin directly", () => {
  execFileSyncMock.mockClear();
  runPagefind('/tmp/example-dist');

  expect(execFileSyncMock).toHaveBeenCalledWith(
    path.join('/tmp/example-dist', 'node_modules', '.bin', 'pagefind'),
    ['--site', 'dist'],
    {
      cwd: '/tmp/example-dist',
      stdio: 'inherit',
    }
  );
});

test("startAstroDevServer starts Astro's dev server via the injected dev function", async () => {
  const server = await startAstroDevServer(async () => ({
    address: { port: 4123 },
    stop: async () => {},
  }));

  expect(server.address.port).toBe(4123);
});

test('buildAstroSite runs the injected Astro build function', async () => {
  let called = false;
  await buildAstroSite(async () => {
    called = true;
  });

  expect(called).toBe(true);
});
