# Contributing to EcoTask App

First off, thank you for considering contributing to EcoTask! We welcome contributions from everyone, regardless of experience level.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
  - [Branching](#branching)
  - [Commit Messages](#commit-messages)
  - [Code Style](#code-style)
  - [Testing](#testing)
  - [Linting](#linting)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Code of Conduct

This project and everyone participating in it is governed by the [EcoTask Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check the [existing issues](https://github.com/ecotask-network/EcoTask-app/issues) to see if the problem has already been reported. If it has, add a comment with additional context instead of opening a new issue.

When creating a bug report, use the [Bug Report template](https://github.com/ecotask-network/EcoTask-app/issues/new?template=bug_report.md) and include as many details as possible:

- **Steps to reproduce** — a clear, numbered list
- **Expected behavior** — what you expected to happen
- **Actual behavior** — what actually happened
- **Screenshots / screen recordings** — if applicable
- **Environment** — device model, OS version, app version
- **Network conditions** — WiFi / mobile data / offline

### Suggesting Features

Feature suggestions are tracked as [GitHub issues](https://github.com/ecotask-network/EcoTask-app/issues/new?template=feature_request.md). When suggesting a feature:

- **Use the Feature Request template**
- **Describe the problem** you're trying to solve
- **Explain the solution** you'd like to see
- **Consider alternatives** you've thought about
- **Include mockups** if the feature involves UI changes

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes following the code style guidelines
4. Write or update tests as needed
5. Run linting and tests (`npm run lint && npm test`)
6. Commit using [conventional commits](#commit-messages)
7. Push to your fork (`git push origin feat/my-feature`)
8. Open a Pull Request against the `main` branch using the [PR template](PULL_REQUEST_TEMPLATE.md)

> **Note:** Small changes (typo fixes, minor docs updates) don't need an issue. For anything substantial, please open an issue first to discuss what you'd like to change.

---

## Development Setup

### Prerequisites

- Node.js >= 18
- npm >= 9
- React Native CLI (`npx react-native`)
- Android Studio (for Android development)
- Xcode >= 15 (for iOS development, macOS only)
- A Stellar testnet account (get one at [laboratory.stellar.org](https://laboratory.stellar.org))

### Installation

```bash
git clone https://github.com/ecotask-network/EcoTask-app.git
cd EcoTask-app
npm install

# iOS only — install CocoaPods dependencies
cd ios && pod install && cd ..
```

### Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your own values. See [.env.example](.env.example) for all available variables.

---

## Development Workflow

### Branching

We use a lightweight branching strategy:

| Branch | Purpose |
|--------|---------|
| `main` | Stable, release-ready code |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Maintenance, deps, tooling |
| `docs/*` | Documentation changes |

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`, `perf`

Examples:
```
feat(wallet): add Stellar testnet faucet integration
fix(submit): handle GPS timeout on older Android devices
docs(readme): update API endpoint URLs
```

### Code Style

- **Language:** TypeScript — strict mode enabled
- **Formatting:** ESLint + Prettier (run `npm run lint`)
- **Components:** Functional components with hooks, no class components
- **State management:** Zustand for global state, React state for local
- **Styling:** NativeWind (Tailwind) utility classes
- **Imports:** Group and order: React → third-party → internal → styles

### Testing

```bash
# Run all unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm test -- --coverage
```

- Write unit tests for all new hooks, services, and utilities
- Write integration tests for critical user flows
- Place test files next to the source file with `.test.ts` or `.integration.test.ts` extension

### Linting

```bash
npm run lint
```

The project uses ESLint with `@react-native/eslint-config`. All linting must pass before a PR can be merged.

---

## Project Structure

```
src/
├── screens/         # Full app screens
├── components/      # Reusable UI components
├── navigation/      # React Navigation config
├── hooks/           # Custom React hooks
├── services/        # API, Stellar, IPFS clients
├── store/           # Zustand stores
├── utils/           # Helpers & formatters
└── assets/          # Images, fonts, icons
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Metro bundler errors | `npx react-native start --reset-cache` |
| iOS Pod install fails | `cd ios && pod repo update && pod install` |
| Android build fails | Check `android/gradle.properties` and Java version (JDK 17) |
| Tests not running | Ensure Jest cache is cleared: `npx jest --clearCache` |

---

## Questions?

Open a [discussion](https://github.com/ecotask-network/EcoTask-app/discussions) or reach out to the maintainers. We're happy to help you get started!
