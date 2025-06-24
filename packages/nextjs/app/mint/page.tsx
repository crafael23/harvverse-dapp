"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const MintPage = () => {
  const { address: connectedAddress } = useAccount();
  const [tokenURI, setTokenURI] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { writeContractAsync: writeCropNFT } = useScaffoldWriteContract("CropNFT");

  const handleMint = async () => {
    if (!tokenURI) {
      notification.error("Please enter a token URI");
      return;
    }

    try {
      setIsLoading(true);
      await writeCropNFT({
        functionName: "mint",
        args: [tokenURI],
      });
      notification.success("CropNFT minted successfully!");
      setTokenURI("");
    } catch (error) {
      console.error("Error minting CropNFT:", error);
      notification.error("Failed to mint CropNFT");
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
          <span className="block text-4xl font-bold">Mint Crop NFT</span>
          <span className="block text-2xl mt-2">Create a new NFT for your crop</span>
        </h1>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Crop Information</h2>

            <div className="form-control w-full">
              <label className="label">
                <span className="label-text text-lg">Token URI</span>
              </label>
              <textarea
                placeholder="Enter token URI (e.g., IPFS link to metadata)"
                className="textarea textarea-bordered textarea-lg w-full"
                value={tokenURI}
                onChange={e => setTokenURI(e.target.value)}
                rows={4}
              />
              <label className="label">
                <span className="label-text-alt">This should be a link to your crop metadata (JSON format)</span>
              </label>
            </div>

            <div className="card-actions justify-end mt-6">
              <button className="btn btn-primary btn-lg" onClick={handleMint} disabled={isLoading || !tokenURI}>
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Minting...
                  </>
                ) : (
                  "Mint CropNFT"
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 card bg-base-200">
          <div className="card-body">
            <h3 className="text-lg font-semibold">💡 Token URI Example</h3>
            <pre className="text-xs overflow-x-auto">
              {`{
  "name": "Organic Wheat Lot #123",
  "description": "10 tons of organic wheat",
  "image": "ipfs://...",
  "attributes": [
    {"trait_type": "Crop Type", "value": "Wheat"},
    {"trait_type": "Weight", "value": "10 tons"},
    {"trait_type": "Quality", "value": "Premium"}
  ]
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MintPage;
