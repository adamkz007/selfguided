# SelfGuided

SelfGuided is an owner-gated workflow for turning a SaaS codebase into reviewable help content. It maps the app statically, pauses for owner alignment, optionally records approved browser journeys, drafts screenshot-backed guides, and publishes only guides the owner has approved.

## Run it

```sh
npm install
npm run selfguided -- discover --root /path/to/saas
npm run selfguided -- plan --root /path/to/saas
npm run selfguided -- align --root /path/to/saas --file owner-alignment.json
```

`align` accepts the owner’s JSON response using the audiences and goals listed by `plan`. It writes the approval record and guide plan. Browser navigation, screenshots, credentials, generated guide files, destructive test actions, and production navigation each remain disabled unless explicitly approved there.

```sh
# Preflight an approved browser journey; the Codex browser workflow runs the actual adapter.
npm run selfguided -- navigate --root /path/to/saas --url http://localhost:3000 --journey onboarding

# Draft and review a completed approved trace.
npm run selfguided -- draft --root /path/to/saas --trace trace.json --options guide-options.json
npm run selfguided -- review --root /path/to/saas --guide RUN_ID --decision approved --by owner
npm run selfguided -- publish --root /path/to/saas

# Generate/validate the searchable guide experience.
npm run selfguided -- index --root /path/to/saas
npm run selfguided -- routes --root /path/to/saas
npm run selfguided -- validate --root /path/to/saas
npm run selfguided -- refresh --root /path/to/saas --from HEAD~1
```

The route generator currently targets a Next.js App Router project and refuses to overwrite an existing `/guides` route unless `--overwrite` is explicitly supplied. Its output includes a searchable guide index and individual guide pages with a table of contents, screenshots, related guides, and verification metadata.

## Checks

```sh
npm run guides:check
```

The test suite covers static discovery, browser safety gates, sensitive screenshot handling, the draft/review/publish lifecycle, index validation, staleness tracking, route generation, and CLI discovery.
