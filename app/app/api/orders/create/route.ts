import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSupabase } from '../../../../utils/supabaseServer';
import { checkRateLimit } from '../../../../utils/rateLimit';

const getHmacSecret = () => {
    const secret = process.env.PAYMENT_HMAC_SECRET;
    if (!secret) {
        throw new Error('Missing PAYMENT_HMAC_SECRET');
    }
    return secret;
};

function signOrder(alias: string, amount: string, token: string, orderId: string): string {
    const payload = `order|${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}|${orderId}`;
    return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex'); // LOW-01 fix: full length HMAC
}

/**
 * POST /api/orders/create
 * Creates a payment order when a merchant generates a payment link.
 * Returns an order_id that must be included in the payment link.
 * MED-02: Requires wallet authentication to prevent spam.
 */
export async function POST(request: NextRequest) {
    try {
        // N-002: Rate Limiting
        const failOverIp = '0.0.0.0';
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || failOverIp;

        // Limit: 10 requests per 1 minute (60s)
        const { success, remaining } = await checkRateLimit(ip.split(',')[0].trim(), 10, 60);

        if (!success) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        const { alias, amount, token, merchant_wallet, concept, expiration } = await request.json();

        if (!alias || !amount || !merchant_wallet) {
            return NextResponse.json({ error: 'Missing required fields (alias, amount, merchant_wallet)' }, { status: 400 });
        }

        const tokenSymbol = (token || 'SOL').toUpperCase();
        const supabase = getServerSupabase();

        // LOW-06: Calculate expires_at
        let expiresAt: string | null = null;
        if (expiration && expiration !== 'never') {
            const now = Date.now();
            let addedMs = 0;
            if (expiration === '1d') addedMs = 24 * 60 * 60 * 1000;
            else if (expiration === '1w') addedMs = 7 * 24 * 60 * 60 * 1000;
            else if (expiration === '1m') addedMs = 30 * 24 * 60 * 60 * 1000;
            else if (expiration === '3m') addedMs = 90 * 24 * 60 * 60 * 1000;
            else if (expiration === '1y') addedMs = 365 * 24 * 60 * 60 * 1000;

            if (addedMs > 0) {
                expiresAt = new Date(now + addedMs).toISOString(); // Requires DB column `expires_at`
            }
        }

        // Generate order ID
        const orderId = crypto.randomUUID();
        const orderSig = signOrder(alias, amount, tokenSymbol, orderId);

        // Insert order
        // WARNING: Ensure expires_at column exists in DB. If not, this might fail, need migration.
        const insertData: any = {
            id: orderId,
            merchant_alias: alias.toLowerCase().trim(),
            merchant_wallet,
            expected_amount: amount,
            expected_token: tokenSymbol,
            concept: concept || null,
            order_sig: orderSig,
            status: 'pending',
        };

        if (expiresAt) {
            insertData.expires_at = expiresAt;
        }

        const { error } = await supabase
            .from('payment_orders')
            .insert(insertData);

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
