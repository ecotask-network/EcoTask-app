<div align="center">

# 📱 ecotask-app

**The EcoTask mobile dApp — browse tasks, submit proof, and earn rewards.**

_A React Native application that puts climate-action income in the hands of communities across the developing world._

[![Build](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![React Native](https://img.shields.io/badge/React%20Native-0.73-61DAFB?logo=react)](https://reactnative.dev)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-7B68EE?logo=stellar)](https://stellar.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-v0.3.0--alpha-blue)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

</div>

## Table of Contents

- [🌍 Overview](#-overview)
- [🏗️ Architecture](#️-architecture)
- [✨ Features](#-features)
- [🏗️ Tech Stack](#️-tech-stack)
- [📦 Data Model](#-data-model)
- [🧠 State Management](#-state-management)
- [📁 Folder Structure](#-folder-structure)
- [🚀 Getting Started](#-getting-started)
- [🧪 Testing](#-testing)
- [📲 App Flow & Key Workflows](#-app-flow--key-workflows)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📬 Contact](#-contact)
- [📄 License](#-license)

---

## 🌍 Overview

`ecotask-app` is the primary user-facing interface of the EcoTask platform. Built with React Native for cross-platform support (iOS & Android), it enables users in developing regions to:

- 🗺️ Discover available climate-action tasks nearby or globally
- 📸 Submit photo and GPS-based proof of completed work
- 💰 Receive ECO tokens or USDC stablecoins directly to their Stellar wallet
- 📊 Track their environmental impact and earnings over time

The app is designed with **low-bandwidth environments** in mind — optimized for 3G connections, older Android devices, and users who may be first-time smartphone owners.

---

## ✨ Features

| Feature                      | Status | Description                                                                    |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ |
| 🔐 **Wallet Integration**    | ✅     | Connect via Freighter, Lobstr (SEP-7), create a testnet wallet, or import an existing one |
| 🗂️ **Task Browser**          | ✅     | Filter by type, search, sort by distance/reward/difficulty, adjustable radius  |
| 📸 **Proof Submission**      | ✅     | Real camera capture with GPS metadata via Vision Camera                        |
| 🔑 **Wallet Authentication** | ✅     | Sign challenges with your Stellar wallet (Freighter or in-app) to authenticate |
| 💸 **Instant Rewards**       | ✅     | Receive ECO tokens after task verification                                     |
| 📈 **Impact Dashboard**      | ✅     | Track trees planted, plastic collected, CO₂ offset per task type               |
| 📊 **Earnings Analytics**    | ✅     | Total earnings, task-type breakdown and 4-week trend chart                     |
| 💰 **Transaction History**   | ✅     | View recent Stellar payments on the wallet screen                              |
| 💸 **Send Tokens**           | ✅     | Sign and submit XLM/ECO payments from in-app wallets                           |
| 🔥 **Streak Tracking**       | ✅     | Consecutive-day streaks with milestone progress (7/14/30/60/100)               |
| 🏅 **Achievements**          | ✅     | Eco-badges unlocked by trees, waste and CO₂ milestones                         |
| 👤 **Profile Management**    | ✅     | Edit name and bio, view impact stats                                           |
| 🌐 **Multi-language**        | 🔜     | Designed for localisation (English, Swahili, French, Portuguese)               |
| 📶 **Offline-first**         | ✅     | Queue submissions when offline, sync when connected, cache the task feed       |
| 🔔 **Push Notifications**    | ✅     | Task reminders, reward confirmations, streak nudges                            |
| 🗄️ **Decentralized Storage** | ✅     | IPFS pinning of proof photos and metadata, wired into submissions              |

---

## 🏗️ Tech Stack

| Layer      | Technology                   | Why                                             |
| ---------- | ---------------------------- | ----------------------------------------------- |
| Framework  | React Native 0.73            | Cross-platform iOS & Android from one codebase  |
| Language   | TypeScript 5.3 (strict)      | Type safety across the entire codebase          |
| Wallet     | Stellar SDK                  | Direct blockchain interaction via Horizon API   |
| State      | Zustand + MMKV               | Lightweight state with persistent local storage |
| Navigation | React Navigation v6          | Bottom tabs + nested stack navigators           |
| Camera     | React Native Vision Camera 3 | High-quality photo capture with GPS metadata    |
| API        | Axios                        | REST client with auth interceptors              |
| Styling    | NativeWind (Tailwind)        | Consistent, responsive UI                       |
| Testing    | Jest + React Test Renderer   | Unit, component, and integration tests          |

---

## 📁 Folder Structure

```
ecotask-app/
├── src/
│   ├── screens/                  # App screens (10 screens)
│   │   ├── HomeScreen.tsx        # Dashboard with impact, earnings & streak
│   │   ├── TaskListScreen.tsx    # Browse, search, sort & filter tasks by type/radius
│   │   ├── TaskDetailScreen.tsx  # Task info with difficulty & time
│   │   ├── SubmitProofScreen.tsx # Real camera + GPS proof submission
│   │   ├── WalletScreen.tsx      # Balance, history, send & disconnect
│   │   ├── SendTokensScreen.tsx  # Sign & send XLM/ECO payments
│   │   ├── OnboardingScreen.tsx  # Wallet connection & auth
│   │   ├── ProfileScreen.tsx     # Stats, achievements & settings
│   │   ├── EditProfileScreen.tsx # Edit name and bio
│   │   └── SubmitPlaceholderScreen.tsx
│   │
│   ├── components/               # Reusable UI (14 components)
│   │   ├── TaskCard.tsx          # Task card with difficulty badge
│   │   ├── RewardBadge.tsx       # Tiered reward badge (5 tiers)
│   │   ├── ImpactStats.tsx       # Trees, plastic, CO₂ metrics
│   │   ├── StreakCard.tsx        # Consecutive-day streak with milestone bar
│   │   ├── AchievementGrid.tsx   # Eco-badge grid with progress
│   │   ├── EarningsSummary.tsx   # Earnings total, type breakdown & weekly chart
│   │   ├── PendingProofsBanner.tsx # Offline proof queue status & retry
│   │   ├── TransactionHistory.tsx # Stellar payment history
│   │   ├── ErrorBoundary.tsx     # Class-based error boundary
│   │   ├── LoadingSkeleton.tsx   # Animated skeleton loaders
│   │   ├── OfflineBanner.tsx     # Yellow offline warning
│   │   ├── EmptyState.tsx        # Generic empty state
│   │   ├── WalletBalance.tsx     # Inline balance display
│   │   └── TabBarIcon.tsx        # Emoji-based tab icons
│   │
│   ├── navigation/               # App routing
│   │   ├── RootNavigator.tsx     # Auth gate + all root routes
│   │   ├── MainTabNavigator.tsx  # Bottom tabs (Home/Tasks/Submit/Wallet)
│   │   └── TaskStackNavigator.tsx # Tasks tab stack navigation
│   │
│   ├── hooks/                    # Custom React hooks (6 hooks)
│   │   ├── useStellarWallet.ts   # Wallet connect, import, balance refresh
│   │   ├── useAuth.ts            # Wallet-based authentication
│   │   ├── useTaskFeed.ts        # Paginated, location-aware task fetching
│   │   ├── useProofSubmit.ts     # Proof upload + IPFS pinning + offline queue
│   │   ├── useLocation.ts        # GPS permission & position
│   │   └── useNetworkStatus.ts   # Online/offline detection
│   │
│   ├── services/                 # External integrations (6 services)
│   │   ├── api.ts                # Axios client with auth + endpoints
│   │   ├── stellar.ts            # Stellar SDK: balances, signing, payments
│   │   ├── ipfs.ts               # IPFS pinning via Pinata API
│   │   ├── lobstr.ts             # Lobstr SEP-7 deep-link: URI build, callback, pay
│   │   ├── notifications.ts      # Push notification registration
│   │   ├── proofQueue.ts         # Persistent offline proof queue (deduped)
│   │   └── walletVault.ts        # Per-account in-app secret key storage
│   │
│   ├── store/                    # Zustand global state (4 stores)
│   │   ├── walletStore.ts        # Wallet state (MMKV persisted)
│   │   ├── taskStore.ts          # Task list & pagination (MMKV cached)
│   │   ├── userStore.ts          # Profile & auth (MMKV persisted)
│   │   └── activityStore.ts      # Activity feed + streaks (MMKV persisted)
│   │
│   ├── types/                    # Shared TypeScript types
│   │   └── index.ts              # Task, UserProfile, Activity, impact config
│   │
│   ├── utils/                    # Helper functions (10 utilities)
│   │   ├── theme.ts              # Dark color palette & spacing
│   │   ├── formatTokens.ts       # Token amount formatting
│   │   ├── geoUtils.ts           # Haversine distance, radius checks, sort
│   │   ├── validation.ts         # Public key & email validation
│   │   ├── impact.ts             # Per-task-type environmental impact
│   │   ├── proofMetadata.ts      # IPFS proof metadata builder
│   │   ├── streaks.ts            # Current/best streak & milestone logic
│   │   ├── achievements.ts       # Achievement tiers & progress
│   │   ├── sortTasks.ts          # Search filtering & feed sorting
│   │   └── earnings.ts           # Earnings sums, type grouping, weekly series
│   │
│   └── __tests__/                # Tests (135 tests across 15 files)
│       ├── stores.test.ts        # Wallet, task, user, activity store tests
│       ├── components.test.tsx   # Component rendering tests
│       ├── formatTokens.test.ts  # Token formatting tests
│       ├── geoUtils.test.ts      # Geolocation & distance sorting tests
│       ├── validation.test.ts    # Validation utility tests
│       ├── proofQueue.test.ts    # Offline proof queue tests
│       ├── proofMetadata.test.ts # IPFS metadata builder tests
│       ├── impact.test.ts        # Impact calculation tests
│       ├── walletVault.test.ts   # Secret key vault tests
│       ├── signChallenge.test.ts # Stellar challenge signing tests
│       ├── streaks.test.ts       # Streak calculation & milestones
│       ├── achievements.test.ts  # Achievement thresholds & progress
│       ├── sortTasks.test.ts     # Search & sort logic
│       ├── stellarPayment.test.ts# Payment build/sign & validation
│       ├── lobstr.test.ts        # SEP-7 URI build, callback parsing, errors
│       └── earnings.test.ts      # Earnings sums, grouping & weekly series
│
├── .github/                      # CI/CD & templates
├── .env.example                  # Environment variable template
├── package.json
├── tsconfig.json
└── babel.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- React Native CLI
- Android Studio (for Android) or Xcode (for iOS)
- A Stellar testnet account (get one free at [laboratory.stellar.org](https://laboratory.stellar.org))

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/ecotask-network/ecotask-app.git
cd ecotask-app

# 2. Install dependencies
npm install

# 3. Install iOS pods (Mac only)
cd ios && pod install && cd ..

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 5. Start Metro bundler
npm start

# 6. Run on device/emulator
npm run android   # Android
npm run ios       # iOS (Mac only)
```

### Environment Variables

```env
STELLAR_NETWORK=testnet
BACKEND_URL=http://localhost:3000

# IPFS (Pinata or compatible pinning service)
IPFS_API_URL=https://api.pinata.cloud
IPFS_API_KEY=your_pinata_api_key
IPFS_SECRET=your_pinata_secret
IPFS_GATEWAY=https://ipfs.io/ipfs/

# ECO Token
ECO_TOKEN_ASSET_CODE=ECO
ECO_TOKEN_ISSUER=YOUR_ISSUER_PUBLIC_KEY

# Push Notifications
FCM_SERVER_KEY=your_fcm_key
```

### Lobstr Deep-Link Scheme Registration

The app uses the `ecotask://` URI scheme to receive signed-transaction callbacks
from Lobstr after SEP-7 signing.  You must register the scheme in both platform
manifests before the Lobstr flow will work on a real device.

**Android — `android/app/src/main/AndroidManifest.xml`**

Add the following `<intent-filter>` inside the `<activity>` tag:

```xml
<intent-filter android:label="EcoTask deep link">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="ecotask" />
</intent-filter>
```

**iOS — `ios/<AppName>/Info.plist`**

Add or extend the `CFBundleURLTypes` array:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.ecotask.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ecotask</string>
    </array>
  </dict>
</array>
```

After adding these entries, rebuild the app (`npm run android` / `npm run ios`).
The `ecotask://lobstr/callback` path is handled automatically by
`RootNavigator` — no additional routing configuration is needed.

---

## 🧪 Testing

```bash
# Type-check the whole program, including dependency declarations
npm run typecheck

# Run unit tests (135 tests)
npm test

# Run with coverage
npm test -- --coverage

# Run integration tests (requires running backend)
npm run test:integration
```

### Type checking with skipLibCheck disabled

`tsc --noEmit` runs with `skipLibCheck: false`, so type errors inside
dependency `.d.ts` files fail the build just like errors in `src/`. CI runs
`npm run typecheck` on every push and pull request.

Because library declarations are now checked, three small, documented
mechanisms keep known-broken third-party typings from failing the build:

1. **`types-stubs/node/`** — `@stellar/stellar-base` hard-references node's
   types (it needs `Buffer`), which drags all of `@types/node` into the
   program. Its global fetch/web declarations collide with React Native's own
   globals (`react-native/types/modules/globals.d.ts`). A minimal stub,
   preferred via `typeRoots`, provides only what compiled code actually uses
   (`Buffer`, re-typed from the `buffer` polyfill the app ships at runtime,
   plus `NodeJS.CallSite` and `MessageEvent` used by `@stellar/stellar-sdk`).
2. **`src/types/vendor.d.ts`** — declares the slice of DOM's `Window` that
   `zustand`'s devtools middleware inspects; we do not include `lib.dom`
   because it collides with React Native's globals.
3. **`patches/`** — unified-diff fixes to genuinely broken dependency
   declarations (currently `react-native-screens@3.37.0`, whose shipped types
   target `@react-navigation` v7 generics while this repo pins v6). Applied
   after every install by `scripts/apply-type-patches.js`; see
   [patches/README.md](patches/README.md) for details and upstream references.

The `lib` compiler option mirrors
[`@react-native/typescript-config`](https://www.npmjs.com/package/@react-native/typescript-config)
(`es2019` plus selected `es2020`–`es2022` features), matching what Hermes
actually supports.

### Test Coverage

| Category            | Tests | Files                                                                                                       |
| ------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| Store logic         | 19    | walletStore, taskStore, userStore, activityStore                                                            |
| Component rendering | 19    | TaskCard, ImpactStats, RewardBadge, EmptyState                                                              |
| Utility functions   | 71    | formatTokens, geoUtils, validation, impact, proofMetadata, streaks, achievements, sortTasks, earnings       |
| Service logic       | 52    | proofQueue, walletVault, signChallenge, stellarPayment, lobstr                                              |

---

## 📲 App Flow

```
Launch
  │
  ├── New User ──▶ Connect Freighter / Create Test Wallet ──▶ Authenticate
  │                                                              │
  │                                                              ▼
  └── Returning ──▶ Auto-authenticate from persisted token ──▶ Home
                                                                 │
                                                ┌───────────────┼────────────────┐
                                                ▼               ▼                ▼
                                            Browse Tasks    My Wallet        My Profile
                                                │               │                │
                                                ▼               ▼                ▼
                                            Task Detail    Balance + TXN     Edit Profile
                                                │            History
                                                ▼
                                           Start Task ──▶ Capture Photo + GPS
                                                                │
                                                                ▼
                                                         Submit Proof
                                                                │
                                                                ▼
                                                   Pending Verification ──▶ ✅ Reward
```

---

## 🗺️ Roadmap

EcoTask is in early alpha. Here's what we're building and in what order:

### Now (v0.2 — current)

- ✅ Wallet connection (Freighter + Lobstr SEP-7 + in-app testnet wallets)
- ✅ Wallet-based authentication
- ✅ In-app wallet import, secret key backup & challenge signing
- ✅ Real camera proof capture with GPS
- ✅ Task browsing, filtering, and detail view
- ✅ Task search, sorting (distance/reward/difficulty) & radius controls
- ✅ Location-aware task discovery sorted by distance
- ✅ Offline proof queue & sync (with dedupe and status banner)
- ✅ Offline task feed caching
- ✅ IPFS proof pinning in the submission flow
- ✅ Persistent activity feed & impact dashboard
- ✅ Transaction history (Stellar Horizon)
- ✅ Streak tracking with milestones (7/14/30/60/100 days)
- ✅ Achievement badges for impact milestones
- ✅ Earnings analytics (totals, task-type breakdown, 4-week trend)
- ✅ Send tokens (XLM/ECO) with signed Stellar payments

### Next (v0.3)

- 🔜 **Backend verification engine** — photo + GPS proof validation
- 🔜 **ECO reward payouts** via Stellar smart contracts
- 🔜 **Push notifications** for reward confirmations & new tasks

### Later (v0.4+)

- 🔜 **Map-based task discovery** (React Native Maps)
- 🔜 **Multi-language support** (English, Swahili, French, Portuguese)
- 🔜 **USDC payout option**
- 🔜 **Leaderboards & community challenges**
- 🔜 **Shared communities, group goals & social proof**

> Milestones are tracked in the [GitHub issues](https://github.com/ecotask-network/EcoTask-app/issues) — check the `roadmap` label for current priorities.

---

## 🤝 Contributing

We welcome contributions from everyone!

- 📖 Read our [Contributing Guidelines](CONTRIBUTING.md)
- ⚖️ Review our [Code of Conduct](CODE_OF_CONDUCT.md)
- 🐛 Report bugs via [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
- 💡 Suggest features via [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)
- 🔒 Report vulnerabilities in [SECURITY.md](SECURITY.md)

Good first issues are tagged [`good first issue`](https://github.com/ecotask-network/ecotask-app/issues?q=label%3A%22good+first+issue%22) in the issue tracker.

---

## 📬 Contact

Questions, feedback, or partnership ideas? We'd love to hear from you.

| Channel                    | Where                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| 📧 **Email**               | [solapromise112@gmail.com](mailto:solapromise112@gmail.com)                                       |
| 🐙 **GitHub Organization** | [github.com/ecotask-network](https://github.com/ecotask-network)                                  |
| 💬 **GitHub Discussions**  | [EcoTask-app discussions](https://github.com/ecotask-network/EcoTask-app/discussions)             |
| 🐛 **Bug Reports**         | [Open an issue](https://github.com/ecotask-network/EcoTask-app/issues/new?template=bug_report.md) |

**Preferred channel:** For project questions and feature discussions, use GitHub Discussions. For direct or time-sensitive inquiries, email the maintainers.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

## Ecosystem

This is part of the [EcoTask Network](https://github.com/ecotask-network):

| Repo                                                                     | Description                       |
| ------------------------------------------------------------------------ | --------------------------------- |
| [EcoTask-app](https://github.com/ecotask-network/EcoTask-app)            | Mobile dApp (this repo)           |
| [EcoTask-backend](https://github.com/ecotask-network/EcoTask-backend)    | Node.js API & verification engine |
| [EcoTask-contracts](https://github.com/ecotask-network/EcoTask-contract) | Stellar Soroban smart contracts   |
| [EcoTask-docs](https://github.com/ecotask-network/EcoTask-docs)          | Documentation hub                 |

---

<div align="center">

_Part of the [EcoTask Network](https://github.com/ecotask-network) — Because the environment deserves an economy._

</div>
