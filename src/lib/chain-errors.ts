/**
 * Maps RPC / ethers errors to short, user-facing copy. Full details stay in server logs.
 */
export function userFacingTransactionError(rawMessage: string): {
  message: string;
  /** HTTP status hint for API routes */
  httpStatus: number;
} {
  const lower = rawMessage.toLowerCase();

  if (rawMessage.includes("LIFI_API_KEY") || lower.includes("lifi api")) {
    return {
      message: "Deposits are temporarily unavailable. Please try again later.",
      httpStatus: 503,
    };
  }

  if (
    rawMessage.includes("INSUFFICIENT_FUNDS") ||
    lower.includes("insufficient funds for intrinsic") ||
    lower.includes("insufficient funds for gas") ||
    lower.includes("gas * price + value") ||
    lower.includes("overshot")
  ) {
    return {
      message:
        "Your Kudi wallet needs a small amount of ETH on Base to cover network fees. Add a little ETH to that wallet, then try again.",
      httpStatus: 400,
    };
  }

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected")) {
    return { message: "The request was cancelled.", httpStatus: 400 };
  }

  if (lower.includes("nonce")) {
    return {
      message: "Network busy with another transaction. Wait a moment and try again.",
      httpStatus: 409,
    };
  }

  if (lower.includes("execution reverted") || lower.includes("revert")) {
    return {
      message: "The network couldn’t complete this step. Try a smaller amount or try again later.",
      httpStatus: 400,
    };
  }

  return {
    message: "We couldn’t complete this. Please check your balance and try again.",
    httpStatus: 500,
  };
}
