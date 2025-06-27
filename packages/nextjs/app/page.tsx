"use client";

import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block mb-4">
              <Image src="/Harvverse Logo.png" alt="HarvVerse Logo" width={300} height={120} className="mx-auto" />
            </span>
            <span className="block text-2xl mt-4 mb-2">Farm Investment Platform</span>
            <span className="block text-xl mb-8">
              Empowering agriculture with blockchain-based investment opportunities
            </span>
          </h1>
        </div>

        <div className="flex-grow bg-base-300 w-full px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <h2 className="text-2xl font-bold mb-4">For Farmers 🌾</h2>
              <p className="mb-6">
                Mint CropNFTs and propose investment agreements. Choose delivery or profit-sharing terms.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/mint" className="btn btn-primary">
                  Mint CropNFT
                </Link>
                <Link href="/create-deal" className="btn btn-secondary">
                  Create Deal
                </Link>
              </div>
            </div>

            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <h2 className="text-2xl font-bold mb-4">For Investors 💼</h2>
              <p className="mb-6">Fund agricultural deals and choose between receiving produce or sharing profits.</p>
              <Link href="/invest" className="btn btn-accent">
                Browse Deals
              </Link>
            </div>
          </div>

          <div className="text-center mt-12">
            {connectedAddress ? (
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                Go to Dashboard →
              </Link>
            ) : (
              <div>
                <p className="mb-4 text-lg">Connect your wallet to get started</p>
                <RainbowKitCustomConnectButton />
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-12 w-full">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">1. Create Deal</h3>
                <p>Farmers mint CropNFTs and propose investment terms with custom profit-sharing or delivery options</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">2. Choose Option</h3>
                <p>Investors fund deals and select either physical produce delivery or profit-sharing</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">3. Harvest Ready</h3>
                <p>Farmers mark crops ready for delivery or sale when harvest is complete</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">4. Settlement</h3>
                <p>Oracle confirms delivery or farmer reports sale proceeds for automatic profit distribution</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
