import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  // forbidden(): 403 real en las secciones del panel sin permiso.
  experimental: {
    authInterrupts: true,
    // Fotos del panel: hasta 10 MB cada una (más el resto del formulario).
    serverActions: { bodySizeLimit: '11mb' },
    proxyClientMaxBodySize: '11mb',
  },
};

export default config;
