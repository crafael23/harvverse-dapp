"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Address, EthDisplay, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

interface UserInvestment {
  loanId: bigint;
  role: "borrower" | "lender";
  counterparty: string;
  amount: bigint;
  status: "requested" | "funded" | "repaid" | "liquidated";
  nftTokenId?: bigint;
}

const DashboardPage = () => {
  const { address: connectedAddress } = useAccount();
  const [userInvestments, setUserInvestments] = useState<UserInvestment[]>([]);
  const [userRole, setUserRole] = useState<"farmer" | "investor" | "both">("farmer");

  // Get all investment events
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

    const investments: UserInvestment[] = [];
    let isFarmer = false;
    let isInvestor = false;

    // Process investment requests where user is borrower
    loanRequestEvents?.forEach(event => {
      if (event.args.borrower === connectedAddress) {
        isFarmer = true;
        const loanId = event.args.loanId || 0n;

        // Check if funded
        const fundedEvent = loanFundedEvents?.find(e => e.args.loanId === loanId);
        const repaidEvent = loanRepaidEvents?.find(e => e.args.loanId === loanId);
        const liquidatedEvent = loanLiquidatedEvents?.find(e => e.args.loanId === loanId);

        let status: UserInvestment["status"] = "requested";
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

        investments.push({
          loanId,
          role: "borrower",
          counterparty,
          amount: event.args.amount || 0n,
          status,
          nftTokenId: event.args.nftTokenId,
        });
      }
    });

    // Process funded investments where user is lender
    loanFundedEvents?.forEach(event => {
      if (event.args.lender === connectedAddress) {
        isInvestor = true;
        const loanId = event.args.loanId || 0n;

        // Get investment details from request event
        const requestEvent = loanRequestEvents?.find(e => e.args.loanId === loanId);
        const repaidEvent = loanRepaidEvents?.find(e => e.args.loanId === loanId);
        const liquidatedEvent = loanLiquidatedEvents?.find(e => e.args.loanId === loanId);

        let status: UserInvestment["status"] = "funded";
        if (liquidatedEvent) status = "liquidated";
        else if (repaidEvent) status = "repaid";

        investments.push({
          loanId,
          role: "lender",
          counterparty: requestEvent?.args.borrower || "",
          amount: requestEvent?.args.amount || 0n,
          status,
          nftTokenId: requestEvent?.args.nftTokenId,
        });
      }
    });

    setUserInvestments(investments);

    if (isFarmer && isInvestor) setUserRole("both");
    else if (isInvestor) setUserRole("investor");
    else setUserRole("farmer");
  }, [connectedAddress, loanRequestEvents, loanFundedEvents, loanRepaidEvents, loanLiquidatedEvents]);

  const getStatusBadge = (status: UserInvestment["status"]) => {
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
              ? "Farmer & Investor"
              : userRole === "investor"
                ? "Investor Account"
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
              <Link href="/request-investment" className="btn btn-secondary btn-lg">
                💰 Request Investment
              </Link>
            </>
          )}
          {(userRole === "investor" || userRole === "both") && (
            <Link href="/fund" className="btn btn-accent btn-lg">
              💸 Make Investments
            </Link>
          )}
        </div>

        {/* User Investments */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Your Investments</h2>

            {userInvestments.length === 0 ? (
              <p className="text-center py-8">No investments found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Investment ID</th>
                      <th>Role</th>
                      <th>Counterparty</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userInvestments.map(investment => (
                      <tr key={investment.loanId.toString()}>
                        <td>#{investment.loanId.toString()}</td>
                        <td className="capitalize">{investment.role === "borrower" ? "Farmer" : "Investor"}</td>
                        <td>
                          <Address address={investment.counterparty} />
                        </td>
                        <td>
                          <EthDisplay amount={investment.amount} className="text-sm" />
                        </td>
                        <td>{getStatusBadge(investment.status)}</td>
                        <td>
                          <Link href={`/investment/${investment.loanId}`} className="btn btn-sm btn-primary">
                            View Details
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

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="stat bg-base-100 shadow-xl rounded-lg">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Total Investments</div>
            <div className="stat-value text-primary">{userInvestments.length}</div>
            <div className="stat-desc">All time</div>
          </div>

          <div className="stat bg-base-100 shadow-xl rounded-lg">
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
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Active</div>
            <div className="stat-value text-secondary">{userInvestments.filter(i => i.status === "funded").length}</div>
            <div className="stat-desc">Currently funded</div>
          </div>

          <div className="stat bg-base-100 shadow-xl rounded-lg">
            <div className="stat-figure text-accent">
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
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Volume</div>
            <div className="stat-value text-accent">
              <EthDisplay
                amount={userInvestments.reduce((total, investment) => total + investment.amount, 0n)}
                className="text-2xl"
                showBoth={false}
              />
            </div>
            <div className="stat-desc">
              <EthDisplay
                amount={userInvestments.reduce((total, investment) => total + investment.amount, 0n)}
                className="text-xs"
                showUsd={true}
                showBoth={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
