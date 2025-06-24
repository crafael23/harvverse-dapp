"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { Address, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface LoanRequest {
  loanId: bigint;
  borrower: string;
  nftContract: string;
  nftTokenId: bigint;
  amount: bigint;
}

const FundPage = () => {
  const { address: connectedAddress } = useAccount();
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [fundingLoanId, setFundingLoanId] = useState<bigint | null>(null);

  // Get loan request events
  const { data: loanRequestEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanRequested",
    fromBlock: 0n,
  });

  // Get funded loan events
  const { data: loanFundedEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanFunded",
    fromBlock: 0n,
  });

  const { writeContractAsync: writeMicroLoan } = useScaffoldWriteContract("MicroLoan");

  // Filter out already funded loans
  useEffect(() => {
    if (!loanRequestEvents) return;

    const fundedLoanIds = new Set(loanFundedEvents?.map(event => event.args.loanId?.toString()) || []);

    const openLoans = loanRequestEvents
      .filter(event => !fundedLoanIds.has(event.args.loanId?.toString()))
      .map(event => ({
        loanId: event.args.loanId || 0n,
        borrower: event.args.borrower || "",
        nftContract: event.args.nftContract || "",
        nftTokenId: event.args.nftTokenId || 0n,
        amount: event.args.amount || 0n,
      }));

    setLoanRequests(openLoans);
  }, [loanRequestEvents, loanFundedEvents]);

  const handleFundLoan = async (loanId: bigint, amount: bigint) => {
    try {
      setFundingLoanId(loanId);

      // Fund the loan with ETH
      await writeMicroLoan({
        functionName: "fundLoan",
        args: [loanId],
        value: amount, // Send ETH amount directly
      });

      notification.success("Loan funded successfully!");
    } catch (error) {
      console.error("Error funding loan:", error);
      notification.error("Failed to fund loan");
    } finally {
      setFundingLoanId(null);
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
          <span className="block text-4xl font-bold">Fund Loans</span>
          <span className="block text-2xl mt-2">Provide liquidity to farmers</span>
        </h1>

        {loanRequests.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body text-center">
              <h2 className="text-2xl font-bold mb-4">No Open Loan Requests</h2>
              <p>There are currently no loan requests waiting for funding.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loanRequests.map(loan => (
              <div key={loan.loanId.toString()} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Loan #{loan.loanId.toString()}</h2>

                  <div className="space-y-2">
                    <div>
                      <span className="text-sm opacity-70">Borrower:</span>
                      <Address address={loan.borrower} />
                    </div>

                    <div>
                      <span className="text-sm opacity-70">Amount:</span>
                      <p className="text-lg font-bold">{formatEther(loan.amount)} ETH</p>
                    </div>

                    <div>
                      <span className="text-sm opacity-70">Collateral:</span>
                      <p className="text-sm">CropNFT #{loan.nftTokenId.toString()}</p>
                    </div>

                    <div className="divider"></div>

                    <div className="stats stats-vertical shadow">
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Interest</div>
                        <div className="stat-value text-sm">5%</div>
                      </div>
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Duration</div>
                        <div className="stat-value text-sm">90 days</div>
                      </div>
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Total Return</div>
                        <div className="stat-value text-sm text-success">
                          {formatEther(loan.amount + (loan.amount * 5n) / 100n)} ETH
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions justify-end mt-4">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleFundLoan(loan.loanId, loan.amount)}
                      disabled={fundingLoanId === loan.loanId}
                    >
                      {fundingLoanId === loan.loanId ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Funding...
                        </>
                      ) : (
                        "Fund Loan"
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
            <h3 className="text-lg font-semibold">💼 Business Opportunity</h3>
            <p className="text-sm">
              Fund microloans to earn 5% interest over 90 days. All loans are secured by CropNFT collateral. If a
              borrower defaults, you&apos;ll receive the NFT which can be redeemed for the underlying crop value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundPage;
