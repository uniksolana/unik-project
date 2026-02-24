import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parametros dinámicos
        const alias = searchParams.get('alias') || 'Usuario';
        const amount = searchParams.get('amount');
        const token = searchParams.get('token') || 'SOL';
        const concept = searchParams.get('concept') || '';

        // Si no hay amount, mostramos una genérica de "Pagar a"
        const isRequest = amount && amount !== '0';

        const getBaseUrl = () => {
            if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
            if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
            if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
            const url = new URL(request.url);
            return `${url.protocol}//${url.host}`;
        };
        const logoUrl = `${getBaseUrl()}/logo-icon.png`;

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
                        background: 'linear-gradient(135deg, #09090b 0%, #1a1a2e 100%)', // Fondo oscuro premium
                        fontFamily: '"Inter", sans-serif',
                    }}
                >
                    {/* Elementos decorativos (círculos desenfocados) */}
                    <div style={{ position: 'absolute', top: -150, left: -150, width: 400, height: 400, background: 'rgba(124, 58, 237, 0.4)', filter: 'blur(100px)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: -150, right: -150, width: 400, height: 400, background: 'rgba(56, 189, 248, 0.3)', filter: 'blur(100px)', borderRadius: '50%' }} />

                    {/* Tarjeta principal estilo "Cristal" */}
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
                            padding: '60px',
                            position: 'relative',
                        }}
                    >
                        {/* Cabecera / Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                            <img src={logoUrl} width="64" height="64" style={{ borderRadius: '16px' }} />
                            <span style={{ color: 'white', fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                UNIK<span style={{ color: '#9ca3af', fontWeight: 400 }}>Pay</span>
                            </span>
                        </div>

                        {/* Contenido principal */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            {isRequest ? (
                                <span style={{ color: '#38bdf8', fontSize: 36, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    Solicitud de Pago
                                </span>
                            ) : (
                                <span style={{ color: '#a78bfa', fontSize: 36, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    Enviar fondos
                                </span>
                            )}

                            {isRequest && (
                                <span style={{ color: 'white', fontSize: 130, fontWeight: 800, margin: '20px 0', display: 'flex', alignItems: 'baseline', gap: '20px' }}>
                                    {amount} <span style={{ fontSize: 60, color: '#9ca3af', fontWeight: 600 }}>{token}</span>
                                </span>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', fontSize: 50, color: '#f3f4f6', marginTop: isRequest ? 10 : 30 }}>
                                <span style={{ color: '#9ca3af', marginRight: '20px' }}>Para:</span> <span style={{ fontWeight: 600 }}>@{alias}</span>
                            </div>

                            {concept && (
                                <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, color: '#d1d5db', marginTop: '30px', background: 'rgba(255, 255, 255, 0.1)', padding: '16px 36px', borderRadius: '100px', textAlign: 'center' }}>
                                    "{concept}"
                                </div>
                            )}
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
