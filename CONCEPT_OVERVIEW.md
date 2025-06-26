# HarvVerse Crop-Investment Platform – Conceptual Overview

## 1. Vision
Enable **farmers** to tokenize real-world crop lots as *CropNFTs* and raise capital from **investors**.  After funding, the investor can either:

1. **Receive Produce** – physical delivery of the harvested crop.
2. **Share Profits** – allow the farmer to sell the crop and share the proceeds.

The protocol must transparently enforce whichever option the investor selects while ensuring fair settlement for both parties.

---

## 2. Current State (Main Branch)
| Contract | Purpose | Key Fields |
|----------|---------|------------|
| `CropNFT.sol` | ERC-721 that immutably stores a metadata URI for each plot/lot. | `tokenURI`, `ownerOf` |
| `MicroLoan.sol` | Simple ETH micro-lending against a single NFT as collateral. Fixed 5 % interest, 90-day term. | `Loan { borrower, lender, principal, interest, deadline, status }` |
| Front-end | Pages for Mint (`/mint`), Request Investment (`/request-investment`), Fund (`/fund`) plus listing views.  | Wagmi + Scaffold-ETH hooks |

### Gaps w.r.t. New Requirements
1. Investor logistics choice (receive produce vs.
   share profits) is not modelled.
2. No representation of **produce quantity / quality**.
3. Settlement only supports *repayment in ETH* – no flow of physical goods or revenue share.
4. Fixed term/interest – cannot express custom agreements.
5. No role for **shipping/oracle** confirmation of delivery or sale.

---

## 3. Proposed Smart-Contract Architecture

### 3.1 CropNFT (minor extension)
Add extra immutable attributes at mint time (also stored in the off-chain metadata):
* `cropType` – e.g., Coffee Arabica.
* `expectedYield` – in kg or bags.
* `harvestDate` – unix timestamp.
* `farmLocation` – optional.

(These live in the metadata JSON; on-chain we keep tokenId ↦ IPFS hash only, so **contract code need not change**.)

### 3.2 InvestmentAgreement (replace `MicroLoan`)
Instead of a one-size-fits-all micro-loan, introduce an `InvestmentAgreement` contract per deal or a registry that stores multiple `Agreement` structs.

```solidity
enum FulfilmentOption { UNSET, DELIVER_PRODUCE, SHARE_PROFITS }

enum AgreementStatus { Proposed, Funded, ProduceReady, Settled, Defaulted }

struct Agreement {
    // Parties
    address farmer;
    address investor;

    // Collateral
    address cropNFT;
    uint256 cropTokenId;

    // Economics
    uint256 investAmount;      // ETH supplied by investor (goes to farmer immediately)
    uint256 investorShareBps;  // Basis-points (1/10,000) of sale proceeds owed to investor if SHARE_PROFITS
    uint256 expectedQuantity;  // Planned yield (kg). Informational / oracle check.

    // Logistics
    FulfilmentOption option;   // irrevocably chosen by investor right after funding
    uint256 harvestDeadline;   // by when farmer must mark produce ready
    uint256 deliveryOrSaleDeadline; // by when produce must be delivered or sale proceeds sent

    AgreementStatus status;
}
```

Key flows:
1. **Propose** – Farmer escrows `CropNFT` & defines deal terms (`investAmount`, `expectedQuantity`, deadlines, profit-share %).
2. **Fund** – Investor transfers `investAmount` ETH; contract forwards it to farmer **immediately**; agreement now **Funded**.
3. **Choose Option** – Investor calls `chooseOption(FulfilmentOption)`. Cannot be changed later.
4. **Harvest Complete** – Farmer calls `markHarvestReady()` (before `harvestDeadline`). Agreement → `ProduceReady`.
5. **Settlement**
   * **Deliver Produce**: After off-chain shipping, trusted oracle (or multisig) invokes `confirmDelivery()` → contract returns NFT to farmer and sets status `Settled`.
   * **Share Profits**: Farmer sells crop, then sends `investorShare` of sale proceeds to contract via `reportSale(amountReceived)`; contract forwards investor's share to investor; NFT returned to farmer; status `Settled`.
6. **Default Handling** – If deadlines pass without settlement, investor may `claimCollateral()` (keeps NFT) or DAO may arbitrate.

### 3.3 Supporting Libraries / Roles
* **Escrow Vault** – holds NFTs & ETH during lifecycle.
* **Oracle / ShippingProof** – minimal interface that a trusted 3rd party or DAO signs to attest delivery.
* **AccessControl** – consider `Ownable` + `Roles` for admin/oracle.

---

## 4. Front-end Changes (Next.js)
1. **/request-investment** (rename to **/create-deal**)
   * Farmer inputs crop details, required capital, deadlines, profit-share %.
2. **/fund** (rename to **/invest**)
   * Investor funds and immediately selects *Receive Produce* or *Share Profits*.
3. **/investment/[id]**
   * Dynamic UI based on option chosen:
     * Deliver option – shows shipping status & delivery deadline.
     * Share-profits option – shows sale report & calculations of investor share.
4. **Farmer Dashboard**
   * Buttons to mark harvest ready, report sale, or upload shipping docs.
   * Countdown timers for deadlines.

All interactions continue to use `useScaffoldReadContract` & `useScaffoldWriteContract` hooks.

---

## 5. Migration Strategy
1. Deploy upgraded contracts (`InvestmentAgreement`) to Optimism Sepolia.
2. Migrate UI pages incrementally – keep existing loan flow for past agreements, route new proposals to new contract.
3. Index & display both old and new agreements in dashboards (versioned by `contractVersion`).

---

## 6. Open Questions
* **Physical Delivery Proof** – which oracle / off-chain service will attest? (e.g., Chainlink Functions, manual multi-sig).
* **Dispute Resolution** – add arbitration mechanism? (e.g., Kleros).
* **Multiple Investors** – support fractional funding (ERC-20 share tokens) in future iterations.

---

## 7. Next Steps
1. Finalise struct & flow diagram; draft Solidity interface.
2. Implement happy-path unit tests (Hardhat Foundry).
3. Update front-end forms & wagmi interactions.
4. Security review → Testnet release → Mainnet.

---

*This document captures the high-level blueprint for extending HarvVerse to a full produce-backed investment marketplace.* 