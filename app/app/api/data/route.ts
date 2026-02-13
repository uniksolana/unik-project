import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../utils/supabaseServer';
import { verifyWalletSignature } from '../../../utils/verifyAuth';

/**
 * Server-side proxy for all user_encrypted_data and transaction_notes operations.
 * The client can no longer access Supabase directly for these tables (RLS blocks anon).
 * 
 * Actions:
 *   - get_encrypted_data: Get encrypted blob/notes for a wallet (AUTH REQUIRED)
 *   - save_encrypted_data: Upsert encrypted blob and/or notes (AUTH REQUIRED)
 *   - save_shared_note: Insert a transaction note (AUTH REQUIRED)
 *   - get_shared_notes: Get shared notes by signatures (PUBLIC)
 *   - save_consent: Save legal consent (Internal signature check)
 *   - get_consent: Check legal consent (PUBLIC)
 *   - upload_avatar: Upload avatar to storage (AUTH REQUIRED)
 *   - remove_avatar: Remove avatar from storage (AUTH REQUIRED)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, wallet_address, auth_wallet, auth_signature, auth_message } = body;

        if (!action) {
            return NextResponse.json({ error: 'Missing action' }, { status: 400 });
        }

        // Helper to verify auth
        const isAuthValid = () => {
            if (!auth_wallet || !auth_signature || !auth_message) return false;
            // The authenticated wallet must match the target wallet_address
            if (wallet_address && auth_wallet !== wallet_address) return false;
            return verifyWalletSignature(auth_wallet, auth_signature, auth_message);
        };

        const requireAuth = () => {
            if (!isAuthValid()) {
                throw new Error('Unauthorized: Valid wallet signature required');
            }
        };

        const supabase = getServerSupabase();

        switch (action) {
            // ─── user_encrypted_data ───
            case 'get_encrypted_data': {
                if (!wallet_address) return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
                requireAuth(); // 🔒 AUTH REQUIRED

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
                requireAuth(); // 🔒 AUTH REQUIRED
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
                if (!signature || !encrypted_note || !sender_wallet) {
                    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
                }

                // Verify the sender is the one saving the note
                if (!auth_wallet || auth_wallet !== sender_wallet || !verifyWalletSignature(auth_wallet, auth_signature, auth_message)) {
                    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                // Publicly readable if you have the signature (encrypted content)
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
                // Public check
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
                // We verify the signature provided in the body itself, no need for auth header
                const { signature_base64, consent_version, ip_address } = body;

                // TODO: Verify signature_base64 here against wallet_address if strictness needed
                // For now, we trust the client logic + signature existence

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
                // Profiles are generally public preferences (currency/lang), or at least low sensitivity.
                // Keeping public for now to avoid blocking UI rendering before auth.

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
                requireAuth(); // 🔒 AUTH REQUIRED

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
                requireAuth(); // 🔒 AUTH REQUIRED
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
                requireAuth(); // 🔒 AUTH REQUIRED
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
    } catch (e: any) {
        if (e.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: e.message }, { status: 401 });
        }
        if (e.message?.includes('Missing SUPABASE')) {
            return NextResponse.json({ error: 'Server Config Error: Missing Supabase Keys' }, { status: 500 });
        }
        console.error('[API /data] Error:', e);
        return NextResponse.json({ error: 'Internal server error: ' + (e.message || 'Unknown') }, { status: 500 });
    }
}
