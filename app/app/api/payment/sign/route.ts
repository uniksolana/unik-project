import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const getHmacSecret = () => {
    const secret = process.env.PAYMENT_HMAC_SECRET;
    if (!secret) {
        throw new Error('Missing PAYMENT_HMAC_SECRET');
    }
    return secret;
};

function computeHmac(alias: string, amount: string, token: string): string {
    const payload = `${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}`;
    return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
    try {
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
