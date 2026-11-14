import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  // forbidden(): 403 real en las secciones del panel sin permiso.
  experimental: {
    authInterrupts: true,
    // Fotos del panel: original de hasta 10 MB + sus versiones optimizadas.
    serverActions: { bodySizeLimit: '20mb' },
    proxyClientMaxBodySize: '20mb',
  },
};

export default config;
