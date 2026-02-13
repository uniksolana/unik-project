import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSupabase } from '../../../../utils/supabaseServer';

const HMAC_SECRET = process.env.PAYMENT_HMAC_SECRET!;
if (!HMAC_SECRET) {
    throw new Error('Missing PAYMENT_HMAC_SECRET');
}

function signOrder(alias: string, amount: string, token: string, orderId: string): string {
    const payload = `order|${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}|${orderId}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 24);
}

/**
 * POST /api/orders/create
 * Creates a payment order when a merchant generates a payment link.
 * Returns an order_id that must be included in the payment link.
 */
export async function POST(request: NextRequest) {
    try {
        const { alias, amount, token, merchant_wallet, concept } = await request.json();

        if (!alias || !amount || !merchant_wallet) {
            return NextResponse.json({ error: 'Missing required fields (alias, amount, merchant_wallet)' }, { status: 400 });
        }

        const tokenSymbol = (token || 'SOL').toUpperCase();
        const supabase = getServerSupabase();

        // Generate order ID
        const orderId = crypto.randomUUID();
        const orderSig = signOrder(alias, amount, tokenSymbol, orderId);

        // Insert order
        const { error } = await supabase
            .from('payment_orders')
            .insert({
                id: orderId,
                merchant_alias: alias.toLowerCase().trim(),
                merchant_wallet,
                expected_amount: amount,
                expected_token: tokenSymbol,
                concept: concept || null,
                order_sig: orderSig,
                status: 'pending',
            });

        if (error) {
            console.error('[Orders] Create failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            order_id: orderId,
            order_sig: orderSig,
        });
    } catch (e) {
        console.error('[Orders] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
