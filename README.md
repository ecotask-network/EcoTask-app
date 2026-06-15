<div align="center">

# 📱 ecotask-app

**The EcoTask mobile dApp — browse tasks, submit proof, and earn rewards.**

*A React Native application that puts climate-action income in the hands of communities across the developing world.*

[![React Native](https://img.shields.io/badge/React%20Native-0.73-61DAFB?logo=react)](https://reactnative.dev)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-7B68EE?logo=stellar)](https://stellar.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-In%20Development-yellow)]()

</div>

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

| Feature | Description |
|---------|-------------|
| 🔐 **Wallet Integration** | Connect via Freighter, Lobstr, or create a new Stellar wallet in-app |
| 🗂️ **Task Browser** | Filter tasks by type, location, reward size, and difficulty |
| 📸 **Proof Submission** | Upload photo evidence with automatic GPS tagging |
| 💸 **Instant Rewards** | Receive ECO tokens or USDC seconds after task verification |
| 📈 **Impact Dashboard** | See your total trees planted, plastic collected, CO₂ offset |
| 🌐 **Multi-language** | Designed for localisation (English, Swahili, French, Portuguese) |
| 📶 **Offline-first** | Queue submissions when offline, sync when connected |

---

## 🏗️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React Native 0.73 | Cross-platform iOS & Android from one codebase |
| Wallet | Stellar Wallets Kit | Unified interface for Freighter, Lobstr, xBull |
| State | Zustand | Lightweight, no-boilerplate global state |
| Navigation | React Navigation v6 | Industry-standard mobile routing |
| Storage | MMKV | Fast local storage for offline task queuing |
| Media | React Native Vision Camera | High-quality photo capture with GPS metadata |
| Maps | React Native Maps | Task discovery by location |
| Styling | NativeWind (Tailwind) | Consistent, responsive UI |
| Testing | Jest + React Native Testing Library | Unit & integration tests |

---

## 📁 Folder Structure

```
ecotask-app/
├── src/
│   ├── screens/              # Full app screens
│   │   ├── HomeScreen.tsx        # Dashboard & impact summary
│   │   ├── TaskListScreen.tsx    # Browse & filter tasks
│   │   ├── TaskDetailScreen.tsx  # Task info & start flow
│   │   ├── SubmitProofScreen.tsx # Camera, GPS & submission
│   │   ├── WalletScreen.tsx      # Balance, history & withdraw
│   │   └── ProfileScreen.tsx     # User stats & settings
│   │
│   ├── components/           # Reusable UI building blocks
│   │   ├── TaskCard.tsx          # Task listing card
│   │   ├── RewardBadge.tsx       # Token reward display
│   │   ├── ProofUploader.tsx     # Photo + GPS capture widget
│   │   ├── WalletBalance.tsx     # Live Stellar balance
│   │   └── ImpactStats.tsx       # Trees, plastic, CO₂ metrics
│   │
│   ├── navigation/           # App routing
│   │   ├── RootNavigator.tsx     # Auth vs main stack
│   │   ├── MainTabNavigator.tsx  # Bottom tab navigation
│   │   └── TaskStackNavigator.tsx
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useStellarWallet.ts   # Wallet connect & signing
│   │   ├── useTaskFeed.ts        # Paginated task fetching
│   │   ├── useProofSubmit.ts     # Proof upload + IPFS pin
│   │   └── useLocation.ts        # GPS permission & tracking
│   │
│   ├── services/             # External integrations
│   │   ├── stellar.ts            # Stellar SDK wrapper
│   │   ├── api.ts                # EcoTask backend API client
│   │   ├── ipfs.ts               # IPFS proof upload
│   │   └── notifications.ts      # Push notifications
│   │
│   ├── store/                # Zustand global state
│   │   ├── walletStore.ts        # Wallet & balance state
│   │   ├── taskStore.ts          # Task list & filters
│   │   └── userStore.ts          # Profile & preferences
│   │
│   ├── utils/                # Helper functions
│   │   ├── formatTokens.ts       # ECO/USDC display formatting
│   │   ├── geoUtils.ts           # Distance & location helpers
│   │   └── validation.ts         # Form & proof validation
│   │
│   └── assets/               # Static files
│       ├── images/
│       ├── fonts/
│       └── icons/
│
├── __tests__/                # Test files mirroring src/
├── android/                  # Android native project
├── ios/                      # iOS native project
├── .env.example              # Environment variable template
├── app.json                  # React Native app config
└── package.json
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
IPFS_GATEWAY=https://ipfs.io/ipfs/
ECO_TOKEN_ASSET_CODE=ECO
ECO_TOKEN_ISSUER=YOUR_ISSUER_PUBLIC_KEY
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run a specific test file
npm test -- TaskCard.test.tsx
```

---

## 📲 App Flow

```
Launch
  │
  ├── New User ──▶ Create Wallet ──▶ Fund with Testnet XLM ──▶ Home
  │
  └── Returning ──▶ Connect Wallet ──▶ Home
                                          │
                          ┌───────────────┼────────────────┐
                          ▼               ▼                ▼
                      Browse Tasks    My Wallet        My Profile
                          │
                          ▼
                      Task Detail
                          │
                          ▼
                     Start Task ──▶ Capture Photo + GPS
                                          │
                                          ▼
                                   Submit Proof
                                          │
                                          ▼
                                   Pending Verification
                                          │
                                          ▼
                                   ✅ Reward Received
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Good first issues are tagged [`good first issue`](https://github.com/ecotask-network/ecotask-app/issues?q=label%3A%22good+first+issue%22) in the issue tracker.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

## Ecosystem

This is part of the [EcoTask Network](https://github.com/ecotask-network):

| Repo | Description |
|------|-------------|
| [EcoTask-app](https://github.com/ecotask-network/EcoTask-app) | Mobile dApp |
| [EcoTask-backend](https://github.com/ecotask-network/EcoTask-backend) | Node.js API & verification engine |
| [EcoTask-contracts](https://github.com/ecotask-network/EcoTask-contract) | Stellar Soroban smart contracts |
| [EcoTask-docs](https://github.com/ecotask-network/EcoTask-docs) | Documentation hub |

---

<div align="center">

*Part of the [EcoTask Network](https://github.com/ecotask-network) — Because the environment deserves an economy.*

</div>
