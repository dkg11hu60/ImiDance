/** @type {import('next').NextConfig} */
const updateVersion = require('./scripts/update-version')

// Auto-bump version on build
if (process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'build') {
  updateVersion()
}

const nextConfig = {}

module.exports = nextConfig
