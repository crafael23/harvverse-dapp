"use client";

import { useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Address, EtherInput, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

enum AgreementStatus {
  Proposed = 0,
  Funded = 1,
  ProduceReady = 2,
  Settled = 3,
  Defaulted = 4,
}

enum FulfilmentOption {
  UNSET = 0,
  DELIVER_PRODUCE = 1,
  SHARE_PROFITS = 2,
}

interface Agreement {
  id: number;
  farmer: string;
  investor: string;
  cropNFT: string;
  cropTokenId: bigint;
  investAmount: bigint;
  investorShareBps: bigint;
  expectedQuantity: bigint;
  option: FulfilmentOption;
  harvestDeadline: bigint;
  deliveryOrSaleDeadline: bigint;
  status: AgreementStatus;
}

interface CropNFT {
  tokenId: bigint;
  tokenURI: string;
  linkedAgreementId?: number;
}

const DashboardPage = () => {
  const { address: connectedAddress } = useAccount();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [userNFTs, setUserNFTs] = useState<CropNFT[]>([]);
  const [saleAmount, setSaleAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [loadingData, setLoadingData] = useState(true);

  const { writeContractAsync: writeInvestmentAgreement } = useScaffoldWriteContract("InvestmentAgreement");

  // Get the agreement counter
  const { data: agreementCounter } = useScaffoldReadContract({
    contractName: "InvestmentAgreement",
    functionName: "agreementCounter",
  });

  // Oracle functionality removed for conceptual testing
  // const { data: oracleAddress } = useScaffoldReadContract({
  //   contractName: "InvestmentAgreement",
  //   functionName: "oracle",
  // });

  // Get user's NFT balance
  const { data: nftBalance } = useScaffoldReadContract({
    contractName: "CropNFT",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  // Get contract instances
  const { data: investmentContract } = useScaffoldContract({
    contractName: "InvestmentAgreement",
  });

  const { data: cropNFTContract } = useScaffoldContract({
    contractName: "CropNFT",
  });

  // const isOracle = connectedAddress === oracleAddress; // Oracle functionality removed
  const totalAgreements = agreementCounter ? Number(agreementCounter) : 0;

  // Fetch real agreement data from chain
  useEffect(() => {
    const fetchAgreements = async () => {
      if (!investmentContract || !connectedAddress || totalAgreements === 0) {
        setAgreements([]);
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      const fetchedAgreements: Agreement[] = [];

      try {
        for (let i = 0; i < totalAgreements; i++) {
          const agreementData = await investmentContract.read.agreements([BigInt(i)]);

          // Parse the tuple data
          const agreement: Agreement = {
            id: i,
            farmer: agreementData[0] as string,
            investor: agreementData[1] as string,
            cropNFT: agreementData[2] as string,
            cropTokenId: agreementData[3] as bigint,
            investAmount: agreementData[4] as bigint,
            investorShareBps: agreementData[5] as bigint,
            expectedQuantity: agreementData[6] as bigint,
            option: agreementData[7] as FulfilmentOption,
            harvestDeadline: agreementData[8] as bigint,
            deliveryOrSaleDeadline: agreementData[9] as bigint,
            status: agreementData[10] as AgreementStatus,
          };

          // Only include agreements where user is farmer or investor
          if (agreement.farmer === connectedAddress || agreement.investor === connectedAddress) {
            fetchedAgreements.push(agreement);
          }
        }
      } catch (error) {
        console.error("Error fetching agreements:", error);
      }

      setAgreements(fetchedAgreements);
      setLoadingData(false);
    };

    fetchAgreements();
  }, [connectedAddress, totalAgreements]);

  // Fetch user's NFTs (for farmers) - removed agreements dependency to prevent infinite loop
  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!nftBalance || !connectedAddress || !cropNFTContract) {
        setUserNFTs([]);
        return;
      }

      const nfts: CropNFT[] = [];
      const balance = Number(nftBalance);

      try {
        for (let i = 0; i < Math.min(balance * 10, 100); i++) {
          try {
            const owner = await cropNFTContract.read.ownerOf([BigInt(i)]);

            if (owner === connectedAddress) {
              const uri = await cropNFTContract.read.tokenURI([BigInt(i)]);

              nfts.push({
                tokenId: BigInt(i),
                tokenURI: uri || "",
                linkedAgreementId: undefined, // Will be updated in separate effect
              });

              if (nfts.length >= balance) break;
            }
          } catch {
            // Token doesn't exist, continue
          }
        }
      } catch (error) {
        console.error("Error fetching NFTs:", error);
      }

      setUserNFTs(nfts);
    };

    fetchUserNFTs();
  }, [nftBalance, connectedAddress]);

  // Update NFT linking when agreements change - separate effect to prevent circular dependency
  useEffect(() => {
    if (agreements.length > 0 && userNFTs.length > 0) {
      setUserNFTs(prevNFTs =>
        prevNFTs.map(nft => {
          const linkedAgreement = agreements.find(
            agreement => Number(agreement.cropTokenId) === Number(nft.tokenId) && agreement.farmer === connectedAddress,
          );
          return {
            ...nft,
            linkedAgreementId: linkedAgreement?.id,
          };
        }),
      );
    }
  }, [agreements, connectedAddress]);

  // Agreement actions
  const handleMarkHarvestReady = async (agreementId: number) => {
    try {
      setIsLoading(prev => ({ ...prev, [`harvest-${agreementId}`]: true }));

      await writeInvestmentAgreement({
        functionName: "markHarvestReady",
        args: [BigInt(agreementId)],
      });

      notification.success("Harvest marked as ready!");
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error("Error marking harvest ready:", error);
      notification.error("Failed to mark harvest ready");
    } finally {
      setIsLoading(prev => ({ ...prev, [`harvest-${agreementId}`]: false }));
    }
  };

  const handleReportSale = async (agreementId: number) => {
    if (!saleAmount) {
      notification.error("Please enter sale amount");
      return;
    }

    try {
      setIsLoading(prev => ({ ...prev, [`sale-${agreementId}`]: true }));

      const saleAmountWei = parseEther(saleAmount);

      await writeInvestmentAgreement({
        functionName: "reportSale",
        args: [BigInt(agreementId), saleAmountWei],
        value: saleAmountWei,
      });

      notification.success("Sale reported successfully!");
      setSaleAmount("");
      window.location.reload();
    } catch (error) {
      console.error("Error reporting sale:", error);
      notification.error("Failed to report sale");
    } finally {
      setIsLoading(prev => ({ ...prev, [`sale-${agreementId}`]: false }));
    }
  };

  const handleConfirmDelivery = async (agreementId: number) => {
    // Remove oracle restriction for conceptual testing
    // if (!isOracle) {
    //   notification.error("Only oracle can confirm delivery");
    //   return;
    // }

    try {
      setIsLoading(prev => ({ ...prev, [`delivery-${agreementId}`]: true }));

      await writeInvestmentAgreement({
        functionName: "confirmDelivery",
        args: [BigInt(agreementId)],
      });

      notification.success("Delivery confirmed successfully!");
      window.location.reload();
    } catch (error) {
      console.error("Error confirming delivery:", error);
      notification.error("Failed to confirm delivery");
    } finally {
      setIsLoading(prev => ({ ...prev, [`delivery-${agreementId}`]: false }));
    }
  };

  const handleClaimCollateral = async (agreementId: number) => {
    try {
      setIsLoading(prev => ({ ...prev, [`claim-${agreementId}`]: true }));

      await writeInvestmentAgreement({
        functionName: "claimCollateral",
        args: [BigInt(agreementId)],
      });

      notification.success("Collateral claimed successfully!");
      window.location.reload();
    } catch (error) {
      console.error("Error claiming collateral:", error);
      notification.error("Failed to claim collateral");
    } finally {
      setIsLoading(prev => ({ ...prev, [`claim-${agreementId}`]: false }));
    }
  };

  const getStatusColor = (status: AgreementStatus) => {
    switch (status) {
      case AgreementStatus.Proposed:
        return "badge-warning";
      case AgreementStatus.Funded:
        return "badge-info";
      case AgreementStatus.ProduceReady:
        return "badge-accent";
      case AgreementStatus.Settled:
        return "badge-success";
      case AgreementStatus.Defaulted:
        return "badge-error";
      default:
        return "badge-ghost";
    }
  };

  const isDeadlinePassed = (deadline: bigint) => {
    return Date.now() / 1000 > Number(deadline);
  };

  if (!connectedAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Connect Your Wallet</h1>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  const farmerAgreements = agreements.filter(a => a.farmer === connectedAddress);
  const investorAgreements = agreements.filter(a => a.investor === connectedAddress);

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full max-w-6xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Dashboard</span>
          <span className="block text-2xl mt-2">Your agricultural investments & agreements</span>
        </h1>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Your Role</div>
              <div className="stat-value text-lg">
                {farmerAgreements.length > 0 && investorAgreements.length > 0
                  ? "👨‍🌾💼 Both"
                  : farmerAgreements.length > 0
                    ? "👨‍🌾 Farmer"
                    : investorAgreements.length > 0
                      ? "💼 Investor"
                      : "👤 User"}
              </div>
            </div>
          </div>

          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Your CropNFTs</div>
              <div className="stat-value">{userNFTs.length}</div>
              <div className="stat-desc">
                {userNFTs.filter(nft => nft.linkedAgreementId !== undefined).length} used in agreements
              </div>
            </div>
          </div>

          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Your Agreements</div>
              <div className="stat-value">{agreements.length}</div>
              <div className="stat-desc">
                {farmerAgreements.length} as farmer, {investorAgreements.length} as investor
              </div>
            </div>
          </div>

          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Total On-Chain</div>
              <div className="stat-value">{totalAgreements}</div>
              <div className="stat-desc">All platform agreements</div>
            </div>
          </div>
        </div>

        {loadingData ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
            <span className="ml-4 text-lg">Loading your data...</span>
          </div>
        ) : (
          <>
            {/* Farmer Section */}
            {farmerAgreements.length > 0 || userNFTs.length > 0 ? (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center">👨‍🌾 Farmer Dashboard</h2>

                {/* User's CropNFTs */}
                {userNFTs.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Your CropNFTs</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userNFTs.map(nft => {
                        const linkedAgreement =
                          nft.linkedAgreementId !== undefined
                            ? agreements.find(a => a.id === nft.linkedAgreementId)
                            : undefined;
                        const isAvailable = nft.linkedAgreementId === undefined;

                        return (
                          <div
                            key={nft.tokenId.toString()}
                            className="card bg-green-50 shadow-lg border-2 border-green-200"
                          >
                            <div className="card-body p-4">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="card-title text-sm font-bold">CropNFT #{nft.tokenId.toString()}</h4>
                                {isAvailable ? (
                                  <div className="badge badge-success badge-sm">✅ Available</div>
                                ) : (
                                  <div className="badge badge-warning badge-sm">📋 In Use</div>
                                )}
                              </div>

                              <div className="text-xs space-y-2 mb-3">
                                <div>
                                  <strong>Token URI:</strong>
                                  <p className="text-gray-600 break-all">{nft.tokenURI.slice(0, 40)}...</p>
                                </div>

                                {linkedAgreement && (
                                  <div className="space-y-1">
                                    <div>
                                      <strong>Agreement:</strong> #{linkedAgreement.id}
                                    </div>
                                    <div>
                                      <strong>Status:</strong>
                                      <span
                                        className={`ml-1 text-xs px-2 py-1 rounded ${getStatusColor(linkedAgreement.status)}`}
                                      >
                                        {AgreementStatus[linkedAgreement.status]}
                                      </span>
                                    </div>
                                    <div>
                                      <strong>Investment:</strong> {formatEther(linkedAgreement.investAmount)} ETH
                                    </div>
                                    {linkedAgreement.investor !== "0x0000000000000000000000000000000000000000" && (
                                      <div>
                                        <strong>Investor:</strong> {linkedAgreement.investor.slice(0, 8)}...
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="card-actions justify-end mt-3">
                                {isAvailable ? (
                                  // Available NFT - can create deals
                                  <div className="flex flex-col w-full gap-2">
                                    <a href="/create-deal" className="btn btn-primary btn-xs">
                                      🤝 Create Deal
                                    </a>
                                    <a href={`/investment/${nft.tokenId}`} className="btn btn-outline btn-xs">
                                      📊 View Details
                                    </a>
                                  </div>
                                ) : linkedAgreement ? (
                                  // NFT in use - show relevant actions based on agreement status
                                  <div className="flex flex-col w-full gap-2">
                                    <a href={`/investment/${linkedAgreement.id}`} className="btn btn-primary btn-xs">
                                      📋 View Agreement
                                    </a>

                                    {linkedAgreement.status === AgreementStatus.Proposed && (
                                      <a href="/invest" className="btn btn-secondary btn-xs">
                                        🔍 Find Investors
                                      </a>
                                    )}

                                    {linkedAgreement.status === AgreementStatus.Funded && (
                                      <span className="text-xs text-green-600 font-semibold text-center">
                                        🌱 Funding Complete - Focus on farming!
                                      </span>
                                    )}

                                    {linkedAgreement.status === AgreementStatus.ProduceReady && (
                                      <span className="text-xs text-blue-600 font-semibold text-center">
                                        📦 Harvest Ready - Awaiting delivery
                                      </span>
                                    )}

                                    {linkedAgreement.status === AgreementStatus.Settled && (
                                      <span className="text-xs text-purple-600 font-semibold text-center">
                                        ✅ Deal Complete!
                                      </span>
                                    )}

                                    {linkedAgreement.status === AgreementStatus.Defaulted && (
                                      <span className="text-xs text-red-600 font-semibold text-center">
                                        ❌ Deal Defaulted
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 text-center">Loading agreement details...</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Farmer Agreements */}
                {farmerAgreements.length > 0 && (
                  <div className="grid grid-cols-1 gap-4">
                    {farmerAgreements.map(agreement => (
                      <div key={agreement.id} className="card bg-base-100 shadow-xl">
                        <div className="card-body">
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="card-title">
                              Agreement #{agreement.id}
                              <div className={`badge ${getStatusColor(agreement.status)}`}>
                                {AgreementStatus[agreement.status]}
                              </div>
                            </h3>
                            <div className="badge badge-primary">👨‍🌾 You are the Farmer</div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="space-y-2">
                              <div>
                                <strong>Investment Amount:</strong> {formatEther(agreement.investAmount)} ETH
                              </div>
                              <div>
                                <strong>Expected Yield:</strong> {formatEther(agreement.expectedQuantity)} kg
                              </div>
                              <div>
                                <strong>Profit Share:</strong> {Number(agreement.investorShareBps) / 100}%
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <strong>Investor:</strong>
                                {agreement.investor === "0x0000000000000000000000000000000000000000" ? (
                                  <span className="text-gray-500 ml-2">Not funded yet</span>
                                ) : (
                                  <Address address={agreement.investor} />
                                )}
                              </div>
                              <div>
                                <strong>CropNFT:</strong> #{agreement.cropTokenId.toString()}
                              </div>
                              {agreement.option !== FulfilmentOption.UNSET && (
                                <div>
                                  <strong>Option:</strong>{" "}
                                  {agreement.option === FulfilmentOption.DELIVER_PRODUCE
                                    ? "📦 Delivery"
                                    : "💰 Profit Share"}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div>
                                <strong>Harvest Deadline:</strong>
                              </div>
                              <div
                                className={`text-sm ${isDeadlinePassed(agreement.harvestDeadline) ? "text-red-500" : "text-green-600"}`}
                              >
                                {new Date(Number(agreement.harvestDeadline) * 1000).toLocaleDateString()}
                                {isDeadlinePassed(agreement.harvestDeadline) && <span> (OVERDUE)</span>}
                              </div>
                              <div>
                                <strong>Delivery Deadline:</strong>
                              </div>
                              <div
                                className={`text-sm ${isDeadlinePassed(agreement.deliveryOrSaleDeadline) ? "text-red-500" : "text-green-600"}`}
                              >
                                {new Date(Number(agreement.deliveryOrSaleDeadline) * 1000).toLocaleDateString()}
                                {isDeadlinePassed(agreement.deliveryOrSaleDeadline) && <span> (OVERDUE)</span>}
                              </div>
                            </div>
                          </div>

                          {/* Farmer Actions */}
                          <div className="card-actions justify-end">
                            {agreement.status === AgreementStatus.Funded &&
                              !isDeadlinePassed(agreement.harvestDeadline) && (
                                <button
                                  className={`btn btn-primary ${isLoading[`harvest-${agreement.id}`] ? "loading" : ""}`}
                                  onClick={() => handleMarkHarvestReady(agreement.id)}
                                  disabled={isLoading[`harvest-${agreement.id}`]}
                                >
                                  Mark Harvest Ready
                                </button>
                              )}

                            {agreement.status === AgreementStatus.ProduceReady &&
                              agreement.option === FulfilmentOption.SHARE_PROFITS &&
                              !isDeadlinePassed(agreement.deliveryOrSaleDeadline) && (
                                <div className="flex gap-2 items-center">
                                  <EtherInput placeholder="Sale amount" value={saleAmount} onChange={setSaleAmount} />
                                  <button
                                    className={`btn btn-success ${isLoading[`sale-${agreement.id}`] ? "loading" : ""}`}
                                    onClick={() => handleReportSale(agreement.id)}
                                    disabled={isLoading[`sale-${agreement.id}`] || !saleAmount}
                                  >
                                    Report Sale
                                  </button>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Investor Section */}
            {investorAgreements.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center">💼 Investor Dashboard</h2>

                <div className="grid grid-cols-1 gap-4">
                  {investorAgreements.map(agreement => (
                    <div key={agreement.id} className="card bg-base-100 shadow-xl">
                      <div className="card-body">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="card-title">
                            Agreement #{agreement.id}
                            <div className={`badge ${getStatusColor(agreement.status)}`}>
                              {AgreementStatus[agreement.status]}
                            </div>
                          </h3>
                          <div className="badge badge-accent">💼 You are the Investor</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="space-y-2">
                            <div>
                              <strong>Your Investment:</strong> {formatEther(agreement.investAmount)} ETH
                            </div>
                            <div>
                              <strong>Expected Returns:</strong>
                              {agreement.option === FulfilmentOption.DELIVER_PRODUCE
                                ? ` ${formatEther(agreement.expectedQuantity)} kg crops`
                                : ` ${Number(agreement.investorShareBps) / 100}% of sales`}
                            </div>
                            <div>
                              <strong>Your Option:</strong>{" "}
                              {agreement.option === FulfilmentOption.DELIVER_PRODUCE
                                ? "📦 Delivery"
                                : "💰 Profit Share"}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <strong>Farmer:</strong> <Address address={agreement.farmer} />
                            </div>
                            <div>
                              <strong>CropNFT:</strong> #{agreement.cropTokenId.toString()}
                            </div>
                            <div>
                              <strong>Expected Yield:</strong> {formatEther(agreement.expectedQuantity)} kg
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <strong>Harvest Deadline:</strong>
                            </div>
                            <div
                              className={`text-sm ${isDeadlinePassed(agreement.harvestDeadline) ? "text-red-500" : "text-green-600"}`}
                            >
                              {new Date(Number(agreement.harvestDeadline) * 1000).toLocaleDateString()}
                            </div>
                            <div>
                              <strong>Delivery Deadline:</strong>
                            </div>
                            <div
                              className={`text-sm ${isDeadlinePassed(agreement.deliveryOrSaleDeadline) ? "text-red-500" : "text-green-600"}`}
                            >
                              {new Date(Number(agreement.deliveryOrSaleDeadline) * 1000).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Investor Actions */}
                        <div className="card-actions justify-end">
                          {/* Delivery Confirmation for DELIVER_PRODUCE option */}
                          {agreement.status === AgreementStatus.ProduceReady &&
                            agreement.option === FulfilmentOption.DELIVER_PRODUCE &&
                            !isDeadlinePassed(agreement.deliveryOrSaleDeadline) && (
                              <button
                                className={`btn btn-success ${isLoading[`delivery-${agreement.id}`] ? "loading" : ""}`}
                                onClick={() => handleConfirmDelivery(agreement.id)}
                                disabled={isLoading[`delivery-${agreement.id}`]}
                              >
                                📦 Confirm Delivery Received
                              </button>
                            )}

                          {/* Collateral Claim for defaults */}
                          {(agreement.status === AgreementStatus.Defaulted ||
                            (isDeadlinePassed(agreement.deliveryOrSaleDeadline) &&
                              agreement.status !== AgreementStatus.Settled)) && (
                            <button
                              className={`btn btn-warning ${isLoading[`claim-${agreement.id}`] ? "loading" : ""}`}
                              onClick={() => handleClaimCollateral(agreement.id)}
                              disabled={isLoading[`claim-${agreement.id}`]}
                            >
                              Claim Collateral NFT
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Oracle Section removed for conceptual testing - delivery confirmation now handled by investors */}

            {/* Empty State */}
            {agreements.length === 0 && userNFTs.length === 0 && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body text-center">
                  <h2 className="card-title justify-center text-2xl">Welcome to HarvVerse! 🌾</h2>
                  <p className="text-lg mb-4">You don&apos;t have any agreements or CropNFTs yet.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-bold mb-2">👨‍🌾 For Farmers</h3>
                      <p className="text-sm mb-3">Start by minting CropNFTs and creating investment deals</p>
                      <div className="space-y-2">
                        <a href="/mint" className="btn btn-primary btn-sm w-full">
                          🌱 Mint CropNFT
                        </a>
                        <a href="/create-deal" className="btn btn-secondary btn-sm w-full">
                          🤝 Create Deal
                        </a>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-bold mb-2">💼 For Investors</h3>
                      <p className="text-sm mb-3">Browse available deals and start investing</p>
                      <div className="space-y-2">
                        <a href="/invest" className="btn btn-accent btn-sm w-full">
                          🔍 Browse Deals
                        </a>
                        <a href="/fund" className="btn btn-outline btn-sm w-full">
                          💰 Make Investments
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
