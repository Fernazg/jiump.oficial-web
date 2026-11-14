import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  // forbidden(): 403 real en las secciones del panel sin permiso.
  experimental: { authInterrupts: true },
};

export default config;
