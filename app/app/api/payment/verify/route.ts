import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const HMAC_SECRET = process.env.PAYMENT_HMAC_SECRET!;
if (!HMAC_SECRET) {
    throw new Error('Missing PAYMENT_HMAC_SECRET');
}

function computeHmac(alias: string, amount: string, token: string): string {
    const payload = `${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
    try {
        const { alias, amount, token, sig } = await request.json();

        if (!alias || !amount || !sig) {
            return NextResponse.json({ valid: false, reason: 'Missing parameters' });
        }

        const expectedSig = computeHmac(alias, String(amount), token || 'SOL');
        const valid = sig === expectedSig;

        return NextResponse.json({ valid });
    } catch (e) {
        return NextResponse.json({ valid: false, reason: 'Internal error' }, { status: 500 });
    }
}
