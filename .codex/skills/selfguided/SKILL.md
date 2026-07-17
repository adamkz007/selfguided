---
name: selfguided
description: Analyze SaaS codebases and, only with owner approval, inspect browser flows to produce application maps, user journey inventories, screenshot-backed guides, a /guides page, and searchable guide indexes. Use for SelfGuided onboarding/help-center generation, static route and feature discovery, approved app navigation, guide planning, and safe documentation generation for web applications.
---

# SelfGuided

## Purpose

Use SelfGuided to transform a SaaS repository and approved product context into safe, owner-reviewed user guidance. Prefer static codebase analysis first; request explicit owner approval before any activity that observes, navigates, captures, or writes generated product content.

## Accepted Inputs

Collect or confirm these inputs before beginning:

- **SaaS repo path:** Local path to the application source code to analyze.
- **App URL or local dev server URL:** URL for approved browser inspection, if allowed.
- **Auth instructions or test account details:** Only use credentials or authenticated sessions after owner approval.
- **Product goals and priority user journeys:** Target users, outcomes, critical flows, and journey priority.
- **Brand/theme constraints:** Tone, visual style, terminology, accessibility expectations, and screenshot treatment.

## Approval Gates

Require explicit owner approval before any of the following:

1. Browser navigation to an app URL, local dev server, admin console, or third-party service.
2. Authenticated sessions, credential use, test-account login, or persistent session reuse.
3. Screenshot capture, screen recording, DOM capture containing user data, or similar visual evidence collection.
4. Writing, modifying, staging, or committing generated guides, guide indexes, `/guides` routes, screenshots, or generated content.

If approval is absent or ambiguous, stop at static analysis and provide a proposed plan plus the exact approval needed.

## Static Codebase Analysis Capabilities

When given a repository path, inspect the codebase without launching the app unless separately approved:

- Identify framework, routing system, entry points, layouts, navigation components, auth boundaries, feature modules, and content systems.
- Build an application map from route files, router configuration, server handlers, menu definitions, sitemap files, tests, stories, and documentation.
- Infer user roles, permissions, onboarding paths, settings areas, billing/account surfaces, dashboards, and primary workflows from source structure and copy.
- Locate existing guide/help-center infrastructure, search/indexing utilities, content schemas, screenshot assets, and style tokens.
- Record confidence levels and distinguish direct evidence from inference.

## Workflow

1. **Scope and safety check:** Confirm inputs, environment type, approvals, and forbidden actions.
2. **Static discovery:** Analyze routes, components, copy, tests, schemas, and existing docs to draft an application map and user journey inventory.
3. **Approval checkpoint:** Ask for owner approval before browser navigation, auth, screenshot capture, or writing generated guide artifacts.
4. **Approved dynamic review:** If approved, use only test/staging/local environments when possible; follow provided auth instructions; avoid destructive actions.
5. **Guide design:** Propose guide topics, audience, page structure, screenshots needed, metadata, and search-index fields.
6. **Content generation checkpoint:** Require approval before writing generated guides or `/guides` implementation files.
7. **Implementation:** Add or update guide pages, screenshot assets, route/page integration, and searchable index according to the app's conventions.
8. **Review package:** Summarize changes, evidence sources, unresolved assumptions, redactions, and validation commands.

## Outputs

SelfGuided may produce these artifacts when approved and supported by the project:

- **Application map:** Routes, screens, navigation hierarchy, feature areas, role/auth boundaries, and source citations.
- **User journey inventory:** Prioritized flows with entry points, prerequisites, success criteria, risks, and evidence.
- **Screenshot-backed guides:** Step-by-step guides with approved screenshots, captions, alt text, redactions, and source mapping.
- **`/guides` route/page:** A route or page integrated into the app using existing framework and design patterns.
- **Searchable guide index:** Structured metadata for titles, descriptions, tags, journeys, roles, routes, screenshots, and search text.

## Safety Boundaries

- Do not mutate production data unless explicitly approved for a specific action.
- Prefer test, staging, seed, demo, or local environments over production.
- Redact secrets, credentials, tokens, private URLs, customer data, personal data, and proprietary analytics from screenshots and generated content.
- Avoid destructive journeys such as billing changes, user deletion, emails, irreversible workflow transitions, and third-party side effects unless explicitly approved.
- Require approval before committing generated content or generated screenshot assets.
- Never include credentials or raw secrets in guide files, screenshots, logs, commits, or PR descriptions.

## Evidence and Documentation Standards

- Cite repository files, routes, and components for every application-map or journey claim when possible.
- Mark claims as `observed`, `source-derived`, or `inferred`.
- Keep generated guide copy aligned with product goals and brand/theme constraints.
- Prefer minimal, reproducible screenshots that show the relevant UI state without unnecessary user data.
- Store guide metadata in the project's existing content system when available; otherwise propose a simple schema before writing files.
