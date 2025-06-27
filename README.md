# 🌿 Harvverse

> A decentralized finance (DeFi) platform that tokenizes agricultural assets and connects farmers directly with investors, businesses, and cities through Web3 infrastructure.

This project is built using [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2), an open-source toolkit for building decentralized applications on Ethereum.

## 📜 Table of Contents

- [What is Harvverse?](#1-what-is-harvverse)
- [Why Does It Exist?](#2-why-does-it-exist)
- [How It Works](#3-how-it-works)
- [Vision](#4-vision)
- [Global Impact](#5-global-impact)
- [Market Opportunity](#6-market-opportunity)
- [Technology Innovation](#7-technology-innovation)
- [Sustainability Impact](#8-sustainability-impact)
- [Technical Deep Dive](#technical-deep-dive)
  - [Project Structure](#project-structure)
  - [Smart Contract Architecture](#smart-contract-architecture)
  - [Contract Interaction Flow](#contract-interaction-flow)
  - [Frontend Application Flow](#frontend-application-flow)
- [🚀 Getting Started](#-getting-started)
- [🤝 Contributing](#-contributing)

## 1. What is Harvverse?

Harvverse is a decentralized finance (DeFi) platform that tokenizes agricultural assets and connects farmers directly with investors, businesses, and cities through Web3 infrastructure. It leverages blockchain, dynamic NFTs (dNFTs), DAOs, and real-time data visualization to create a transparent, traceable, and regenerative agricultural economy. The platform is designed to power a network state economy—where restaurants, shops, and markets can directly finance crops via smart contracts—ensuring supply chain integrity and food security.

### Technology Stack:

*   **Blockchain & Smart Contracts**: Ethereum-compatible chains for asset tokenization and automated agreements.
*   **Dynamic NFTs (dNFTs)**: Representing verified sustainable practices and producer identities.
*   **DAOs**: Enabling decentralized governance and funding mechanisms.
*   **IoT & Data Feeds**: Real-time sensor data from farms integrated into a connected city dashboard.
*   **Digital Wallets**: For citizen incentives and green reputation systems.

## 2. Why Does It Exist?

Agricultural producers—especially smallholders—face systemic barriers to financing, transparency, and market access. Meanwhile, cities struggle with food resilience, carbon accountability, and citizen engagement in sustainability. Harvverse bridges this gap by enabling direct, trustless financing of regenerative agriculture, verified through on-chain data and incentivized through gamified participation.

## 3. How It Works

### Technical Architecture & User Flow:

1.  **Producer Onboarding**: Farmers and urban growers create digital identities via dNFTs.
2.  **Tokenization**: Agricultural outputs and sustainable practices are tokenized as real-world assets (RWAs).
3.  **Smart Contracts**: Investors (e.g., restaurants, shops) fund crops directly through programmable contracts.
4.  **Verification**: IoT sensors and manual inputs validate sustainable practices and crop progress.
5.  **DAO Governance**: Local DAOs manage funding pools, vote on proposals, and distribute incentives.
6.  **Citizen Participation**: Urban residents engage via gamified dashboards, earning tokens for supporting green initiatives.

## 4. Vision

Harvverse envisions a future where agriculture is not only decentralized but regenerative—where every city becomes a stakeholder in its food system. By embedding agriculture into the digital fabric of urban economies, Harvverse aims to transform how we grow, fund, and consume food—creating a resilient, transparent, and equitable global food network.

## 5. Global Impact

*   **Economic**: Unlocks new capital flows for underserved farmers and regenerative projects.
*   **Social**: Empowers communities through participatory governance and equitable access to food.
*   **Technological**: Demonstrates scalable models for integrating DeFi with real-world sustainability.
*   **Policy**: Provides transparent data for governments and institutions to support green transitions.

## 6. Market Opportunity

The addressable market spans:

*   **$1T+** in global agriculture financing gaps (as of 2024).
*   **$50B+** in voluntary carbon markets by 2030.
*   Smart cities and urban agriculture initiatives across the globe.
*   DeFi and Web3 sectors seeking real-world asset integration.

Harvverse positions itself at the intersection of these trends, offering a first-mover advantage in agricultural tokenization and regenerative finance.

## 7. Technology Innovation

*   **Dynamic NFTs**: Evolving digital identities that reflect real-time sustainability metrics.
*   **DeFi for Agriculture**: Smart contracts automate funding, delivery, and verification.
*   **Connected City Dashboard**: Real-time visualization of agricultural data for transparency and engagement.
*   **Gamified Governance**: Citizens earn green reputation scores and tokens for participation.

## 8. Sustainability Impact

*   **Environmental**: Promotes regenerative practices, reduces food miles, and supports carbon sequestration.
*   **Social**: Builds trust between producers and consumers, democratizes access to food systems.
*   **Urban-Rural Synergy**: Encourages cities to co-invest in the ecosystems that feed them.


## Technical Deep Dive

Harvverse is built as a yarn monorepo, separating the on-chain and off-chain logic into distinct packages for clarity and scalability.

### Project Structure

-   **`packages/hardhat`**: This package contains the heart of our on-chain logic.
    -   `contracts/`: Home to the Solidity smart contracts, including `CropNFT.sol` and the core `InvestmentAgreement.sol`.
    -   `deploy/`: Contains the deployment scripts that push our contracts to the blockchain. The scripts are ordered to ensure dependencies are handled correctly (`01_deploy_crop_nft.ts`, `03_deploy_investment_agreement.ts`).
    -   `test/`: Unit and integration tests for the smart contracts, ensuring their reliability and security.

-   **`packages/nextjs`**: The frontend application that brings Harvverse to life for users.
    -   `app/`: Built with the Next.js App Router, this directory defines the routes and user-facing pages of the platform.
    -   `components/`: Contains reusable React components, including standard UI elements from Scaffold-ETH 2 and custom components tailored for Harvverse's functionality.
    -   `hooks/`: Leverages Scaffold-ETH 2's powerful custom hooks (`useScaffoldReadContract`, `useScaffoldWriteContract`) to simplify interaction with our smart contracts, providing type-safe and reactive data fetching.
    -   `contracts/`: Holds the ABI and deployment information for our smart contracts, automatically generated by the `yarn deploy` command to keep the frontend in sync with the backend.

### Smart Contract Architecture

The core logic of Harvverse is implemented in two main Solidity smart contracts:

-   **`CropNFT.sol`**: An `ERC721` token contract that represents unique crop lots. Each NFT is minted by a farmer and contains an immutable metadata URI pointing to details about the crop (e.g., type, expected yield, location). This token serves as the digital representation of the real-world agricultural asset and acts as collateral within the investment agreements.

-   **`InvestmentAgreement.sol`**: This is the central contract managing the entire investment lifecycle.
    -   **State Management**: It uses enums (`AgreementStatus`, `FulfilmentOption`) to track the state of each agreement, from `Proposed` to `Funded`, `ProduceReady`, and finally `Settled` or `Defaulted`.
    -   **Deal Proposal**: Farmers initiate agreements by calling `proposeAgreement`, which escrows their `CropNFT` in the contract and records the deal's financial terms.
    -   **Funding & Option Selection**: Investors call `fundAgreement` with the required ETH amount. Crucially, at this moment, they must choose their fulfilment option:
        1.  `DELIVER_PRODUCE`: The investor will receive the physical harvest.
        2.  `SHARE_PROFITS`: The investor allows the farmer to sell the produce and receives a pre-agreed percentage of the profits.
    -   **Automated Settlement**: The contract includes functions (`confirmDelivery`, `reportSale`) that handle the final settlement. An external oracle (or for this MVP, the contract owner) confirms physical delivery, while the `reportSale` function automatically calculates and distributes the profit share, ensuring a trustless and transparent process.
    -   **Default Handling**: If deadlines are missed, the `claimCollateral` function allows the investor to claim the escrowed `CropNFT`, protecting their investment.

### Deployed Contracts

Harvverse smart contracts are deployed on multiple networks:

#### Base Mainnet
- **CropNFT**: [`0x7aF4f0993F7cc4a028070c677C7568B389970b89`](https://basescan.org/address/0x7aF4f0993F7cc4a028070c677C7568B389970b89)
- **InvestmentAgreement**: [`0xCB78156636E5A2B9d17f897976CCBd1324c4d53b`](https://basescan.org/address/0xCB78156636E5A2B9d17f897976CCBd1324c4d53b)

#### Base Sepolia Testnet
- **CropNFT**: [`0x7aF4f0993F7cc4a028070c677C7568B389970b89`](https://sepolia.basescan.org/address/0x7aF4f0993F7cc4a028070c677C7568B389970b89)
- **InvestmentAgreement**: [`0xCB78156636E5A2B9d17f897976CCBd1324c4d53b`](https://sepolia.basescan.org/address/0xCB78156636E5A2B9d17f897976CCBd1324c4d53b)

### Contract Interaction Flow

The two main contracts, `CropNFT` and `InvestmentAgreement`, work in tandem to create a transparent and automated investment process.

1.  **Minting the Asset**: A farmer initiates the process by minting a `CropNFT` via the `mint(tokenURI)` function. This creates a unique on-chain asset representing their crop.

2.  **Proposing the Deal**:
    -   **Approval**: Before proposing a deal, the farmer must first call `approve()` on the `CropNFT` contract, granting the `InvestmentAgreement` contract permission to manage their specific NFT (the one they wish to use as collateral).
    -   **Proposal**: The farmer then calls `proposeAgreement(...)` on the `InvestmentAgreement` contract. This function performs several key actions:
        -   It validates the deal parameters (e.g., investment amount > 0, deadlines are in the future).
        -   It securely pulls the approved `CropNFT` from the farmer's wallet into the contract's escrow using `safeTransferFrom`.
        -   It creates a new `Agreement` struct, populates it with the deal terms, and sets its initial status to `Proposed`.

3.  **Funding the Deal**:
    -   An investor calls `fundAgreement(agreementId, option)` on the `InvestmentAgreement` contract, sending the required ETH.
    -   The contract validates that the correct amount of ETH has been sent and that the agreement is still in the `Proposed` state.
    -   It records the investor's address and their chosen fulfilment option (`DELIVER_PRODUCE` or `SHARE_PROFITS`).
    -   The investment amount is **immediately and atomically** transferred to the farmer's address.
    -   The agreement status is updated to `Funded`.

4.  **Executing and Settling the Agreement**:
    -   **Harvest**: The farmer calls `markHarvestReady(agreementId)` to signal that the crop is ready, transitioning the agreement to the `ProduceReady` state.
    -   **Settlement**:
        -   If `DELIVER_PRODUCE` was chosen, `confirmDelivery(agreementId)` is called (by a trusted oracle in a full implementation) after physical delivery. This settles the agreement and returns the `CropNFT` to the farmer.
        -   If `SHARE_PROFITS` was chosen, the farmer calls `reportSale(agreementId, saleAmount)`, sending the investor's share of the proceeds. The contract verifies the amount, transfers the share to the investor, returns any excess funds to the farmer, and finally returns the `CropNFT`.
    -   **Default**: If the farmer fails to meet a deadline, the investor can call `claimCollateral(agreementId)`. The contract verifies the deadline has passed and transfers the escrowed `CropNFT` to the investor as compensation.

Throughout this process, the contracts emit events (`AgreementProposed`, `AgreementFunded`, etc.) to provide a transparent, on-chain record of every state change, which the frontend uses to update the UI in real-time.

### Frontend Application Flow

The Next.js application provides two distinct user journeys for Farmers and Investors, facilitated by a suite of purpose-built pages:

**For Farmers 🌾:**

1.  **Mint CropNFT (`/mint`)**: The journey begins here. A farmer provides a metadata URI (e.g., an IPFS link) for their crop lot, which includes details like crop type, expected yield, and quality. The platform then calls the `mint` function on the `CropNFT` contract, creating a unique token representing their agricultural asset.
2.  **Create Deal (`/create-deal`)**: With a `CropNFT` in their wallet, the farmer can propose an investment deal. This page fetches the farmer's owned NFTs and allows them to select one as collateral. They then fill out a form with the investment terms:
    -   **Investment Amount**: The capital required, in ETH.
    -   **Investor Profit Share**: The percentage of sale proceeds for the investor if they choose the profit-sharing option.
    -   **Expected Yield**: The quantity of the crop (e.g., in kg).
    -   **Deadlines**: Timelines for the harvest and subsequent delivery or sale.
    Submitting this form first triggers an `approve` transaction on the `CropNFT` contract, followed by a call to `proposeAgreement` on the `InvestmentAgreement` contract, which locks the NFT and lists the deal.

**For Investors 💼:**

1.  **Browse Deals (`/invest`)**: Investors explore a marketplace of open investment opportunities. The page reads the total number of agreements from the `InvestmentAgreement` contract and dynamically renders a card for each `Proposed` deal, fetching and displaying its specific terms.
2.  **Fund & Choose Option**: On each deal card, an investor can select their preferred fulfillment option:
    -   `📦 Receive Physical Produce`: For businesses or individuals who want the crops themselves.
    -   `💰 Share Profits`: For those seeking a financial return.
    After selecting an option and clicking "Fund," the application calls the `fundAgreement` function, sending the required ETH and locking their choice on-chain.

**Dashboard & Tracking (`/dashboard`)**

This is the central hub for all users to manage and monitor their activities:

-   **Role-Based Views**: The dashboard intelligently detects if the user is a Farmer, Investor, or both, and customizes the interface accordingly.
-   **Asset & Agreement Tracking**: It fetches and displays all `CropNFTs` owned by the user and all `InvestmentAgreements` they are a party to (either as a farmer or investor).
-   **Lifecycle Actions**: Based on an agreement's status, specific actions become available:
    -   A farmer can **Mark Harvest Ready**.
    -   If the profit-share option was chosen, the farmer can **Report Sale** and distribute proceeds.
    -   An investor can **Confirm Delivery** for the produce option.
    -   In case of a default, an investor can **Claim Collateral**.
-   **Status & Deadlines**: Each agreement's status (e.g., `Funded`, `ProduceReady`, `Settled`) and deadlines are clearly displayed, providing a transparent overview of the entire process.

**Developer & Diagnostic Tools:**

-   **`/debug`**: A powerful interface for developers to directly interact with all functions (read and write) of the deployed smart contracts.
-   **`/blockexplorer`**: A local block explorer that provides detailed views of transactions, addresses, contract code, and storage, aiding in development and debugging.

![Debug Contracts tab](https://github.com/scaffold-eth/scaffold-eth-2/assets/55535804/b237af0c-5027-4849-a5c1-2e31495cccb1)

## 🚀 Getting Started

### Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

### Quickstart

1.  Clone the repository and install dependencies:
    ```bash
    git clone https://github.com/BuidlGuidl/harvverse.git
    cd harvverse
    yarn install
    ```

2.  Run a local blockchain in the first terminal:
    ```bash
    yarn chain
    ```
    This command starts a local Hardhat network for development and testing.

3.  On a second terminal, deploy the smart contracts to the local network:
    ```bash
    yarn deploy
    ```

4.  On a third terminal, start the Next.js frontend application:
    ```bash
    yarn start
    ```

Visit your app at `http://localhost:3000`. You can interact with your smart contracts on the `/debug` page.


## 🤝 Contributing

We welcome contributions to Harvverse!

Please see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for more information and guidelines.