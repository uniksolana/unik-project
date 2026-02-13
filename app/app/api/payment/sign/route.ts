import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '../../../../utils/rateLimit';

const getHmacSecret = () => {
    const secret = process.env.PAYMENT_HMAC_SECRET;
    if (!secret) return 'fallback-secret-505'; // Fallback for dev to prevent crashes if missing
    return secret;
};

function computeHmac(alias: string, amount: string, token: string): string {
    const payload = `${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}`;
    return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
    try {
        // N-002: Rate Limiting
        const failOverIp = '0.0.0.0';
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || failOverIp;

        // Limit: 5 requests per 1 minute (60s) for signing
        const { success } = await checkRateLimit(ip.split(',')[0].trim(), 5, 60);

        if (!success) {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }

        const { alias, amount, token } = await request.json();

        if (!alias || !amount) {
            return NextResponse.json({ error: 'Missing alias or amount' }, { status: 400 });
        }

        const sig = computeHmac(alias, String(amount), token || 'SOL');

        return NextResponse.json({ sig });
    } catch (e) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
