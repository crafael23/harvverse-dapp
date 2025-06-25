"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Address, EthDisplay, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface InvestmentRequest {
  loanId: bigint;
  borrower: string;
  nftContract: string;
  nftTokenId: bigint;
  amount: bigint;
}

const FundPage = () => {
  const { address: connectedAddress } = useAccount();
  const [investmentRequests, setInvestmentRequests] = useState<InvestmentRequest[]>([]);
  const [fundingInvestmentId, setFundingInvestmentId] = useState<bigint | null>(null);

  // Get investment request events
  const { data: loanRequestEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanRequested",
    fromBlock: 0n,
  });

  // Get funded investment events
  const { data: loanFundedEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanFunded",
    fromBlock: 0n,
  });

  const { writeContractAsync: writeMicroLoan } = useScaffoldWriteContract("MicroLoan");

  // Filter out already funded investments
  useEffect(() => {
    if (!loanRequestEvents) return;

    const fundedLoanIds = new Set(loanFundedEvents?.map(event => event.args.loanId?.toString()) || []);

    const openInvestments = loanRequestEvents
      .filter(event => !fundedLoanIds.has(event.args.loanId?.toString()))
      .map(event => ({
        loanId: event.args.loanId || 0n,
        borrower: event.args.borrower || "",
        nftContract: event.args.nftContract || "",
        nftTokenId: event.args.nftTokenId || 0n,
        amount: event.args.amount || 0n,
      }));

    setInvestmentRequests(openInvestments);
  }, [loanRequestEvents, loanFundedEvents]);

  const handleFundInvestment = async (loanId: bigint, amount: bigint) => {
    try {
      setFundingInvestmentId(loanId);

      // Fund the investment with ETH
      await writeMicroLoan({
        functionName: "fundLoan",
        args: [loanId],
        value: amount, // Send ETH amount directly
      });

      notification.success("Investment funded successfully!");
    } catch (error) {
      console.error("Error funding investment:", error);
      notification.error("Failed to fund investment");
    } finally {
      setFundingInvestmentId(null);
    }
  };

  if (!connectedAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Connect Your Wallet</h1>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full max-w-6xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Make Investments</span>
          <span className="block text-2xl mt-2">Fund agricultural projects and earn returns</span>
        </h1>

        {investmentRequests.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body text-center">
              <h2 className="text-2xl font-bold mb-4">No Open Investment Requests</h2>
              <p>There are currently no investment requests waiting for funding.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {investmentRequests.map(investment => (
              <div key={investment.loanId.toString()} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Investment #{investment.loanId.toString()}</h2>

                  <div className="space-y-2">
                    <div>
                      <span className="text-sm opacity-70">Farmer:</span>
                      <Address address={investment.borrower} />
                    </div>

                    <div>
                      <span className="text-sm opacity-70">Amount:</span>
                      <div className="text-lg font-bold">
                        <EthDisplay amount={investment.amount} />
                      </div>
                    </div>

                    <div>
                      <span className="text-sm opacity-70">Collateral:</span>
                      <p className="text-sm">CropNFT #{investment.nftTokenId.toString()}</p>
                    </div>

                    <div className="divider"></div>

                    <div className="stats stats-vertical shadow">
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Returns</div>
                        <div className="stat-value text-sm">5%</div>
                      </div>
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Duration</div>
                        <div className="stat-value text-sm">90 days</div>
                      </div>
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Total Return</div>
                        <div className="stat-value text-sm text-success">
                          <EthDisplay
                            amount={investment.amount + (investment.amount * 5n) / 100n}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions justify-end mt-4">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleFundInvestment(investment.loanId, investment.amount)}
                      disabled={fundingInvestmentId === investment.loanId}
                    >
                      {fundingInvestmentId === investment.loanId ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Funding...
                        </>
                      ) : (
                        "Fund Investment"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 card bg-base-200">
          <div className="card-body">
            <h3 className="text-lg font-semibold">💼 Investment Opportunity</h3>
            <p className="text-sm">
              Fund agricultural investments to earn 5% returns over 90 days. All investments are secured by CropNFT
              collateral. If a farmer defaults, you&apos;ll receive the NFT which can be redeemed for the underlying
              crop value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundPage;
