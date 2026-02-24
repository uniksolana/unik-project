import { Metadata } from 'next';
import ClientPage from './ClientPage';

type Props = {
    params: { alias: string };
    searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
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

    if (amount) ogUrl.searchParams.set('amount', amount);
    if (token) ogUrl.searchParams.set('token', token);
    if (concept) ogUrl.searchParams.set('concept', concept);

    const isRequest = amount && amount !== '0';
    const title = isRequest
        ? `Solicitud de Pago - UNIK Pay`
        : `Enviar Pago a @${alias} - UNIK Pay`;

    const description = isRequest
        ? `Paga ${amount} ${token || 'SOL'} a @${alias} de forma segura con Solana.`
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
