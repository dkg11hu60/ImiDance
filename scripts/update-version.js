const fs = require('fs')
const path = require('path')

function generateVersion() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const hh = pad(now.getHours())
  const min = pad(now.getMinutes())
  const ss = pad(now.getSeconds())

  return `v${yy}${mm}${dd}.${hh}${min}${ss}`
}

function updateVersion() {
  const version = generateVersion()
  const rootDir = path.resolve(__dirname, '..')

  // 1. Update lib/version.ts
  const versionTsPath = path.join(rootDir, 'lib', 'version.ts')
  const versionTsContent = `// Automatically generated during compilation. Do not edit directly.\nexport const APP_VERSION = '${version}'\n`
  fs.writeFileSync(versionTsPath, versionTsContent, 'utf-8')

  // 2. Update package.json version field
  try {
    const pkgPath = path.join(rootDir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      // npm prefers semver without 'v', so strip leading 'v' for package.json
      pkg.version = version.replace(/^v/, '')
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    }
  } catch (err) {
    console.error('Failed to update package.json version:', err)
  }

  // 3. Remove stale tsconfig.tsbuildinfo and .next/dev cache to prevent TS6053 errors during type check
  try {
    const buildInfoPath = path.join(rootDir, 'tsconfig.tsbuildinfo')
    if (fs.existsSync(buildInfoPath)) {
      fs.unlinkSync(buildInfoPath)
      console.log('[BUILD] Removed stale tsconfig.tsbuildinfo')
    }
    const devTypesPath = path.join(rootDir, '.next', 'dev')
    if (fs.existsSync(devTypesPath)) {
      fs.rmSync(devTypesPath, { recursive: true, force: true })
      console.log('[BUILD] Cleaned .next/dev cache')
    }
  } catch (err) {
    // Non-fatal if cleanup fails
  }

  console.log(`[BUILD] Updated application version to: ${version}`)
  return version
}

// When executed directly from CLI: node scripts/update-version.js
if (require.main === module) {
  updateVersion()
}

module.exports = updateVersion
