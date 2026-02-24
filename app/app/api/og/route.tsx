import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parametros dinámicos
        const alias = searchParams.get('alias') || 'Usuario';
        const amount = searchParams.get('amount');
        const token = searchParams.get('token');
        const concept = searchParams.get('concept') || '';

        // Si no hay amount, mostramos una genérica de "Pagar a"
        const isRequest = amount && amount !== '0';

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
                            width: '80%',
                            height: '75%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '32px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                            padding: '40px',
                            position: 'relative',
                        }}
                    >
                        {/* Cabecera / Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
                            <div style={{ display: 'flex', width: '40px', height: '40px', background: 'linear-gradient(to right, #7c3aed, #3b82f6)', borderRadius: '10px' }} />
                            <span style={{ color: 'white', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                UNIK<span style={{ color: '#9ca3af', fontWeight: 400 }}>Pay</span>
                            </span>
                        </div>

                        {/* Contenido principal */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            {isRequest ? (
                                <span style={{ color: '#38bdf8', fontSize: 28, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    Solicitud de Pago
                                </span>
                            ) : (
                                <span style={{ color: '#a78bfa', fontSize: 28, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    Enviar fondos
                                </span>
                            )}

                            {isRequest && (
                                <span style={{ color: 'white', fontSize: 80, fontWeight: 800, margin: '20px 0', display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                                    {amount} <span style={{ fontSize: 40, color: '#9ca3af', fontWeight: 600 }}>{token}</span>
                                </span>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, color: '#f3f4f6', marginTop: isRequest ? 0 : 40 }}>
                                <span style={{ color: '#9ca3af', marginRight: '16px' }}>Para:</span> <span style={{ fontWeight: 600 }}>@{alias}</span>
                            </div>

                            {concept && (
                                <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, color: '#d1d5db', marginTop: '20px', background: 'rgba(255, 255, 255, 0.1)', padding: '12px 24px', borderRadius: '100px' }}>
                                    "{concept}"
                                </div>
                            )}
                        </div>

                        {/* Footer (Solana Badge) */}
                        <div style={{ position: 'absolute', bottom: '40px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
                            <span style={{ color: '#9ca3af', fontSize: 20 }}>Powered by</span>
                            <span style={{ color: 'white', fontSize: 20, fontWeight: 600, background: 'linear-gradient(to right, #14F195, #9945FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Solana</span>
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
