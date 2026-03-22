# Trip Planning Roadmap

## Goal

Push Wanderplan from a feature-rich trip planner into a shared travel operating system that helps users decide, not just record.

## Product North Star

Each area should answer one job:
- `Overview` resolves uncertainty
- `Itinerary` resolves timing
- `Bookings` resolves commitments
- `Budget` resolves spend
- `Todo` resolves follow-through
- `Voting` resolves decisions
- `Cities` resolves context
- `Packing` resolves readiness
- `WanderMap` resolves place
- `Wrap-Up` resolves memory

## Design Principles

- Reduce tab switching whenever possible.
- Turn passive data into a decision.
- Surface the next best action.
- Keep the spreadsheet/Notion editing feel intact.
- Preserve trust: AI-generated content must stay editable, attributable, and reversible.

## Tool Fit Assumptions

- `Gemini 3 Flash`: best for fast, bounded UI work, copy polish, and isolated feature patches.
- `Gemini 3.1 Pro`: best for multi-file implementation, state updates, data shaping, and testable logic changes.
- `GPT 5.4 mini`: best for lightweight feature patches, copy cleanup, and small UX edits.
- `GPT 5.2 Codex`: best for implementation-heavy work that still stays within a contained codepath.
- `Claude Code Sonnet 4.6`: best for architecture-heavy refactors and large ambiguous workflows.
- `Antigravity`: best for orchestration, integration, QA, and end-to-end delivery across multiple surfaces.

Rule of thumb:
- `Gemini 3 Flash` for low-risk, local, mostly visual or text-heavy work.
- `Gemini 3.1 Pro` for medium-complexity product logic and multi-component updates.
- `GPT 5.4 mini` for fast UI cleanup and small, bounded changes.
- `GPT 5.2 Codex` for deeper coding tasks with a defined write scope.
- `Claude Code Sonnet 4.6` for broad or ambiguous systems work.
- `Antigravity` for the highest-complexity work where implementation, QA, and coordination all matter.

## 15 Ideas

| # | Idea | Complexity | Best fit | Also viable | Why |
|---|---|---|---|---|---|
| 1 | Trip Health Summary Card | Low | `Gemini 3.1 Pro` | `GPT 5.2 Codex` | Aggregates readiness, overdue work, budget burn, and next booking into one view. |
| 2 | Budget Forecast Alerts | Low | `Gemini 3 Flash` | `GPT 5.4 mini` | Mostly alert logic, badges, and lightweight surface updates. |
| 3 | Receipt-to-Split Polish | Low | `GPT 5.4 mini` | `Gemini 3 Flash` | Bounded modal/table cleanup around an existing workflow. |
| 4 | Trip Change Digest | Low | `GPT 5.4 mini` | `Gemini 3 Flash` | Diff summary plus compact presentation layer. |
| 5 | Template Library For Common Trips | Low | `Gemini 3 Flash` | `GPT 5.4 mini` | Content packaging and starter-trip generation. |
| 6 | Gap Finder For Itinerary | Medium | `Gemini 3.1 Pro` | `GPT 5.2 Codex` | Cross-references schedule gaps, location, weather, and budget. |
| 7 | Context-Aware Packing Suggestions | Medium | `GPT 5.2 Codex` | `Gemini 3.1 Pro` | Rule engine plus trustable one-tap add flows. |
| 8 | Discovery Map Clustering | Medium | `Antigravity` | `Claude Code Sonnet 4.6` | Spatial reasoning, route grouping, and map UX coordination. |
| 9 | Notion / Spreadsheet Import-Export | Medium | `GPT 5.2 Codex` | `Gemini 3.1 Pro` | Schema conversion, validation, and data-loss safeguards. |
| 10 | Voting To Action Pipeline | High | `Antigravity` | `Claude Code Sonnet 4.6` | State transitions from idea to itinerary, booking, budget, or task. |
| 11 | Co-traveler Presence Dots | Medium | `Gemini 3.1 Pro` | `GPT 5.2 Codex` | Real-time profile awareness and small collaborative presence cues. |
| 12 | Booking Confirmation Parser | Medium | `GPT 5.2 Codex` | `Gemini 3.1 Pro` | Extraction pipeline plus mapping to booking fields and validation. |
| 13 | Weather Disruption Playbooks | Medium | `Claude Code Sonnet 4.6` | `Antigravity` | Cross-tab suggestions when weather changes affect plan, packing, or budget. |
| 14 | Readiness-Based Wrap-Up Generator | Low | `Gemini 3 Flash` | `GPT 5.4 mini` | Mostly summary copy, memory surfacing, and lightweight presentation. |
| 15 | Universal Trip Inbox | High | `Antigravity` | `Claude Code Sonnet 4.6` | Unifies receipts, ideas, confirmations, and follow-ups into one triage queue. |

## Agent Fit Summary

Use this as the quick delegation map:

- `Gemini 3 Flash`
  - Trip Change Digest
  - Budget Forecast Alerts
  - Receipt-to-Split Polish
  - Template Library For Common Trips
  - Readiness-Based Wrap-Up Generator

- `Gemini 3.1 Pro`
  - Trip Health Summary Card
  - Gap Finder For Itinerary
  - Context-Aware Packing Suggestions
  - Notion / Spreadsheet Import-Export
  - Co-traveler Presence Dots
  - Booking Confirmation Parser

- `GPT 5.4 mini`
  - Budget Forecast Alerts
  - Receipt-to-Split Polish
  - Trip Change Digest
  - Template Library For Common Trips
  - Readiness-Based Wrap-Up Generator

- `GPT 5.2 Codex`
  - Trip Health Summary Card
  - Gap Finder For Itinerary
  - Context-Aware Packing Suggestions
  - Notion / Spreadsheet Import-Export
  - Co-traveler Presence Dots
  - Booking Confirmation Parser

- `Claude Code Sonnet 4.6`
  - Discovery Map Clustering
  - Voting To Action Pipeline
  - Weather Disruption Playbooks
  - Universal Trip Inbox

- `Antigravity`
  - Discovery Map Clustering
  - Voting To Action Pipeline
  - Weather Disruption Playbooks
  - Universal Trip Inbox

## Recommended Build Order

If the goal is optimum usage, ship in this order:

1. Trip Health Summary Card
2. Budget Forecast Alerts
3. Gap Finder For Itinerary
4. Context-Aware Packing Suggestions
5. Receipt-to-Split Polish
6. Trip Change Digest
7. Template Library For Common Trips
8. Co-traveler Presence Dots
9. Booking Confirmation Parser
10. Readiness-Based Wrap-Up Generator
11. Notion / Spreadsheet Import-Export
12. Discovery Map Clustering
13. Weather Disruption Playbooks
14. Universal Trip Inbox
15. Voting To Action Pipeline

The first five create immediate daily value. The last four are the biggest step-function upgrades, but they need more schema and UX hardening.
