"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { Address, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

interface UserLoan {
  loanId: bigint;
  role: "borrower" | "lender";
  counterparty: string;
  amount: bigint;
  status: "requested" | "funded" | "repaid" | "liquidated";
  nftTokenId?: bigint;
}

const DashboardPage = () => {
  const { address: connectedAddress } = useAccount();
  const [userLoans, setUserLoans] = useState<UserLoan[]>([]);
  const [userRole, setUserRole] = useState<"farmer" | "business" | "both">("farmer");

  // Get all loan events
  const { data: loanRequestEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanRequested",
    fromBlock: 0n,
  });

  const { data: loanFundedEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanFunded",
    fromBlock: 0n,
  });

  const { data: loanRepaidEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanRepaid",
    fromBlock: 0n,
  });

  const { data: loanLiquidatedEvents } = useScaffoldEventHistory({
    contractName: "MicroLoan",
    eventName: "LoanLiquidated",
    fromBlock: 0n,
  });

  useEffect(() => {
    if (!connectedAddress) return;

    const loans: UserLoan[] = [];
    let isFarmer = false;
    let isBusiness = false;

    // Process loan requests where user is borrower
    loanRequestEvents?.forEach(event => {
      if (event.args.borrower === connectedAddress) {
        isFarmer = true;
        const loanId = event.args.loanId || 0n;

        // Check if funded
        const fundedEvent = loanFundedEvents?.find(e => e.args.loanId === loanId);
        const repaidEvent = loanRepaidEvents?.find(e => e.args.loanId === loanId);
        const liquidatedEvent = loanLiquidatedEvents?.find(e => e.args.loanId === loanId);

        let status: UserLoan["status"] = "requested";
        let counterparty = "";

        if (liquidatedEvent) {
          status = "liquidated";
          counterparty = fundedEvent?.args.lender || "";
        } else if (repaidEvent) {
          status = "repaid";
          counterparty = fundedEvent?.args.lender || "";
        } else if (fundedEvent) {
          status = "funded";
          counterparty = fundedEvent.args.lender || "";
        }

        loans.push({
          loanId,
          role: "borrower",
          counterparty,
          amount: event.args.amount || 0n,
          status,
          nftTokenId: event.args.nftTokenId,
        });
      }
    });

    // Process funded loans where user is lender
    loanFundedEvents?.forEach(event => {
      if (event.args.lender === connectedAddress) {
        isBusiness = true;
        const loanId = event.args.loanId || 0n;

        // Get loan details from request event
        const requestEvent = loanRequestEvents?.find(e => e.args.loanId === loanId);
        const repaidEvent = loanRepaidEvents?.find(e => e.args.loanId === loanId);
        const liquidatedEvent = loanLiquidatedEvents?.find(e => e.args.loanId === loanId);

        let status: UserLoan["status"] = "funded";
        if (liquidatedEvent) status = "liquidated";
        else if (repaidEvent) status = "repaid";

        loans.push({
          loanId,
          role: "lender",
          counterparty: requestEvent?.args.borrower || "",
          amount: requestEvent?.args.amount || 0n,
          status,
          nftTokenId: requestEvent?.args.nftTokenId,
        });
      }
    });

    setUserLoans(loans);

    if (isFarmer && isBusiness) setUserRole("both");
    else if (isBusiness) setUserRole("business");
    else setUserRole("farmer");
  }, [connectedAddress, loanRequestEvents, loanFundedEvents, loanRepaidEvents, loanLiquidatedEvents]);

  const getStatusBadge = (status: UserLoan["status"]) => {
    const badges = {
      requested: <span className="badge badge-warning">Requested</span>,
      funded: <span className="badge badge-info">Funded</span>,
      repaid: <span className="badge badge-success">Repaid</span>,
      liquidated: <span className="badge badge-error">Liquidated</span>,
    };
    return badges[status];
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
          <span className="block text-4xl font-bold">Dashboard</span>
          <span className="block text-2xl mt-2">
            {userRole === "both"
              ? "Farmer & Business"
              : userRole === "business"
                ? "Business Account"
                : "Farmer Account"}
          </span>
        </h1>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {(userRole === "farmer" || userRole === "both") && (
            <>
              <Link href="/mint" className="btn btn-primary btn-lg">
                🌾 Mint CropNFT
              </Link>
              <Link href="/request-loan" className="btn btn-secondary btn-lg">
                💰 Request Loan
              </Link>
            </>
          )}
          {(userRole === "business" || userRole === "both") && (
            <Link href="/fund" className="btn btn-accent btn-lg">
              💸 Fund Loans
            </Link>
          )}
        </div>

        {/* User Loans */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Your Loans</h2>

            {userLoans.length === 0 ? (
              <p className="text-center py-8">No loans found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Loan ID</th>
                      <th>Role</th>
                      <th>Counterparty</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userLoans.map(loan => (
                      <tr key={loan.loanId.toString()}>
                        <td>#{loan.loanId.toString()}</td>
                        <td>
                          <span className={`badge ${loan.role === "borrower" ? "badge-primary" : "badge-secondary"}`}>
                            {loan.role}
                          </span>
                        </td>
                        <td>
                          {loan.counterparty ? (
                            <Address address={loan.counterparty} />
                          ) : (
                            <span className="text-gray-500">Waiting...</span>
                          )}
                        </td>
                        <td>{formatEther(loan.amount)} ETH</td>
                        <td>{getStatusBadge(loan.status)}</td>
                        <td>
                          <Link href={`/loan/${loan.loanId.toString()}`} className="btn btn-sm btn-ghost">
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="stats shadow mt-8 w-full">
          <div className="stat">
            <div className="stat-figure text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Total Loans</div>
            <div className="stat-value text-primary">{userLoans.length}</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Active Loans</div>
            <div className="stat-value text-secondary">{userLoans.filter(l => l.status === "funded").length}</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-success">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Completed</div>
            <div className="stat-value text-success">{userLoans.filter(l => l.status === "repaid").length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
