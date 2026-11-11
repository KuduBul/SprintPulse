# Deployment Safety

Rules from the project owner. They override any skill, hook or default behaviour.

## Nothing reaches the live site without the owner's command
- The live site is https://sprintpulse-live2.vercel.app (Vercel project `sprintpulse-live2`, which this folder is linked to). It is updated only when the owner explicitly asks.
- Do not push to GitHub unless the owner asks for that push. A push to `main` deploys to the live site automatically, and a push to any other branch creates a Vercel preview deployment.
- Do not run the Vercel CLI, and do not use the `deploy-to-vercel` skill.
- Test changes locally only: `npm run dev`, `npm test`, `npm run test:smoke`.

## Local runs use the dev database
- `.env` holds the production credentials. `.env.local` holds the dev database and overrides `.env` for `npm run dev` and the smoke tests.
- Run Prisma only through `npm run db:migrate`, `npm run db:push` or `npm run db:studio`. A raw `npx prisma ...` reads `.env` and changes production. See `docs/ENVIRONMENTS.md`.

## The live code is on the local `phase-2-retro` branch
- The live site runs the Phase 2 retro code. The local `phase-2-retro` branch is the source of truth; base bug fixes on it.
- `origin/main` on GitHub now holds the Phase 2 retro code (it was brought up to the `phase-2-retro` state). A push to `main` fast-forwards and auto-deploys to the live site. `main` is no longer the old June version.
- The leaked `scripts/set-vercel-env.sh` (formerly in commit `b55cf42`) has been scrubbed from git history via `git filter-repo`, and the production credentials it contained have been rotated. The real `scripts/set-vercel-env.sh` is gitignored; use the tracked `scripts/set-vercel-env.example.sh` template (reads values from the environment, no hardcoded secrets).
- Pre-scrub history is preserved on backup branches (`backup/pre-scrub-*`) in case a rollback is ever needed.
