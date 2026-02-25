import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// ─── OG Card Translations ───
const ogTranslations: Record<string, Record<string, string>> = {
    en: {
        payment_request: 'Payment Request',
        send_funds: 'Send Funds',
        to: 'To:',
        concept: 'Concept:',
        new_contact: 'New Contact',
        powered_by: 'Powered by',
    },
    es: {
        payment_request: 'Solicitud de Pago',
        send_funds: 'Enviar Fondos',
        to: 'Para:',
        concept: 'Concepto:',
        new_contact: 'Nuevo Contacto',
        powered_by: 'Powered by',
    },
    fr: {
        payment_request: 'Demande de Paiement',
        send_funds: 'Envoyer des Fonds',
        to: 'Pour:',
        concept: 'Motif:',
        new_contact: 'Nouveau Contact',
        powered_by: 'Powered by',
    },
};

// ─── Meta description translations ───
export const metaTranslations: Record<string, Record<string, string>> = {
    en: {
        pay_desc: 'Pay {amount} {token} to @{alias} securely with UNIK.',
        send_desc: 'Send funds to @{alias} instantly via UNIK Pay.',
        contact_title: 'Add @{alias} to contacts - UNIK Pay',
        contact_desc: 'Save @{alias} to your contacts to send payments easily and securely.',
        pay_title: 'Payment Request - UNIK Pay',
        send_title: 'Send Payment to @{alias} - UNIK Pay',
    },
    es: {
        pay_desc: 'Paga {amount} {token} a @{alias} de forma segura con UNIK.',
        send_desc: 'Envía fondos a @{alias} instantáneamente vía UNIK Pay.',
        contact_title: 'Añadir a @{alias} a contactos - UNIK Pay',
        contact_desc: 'Guarda a @{alias} en tus contactos para enviarle pagos de forma fácil y segura.',
        pay_title: 'Solicitud de Pago - UNIK Pay',
        send_title: 'Enviar Pago a @{alias} - UNIK Pay',
    },
    fr: {
        pay_desc: 'Payez {amount} {token} à @{alias} en toute sécurité avec UNIK.',
        send_desc: 'Envoyez des fonds à @{alias} instantanément via UNIK Pay.',
        contact_title: 'Ajouter @{alias} aux contacts - UNIK Pay',
        contact_desc: 'Enregistrez @{alias} dans vos contacts pour envoyer des paiements facilement.',
        pay_title: 'Demande de Paiement - UNIK Pay',
        send_title: 'Envoyer un Paiement à @{alias} - UNIK Pay',
    },
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parametros dinámicos
        const alias = searchParams.get('alias') || 'Usuario';
        const amount = searchParams.get('amount');
        const token = searchParams.get('token') || 'SOL';
        const concept = searchParams.get('concept') || '';
        const action = searchParams.get('action');
        const lang = searchParams.get('lang') || 'es';

        const t = ogTranslations[lang] || ogTranslations['en'];

        const isRequest = amount && amount !== '0';

        const getBaseUrl = () => {
            if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
            if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
            if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
            const url = new URL(request.url);
            return `${url.protocol}//${url.host}`;
        };
        const logoUrl = `${getBaseUrl()}/logo-icon.png`;

        const isPubKey = alias.length >= 32 && alias.length <= 44 && !alias.includes(' ');
        const displayAlias = isPubKey ? `${alias.slice(0, 4)}...${alias.slice(-4)}` : `@${alias}`;

        const pubkey = searchParams.get('pubkey');
        let avatarUrl: string | null = null;

        if (pubkey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const potentialAvatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${pubkey}_avatar`;
            try {
                const res = await fetch(potentialAvatarUrl, { method: 'HEAD' });
                if (res.ok) {
                    avatarUrl = potentialAvatarUrl;
                }
            } catch (e) {
                console.error('Error fetching avatar visibility:', e);
            }
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #09090b 0%, #1a1a2e 100%)',
                        fontFamily: '"Inter", sans-serif',
                    }}
                >
                    {/* Decorative blurred circles */}
                    <div style={{ position: 'absolute', top: -150, left: -150, width: 400, height: 400, background: 'rgba(124, 58, 237, 0.4)', filter: 'blur(100px)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: -150, right: -150, width: 400, height: 400, background: 'rgba(56, 189, 248, 0.3)', filter: 'blur(100px)', borderRadius: '50%' }} />

                    {/* Glass Card */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '85%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '48px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                            padding: '80px 60px 100px 60px',
                            position: 'relative',
                        }}
                    >
                        {/* Main Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%' }}>
                            {action === 'add-contact' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '160px', height: '160px', borderRadius: '50%', background: 'linear-gradient(to bottom right, #06b6d4, #a855f7)', color: 'white', fontSize: '80px', fontWeight: 'bold', marginBottom: '30px', overflow: 'hidden' }}>
                                        {avatarUrl ? (
                                            <img src={avatarUrl} width="160" height="160" style={{ objectFit: 'cover' }} />
                                        ) : (
                                            alias.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 90, color: 'white', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px' }}>
                                        <span style={{ fontWeight: 600, color: isPubKey ? '#cbd5e1' : 'white' }}>{displayAlias}</span>
                                    </div>
                                    <span style={{ color: '#06b6d4', fontSize: 36, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '10px' }}>
                                        {t.new_contact}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    {isRequest ? (
                                        <span style={{ color: '#38bdf8', fontSize: 40, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                                            {t.payment_request}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#a78bfa', fontSize: 40, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                                            {t.send_funds}
                                        </span>
                                    )}

                                    {isRequest && (
                                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: '20px 0', gap: '20px' }}>
                                            <span style={{ color: 'white', fontSize: 130, fontWeight: 800, lineHeight: 1 }}>
                                                {amount}
                                            </span>
                                            <span style={{ fontSize: 60, color: '#9ca3af', fontWeight: 600, marginTop: '20px' }}>
                                                {token}
                                            </span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 50, color: '#f3f4f6', marginTop: isRequest ? 15 : 30 }}>
                                        <span style={{ color: '#9ca3af', marginRight: '20px' }}>{t.to}</span>
                                        {avatarUrl && (
                                            <div style={{ display: 'flex', overflow: 'hidden', borderRadius: '50%', marginRight: '16px', width: '64px', height: '64px' }}>
                                                <img src={avatarUrl} width="64" height="64" style={{ objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        <span style={{ fontWeight: 600, color: isPubKey ? '#cbd5e1' : 'white' }}>{displayAlias}</span>
                                    </div>

                                    {concept && (
                                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', marginTop: '40px', background: 'rgba(255, 255, 255, 0.1)', padding: '16px 36px', borderRadius: '100px' }}>
                                            <span style={{ color: '#9ca3af', fontSize: 36, fontWeight: 500 }}>{t.concept}</span>
                                            <span style={{ color: '#d1d5db', fontSize: 36, fontWeight: 600 }}>"{concept}"</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer (UNIK Badge) */}
                        <div style={{ position: 'absolute', bottom: '30px', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8 }}>
                            <span style={{ color: '#9ca3af', fontSize: 24, fontWeight: 500 }}>{t.powered_by}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={logoUrl} width="32" height="32" style={{ borderRadius: '8px' }} />
                                <span style={{ color: 'white', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' }}>
                                    UNIK<span style={{ color: '#9ca3af', fontWeight: 400 }}>Pay</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (e: any) {
        console.error('OG Image generation error:', e);
        return new Response('Failed to generate image', { status: 500 });
    }
}
