import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// API endpoint for ESP32 NFC reader
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const nfcId = searchParams.get('nfc_id')
  const apiKey = request.headers.get('x-api-key')

  // Validate API key (set this in your environment)
  if (apiKey !== process.env.ESP32_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!nfcId) {
    return NextResponse.json({ error: 'NFC ID required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Find user by NFC ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, virtual_currency')
      .eq('nfc_id', nfcId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'NFC ID not found' }, { status: 404 })
    }

    // Get pending orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        total_price,
        created_at,
        order_items (
          item_name,
          quantity,
          price_at_purchase
        )
      `)
      .eq('user_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (ordersError) throw ordersError

    return NextResponse.json({
      user: {
        id: profile.id,
        name: profile.full_name || profile.email,
        email: profile.email,
        balance: profile.virtual_currency
      },
      orders: orders || []
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}