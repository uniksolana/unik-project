import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '../../../../utils/rateLimit';

const getHmacSecret = () => {
    const secret = process.env.PAYMENT_HMAC_SECRET;
    if (!secret) {
        throw new Error('Missing PAYMENT_HMAC_SECRET');
    }
    return secret;
};

function computeHmac(alias: string, amount: string, token: string, orderId?: string, concept?: string): string {
    const payload = `${alias.toLowerCase().trim()}|${amount}|${token.toUpperCase()}|${orderId || ''}|${concept || ''}`;
    // CRIT-02: Use full 256-bit HMAC (64 hex chars)
    return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex');
}

export async function POST(request: NextRequest) {
    try {
        // N-002: Rate Limiting
        // MED-05: Use Vercel's trusted header first (not spoofable)
        const ip = request.headers.get('x-vercel-forwarded-for')
            || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || '0.0.0.0';

        // Limit: 30 requests per 1 minute (60s) for verification
        const { success } = await checkRateLimit(ip.split(',')[0].trim(), 30, 60);

        if (!success) {
            return NextResponse.json({ valid: false, reason: 'Rate limit exceeded' }, { status: 429 });
        }

        const { alias, amount, token, sig, orderId, concept } = await request.json();

        if (!alias || !amount || !sig) {
            return NextResponse.json({ valid: false, reason: 'Missing parameters' });
        }

        const fullSig = computeHmac(alias, String(amount), token || 'SOL', orderId, concept || '');

        // CRIT-01 + CRIT-02: Timing-safe comparison with dual backward compatibility
        // Accept both full (64 char) and legacy (16 char) signatures
        let valid = false;
        try {
            if (sig.length === 64) {
                // New full-length signature
                valid = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(fullSig, 'hex'));
            } else if (sig.length === 16) {
                // Legacy truncated signature (backward compat — remove after 30 days)
                const legacySig = fullSig.slice(0, 16);
                valid = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(legacySig, 'hex'));
            }
        } catch {
            valid = false;
        }

        return NextResponse.json({ valid });
    } catch (e) {
        return NextResponse.json({ valid: false, reason: 'Internal error' }, { status: 500 });
    }
}
