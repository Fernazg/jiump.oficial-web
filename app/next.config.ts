import type { NextConfig } from 'next';
import { cabecerasFijas } from './src/lib/seguridad/cabeceras';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  // Cabeceras de seguridad en todas las respuestas (la política de contenido la pone proxy.ts).
  headers: async () => [{ source: '/:path*', headers: cabecerasFijas(process.env.NODE_ENV === 'production') }],
  // forbidden(): 403 real en las secciones del panel sin permiso.
  experimental: {
    authInterrupts: true,
    // Fotos del panel: original de hasta 10 MB + sus versiones optimizadas.
    serverActions: { bodySizeLimit: '20mb' },
    proxyClientMaxBodySize: '20mb',
  },
};

export default config;
