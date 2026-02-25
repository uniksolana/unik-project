import { Metadata } from 'next';
import ClientPage from './ClientPage';

type Props = {
    params: Promise<{ alias: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
    const searchParams = await props.searchParams;

    const alias = params.alias;
    const amount = typeof searchParams.amount === 'string' ? searchParams.amount : null;
    const token = typeof searchParams.token === 'string' ? searchParams.token : null;
    const concept = typeof searchParams.concept === 'string' ? searchParams.concept : null;

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
        }
    } catch (e) {
        console.error("Failed to fetch alias owner pubkey in OG generation:", e);
    }

    if (amount) ogUrl.searchParams.set('amount', amount);
    if (token) ogUrl.searchParams.set('token', token);
    if (concept) ogUrl.searchParams.set('concept', concept);

    const isRequest = amount && amount !== '0';
    const title = isRequest
        ? `Solicitud de Pago - UNIK Pay`
        : `Enviar Pago a @${alias} - UNIK Pay`;

    const description = isRequest
        ? `Paga ${amount} ${token || 'SOL'} a @${alias} de forma segura con UNIK.`
        : `Envía fondos a @${alias} instantáneamente vía UNIK Pay.`;

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
