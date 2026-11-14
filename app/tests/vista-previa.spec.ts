import { expect, test } from '@playwright/test';
import { vistaPreviaActiva } from '../src/lib/vista-previa';

// La vista previa local solo se activa con las tres condiciones a la vez.
test.describe('vista previa local', () => {
  const local = { NODE_ENV: 'development', JIUMP_VISTA_PREVIA: '1', SUPABASE_URL: 'http://127.0.0.1:54321' };

  test('se activa solo en desarrollo, con la variable y con Supabase local', () => {
    expect(vistaPreviaActiva(local)).toBe(true);
    expect(vistaPreviaActiva({ ...local, SUPABASE_URL: 'http://localhost:54321' })).toBe(true);
  });

  test('nunca se activa en producción, sin la variable o con un Supabase que no es local', () => {
    expect(vistaPreviaActiva({ ...local, NODE_ENV: 'production' })).toBe(false);
    expect(vistaPreviaActiva({ ...local, NODE_ENV: undefined })).toBe(false);
    expect(vistaPreviaActiva({ ...local, JIUMP_VISTA_PREVIA: undefined })).toBe(false);
    expect(vistaPreviaActiva({ ...local, JIUMP_VISTA_PREVIA: 'true' })).toBe(false);
    expect(vistaPreviaActiva({ ...local, SUPABASE_URL: 'https://abcd.supabase.co' })).toBe(false);
    expect(vistaPreviaActiva({ ...local, SUPABASE_URL: 'http://127.0.0.1.evil.com:54321' })).toBe(false);
    expect(vistaPreviaActiva({ ...local, SUPABASE_URL: undefined })).toBe(false);
  });
});
