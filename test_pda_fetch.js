const { Connection, PublicKey } = require('@solana/web3.js');
const PROGRAM_ID = new PublicKey('ASA8xRVPFBQLo3dLJQH2NedBKJWsVXGu46radY6oRX6i');

async function run() {
    const alias = 'unik';
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("alias"), Buffer.from(alias.toLowerCase())],
        PROGRAM_ID
    );
    console.log("PDA:", pda.toBase58());
    const accountInfo = await connection.getAccountInfo(pda);
    if (accountInfo) {
        const ownerPubkey = new PublicKey(accountInfo.data.subarray(8, 40)).toBase58();
        console.log("Owner PUBKEY:", ownerPubkey);
    } else {
        console.log("No account info.");
    }
}
run();
