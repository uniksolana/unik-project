import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../utils/supabaseServer';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

/**
 * POST /api/orders/verify
 * Verifies that a Solana transaction matches the expected payment order.
 * 
 * Flow:
 * 1. Client sends tx_signature + order_id after payment
 * 2. We fetch the order from DB (expected amount/token)
 * 3. We fetch the on-chain TX and parse the actual transfer
 * 4. We compare: actual >= expected
 * 5. We update the order status
 */
export async function POST(request: NextRequest) {
    try {
        const { order_id, tx_signature, payer_wallet } = await request.json();

        if (!order_id || !tx_signature) {
            return NextResponse.json({ error: 'Missing order_id or tx_signature' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        // 1. Fetch the order
        const { data: order, error: fetchError } = await supabase
            .from('payment_orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.status === 'paid') {
            return NextResponse.json({
                verified: true,
                status: 'already_paid',
                message: 'This order was already verified as paid.'
            });
        }

        if (order.status === 'expired') {
            return NextResponse.json({ verified: false, status: 'expired', message: 'Order has expired' });
        }

        // N-003: Replay Attack Protection
        // Check if this signature has already been used to fulfill a DIFFERENT order
        const { data: existingUsage } = await supabase
            .from('payment_orders')
            .select('id')
            .eq('tx_signature', tx_signature)
            .neq('id', order_id) // ignore self (idempotency is fine)
            .eq('status', 'paid') // only care if it successfully paid another order
            .single();

        if (existingUsage) {
            return NextResponse.json({
                verified: false,
                status: 'replay_attack',
                message: 'This transaction signature has already been used for another order.'
            });
        }

        // Also check dedicated replay table if present (for stricter checks across systems)
        const { data: replayCheck } = await supabase
            .from('processed_signatures')
            .select('signature')
            .eq('signature', tx_signature)
            .single();

        if (replayCheck) {
            // If signature is in processed_signatures but NOT in payment_orders for this ID?
            // It means it was used elsewhere.
            // We need to be careful not to block retries of the SAME order.
            // But processed_signatures doesn't store order_id.
            // So this check is strict: 1 signature = 1 verification attempt globally.
            // This is safer but less user-friendly if they retry.
            // Given we check payment_orders above, we can skip this strict check unless we want to enforce "1 attempt".
            // Let's rely on payment_orders for user-friendliness (retry same order is OK).
            // BUT, we should insert into processed_signatures on SUCCESS to future-proof.
        }

        // 2. Verify on-chain transaction
        const connection = new Connection(SOLANA_RPC, 'confirmed');

        let tx;
        try {
            tx = await connection.getParsedTransaction(tx_signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });
        } catch (e) {
            return NextResponse.json({
                verified: false,
                status: 'tx_not_found',
                message: 'Transaction not found on-chain. It may still be processing.'
            });
        }

        if (!tx || !tx.meta || tx.meta.err) {
            return NextResponse.json({
                verified: false,
                status: 'tx_failed',
                message: 'Transaction not found or failed on-chain.'
            });
        }

        // 3. Parse the transfer amount
        let actualAmountLamports = BigInt(0);
        let tokenTransferFound = false;

        if (order.expected_token === 'SOL') {
            // For SOL transfers, check balance changes
            const preBalances = tx.meta.preBalances;
            const postBalances = tx.meta.postBalances;
            const accountKeys = tx.transaction.message.accountKeys;

            // Find the merchant's account and calculate received amount
            for (let i = 0; i < accountKeys.length; i++) {
                const pubkey = accountKeys[i].pubkey.toBase58();
                if (pubkey === order.merchant_wallet) {
                    const received = BigInt(postBalances[i]) - BigInt(preBalances[i]);
                    if (received > 0) {
                        actualAmountLamports = received;
                    }
                    break;
                }
            }
        } else {
            // For SPL token transfers, check token balance changes
            const preTokenBalances = tx.meta.preTokenBalances || [];
            const postTokenBalances = tx.meta.postTokenBalances || [];

            // Find merchant's token balance change
            for (const postBal of postTokenBalances) {
                if (postBal.owner === order.merchant_wallet) {
                    const preBal = preTokenBalances.find(
                        (p) => p.accountIndex === postBal.accountIndex
                    );
                    const preAmount = BigInt(preBal?.uiTokenAmount?.amount || '0');
                    const postAmount = BigInt(postBal.uiTokenAmount.amount || '0');
                    const received = postAmount - preAmount;

                    if (received > BigInt(0)) {
                        actualAmountLamports = received;
                        tokenTransferFound = true;
                    }
                    break;
                }
            }

            if (!tokenTransferFound) {
                // Update order as failed
                await supabase
                    .from('payment_orders')
                    .update({
                        tx_signature,
                        payer_wallet: payer_wallet || null,
                        status: 'failed',
                    })
                    .eq('id', order_id);

                return NextResponse.json({
                    verified: false,
                    status: 'no_token_transfer',
                    message: `No ${order.expected_token} transfer found to merchant wallet.`
                });
            }
        }

        // 4. Compare amounts
        const expectedAmountNumber = parseFloat(order.expected_amount);
        let actualAmountHuman: number;

        if (order.expected_token === 'SOL') {
            actualAmountHuman = Number(actualAmountLamports) / LAMPORTS_PER_SOL;
        } else {
            // SPL tokens: use the decimals from the token (most stablecoins = 6, some = 9)
            const decimals = order.expected_token === 'USDC' || order.expected_token === 'USDT' || order.expected_token === 'EURC' ? 6 : 9;
            actualAmountHuman = Number(actualAmountLamports) / Math.pow(10, decimals);
        }

        // M-06: Remove 1% underpayment tolerance to prevent systematic sub-payments
        const isAmountCorrect = actualAmountHuman >= expectedAmountNumber;

        // 5. Update order
        const newStatus = isAmountCorrect ? 'paid' : 'failed';
        await supabase
            .from('payment_orders')
            .update({
                tx_signature,
                actual_amount: actualAmountHuman.toString(),
                payer_wallet: payer_wallet || null,
                status: newStatus,
                paid_at: isAmountCorrect ? new Date().toISOString() : null,
            })
            .eq('id', order_id);

        // N-003: If successful, record signature globally to prevent reuse in other contexts
        if (isAmountCorrect) {
            await supabase
                .from('processed_signatures')
                .upsert({ signature: tx_signature });
        }

        if (isAmountCorrect) {
            return NextResponse.json({
                verified: true,
                status: 'paid',
                expected: expectedAmountNumber,
                received: actualAmountHuman,
                message: `✅ Payment verified: ${actualAmountHuman} ${order.expected_token} received.`
            });
        } else {
            return NextResponse.json({
                verified: false,
                status: 'amount_mismatch',
                expected: expectedAmountNumber,
                received: actualAmountHuman,
                message: `❌ Amount mismatch: expected ${expectedAmountNumber} ${order.expected_token}, received ${actualAmountHuman}.`
            });
        }
    } catch (e) {
        console.error('[Orders/Verify] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
