'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Coins, Package, Sparkles } from 'lucide-react'
import Image from 'next/image'

interface HardwareItem {
  id: string
  name: string
  description: string
  price: number
  stock: number
  image_url: string | null
  category: string | null
}

interface CartItem {
  item: HardwareItem
  quantity: number
}

export default function ShopPage() {
  const [items, setItems] = useState<HardwareItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchItems()
    fetchBalance()
  }, [])

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('hardware_items')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data) setItems(data)
    setLoading(false)
  }

  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('virtual_currency')
        .eq('id', user.id)
        .single()
      
      if (data) setBalance(data.virtual_currency)
    }
  }

  const addToCart = (item: HardwareItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) {
        if (existing.quantity >= item.stock) {
          setError(`Only ${item.stock} in stock`)
          setTimeout(() => setError(''), 3000)
          return prev
        }
        return prev.map(c =>
          c.item.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [...prev, { item, quantity: 1 }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId))
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId)
      return
    }

    setCart(prev => prev.map(c => {
      if (c.item.id === itemId) {
        const maxQty = c.item.stock
        return { ...c, quantity: Math.min(quantity, maxQty) }
      }
      return c
    }))
  }

  const getTotalCost = () => {
    return cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0)
  }

  const handlePurchase = async () => {
    const total = getTotalCost()
    
    if (total > balance) {
      setError('Insufficient balance')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (cart.length === 0) {
      setError('Cart is empty')
      setTimeout(() => setError(''), 3000)
      return
    }

    setPurchasing(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const purchaseItems = cart.map(c => ({
        item_id: c.item.id,
        quantity: c.quantity
      }))

      const { data, error } = await supabase.rpc('process_purchase', {
        p_user_id: user.id,
        p_items: purchaseItems
      })

      if (error) throw error

      setSuccess('Purchase successful! Check "My Orders" to view.')
      setCart([])
      fetchBalance()
      fetchItems()
      
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: any) {
      setError(err.message || 'Purchase failed')
      setTimeout(() => setError(''), 5000)
    } finally {
      setPurchasing(false)
    }
  }

  const cartTotal = getTotalCost()

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
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 left-1/3 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 text-transparent bg-clip-text mb-2">
              Hardware Shop
            </h1>
            <p className="text-gray-400">Equip your mission with the best gear</p>
          </div>
          <div className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-sm border border-cyan-500/30 px-6 py-3 rounded-full">
            <Coins className="w-6 h-6 text-yellow-400 animate-pulse" />
            <span className="font-bold text-2xl bg-gradient-to-r from-yellow-400 to-yellow-200 text-transparent bg-clip-text">
              {balance}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-900/50 backdrop-blur-sm border border-red-500/50 text-red-200 px-6 py-4 rounded-lg animate-shake">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-900/50 backdrop-blur-sm border border-green-500/50 text-green-200 px-6 py-4 rounded-lg flex items-center">
            <Sparkles className="w-5 h-5 mr-2 animate-spin" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Grid */}
          <div className="lg:col-span-2">
            {items.length === 0 ? (
              <div className="text-center py-20 bg-gray-900/40 backdrop-blur-sm border border-cyan-500/20 rounded-2xl">
                <Package className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No items available in the shop</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="group bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400/60 hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300"
                  >
                    <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={200}
                          height={200}
                          className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <Package className="w-20 h-20 text-gray-600 group-hover:text-cyan-500 transition-colors" />
                      )}
                      {item.category && (
                        <div className="absolute top-3 right-3 bg-cyan-500/80 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-semibold">
                          {item.category}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-5">
                      <h3 className="font-bold text-lg text-cyan-300 mb-2 group-hover:text-cyan-200 transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {item.description}
                      </p>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-200 text-transparent bg-clip-text">
                            {item.price}
                          </span>
                          <Coins className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div className="text-right">
                          <span className={`text-sm ${item.stock > 10 ? 'text-green-400' : item.stock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        disabled={item.stock === 0}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 
                                 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed 
                                 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200
                                 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                      >
                        {item.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 sticky top-4">
              <h2 className="text-2xl font-bold text-cyan-300 mb-6 flex items-center">
                <ShoppingCart className="w-6 h-6 mr-2" />
                Shopping Cart
              </h2>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6 max-h-96 overflow-y-auto custom-scrollbar">
                    {cart.map(({ item, quantity }) => (
                      <div key={item.id} className="bg-gray-800/40 border border-cyan-500/20 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-sm text-cyan-200">{item.name}</h4>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-400 hover:text-red-300 text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateQuantity(item.id, quantity - 1)}
                              className="w-8 h-8 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 font-bold transition-colors"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-bold text-white">{quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, quantity + 1)}
                              className="w-8 h-8 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-lg text-yellow-400">
                              {item.price * quantity}
                            </span>
                            <Coins className="w-4 h-4 text-yellow-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-cyan-500/30 pt-6 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Subtotal:</span>
                      <div className="flex items-center space-x-1">
                        <span className="font-bold text-xl text-yellow-400">{cartTotal}</span>
                        <Coins className="w-5 h-5 text-yellow-400" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-lg text-cyan-300">Total:</span>
                      <div className="flex items-center space-x-1">
                        <span className="font-bold text-3xl bg-gradient-to-r from-yellow-400 to-yellow-200 text-transparent bg-clip-text">
                          {cartTotal}
                        </span>
                        <Coins className="w-7 h-7 text-yellow-400 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {cartTotal > balance && (
                    <p className="text-red-400 text-sm mb-3 text-center bg-red-900/20 border border-red-500/30 rounded-lg py-2">
                      Need {cartTotal - balance} more coins
                    </p>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || cartTotal > balance || cart.length === 0}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 
                             disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
                             text-white font-bold py-4 px-4 rounded-lg transition-all duration-200
                             shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
                  >
                    {purchasing ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Complete Purchase'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}