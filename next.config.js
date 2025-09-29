/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    HELIUS_API_KEY: process.env.HELIUS_API_KEY,
  },
}

module.exports = nextConfig

