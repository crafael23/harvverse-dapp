"use client";

import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { EtherInput, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import {
  useDeployedContractInfo,
  useScaffoldContract,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface NFTData {
  tokenId: bigint;
  tokenURI: string;
}

const RequestInvestmentPage = () => {
  const { address: connectedAddress } = useAccount();
  const [selectedNFT, setSelectedNFT] = useState<string>("");
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [userNFTs, setUserNFTs] = useState<NFTData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get deployed contract info
  const { data: cropNFTInfo } = useDeployedContractInfo("CropNFT");
  const { data: microLoanInfo } = useDeployedContractInfo("MicroLoan");

  // Get user's NFT balance
  const { data: nftBalance } = useScaffoldReadContract({
    contractName: "CropNFT",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  // Get contract instance for reading
  const { data: cropNFTContract } = useScaffoldContract({
    contractName: "CropNFT",
  });

  const { writeContractAsync: writeCropNFT } = useScaffoldWriteContract("CropNFT");
  const { writeContractAsync: writeMicroLoan } = useScaffoldWriteContract("MicroLoan");

  // Fetch user's NFTs
  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!nftBalance || !connectedAddress || !cropNFTContract) return;

      const nfts: NFTData[] = [];
      const balance = Number(nftBalance);

      // Note: This is a simplified approach. In production, you'd want to use
      // events or a more efficient method to get token IDs
      // For now, we'll check the first 100 token IDs
      for (let i = 0; i < Math.min(balance * 10, 100); i++) {
        try {
          const owner = await cropNFTContract.read.ownerOf([BigInt(i)]);

          if (owner === connectedAddress) {
            const uri = await cropNFTContract.read.tokenURI([BigInt(i)]);

            nfts.push({
              tokenId: BigInt(i),
              tokenURI: uri || "",
            });

            if (nfts.length >= balance) break;
          }
        } catch {
          // Token doesn't exist, continue
        }
      }

      setUserNFTs(nfts);
    };

    fetchUserNFTs();
  }, [nftBalance, connectedAddress, cropNFTContract]);

  const handleRequestInvestment = async () => {
    if (!selectedNFT || !investmentAmount || !cropNFTInfo || !microLoanInfo) {
      notification.error("Please fill all fields and ensure contracts are loaded");
      return;
    }

    try {
      setIsLoading(true);

      // First approve the MicroLoan contract to transfer the NFT
      await writeCropNFT({
        functionName: "approve",
        args: [microLoanInfo.address, BigInt(selectedNFT)],
      });

      // Then request the investment funding (ETH - no token address needed)
      await writeMicroLoan({
        functionName: "requestLoan",
        args: [cropNFTInfo.address, BigInt(selectedNFT), parseEther(investmentAmount)],
      });

      notification.success("Investment request submitted successfully!");
      setSelectedNFT("");
      setInvestmentAmount("");
    } catch (error) {
      console.error("Error requesting investment:", error);
      notification.error("Failed to request investment");
    } finally {
      setIsLoading(false);
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
      <div className="px-5 w-full max-w-2xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Request Investment</span>
          <span className="block text-2xl mt-2">Use your CropNFT as collateral for investment funding</span>
        </h1>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Investment Details</h2>

            {userNFTs.length === 0 ? (
              <div className="alert alert-warning">
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
                <span>You don&apos;t have any CropNFTs. Please mint one first.</span>
              </div>
            ) : (
              <>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text text-lg">Select Your CropNFT</span>
                  </label>
                  <select
                    className="select select-bordered select-lg w-full"
                    value={selectedNFT}
                    onChange={e => setSelectedNFT(e.target.value)}
                  >
                    <option value="">Choose a CropNFT</option>
                    {userNFTs.map(nft => (
                      <option key={nft.tokenId.toString()} value={nft.tokenId.toString()}>
                        Token #{nft.tokenId.toString()} - {nft.tokenURI.slice(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text text-lg">Investment Amount (ETH)</span>
                  </label>
                  <EtherInput
                    placeholder="Enter amount in ETH"
                    value={investmentAmount}
                    onChange={setInvestmentAmount}
                  />
                </div>

                <div className="stats shadow mt-6">
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
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                    <div className="stat-title">Investment Terms</div>
                    <div className="stat-value text-primary">5% Returns</div>
                    <div className="stat-desc">90 days duration</div>
                  </div>
                </div>

                <div className="card-actions justify-end mt-6">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleRequestInvestment}
                    disabled={isLoading || !selectedNFT || !investmentAmount}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      "Request Investment"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 card bg-base-200">
          <div className="card-body">
            <h3 className="text-lg font-semibold">ℹ️ How it works</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Select your CropNFT to use as collateral</li>
              <li>Enter the investment amount you need</li>
              <li>Your NFT will be locked in the contract</li>
              <li>Wait for a business to fund your investment</li>
              <li>Repay within 90 days to get your NFT back</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestInvestmentPage;
