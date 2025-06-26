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

const CreateDealPage = () => {
  const { address: connectedAddress } = useAccount();
  const [selectedNFT, setSelectedNFT] = useState<string>("");
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [profitShareBps, setProfitShareBps] = useState("3000"); // 30% default
  const [expectedQuantity, setExpectedQuantity] = useState("");
  const [harvestDays, setHarvestDays] = useState("90");
  const [deliveryDays, setDeliveryDays] = useState("30");
  const [userNFTs, setUserNFTs] = useState<NFTData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get deployed contract info
  const { data: cropNFTInfo } = useDeployedContractInfo("CropNFT");
  const { data: investmentAgreementInfo } = useDeployedContractInfo("InvestmentAgreement");

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
  const { writeContractAsync: writeInvestmentAgreement } = useScaffoldWriteContract("InvestmentAgreement");

  // Fetch user's NFTs
  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!nftBalance || !connectedAddress || !cropNFTContract) return;

      const nfts: NFTData[] = [];
      const balance = Number(nftBalance);

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

  const handleCreateDeal = async () => {
    if (!selectedNFT || !investmentAmount || !expectedQuantity || !cropNFTInfo || !investmentAgreementInfo) {
      notification.error("Please fill all fields and ensure contracts are loaded");
      return;
    }

    try {
      setIsLoading(true);

      // First approve the InvestmentAgreement contract to transfer the NFT
      await writeCropNFT({
        functionName: "approve",
        args: [investmentAgreementInfo.address, BigInt(selectedNFT)],
      });

      // Calculate deadlines (in seconds from now)
      const now = Math.floor(Date.now() / 1000);
      const harvestDeadline = now + parseInt(harvestDays) * 24 * 60 * 60;
      const deliveryDeadline = harvestDeadline + parseInt(deliveryDays) * 24 * 60 * 60;

      // Propose the agreement
      await writeInvestmentAgreement({
        functionName: "proposeAgreement",
        args: [
          cropNFTInfo.address,
          BigInt(selectedNFT),
          parseEther(investmentAmount),
          BigInt(parseInt(profitShareBps)),
          parseEther(expectedQuantity), // Using parseEther for quantity in kg (treating as wei)
          BigInt(harvestDeadline),
          BigInt(deliveryDeadline),
        ],
      });

      notification.success("Investment deal created successfully!");
      setSelectedNFT("");
      setInvestmentAmount("");
      setExpectedQuantity("");
    } catch (error) {
      console.error("Error creating deal:", error);
      notification.error("Failed to create deal");
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
          <span className="block text-4xl font-bold">Create Investment Deal</span>
          <span className="block text-2xl mt-2">Propose an investment agreement using your CropNFT</span>
        </h1>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Deal Terms</h2>

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
                {/* NFT Selection */}
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

                {/* Investment Amount */}
                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text text-lg">Investment Amount Needed (ETH)</span>
                  </label>
                  <EtherInput
                    placeholder="Enter amount in ETH"
                    value={investmentAmount}
                    onChange={setInvestmentAmount}
                  />
                </div>

                {/* Expected Quantity */}
                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text text-lg">Expected Crop Yield (kg)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Expected yield in kg"
                    className="input input-bordered input-lg w-full"
                    value={expectedQuantity}
                    onChange={e => setExpectedQuantity(e.target.value)}
                  />
                </div>

                {/* Profit Share */}
                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text text-lg">Investor Profit Share (%)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    className="input input-bordered input-lg w-full"
                    value={(parseInt(profitShareBps) / 100).toString()}
                    onChange={e => setProfitShareBps((parseFloat(e.target.value) * 100).toString())}
                    min="1"
                    max="99"
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      If investor chooses profit-sharing, they get {(parseInt(profitShareBps) / 100).toFixed(1)}% of
                      sale proceeds
                    </span>
                  </label>
                </div>

                {/* Harvest Deadline */}
                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text text-lg">Days until Harvest Deadline</span>
                  </label>
                  <input
                    type="number"
                    placeholder="90"
                    className="input input-bordered input-lg w-full"
                    value={harvestDays}
                    onChange={e => setHarvestDays(e.target.value)}
                    min="1"
                    max="365"
                  />
                </div>

                {/* Delivery Deadline */}
                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text text-lg">Days for Delivery/Sale after Harvest</span>
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    className="input input-bordered input-lg w-full"
                    value={deliveryDays}
                    onChange={e => setDeliveryDays(e.target.value)}
                    min="1"
                    max="180"
                  />
                </div>

                <div className="divider"></div>

                {/* Terms Summary */}
                <div className="stats shadow">
                  <div className="stat">
                    <div className="stat-title">Terms Summary</div>
                    <div className="stat-value text-sm">{investmentAmount} ETH needed</div>
                    <div className="stat-desc">
                      For {expectedQuantity}kg expected yield
                      <br />
                      {(parseInt(profitShareBps) / 100).toFixed(1)}% profit share option
                      <br />
                      {harvestDays} days to harvest, +{deliveryDays} days to deliver/sell
                    </div>
                  </div>
                </div>

                <div className="card-actions justify-end mt-6">
                  <button
                    className={`btn btn-primary btn-lg ${isLoading ? "loading" : ""}`}
                    onClick={handleCreateDeal}
                    disabled={isLoading || !selectedNFT || !investmentAmount || !expectedQuantity}
                  >
                    {isLoading ? "Creating Deal..." : "Create Investment Deal"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateDealPage;
