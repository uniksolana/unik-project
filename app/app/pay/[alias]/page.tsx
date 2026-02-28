import { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import ClientPage from './ClientPage';

type Props = {
    params: Promise<{ alias: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// ─── i18n for meta tags ───
const metaI18n: Record<string, Record<string, string>> = {
    en: {
        pay_desc: 'Pay {amount} {token} to @{alias} securely with UNIK.',
        send_desc: 'Send funds to @{alias} instantly via UNIK Pay.',
        pay_title: 'Payment Request - UNIK Pay',
        send_title: 'Send Payment to @{alias} - UNIK Pay',
    },
    es: {
        pay_desc: 'Paga {amount} {token} a @{alias} de forma segura con UNIK.',
        send_desc: 'Envía fondos a @{alias} instantáneamente vía UNIK Pay.',
        pay_title: 'Solicitud de Pago - UNIK Pay',
        send_title: 'Enviar Pago a @{alias} - UNIK Pay',
    },
    fr: {
        pay_desc: 'Payez {amount} {token} à @{alias} en toute sécurité avec UNIK.',
        send_desc: 'Envoyez des fonds à @{alias} instantanément via UNIK Pay.',
        pay_title: 'Demande de Paiement - UNIK Pay',
        send_title: 'Envoyer un Paiement à @{alias} - UNIK Pay',
    },
};

export async function generateMetadata(props: Props): Promise<Metadata> {
    noStore();
    const params = await props.params;
    const searchParams = await props.searchParams;

    const alias = params.alias;
    const orderId = typeof searchParams.order_id === 'string' ? searchParams.order_id : null;
    let amount = typeof searchParams.amount === 'string' ? searchParams.amount : null;
    let token = typeof searchParams.token === 'string' ? searchParams.token : null;
    let concept = typeof searchParams.concept === 'string' ? searchParams.concept : null;

    if (orderId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
            const orderRes = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/payment_orders?id=eq.${orderId}&select=expected_amount,expected_token,concept`,
                {
                    headers: {
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    cache: 'no-store'
                }
            );
            if (orderRes.ok) {
                const orders = await orderRes.json();
                if (orders.length > 0) {
                    const o = orders[0];
                    if (o.expected_amount) amount = String(o.expected_amount);
                    if (o.concept) concept = o.concept;
                    if (o.expected_token) token = o.expected_token;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch order details for OG metadata:', e);
        }
    }

    const getBaseUrl = () => {
        if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
        if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
        if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
        return 'http://localhost:3000';
    };

    const baseUrl = getBaseUrl();
    const ogUrl = new URL(baseUrl);
    ogUrl.pathname = '/api/og';
    ogUrl.searchParams.set('alias', alias);

    // ─── Resolve owner pubkey + language from Supabase ───
    let userLang = 'en'; // Default to English

    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const { PROGRAM_ID } = await import('../../../utils/anchor');
        const connection = new Connection('https://api.devnet.solana.com');
        const isPubKey = alias.length >= 32 && alias.length <= 44 && !alias.includes(' ');

        let ownerPubkey = isPubKey ? alias : '';

        if (!isPubKey) {
            const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(alias.toLowerCase())],
                PROGRAM_ID
            );
            const accountInfo = await connection.getAccountInfo(pda);
            if (accountInfo && accountInfo.data.length >= 40) {
                ownerPubkey = new PublicKey(accountInfo.data.subarray(8, 40)).toBase58();
            }
        }

        if (ownerPubkey) {
            ogUrl.searchParams.set('pubkey', ownerPubkey);

            // Fetch user's preferred language from Supabase profiles
            if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                try {
                    const profileRes = await fetch(
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?wallet_address=eq.${ownerPubkey}&select=preferred_language`,
                        {
                            headers: {
                                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                            },
                        }
                    );
                    if (profileRes.ok) {
                        const profiles = await profileRes.json();
                        if (profiles.length > 0 && profiles[0].preferred_language) {
                            userLang = profiles[0].preferred_language;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to fetch user language preference:', e);
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch alias owner pubkey in OG generation:", e);
    }

    // Pass language to OG image generator
    ogUrl.searchParams.set('lang', userLang);

    if (amount) ogUrl.searchParams.set('amount', amount);
    if (token) ogUrl.searchParams.set('token', token);
    if (concept) ogUrl.searchParams.set('concept', concept);

    const i18n = metaI18n[userLang] || metaI18n['en'];
    const isRequest = amount && amount !== '0';

    const title = isRequest
        ? i18n.pay_title
        : i18n.send_title.replace('{alias}', alias);

    const description = isRequest
        ? i18n.pay_desc.replace('{amount}', amount!).replace('{token}', token || 'SOL').replace('{alias}', alias)
        : i18n.send_desc.replace('{alias}', alias);

    return {
        metadataBase: new URL(baseUrl),
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: [
                {
                    url: ogUrl.toString(),
                    width: 1200,
                    height: 630,
                    alt: 'UNIK Payment Request',
                },
            ],
            siteName: 'UNIK Pay',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogUrl.toString()],
        },
    };
}

export default function Page() {
    return <ClientPage />;
}
