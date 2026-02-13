import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../utils/supabaseServer';

/**
 * Server-side proxy for all user_encrypted_data and transaction_notes operations.
 * The client can no longer access Supabase directly for these tables (RLS blocks anon).
 * 
 * Actions:
 *   - get_encrypted_data: Get encrypted blob/notes for a wallet
 *   - save_encrypted_data: Upsert encrypted blob and/or notes  
 *   - save_shared_note: Insert a transaction note
 *   - get_shared_notes: Get shared notes by signatures
 *   - save_consent: Save legal consent
 *   - get_consent: Check legal consent
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, wallet_address } = body;

        if (!action) {
            return NextResponse.json({ error: 'Missing action' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        switch (action) {
            // ─── user_encrypted_data ───
            case 'get_encrypted_data': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });

                const { data, error } = await supabase
                    .from('user_encrypted_data')
                    .select('encrypted_blob, encrypted_notes')
                    .eq('wallet_address', wallet_address)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                return NextResponse.json({ data: data || null });
            }

            case 'save_encrypted_data': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
                const { encrypted_blob, encrypted_notes } = body;

                const updatePayload: Record<string, string> = {
                    updated_at: new Date().toISOString()
                };
                if (encrypted_blob !== undefined) updatePayload.encrypted_blob = encrypted_blob;
                if (encrypted_notes !== undefined) updatePayload.encrypted_notes = encrypted_notes;

                const { error } = await supabase
                    .from('user_encrypted_data')
                    .upsert({
                        wallet_address,
                        ...updatePayload
                    });

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }

            // ─── transaction_notes (shared notes) ───
            case 'save_shared_note': {
                const { signature, encrypted_note, sender_wallet, recipient_wallet, sender_alias } = body;
                if (!signature || !encrypted_note) {
                    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
                }

                const { error } = await supabase
                    .from('transaction_notes')
                    .insert({
                        signature,
                        encrypted_note,
                        sender_wallet,
                        recipient_wallet,
                        sender_alias: sender_alias || null
                    });

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }

            case 'get_shared_notes': {
                const { signatures } = body;
                if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
                    return NextResponse.json({ data: [] });
                }

                // Limit to prevent abuse
                const limitedSigs = signatures.slice(0, 100);

                const { data, error } = await supabase
                    .from('transaction_notes')
                    .select('signature, encrypted_note, sender_alias')
                    .in('signature', limitedSigs);

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ data: data || [] });
            }

            // ─── legal_consents ───
            case 'get_consent': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });

                const { data, error } = await supabase
                    .from('legal_consents')
                    .select('*')
                    .eq('wallet_address', wallet_address)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
                return NextResponse.json({ data: data || null });
            }

            case 'save_consent': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
                const { signature_base64, consent_version, ip_address } = body;

                const { error } = await supabase
                    .from('legal_consents')
                    .insert({
                        wallet_address,
                        signature: signature_base64,
                        consent_version: consent_version || '1.0',
                        ip_address: ip_address || null,
                        accepted_at: new Date().toISOString()
                    });

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }

            // ─── profiles (preferences) ───
            case 'get_profile': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });

                const { data, error } = await supabase
                    .from('profiles')
                    .select('preferred_language, preferred_currency')
                    .eq('wallet_address', wallet_address)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
                return NextResponse.json({ data: data || null });
            }

            case 'save_profile': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
                const { preferred_language, preferred_currency } = body;

                const upsertPayload: Record<string, string> = { wallet_address };
                if (preferred_language) upsertPayload.preferred_language = preferred_language as string;
                if (preferred_currency) upsertPayload.preferred_currency = preferred_currency as string;

                const { error } = await supabase
                    .from('profiles')
                    .upsert(upsertPayload, { onConflict: 'wallet_address' });

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }


            // ─── avatars (storage) ───
            case 'upload_avatar': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
                const { avatar_base64 } = body;
                if (!avatar_base64) return NextResponse.json({ error: 'Missing avatar_base64' }, { status: 400 });

                // Convert base64 data URL to buffer
                const base64Data = (avatar_base64 as string).replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = `${wallet_address}_avatar`;

                const { error } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, buffer, { upsert: true, contentType: 'image/jpeg' });

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }

            case 'remove_avatar': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
                const fileName = `${wallet_address}_avatar`;

                const { error } = await supabase.storage
                    .from('avatars')
                    .remove([fileName]);

                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (e) {
        console.error('[API /data] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
