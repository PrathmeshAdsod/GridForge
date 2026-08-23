#!/usr/bin/env node
/**
 * GridForge — Automated Vercel Deployment Script
 *
 * Usage:
 *   node deploy.mjs
 *
 * What it does:
 * 1. Deploys demo-store to Vercel
 * 2. Sets environment variables for demo-store
 * 3. Deploys frontend to Vercel
 * 4. Sets environment variables for frontend
 *
 * Requirements:
 *   - vercel CLI installed: npm install -g vercel
 *   - Already logged in: vercel login
 *   - frontend/.env.local filled in
 *   - demo-store/.env.local filled in
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function run(cmd, cwd = __dirname) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function parseEnv(filePath) {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, 'utf-8')
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && value) vars[key] = value
  }
  return vars
}

function setVercelEnvVars(vars, projectDir) {
  for (const [key, value] of Object.entries(vars)) {
    // Skip placeholder values
    if (value.includes('YOUR_') || value.includes('...') || value === 'generate_a_random_secret_here') {
      console.log(`  ⚠ Skipping placeholder: ${key}`)
      continue
    }
    try {
      // Set for all environments (production, preview, development)
      const cmd = `echo "${value}" | vercel env add ${key} production --yes`
      execSync(cmd, { cwd: projectDir, stdio: 'pipe' })
      console.log(`  ✓ ${key}`)
    } catch {
      // Variable might already exist — try to update
      try {
        const cmd = `echo "${value}" | vercel env add ${key} production --force --yes`
        execSync(cmd, { cwd: projectDir, stdio: 'pipe' })
        console.log(`  ↻ ${key} (updated)`)
      } catch {
        console.log(`  ✗ ${key} (failed — set manually in Vercel dashboard)`)
      }
    }
  }
}

async function main() {
  console.log('\n🔧 GridForge Automated Vercel Deployment\n')

  // ── Step 1: Deploy Demo Store ───────────────────────────────
  console.log('\n📦 Step 1: Deploy Demo Store...')
  const demoStoreDir = path.join(__dirname, 'demo-store')

  run('vercel --prod --yes --name gridforge-demo-store', demoStoreDir)

  // Get the demo store URL
  let demoStoreUrl = ''
  try {
    demoStoreUrl = execSync('vercel ls --json 2>/dev/null | head -1', { cwd: demoStoreDir }).toString().trim()
  } catch { /* ignore */ }

  console.log('\n🔑 Step 2: Setting Demo Store environment variables...')
  const demoStoreEnv = parseEnv(path.join(demoStoreDir, '.env.local'))
  setVercelEnvVars(demoStoreEnv, demoStoreDir)

  // ── Step 2: Deploy Frontend ─────────────────────────────────
  console.log('\n📦 Step 3: Deploy Frontend...')
  const frontendDir = path.join(__dirname, 'frontend')

  run('vercel --prod --yes --name gridforge', frontendDir)

  console.log('\n🔑 Step 4: Setting Frontend environment variables...')
  const frontendEnv = parseEnv(path.join(frontendDir, '.env.local'))
  setVercelEnvVars(frontendEnv, frontendDir)

  // ── Done ────────────────────────────────────────────────────
  console.log('\n✅ Deployment complete!\n')
  console.log('Next steps:')
  console.log('  1. Get your Vercel URLs from the dashboard')
  console.log('  2. Update DEMO_STORE_URL in frontend Vercel env vars')
  console.log('  3. Update your Bright Data collector target URL to demo store Vercel URL')
  console.log('  4. Test: visit your frontend URL and click "Live compile"')
  console.log('\nVercel dashboard: https://vercel.com/dashboard\n')
}

main().catch(err => {
  console.error('\n❌ Deployment failed:', err.message)
  process.exit(1)
})
