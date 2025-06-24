"use client";

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
            <span className="block text-6xl font-bold">🌾 HarvVerse</span>
            <span className="block text-2xl mt-4 mb-2">Microloans for Farmers</span>
            <span className="block text-xl mb-8">Empowering agriculture with blockchain-based microfinance</span>
          </h1>
        </div>

        <div className="flex-grow bg-base-300 w-full px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <h2 className="text-2xl font-bold mb-4">For Farmers 🌾</h2>
              <p className="mb-6">
                Mint CropNFTs and use them as collateral to access quick microloans for your agricultural needs.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/mint" className="btn btn-primary">
                  Mint CropNFT
                </Link>
                <Link href="/request-loan" className="btn btn-secondary">
                  Request Loan
                </Link>
              </div>
            </div>

            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <h2 className="text-2xl font-bold mb-4">For Businesses 💼</h2>
              <p className="mb-6">
                Fund microloans to earn 5% interest while supporting local farmers and agriculture.
              </p>
              <Link href="/fund" className="btn btn-accent">
                Fund Loans
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">1. Mint CropNFT</h3>
                <p>Farmers create NFTs representing their crop lots with metadata stored on IPFS</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">2. Request Loan</h3>
                <p>Use your CropNFT as collateral to request an ETH loan with 5% interest</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">3. Get Funded</h3>
                <p>Businesses fund loans to earn interest, with NFT collateral as security</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
