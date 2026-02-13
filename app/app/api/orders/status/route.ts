import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../utils/supabaseServer';

/**
 * POST /api/orders/status
 * Check the verification status of a payment order.
 * Used by the merchant dashboard to confirm payments.
 */
export async function POST(request: NextRequest) {
    try {
        const { order_id, merchant_wallet } = await request.json();

        if (!order_id) {
            return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        const { data: order, error } = await supabase
            .from('payment_orders')
            .select('id, merchant_alias, expected_amount, expected_token, concept, status, actual_amount, payer_wallet, tx_signature, created_at, paid_at')
            .eq('id', order_id)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Optional: verify the requester is the merchant
        if (merchant_wallet && order.merchant_alias) {
            // We allow checking without wallet for now (public order status)
        }

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
    } catch (e) {
        console.error('[Orders/Status] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
