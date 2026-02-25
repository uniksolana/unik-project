import { Metadata } from 'next';
import ClientPage from './ClientPage';

type Props = {
    params: Promise<{ alias: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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

    const title = `Añadir a @${alias} a contactos - UNIK Pay`;
    const description = `Guarda a @${alias} en tus contactos para enviarle pagos de forma fácil y segura.`;

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
                    alt: 'Añadir Contacto UNIK',
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
