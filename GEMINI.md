# Single Source of Truth (SSOT): ImiDance Project Guidelines

## Core Development Standards

- All code, variable names, functions, and inline comments must be written in English.
- Administration scripts, build scripts, and PowerShell execution messages must strictly use English.
- Use incremental development: never remove existing functions unless explicitly requested.

## Exclude & Ignore Rules

- Do not analyze, index, or process unwanted directories and hidden files:
  - `**/node_modules/**`
  - `**/.next/**`
  - `**/__pycache__/**`
  - `**/.*` (except `.env.local` when explicitly referenced)
  - `**/dist/**`, `**/build/**`

## Git Workflow & Automation Rules

- All automated sync scripts (`START_syncPush.ps1`, `START_MasterPipeline.ps1`) must handle untracked files gracefully without exiting prematurely.
- Staging must include modified and untracked files (`git add -A`), while strictly respecting `.gitignore`.
- Fallback commit message: `feat: pwsh pipeline, scripts, and workspace sync`.
- Always push to the active branch (`origin/master` or active HEAD).

## Project Stack & Guidelines

- Framework: Next.js (App Router), TypeScript, Tailwind CSS.
- Backend: Supabase (Auth, Database, RLS Policies).
