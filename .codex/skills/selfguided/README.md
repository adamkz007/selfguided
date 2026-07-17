# SelfGuided Skill

SelfGuided is a Codex skill definition for analyzing SaaS applications and producing safe, owner-approved product guidance.

## What It Does

SelfGuided supports:

- Static codebase analysis of SaaS repositories.
- Application maps that describe routes, screens, feature areas, navigation, and auth boundaries.
- User journey inventories tied to product goals and priority workflows.
- Screenshot-backed guides, when screenshot capture is explicitly approved.
- A `/guides` route or page, when content generation and repository mutation are explicitly approved.
- Searchable guide indexes with structured metadata.

## Required Approvals

The skill requires owner approval before:

1. Browser navigation to an app, local dev server, admin console, or third-party service.
2. Authenticated sessions or use of test account details.
3. Screenshot capture, screen recording, or visual evidence collection.
4. Writing generated guides, screenshots, `/guides` pages, indexes, or other generated content.
5. Committing generated guide content.

Without approval, SelfGuided should limit work to static analysis and planning.

## Accepted Inputs

SelfGuided accepts the following inputs:

- `repoPath`: Local SaaS repository path.
- `appUrl`: App URL or local dev server URL, if browser navigation is approved.
- `auth`: Auth instructions or test account details, if authenticated access is approved.
- `productGoals`: Product goals, target audiences, and desired outcomes.
- `priorityJourneys`: Critical user journeys to document first.
- `brandTheme`: Brand, tone, terminology, theme, and accessibility constraints.
- `approvals`: Explicit approvals for browser navigation, auth, screenshots, writing generated content, production mutation, and committing generated content.

## Outputs

Expected outputs include:

- Application map.
- User journey inventory.
- Screenshot-backed guides.
- `/guides` route/page.
- Searchable guide index.

Each output should record evidence, confidence, and unresolved assumptions where applicable.

## Safety Boundaries

- Do not mutate production data unless the owner explicitly approves the specific action.
- Prefer test, staging, demo, seed, or local environments.
- Redact secrets, tokens, credentials, customer data, user data, private URLs, and sensitive business data from screenshots.
- Avoid destructive or side-effecting flows unless explicitly approved.
- Require owner approval before committing generated content.
