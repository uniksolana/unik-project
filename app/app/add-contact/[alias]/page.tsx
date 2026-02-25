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

    // Build the dynamic image URL
    const baseUrl = getBaseUrl();
    const ogUrl = new URL(baseUrl);
    ogUrl.pathname = '/api/og';
    ogUrl.searchParams.set('alias', alias);
    ogUrl.searchParams.set('action', 'add-contact'); // Tell OG to render contact view

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
