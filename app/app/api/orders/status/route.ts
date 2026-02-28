import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../utils/supabaseServer';
import { verifyWalletSignature } from '../../../../utils/verifyAuth';

/**
 * POST /api/orders/status
 * Check the verification status of a payment order.
 * Used by the merchant dashboard to confirm payments.
 */
export async function POST(request: NextRequest) {
    try {
        const { order_id, merchant_wallet, auth_wallet, auth_signature, auth_message } = await request.json();

        if (!order_id) {
            return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        const { data: order, error } = await supabase
            .from('payment_orders')
            .select('*') // LOW-06 safe schema fetching to avoid crashing before SQL migration
            .eq('id', order_id)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // LOW-06: Check expiration dynamically
        if (order.status !== 'paid' && order.status !== 'expired' && order.expires_at) {
            if (new Date(order.expires_at) < new Date()) {
                // If it's expired, update DB (fire and forget) and update local object
                supabase.from('payment_orders').update({ status: 'expired' }).eq('id', order_id).then();
                order.status = 'expired';
            }
        }

        // MED-01: Require cryptographic wallet signature for full details (not just knowing the wallet address)
        const isAuthorizedMerchant = merchant_wallet
            && auth_wallet === merchant_wallet
            && merchant_wallet === order.merchant_wallet
            && auth_signature && auth_message
            && verifyWalletSignature(auth_wallet, auth_signature, auth_message);

        if (isAuthorizedMerchant) {
            return NextResponse.json({
                order_id: order.id,
                status: order.status,
                expected_amount: order.expected_amount,
                expected_token: order.expected_token,
                actual_amount: order.actual_amount,
                concept: order.concept,
                payer_wallet: order.payer_wallet,
                tx_signature: order.tx_signature,
                created_at: order.created_at,
                paid_at: order.paid_at,
                verified: order.status === 'paid',
            });
        } else {
            // Minimal public information (concept included for HMAC verification)
            return NextResponse.json({
                order_id: order.id,
                status: order.status,
                expected_amount: order.expected_amount,
                expected_token: order.expected_token,
                concept: order.concept,
                verified: order.status === 'paid',
            });
        }
    } catch (e) {
        console.error('[Orders/Status] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
