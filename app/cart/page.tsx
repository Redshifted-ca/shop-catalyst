'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Clock, CheckCircle, XCircle, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

interface OrderItem {
  id: string
  item_name: string
  quantity: number
  price_at_purchase: number
}

interface Order {
  id: string
  status: string
  total_price: number
  created_at: string
  picked_up_at: string | null
  notes: string | null
  order_items: OrderItem[]
}

export default function CartPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          item_name,
          quantity,
          price_at_purchase
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setOrders(data as Order[])
    }
    setLoading(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />
      case 'picked_up':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-400" />
      default:
        return <Package className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
      case 'picked_up':
        return 'bg-green-500/20 text-green-300 border-green-500/50'
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-blue-950 to-cyan-950 flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-400 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-blue-950 to-cyan-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Nebula effects */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-1/3 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 text-transparent bg-clip-text mb-2">
          My Orders
        </h1>
        <p className="text-gray-400 mb-8">Track your hardware acquisitions</p>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/40 backdrop-blur-sm border border-cyan-500/20 rounded-2xl">
            <Package className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cyan-300 mb-2">No orders yet</h3>
            <p className="text-gray-400">Start shopping to see your orders here!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400/60 transition-all">
                <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 px-6 py-4 border-b border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(order.status)}
                      <div>
                        <p className="text-sm text-gray-400">
                          {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="space-y-3 mb-4">
                    {order.order_items.map(item => (
                      <div key={item.id} className="flex justify-between items-center py-2 border-b border-cyan-500/10">
                        <div>
                          <p className="font-semibold text-cyan-200">{item.item_name}</p>
                          <p className="text-sm text-gray-400">
                            {item.quantity} × {item.price_at_purchase} coins
                          </p>
                        </div>
                        <p className="font-bold text-lg text-yellow-400">
                          {item.price_at_purchase * item.quantity}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-cyan-500/30">
                    <span className="font-semibold text-lg text-cyan-300">Total</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-200 text-transparent bg-clip-text">
                      {order.total_price} coins
                    </span>
                  </div>

                  {order.status === 'picked_up' && order.picked_up_at && (
                    <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <p className="text-sm text-green-300">
                          Picked up on {format(new Date(order.picked_up_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  )}

                  {order.notes && (
                    <div className="mt-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-300">
                        <strong>Note:</strong> {order.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}