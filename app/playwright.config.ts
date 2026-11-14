import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas del sitio contra Supabase LOCAL (ver tests/README en app/README.md).
 * Antes: `npm run build`. Playwright levanta `next start` en el puerto 3100.
 */
export default defineConfig({
  testDir: './tests',
  globalTeardown: './tests/limpieza-global.ts',
  workers: 1, // algunas pruebas cambian datos compartidos (mantenimiento, borradores)
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'off',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@celular/ },
    { name: 'celular', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }, grep: /@celular/ },
  ],
  webServer: {
    command: 'npx next start -p 3100',
    // Se activa la vista previa A PROPÓSITO: en un build de producción no debe tener efecto.
    env: { JIUMP_VISTA_PREVIA: '1' },
    url: 'http://localhost:3100/articulos',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
