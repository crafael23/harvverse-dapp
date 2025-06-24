"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { Address, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface LoanData {
  borrower: string;
  lender: string;
  nftContract: string;
  nftTokenId: bigint;
  principal: bigint;
  interest: bigint;
  deadline: bigint;
  status: number;
}

const LoanDetailPage = () => {
  const params = useParams<{ id: string }>();
  const loanId = BigInt(params.id);
  const { address: connectedAddress } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get loan details
  const { data: loanData } = useScaffoldReadContract({
    contractName: "MicroLoan",
    functionName: "getLoan",
    args: [loanId],
  });

  const { writeContractAsync: writeMicroLoan } = useScaffoldWriteContract("MicroLoan");

  const loan = loanData as LoanData | undefined;

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
    if (!loan) return;

    try {
      setIsProcessing(true);
      const totalRepayment = loan.principal + loan.interest;

      // Repay the loan with ETH
      await writeMicroLoan({
        functionName: "repay",
        args: [loanId],
        value: totalRepayment, // Send ETH for repayment
      });

      notification.success("Loan repaid successfully!");
    } catch (error) {
      console.error("Error repaying loan:", error);
      notification.error("Failed to repay loan");
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

      notification.success("Loan liquidated successfully!");
    } catch (error) {
      console.error("Error liquidating loan:", error);
      notification.error("Failed to liquidate loan");
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

  if (!loan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const isExpired = loan.deadline > 0n && BigInt(Math.floor(Date.now() / 1000)) > loan.deadline;
  const timeRemaining = loan.deadline > 0n ? loan.deadline - BigInt(Math.floor(Date.now() / 1000)) : 0n;
  const daysRemaining = timeRemaining > 0n ? Number(timeRemaining) / (24 * 60 * 60) : 0;

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full max-w-4xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Loan #{loanId.toString()}</span>
          <span className="block text-2xl mt-2">{getStatusBadge(loan.status)}</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Loan Details Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Loan Details</h2>

              <div className="space-y-3">
                <div>
                  <span className="text-sm opacity-70">Borrower:</span>
                  <Address address={loan.borrower} />
                </div>

                {loan.lender !== "0x0000000000000000000000000000000000000000" && (
                  <div>
                    <span className="text-sm opacity-70">Lender:</span>
                    <Address address={loan.lender} />
                  </div>
                )}

                <div>
                  <span className="text-sm opacity-70">Principal Amount:</span>
                  <p className="text-lg font-bold">{formatEther(loan.principal)} ETH</p>
                </div>

                <div>
                  <span className="text-sm opacity-70">Interest:</span>
                  <p className="text-lg font-bold">{formatEther(loan.interest)} ETH</p>
                </div>

                <div>
                  <span className="text-sm opacity-70">Total Repayment:</span>
                  <p className="text-lg font-bold text-primary">{formatEther(loan.principal + loan.interest)} ETH</p>
                </div>

                {loan.deadline > 0n && (
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
                  <Address address={loan.nftContract} />
                </div>

                <div>
                  <span className="text-sm opacity-70">Token ID:</span>
                  <p className="text-lg font-bold">#{loan.nftTokenId.toString()}</p>
                </div>

                <div className="divider"></div>

                <div className="bg-base-200 p-4 rounded-lg">
                  <p className="text-sm">
                    This CropNFT is held as collateral for the loan.
                    {loan.status === 1 && " It will be returned upon successful repayment."}
                    {loan.status === 2 && " It has been returned to the borrower."}
                    {loan.status === 3 && " It has been transferred to the lender."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {loan.status === 1 && (
          <div className="card bg-base-100 shadow-xl mt-6">
            <div className="card-body">
              <h2 className="card-title text-xl mb-4">Actions</h2>

              <div className="flex flex-col md:flex-row gap-4">
                {connectedAddress === loan.borrower && !isExpired && (
                  <button className="btn btn-success btn-lg flex-1" onClick={handleRepay} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      `Repay ${formatEther(loan.principal + loan.interest)} ETH`
                    )}
                  </button>
                )}

                {connectedAddress === loan.lender && isExpired && (
                  <button className="btn btn-error btn-lg flex-1" onClick={handleLiquidate} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      "Liquidate Loan"
                    )}
                  </button>
                )}

                {connectedAddress !== loan.borrower && connectedAddress !== loan.lender && (
                  <div className="alert alert-info">
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
                    <span>Only the borrower can repay this loan, or the lender can liquidate after expiry.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanDetailPage;
