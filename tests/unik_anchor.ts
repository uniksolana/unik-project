import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UnikAnchor } from "../target/types/unik_anchor";
import { assert } from "chai";

describe("unik_anchor", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.unikAnchor as Program<UnikAnchor>;

  const alias = "my_alias";
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
        aliasAccount: aliasPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
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
      .setRouteConfig(alias, splits)
      .accounts({
        routeAccount: routePda,
        aliasAccount: aliasPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
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

    await program.methods
      .setRouteConfig(alias, splits)
      .accounts({
        routeAccount: routePda,
        aliasAccount: aliasPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const amount = new anchor.BN(1000000); // 0.001 SOL

    // Get initial balances
    const initialBal1 = await provider.connection.getBalance(recipient1.publicKey);
    const initialBal2 = await provider.connection.getBalance(recipient2.publicKey);

    await program.methods
      .executeTransfer(alias, amount)
      .accounts({
        routeAccount: routePda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: recipient1.publicKey, isWritable: true, isSigner: false },
        { pubkey: recipient2.publicKey, isWritable: true, isSigner: false },
      ])
      .rpc();

    // Verify balances
    const finalBal1 = await provider.connection.getBalance(recipient1.publicKey);
    const finalBal2 = await provider.connection.getBalance(recipient2.publicKey);

    assert.equal(finalBal1 - initialBal1, 500000);
    assert.equal(finalBal2 - initialBal2, 500000);
  });
});
