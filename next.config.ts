import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@duckdb/node-api', 'node-cron'],
}

export default nextConfig
