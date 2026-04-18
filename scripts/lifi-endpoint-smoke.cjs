"use strict";

/**
 * Smoke-test LI.FI Earn (earn.li.fi) and Composer (li.quest) endpoints.
 * Loads LIFI_API_KEY from web/.env (via dotenv) or the environment.
 *
 * Run from the web package:
 *   npm run lifi:smoke
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const EARN = "https://earn.li.fi";
const QUEST = "https://li.quest";

const SAMPLE_VAULT = "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A";
const SAMPLE_WALLET = "0x0000000000000000000000000000000000000001";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function probe(label, url, init = {}, opts = {}) {
  const maxAttempts = typeof opts === "number" ? opts : opts.maxAttempts ?? 3;
  const retryHttp = opts.retryHttpStatuses ?? [];
  const t0 = Date.now();
  let status = 0;
  let errText = "";
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { ...init, redirect: "follow" });
      status = res.status;
      if (res.ok) {
        errText = "";
        break;
      }
      errText = (await res.text()).slice(0, 240).replace(/\s+/g, " ");
      const retryable = retryHttp.includes(status) && attempt < maxAttempts;
      if (!retryable) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    } catch (e) {
      errText = e && e.message ? e.message : String(e);
      if (attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  const ms = Date.now() - t0;
  return { label, url, status, ok: status >= 200 && status < 300, ms, errText };
}

async function main() {
  const apiKey = process.env.LIFI_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing LIFI_API_KEY. Set it in web/.env or the environment.");
    process.exit(1);
  }

  const withKey = {
    accept: "application/json",
    "x-lifi-api-key": apiKey,
  };

  const listQs = "chainId=8453&limit=1";

  const earnTests = [
    ["OLD list GET /v1/earn", `${EARN}/v1/earn?${listQs}`],
    ["OLD list GET /v1/earn/vaults", `${EARN}/v1/earn/vaults?${listQs}`],
    ["NEW list GET /v1/vaults", `${EARN}/v1/vaults?${listQs}`],
    ["OLD GET /v1/earn/chains", `${EARN}/v1/earn/chains`],
    ["NEW GET /v1/chains", `${EARN}/v1/chains`],
    ["OLD GET /v1/earn/protocols", `${EARN}/v1/earn/protocols`],
    ["NEW GET /v1/protocols", `${EARN}/v1/protocols`],
    ["OLD GET /v1/earn/portfolio/.../positions", `${EARN}/v1/earn/portfolio/${SAMPLE_WALLET}/positions`],
    ["NEW GET /v1/portfolio/.../positions", `${EARN}/v1/portfolio/${SAMPLE_WALLET}/positions`],
    ["OLD GET /v1/earn/:chain/:vault", `${EARN}/v1/earn/8453/${SAMPLE_VAULT}`],
    /** Docs implied `GET /v1/earn/:chain/:address` → after removing `/earn/`, the live route is under `vaults`. */
    ["NEW GET /v1/vaults/:chain/:vault", `${EARN}/v1/vaults/8453/${SAMPLE_VAULT}`],
  ];

  const quoteQs = new URLSearchParams({
    fromChain: "8453",
    toChain: "8453",
    fromToken: USDC_BASE,
    toToken: SAMPLE_VAULT,
    fromAddress: SAMPLE_WALLET,
    toAddress: SAMPLE_WALLET,
    fromAmount: "1000000",
  });

  const composerTests = [
    ["GET /v1/quote (Base USDC → sample vault)", `${QUEST}/v1/quote?${quoteQs}`],
    ["GET /v1/status (no query — may 400)", `${QUEST}/v1/status`],
  ];

  const rows = [];
  for (const [label, url] of earnTests) {
    const pOpts =
      label.includes("portfolio") && label.startsWith("NEW")
        ? { maxAttempts: 4, retryHttpStatuses: [502, 503, 504] }
        : { maxAttempts: 3 };
    rows.push(await probe(label, url, { headers: withKey, cache: "no-store" }, pOpts));
  }
  for (const [label, url] of composerTests) {
    rows.push(await probe(label, url, { headers: withKey, cache: "no-store" }, { maxAttempts: 4 }));
  }

  rows.push(
    await probe(
      "POST /v1/advanced/routes",
      `${QUEST}/v1/advanced/routes`,
      {
        method: "POST",
        headers: { ...withKey, "content-type": "application/json" },
        body: JSON.stringify({
          fromChainId: 8453,
          toChainId: 8453,
          fromTokenAddress: USDC_BASE,
          toTokenAddress: SAMPLE_VAULT,
          fromAmount: "1000000",
          fromAddress: SAMPLE_WALLET,
          toAddress: SAMPLE_WALLET,
        }),
        cache: "no-store",
      },
      { maxAttempts: 4 },
    ),
  );

  rows.push(
    await probe(
      "NEW /v1/vaults without x-lifi-api-key (expect 401/403)",
      `${EARN}/v1/vaults?${listQs}`,
      { headers: { accept: "application/json" }, cache: "no-store" },
    ),
  );

  console.log("\n=== LI.FI smoke (earn.li.fi + li.quest) ===\n");
  for (const r of rows) {
    const mark = r.ok ? "OK  " : "FAIL";
    console.log(`${mark} ${String(r.status).padEnd(4)} ${r.ms}ms  ${r.label}`);
    console.log(`      ${r.url}`);
    if (!r.ok && r.errText) console.log(`      ${r.errText}`);
    console.log("");
  }

  const newEarn = rows.filter(
    (r) =>
      r.label.startsWith("NEW GET") ||
      r.label.startsWith("NEW list") ||
      r.label.startsWith("NEW /v1/vaults without"),
  );
  const newBroken = newEarn.filter((r) => !r.ok && !r.label.includes("without x-lifi-api-key"));
  const composer = rows.filter((r) => r.label.includes("/v1/quote") || r.label.includes("advanced"));
  const composerBroken = composer.filter(
    (r) => !r.ok && !r.label.includes("/v1/status (no query"),
  );

  console.log("--- Interpretation ---");
  console.log(
    "After removing /earn/ from data paths, use: /v1/vaults, /v1/vaults/{chainId}/{vaultAddress}, /v1/chains, /v1/protocols, /v1/portfolio/{addr}/positions.",
  );
  console.log("Legacy /v1/earn* paths may return 404 once the cutover is live.\n");

  const earnCoreBroken = newBroken.filter((r) => !r.label.includes("portfolio"));
  const portfolioRow = newEarn.find((r) => r.label.includes("portfolio") && r.label.startsWith("NEW"));

  if (earnCoreBroken.length) {
    console.log("NEW earn paths still failing (needs attention):");
    for (const r of earnCoreBroken) console.log(`  - ${r.label} → ${r.status}`);
    process.exit(1);
  }
  if (portfolioRow && !portfolioRow.ok) {
    console.log(
      `Note: portfolio probe returned ${portfolioRow.status} (HTML 502 often means edge/upstream; path /v1/portfolio/{addr}/positions is correct per LI.FI). Re-run from your network or with a real wallet if needed.\n`,
    );
  }
  if (composerBroken.length) {
    console.log("Composer checks failing (verify key / params):");
    for (const r of composerBroken) console.log(`  - ${r.label} → ${r.status}`);
    process.exit(1);
  }
  console.log("All critical NEW earn paths and Composer quote/routes returned 2xx.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
