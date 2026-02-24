import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UnikAnchor } from "../target/types/unik_anchor";
import { assert } from "chai";

describe("unik_anchor", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.unikAnchor as Program<UnikAnchor>;

  const alias = `alias_${Date.now()}`;
  const metadataUri = "https://example.com/metadata";

  // PDAs
  const [aliasPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("alias"), Buffer.from(alias)],
    program.programId
  );

  const [routePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("route"), Buffer.from(alias)],
    program.programId
  );

  it("Registers an alias", async () => {
    await program.methods
      .registerAlias(alias, metadataUri)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();

    const account = await program.account.aliasAccount.fetch(aliasPda);
    assert.equal(account.alias, alias);
    assert.equal(account.metadataUri, metadataUri);
    assert.ok(account.owner.equals(provider.wallet.publicKey));
  });

  it("Sets route config", async () => {
    // Generate random recipients
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();

    const splits = [
      { recipient: recipient1.publicKey, percentage: 6000 }, // 60%
      { recipient: recipient2.publicKey, percentage: 4000 }, // 40%
    ];

    await program.methods
      .initRouteConfig(alias)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();

    await program.methods
      .setRouteConfig(alias, splits)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();

    const account = await program.account.routeAccount.fetch(routePda);
    assert.equal(account.splits.length, 2);
    assert.equal(account.splits[0].percentage, 6000);
  });

  it("Executes transfer", async () => {
    // Setup recipients
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();

    // Update routes to these specific keys for verification
    const splits = [
      { recipient: recipient1.publicKey, percentage: 5000 }, // 50%
      { recipient: recipient2.publicKey, percentage: 5000 }, // 50%
    ];

    // We skip initRouteConfig here because it was already initialized in the previous test
    await program.methods
      .setRouteConfig(alias, splits)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();

    const amount = new anchor.BN(10000000); // 0.01 SOL (Rent exempt for fresh accts)

    // Get initial balances
    const initialBal1 = await provider.connection.getBalance(recipient1.publicKey);
    const initialBal2 = await provider.connection.getBalance(recipient2.publicKey);

    await program.methods
      .executeTransfer(alias, amount)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .remainingAccounts([
        { pubkey: recipient1.publicKey, isWritable: true, isSigner: false },
        { pubkey: recipient2.publicKey, isWritable: true, isSigner: false },
      ])
      .rpc();

    // Verify balances
    const finalBal1 = await provider.connection.getBalance(recipient1.publicKey);
    const finalBal2 = await provider.connection.getBalance(recipient2.publicKey);

    assert.equal(finalBal1 - initialBal1, 5000000);
    assert.equal(finalBal2 - initialBal2, 5000000);
  });

  // --- Negative Tests (V1 Hardening) ---

  it("Fail: Duplicate alias registration", async () => {
    try {
      await program.methods
        .registerAlias(alias, metadataUri)
        .accounts({
          aliasAccount: aliasPda,
          user: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed to register duplicate alias");
    } catch (e: any) {
      // Anchor throws an error when initializing an existing account (usually logs "already in use")
      assert.ok(e.logs?.some((log: string) => log.includes("already in use")) || e.toString().includes("0x0"), "Expected 'already in use' error");
    }
  });

  it("Fail: Split sum > 100%", async () => {
    const r1 = anchor.web3.Keypair.generate().publicKey;
    const splits = [{ recipient: r1, percentage: 10001 }]; // 100.01%
    try {
      await program.methods.setRouteConfig(alias, splits).accounts({
        user: provider.wallet.publicKey,
      }).rpc();
      assert.fail("Should fail > 100%");
    } catch (e: any) {
      const str = JSON.stringify(e) + e.toString();
      assert.ok(str.includes("6001") || str.includes("InvalidSplitTotal"), "Expected InvalidSplitTotal (6001)");
    }
  });

  it("Fail: Split sum < 100%", async () => {
    const r1 = anchor.web3.Keypair.generate().publicKey;
    const splits = [{ recipient: r1, percentage: 9999 }]; // 99.99%
    try {
      await program.methods.setRouteConfig(alias, splits).accounts({
        user: provider.wallet.publicKey,
      }).rpc();
      assert.fail("Should fail < 100%");
    } catch (e: any) {
      const str = JSON.stringify(e) + e.toString();
      assert.ok(str.includes("6001") || str.includes("InvalidSplitTotal"), "Expected InvalidSplitTotal (6001)");
    }
  });

  it("Fail: More than 5 recipients", async () => {
    const splits = Array(6).fill(0).map(() => ({
      recipient: anchor.web3.Keypair.generate().publicKey,
      percentage: 2000 // 20% * 6 = 120% (logic fails on sum first if checked first, or length)
      // We set percentage to 1000 (10%) to satisfy sum check if we had 10? 
      // Actually 6 * 1666 = 9996... hard to exact 10000 with 6 if equal.
      // Let's just use dummy percentages that sum correctly or fail length check first.
      // Contract checks sum primarily?
      // Order in lib.rs: Sum check -> Len check.
      // Let's make sum valid: 6 items: 5x1666 + 1x1670 = 10000
    }));
    splits[0].percentage = 1666;
    splits[1].percentage = 1666;
    splits[2].percentage = 1666;
    splits[3].percentage = 1666;
    splits[4].percentage = 1666;
    splits[5].percentage = 1670;

    try {
      await program.methods.setRouteConfig(alias, splits).accounts({
        user: provider.wallet.publicKey,
      }).rpc();
      assert.fail("Should fail with > 5 splits");
    } catch (e: any) {
      console.error("FULL ERROR OBJECT (TooManySplits):", JSON.stringify(e, null, 2));
      console.error("FULL ERROR TOSTRING:", e.toString());
      if (e.logs) console.error("LOGS:", e.logs);

      const str = JSON.stringify(e) + e.toString() + (e.logs ? e.logs.join("") : "");
      assert.ok(str.includes("6007") || str.includes("Maximum 5 splits allowed") || str.includes("TooManySplits"), `Expected TooManySplits (6007), got: ${str.substring(0, 500)}...`);
    }
  });

  it("Fail: Duplicate recipient", async () => {
    const r1 = anchor.web3.Keypair.generate().publicKey;
    const splits = [
      { recipient: r1, percentage: 5000 },
      { recipient: r1, percentage: 5000 },
    ];
    try {
      await program.methods.setRouteConfig(alias, splits).accounts({
        user: provider.wallet.publicKey,
      }).rpc();
      assert.fail("Should duplicate recipient");
    } catch (e: any) {
      const str = JSON.stringify(e) + e.toString();
      assert.ok(str.includes("6008") || str.includes("Duplicate recipient"), "Expected DuplicateRecipient (6008)");
    }
  });

  it("Fail: Self-Reference (Route Account)", async () => {
    const splits = [
      { recipient: routePda, percentage: 10000 },
    ];
    try {
      await program.methods.setRouteConfig(alias, splits).accounts({
        user: provider.wallet.publicKey,
      }).rpc();
      assert.fail("Should fail self-reference");
    } catch (e: any) {
      console.error("FULL ERROR OBJECT (SelfReference):", JSON.stringify(e, null, 2));
      console.error("FULL ERROR TOSTRING:", e.toString());
      if (e.logs) console.error("LOGS:", e.logs);

      const str = JSON.stringify(e) + e.toString() + (e.logs ? e.logs.join("") : "");
      assert.ok(str.includes("6009") || str.includes("Cannot route funds to the alias") || str.includes("SelfReference"), `Expected SelfReference (6009), got: ${str.substring(0, 500)}...`);
    }
  }); it("Fail: Duplicate alias registration", async () => {
    try {
      await program.methods
        .registerAlias(alias, metadataUri)
        .accounts({
          aliasAccount: aliasPda,
          user: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed to register duplicate alias");
    } catch (e: any) {
      console.log("Duplicate alias error:", e);
      // Anchor throws an error when initializing an existing account (usually logs "already in use")
      assert.ok(
        e.logs?.some((log: string) => log.includes("already in use")) ||
        e.toString().includes("0x0") ||
        JSON.stringify(e).includes("already in use"),
        "Expected 'already in use' error"
      );
    }
  });
});
