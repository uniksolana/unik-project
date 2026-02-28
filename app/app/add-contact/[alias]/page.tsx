import { Metadata } from 'next';
import ClientPage from './ClientPage';

type Props = {
    params: Promise<{ alias: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// ─── i18n for meta tags ───
const metaI18n: Record<string, Record<string, string>> = {
    en: {
        contact_title: 'Add @{alias} to contacts - UNIK Pay',
        contact_desc: 'Save @{alias} to your contacts to send payments easily and securely.',
    },
    es: {
        contact_title: 'Añadir a @{alias} a contactos - UNIK Pay',
        contact_desc: 'Guarda a @{alias} en tus contactos para enviarle pagos de forma fácil y segura.',
    },
    fr: {
        contact_title: 'Ajouter @{alias} aux contacts - UNIK Pay',
        contact_desc: 'Enregistrez @{alias} dans vos contacts pour envoyer des paiements facilement.',
    },
};

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;

    const alias = params.alias;

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
    ogUrl.searchParams.set('action', 'add-contact');

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

    ogUrl.searchParams.set('lang', userLang);

    const i18n = metaI18n[userLang] || metaI18n['en'];
    const title = i18n.contact_title.replace('{alias}', alias);
    const description = i18n.contact_desc.replace('{alias}', alias);

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
                    alt: 'UNIK Contact',
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
