import { Contract, ethers } from "ethers";

import type { LiFiQuoteResponse } from "./server";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
] as const;

const NATIVE_LIKE = new Set([
  ethers.ZeroAddress.toLowerCase(),
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);

export async function ensureAllowanceForQuote(
  signer: ethers.Signer,
  quote: LiFiQuoteResponse,
) {
  const token = quote.action?.fromToken?.address;
  const spender = quote.estimate?.approvalAddress;
  const amount = quote.action?.fromAmount;
  if (!token || !spender || !amount) {
    return;
  }
  if (NATIVE_LIKE.has(token.toLowerCase())) {
    return;
  }

  const owner = await signer.getAddress();
  const erc20 = new Contract(token, ERC20_ABI, signer);
  const current: bigint = await erc20.allowance(owner, spender);
  const need = BigInt(amount);
  if (current >= need) {
    return;
  }
  const approveTx = await erc20.approve(spender, need);
  await approveTx.wait();
}

export async function sendComposerTransaction(
  signer: ethers.Signer,
  quote: LiFiQuoteResponse,
) {
  const txReq = quote.transactionRequest;
  if (!txReq || typeof txReq.to !== "string" || typeof txReq.data !== "string") {
    throw new Error("Composer quote did not include a transaction to sign.");
  }

  await ensureAllowanceForQuote(signer, quote);

  const tx = await signer.sendTransaction({
    to: txReq.to,
    data: txReq.data,
    value: BigInt(String(txReq.value ?? 0)),
    gasLimit: txReq.gasLimit != null ? BigInt(String(txReq.gasLimit)) : undefined,
    gasPrice: txReq.gasPrice != null ? BigInt(String(txReq.gasPrice)) : undefined,
    maxFeePerGas: txReq.maxFeePerGas != null ? BigInt(String(txReq.maxFeePerGas)) : undefined,
    maxPriorityFeePerGas:
      txReq.maxPriorityFeePerGas != null
        ? BigInt(String(txReq.maxPriorityFeePerGas))
        : undefined,
  });
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
}
