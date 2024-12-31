# Token Locker

A Vue.js application for locking and unlocking your own tokens on the Gala Chain network.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Gala Chain wallet with tokens
- Metamask extension with Gala wallet seed phrase imported

## Setup

1. Clone the repository:
```bash
git clone https://github.com/jehosephat/token-locker.git
cd token-locker
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your configuration:
```env
VITE_BURN_GATEWAY_API=https://gateway-mainnet.galachain.com/api/asset/token-contract
VITE_BURN_GATEWAY_PUBLIC_KEY_API=https://api-galaswap.gala.com/galachain/api/asset/public-key-contract
```

## Development

To run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

To build the application for production:
```bash
npm run build
```

To preview the production build:
```bash
npm run serve
```

## Usage

1. Enter your Gala wallet address (client|...) and fetch your tokens
2. Connect your wallet using the connect button in the application
3. Select the tokens you want to lock/unlock
4. Confirm the transaction in your wallet

## Features

- Connect to Gala Chain wallet
- View token balances
- Lock tokens
- Unlock tokens (that have been locked by you)
- View lock history and status

## Technologies

- Vue.js 3
- TypeScript
- Vite
- @gala-chain/connect
