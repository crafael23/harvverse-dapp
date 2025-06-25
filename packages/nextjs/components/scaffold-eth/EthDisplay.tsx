"use client";

import { formatEther } from "viem";
import { useGlobalState } from "~~/services/store/store";

type EthDisplayProps = {
  amount: bigint;
  className?: string;
  showUsd?: boolean;
  showBoth?: boolean;
  prefix?: string;
  suffix?: string;
};

/**
 * Display ETH amount with optional USD conversion
 */
export const EthDisplay = ({
  amount,
  className = "",
  showUsd = false,
  showBoth = true,
  prefix = "",
  suffix = "",
}: EthDisplayProps) => {
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const isNativeCurrencyPriceFetching = useGlobalState(state => state.nativeCurrency.isFetching);

  const formattedEthAmount = formatEther(amount);
  const ethValue = Number(formattedEthAmount);
  const usdValue = ethValue * nativeCurrencyPrice;

  if (isNativeCurrencyPriceFetching && nativeCurrencyPrice === 0) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-slate-300 rounded w-20"></div>
      </div>
    );
  }

  // Show only USD
  if (showUsd && !showBoth) {
    return (
      <span className={className}>
        {prefix}${usdValue.toFixed(2)}
        {suffix}
      </span>
    );
  }

  // Show only ETH
  if (!showUsd && !showBoth) {
    return (
      <span className={className}>
        {prefix}
        {ethValue.toFixed(4)} ETH{suffix}
      </span>
    );
  }

  // Show both ETH and USD (default)
  return (
    <span className={className}>
      {prefix}
      {ethValue.toFixed(4)} ETH
      {nativeCurrencyPrice > 0 && <span className="text-sm opacity-70 ml-1">(${usdValue.toFixed(2)})</span>}
      {suffix}
    </span>
  );
};
