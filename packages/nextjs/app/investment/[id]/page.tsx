"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { Address, EthDisplay, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface InvestmentData {
  borrower: string;
  lender: string;
  nftContract: string;
  nftTokenId: bigint;
  principal: bigint;
  interest: bigint;
  deadline: bigint;
  status: number;
}

const InvestmentDetailPage = () => {
  const params = useParams<{ id: string }>();
  const loanId = BigInt(params.id);
  const { address: connectedAddress } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get investment details
  const { data: loanData } = useScaffoldReadContract({
    contractName: "MicroLoan",
    functionName: "getLoan",
    args: [loanId],
  });

  const { writeContractAsync: writeMicroLoan } = useScaffoldWriteContract("MicroLoan");

  const investment = loanData as InvestmentData | undefined;

  const getStatusBadge = (status: number) => {
    const badges = {
      0: <span className="badge badge-warning badge-lg">Requested</span>,
      1: <span className="badge badge-info badge-lg">Funded</span>,
      2: <span className="badge badge-success badge-lg">Repaid</span>,
      3: <span className="badge badge-error badge-lg">Liquidated</span>,
    };
    return badges[status as keyof typeof badges] || <span className="badge badge-lg">Unknown</span>;
  };

  const handleRepay = async () => {
    if (!investment) return;

    try {
      setIsProcessing(true);
      const totalRepayment = investment.principal + investment.interest;

      // Repay the investment with ETH
      await writeMicroLoan({
        functionName: "repay",
        args: [loanId],
        value: totalRepayment, // Send ETH for repayment
      });

      notification.success("Investment repaid successfully!");
    } catch (error) {
      console.error("Error repaying investment:", error);
      notification.error("Failed to repay investment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLiquidate = async () => {
    try {
      setIsProcessing(true);

      await writeMicroLoan({
        functionName: "liquidate",
        args: [loanId],
      });

      notification.success("Investment liquidated successfully!");
    } catch (error) {
      console.error("Error liquidating investment:", error);
      notification.error("Failed to liquidate investment");
    } finally {
      setIsProcessing(false);
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

  if (!investment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const isExpired = investment.deadline > 0n && BigInt(Math.floor(Date.now() / 1000)) > investment.deadline;
  const timeRemaining = investment.deadline > 0n ? investment.deadline - BigInt(Math.floor(Date.now() / 1000)) : 0n;
  const daysRemaining = timeRemaining > 0n ? Number(timeRemaining) / (24 * 60 * 60) : 0;

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full max-w-4xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Investment #{loanId.toString()}</span>
          <span className="block text-2xl mt-2">{getStatusBadge(investment.status)}</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Investment Details Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Investment Details</h2>

              <div className="space-y-3">
                <div>
                  <span className="text-sm opacity-70">Farmer:</span>
                  <Address address={investment.borrower} />
                </div>

                {investment.lender !== "0x0000000000000000000000000000000000000000" && (
                  <div>
                    <span className="text-sm opacity-70">Investor:</span>
                    <Address address={investment.lender} />
                  </div>
                )}

                <div>
                  <span className="text-sm opacity-70">Principal Amount:</span>
                  <div className="text-lg font-bold">
                    <EthDisplay amount={investment.principal} />
                  </div>
                </div>

                <div>
                  <span className="text-sm opacity-70">Returns:</span>
                  <div className="text-lg font-bold">
                    <EthDisplay amount={investment.interest} />
                  </div>
                </div>

                <div>
                  <span className="text-sm opacity-70">Total Repayment:</span>
                  <div className="text-lg font-bold text-primary">
                    <EthDisplay amount={investment.principal + investment.interest} />
                  </div>
                </div>

                {investment.deadline > 0n && (
                  <div>
                    <span className="text-sm opacity-70">Time Remaining:</span>
                    <p className={`text-lg font-bold ${isExpired ? "text-error" : ""}`}>
                      {isExpired ? "Expired" : `${Math.floor(daysRemaining)} days`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collateral Details Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Collateral Details</h2>

              <div className="space-y-3">
                <div>
                  <span className="text-sm opacity-70">NFT Contract:</span>
                  <Address address={investment.nftContract} />
                </div>

                <div>
                  <span className="text-sm opacity-70">Token ID:</span>
                  <p className="text-lg font-bold">#{investment.nftTokenId.toString()}</p>
                </div>

                <div className="divider"></div>

                <div className="bg-base-200 p-4 rounded-lg">
                  <p className="text-sm">
                    This CropNFT is held as collateral for the investment.
                    {investment.status === 1 && " It will be returned upon successful repayment."}
                    {investment.status === 2 && " It has been returned to the farmer."}
                    {investment.status === 3 && " It has been transferred to the investor."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {investment.status === 1 && (
          <div className="card bg-base-100 shadow-xl mt-6">
            <div className="card-body">
              <h2 className="card-title text-xl mb-4">Actions</h2>

              <div className="flex gap-4 justify-center">
                {/* Repay button for farmer */}
                {connectedAddress?.toLowerCase() === investment.borrower.toLowerCase() && (
                  <button className="btn btn-success btn-lg" onClick={handleRepay} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        Repay Investment (
                        <EthDisplay amount={investment.principal + investment.interest} className="inline" />)
                      </>
                    )}
                  </button>
                )}

                {/* Liquidate button for investor (if expired) */}
                {connectedAddress?.toLowerCase() === investment.lender.toLowerCase() && isExpired && (
                  <button className="btn btn-error btn-lg" onClick={handleLiquidate} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      "Liquidate Investment"
                    )}
                  </button>
                )}
              </div>

              {/* Status messages */}
              {investment.status === 1 && !isExpired && (
                <div className="alert alert-info mt-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span>Investment is active. Farmer has {Math.floor(daysRemaining)} days remaining to repay.</span>
                </div>
              )}

              {investment.status === 1 && isExpired && (
                <div className="alert alert-warning mt-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>Investment has expired. Investor can now liquidate the collateral.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {investment.status === 2 && (
          <div className="alert alert-success mt-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Investment has been successfully repaid!</span>
          </div>
        )}

        {investment.status === 3 && (
          <div className="alert alert-error mt-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Investment has been liquidated. The collateral NFT has been transferred to the investor.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestmentDetailPage;
