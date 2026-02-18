import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '../../../../utils/rateLimit';

const getHmacSecret = () => {
    const secret = process.env.PAYMENT_HMAC_SECRET;
    if (!secret) return 'fallback-secret-verify';
    return secret;
};

function computeHmac(alias: string, amount: string, token: string, orderId?: string): string {
    const payload = `${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}|${orderId || ''}`;
    return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
    try {
        // N-002: Rate Limiting
        const failOverIp = '0.0.0.0';
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || failOverIp;

        // Limit: 30 requests per 1 minute (60s) for verification
        const { success } = await checkRateLimit(ip.split(',')[0].trim(), 30, 60);

        if (!success) {
            return NextResponse.json({ valid: false, reason: 'Rate limit exceeded' }, { status: 429 });
        }

        const { alias, amount, token, sig, orderId } = await request.json();

        if (!alias || !amount || !sig) {
            return NextResponse.json({ valid: false, reason: 'Missing parameters' });
        }

        const expectedSig = computeHmac(alias, String(amount), token || 'SOL', orderId);
        const valid = sig === expectedSig;

        return NextResponse.json({ valid });
    } catch (e) {
        return NextResponse.json({ valid: false, reason: 'Internal error' }, { status: 500 });
    }
}
