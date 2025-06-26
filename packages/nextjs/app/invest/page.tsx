"use client";

import { useEffect, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

enum FulfilmentOption {
  UNSET = 0,
  DELIVER_PRODUCE = 1,
  SHARE_PROFITS = 2,
}

enum AgreementStatus {
  Proposed = 0,
  Funded = 1,
  ProduceReady = 2,
  Settled = 3,
  Defaulted = 4,
}

const InvestPage = () => {
  const { address: connectedAddress } = useAccount();
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: FulfilmentOption | undefined }>({});
  const [isLoading, setIsLoading] = useState(false);

  const { writeContractAsync: writeInvestmentAgreement } = useScaffoldWriteContract("InvestmentAgreement");

  // Get the agreement counter to know how many agreements exist
  const { data: agreementCounter } = useScaffoldReadContract({
    contractName: "InvestmentAgreement",
    functionName: "agreementCounter",
  });

  // Note: In a production app, you might want to fetch all agreements here
  // and filter them. For now, we'll load them individually in the AgreementCard component.
  useEffect(() => {
    // Reserved for future use - fetching and caching agreement data
  }, [agreementCounter]);

  const handleOptionChange = (agreementId: number, option: FulfilmentOption) => {
    setSelectedOptions(prev => ({
      ...prev,
      [agreementId]: option,
    }));
  };

  const handleFundAgreement = async (agreementId: number, investAmount: bigint) => {
    if (!connectedAddress) {
      notification.error("Please connect your wallet");
      return;
    }

    const selectedOption = selectedOptions[agreementId];
    if (!selectedOption) {
      notification.error("Please select a fulfilment option");
      return;
    }

    try {
      setIsLoading(true);

      await writeInvestmentAgreement({
        functionName: "fundAgreement",
        args: [BigInt(agreementId), selectedOption],
        value: investAmount,
      });

      notification.success("Agreement funded successfully!");

      // Reset the selected option for this agreement
      setSelectedOptions(prev => ({
        ...prev,
        [agreementId]: undefined,
      }));
    } catch (error) {
      console.error("Error funding agreement:", error);
      notification.error("Failed to fund agreement");
    } finally {
      setIsLoading(false);
    }
  };

  // Individual agreement reader component
  const AgreementCard = ({ agreementId }: { agreementId: number }) => {
    const { data: agreementData } = useScaffoldReadContract({
      contractName: "InvestmentAgreement",
      functionName: "agreements",
      args: [BigInt(agreementId)],
    });

    if (!agreementData) {
      return (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-32 w-full"></div>
          </div>
        </div>
      );
    }

    const [
      farmer,
      investor,
      cropNFT,
      cropTokenId,
      investAmount,
      investorShareBps,
      expectedQuantity, // option - unused
      ,
      harvestDeadline,
      deliveryOrSaleDeadline,
      status,
    ] = agreementData;

    // Only show agreements that are available for funding (Proposed status and no investor)
    if (status !== AgreementStatus.Proposed || investor !== zeroAddress) {
      return null;
    }

    const selectedOption = selectedOptions[agreementId] || FulfilmentOption.UNSET;

    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            Agreement #{agreementId}
            <div className="badge badge-success">Available</div>
          </h2>

          <div className="space-y-2">
            <div>
              <span className="font-semibold">Farmer:</span>
              <div className="text-sm font-mono">
                {farmer.slice(0, 6)}...{farmer.slice(-4)}
              </div>
            </div>

            <div>
              <span className="font-semibold">Investment Needed:</span>
              <span className="text-lg font-bold ml-2">{formatEther(investAmount)} ETH</span>
            </div>

            <div>
              <span className="font-semibold">Expected Yield:</span>
              <span className="ml-2">{formatEther(expectedQuantity)} kg</span>
            </div>

            <div>
              <span className="font-semibold">Profit Share:</span>
              <span className="ml-2">{Number(investorShareBps) / 100}%</span>
            </div>

            <div>
              <span className="font-semibold">Harvest Deadline:</span>
              <span className="ml-2">{new Date(Number(harvestDeadline) * 1000).toLocaleDateString()}</span>
            </div>

            <div>
              <span className="font-semibold">Delivery Deadline:</span>
              <span className="ml-2">{new Date(Number(deliveryOrSaleDeadline) * 1000).toLocaleDateString()}</span>
            </div>

            <div>
              <span className="font-semibold">Crop NFT:</span>
              <div className="text-sm font-mono">
                Token #{cropTokenId.toString()} from {cropNFT.slice(0, 6)}...{cropNFT.slice(-4)}
              </div>
            </div>
          </div>

          <div className="card-actions flex-col mt-4">
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text font-semibold">Choose Your Option:</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={selectedOption}
                onChange={e => handleOptionChange(agreementId, parseInt(e.target.value) as FulfilmentOption)}
              >
                <option value={FulfilmentOption.UNSET}>Select an option</option>
                <option value={FulfilmentOption.DELIVER_PRODUCE}>📦 Receive Physical Produce</option>
                <option value={FulfilmentOption.SHARE_PROFITS}>
                  💰 Share Profits ({Number(investorShareBps) / 100}%)
                </option>
              </select>
            </div>

            <button
              className={`btn btn-primary w-full ${isLoading ? "loading" : ""}`}
              onClick={() => handleFundAgreement(agreementId, investAmount)}
              disabled={isLoading || selectedOption === FulfilmentOption.UNSET}
            >
              {isLoading ? "Funding..." : `Fund ${formatEther(investAmount)} ETH`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!connectedAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Connect Your Wallet</h1>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  const totalAgreements = agreementCounter ? Number(agreementCounter) : 0;

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full max-w-6xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Investment Opportunities</span>
          <span className="block text-2xl mt-2">Browse and fund agricultural investment deals</span>
        </h1>

        <div className="stats shadow mb-8">
          <div className="stat">
            <div className="stat-title">Total Agreements Created</div>
            <div className="stat-value">{totalAgreements}</div>
            <div className="stat-desc">On-chain agreement counter</div>
          </div>
        </div>

        {totalAgreements === 0 ? (
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body text-center">
              <h2 className="card-title justify-center text-2xl">No Investment Opportunities Available</h2>
              <p className="text-lg">
                There are currently no investment agreements available for funding. Check back later or encourage
                farmers to create new deals!
              </p>
              <div className="card-actions justify-center">
                <a href="/create-deal" className="btn btn-primary">
                  Create a Deal (Farmers)
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: totalAgreements }, (_, i) => (
                <AgreementCard key={i} agreementId={i} />
              ))}
            </div>
          </>
        )}

        <div className="mt-12 card bg-base-200">
          <div className="card-body">
            <h2 className="card-title">How Investment Options Work</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-base-100 rounded-lg">
                <h3 className="font-bold text-lg mb-2">📦 Receive Physical Produce</h3>
                <p>
                  The farmer will deliver the actual harvested crops to you. You receive the full quantity of produce
                  specified in the deal. Great for businesses or individuals who want the actual crops.
                </p>
              </div>
              <div className="p-4 bg-base-100 rounded-lg">
                <h3 className="font-bold text-lg mb-2">💰 Share Profits</h3>
                <p>
                  The farmer sells the crops and shares the specified percentage of profits with you. You receive ETH
                  payments without handling physical goods. Ideal for financial investors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestPage;
