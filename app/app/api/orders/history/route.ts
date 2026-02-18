
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../utils/supabaseServer';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { wallet } = body;

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        // Fetch orders and transaction notes where user is involved
        // We select orders where the user is either the merchant (recipient) or payer (sender)
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .or(`merchant_wallet.eq.${wallet},payer_wallet.eq.${wallet}`)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("Error fetching orders:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ orders: orders || [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
