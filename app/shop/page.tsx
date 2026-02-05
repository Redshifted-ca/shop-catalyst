'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Coins, Package } from 'lucide-react'
import Image from 'next/image'
import { useBalance } from '@/contexts/BalanceContext'

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
  const { balance, setBalance, refreshBalance } = useBalance()
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchItems()
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

      // Refresh balance from server before purchase to prevent tampering
      await refreshBalance()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('virtual_currency')
        .eq('id', user.id)
        .single()
      
      const actualBalance = profileData?.virtual_currency || 0
      
      if (total > actualBalance) {
        setError('Insufficient balance')
        setTimeout(() => setError(''), 3000)
        setPurchasing(false)
        return
      }

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
      await refreshBalance() // Update shared balance after purchase
      fetchItems() // Refresh stock
      
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Hardware Shop</h1>
        <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-lg">
          <Coins className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-700">{balance} coins</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product Grid */}
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No items available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        width={200}
                        height={200}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-lg text-gray-900 mb-1">
                      {item.name}
                    </h3>
                    {item.category && (
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
                        {item.category}
                      </span>
                    )}
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {item.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          {item.price}
                        </span>
                        <Coins className="inline w-5 h-5 ml-1 text-yellow-500" />
                      </div>
                      <span className="text-sm text-gray-500">
                        Stock: {item.stock}
                      </span>
                    </div>

                    <button
                      onClick={() => addToCart(item)}
                      disabled={item.stock === 0}
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
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
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Shopping Cart
            </h2>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Cart is empty</p>
            ) : (
              <>
                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                  {cart.map(({ item, quantity }) => (
                    <div key={item.id} className="border-b pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.id, quantity - 1)}
                            className="w-7 h-7 rounded border border-gray-300 hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, quantity + 1)}
                            className="w-7 h-7 rounded border border-gray-300 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-semibold">
                          {quantity}
                          <Coins className="inline w-4 h-4 ml-1 text-yellow-500" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-lg">Total:</span>
                    <span className="font-bold text-2xl text-gray-900">
                      {cartTotal}
                      <Coins className="inline w-6 h-6 ml-1 text-yellow-500" />
                    </span>
                  </div>

                  {cartTotal > balance && (
                    <p className="text-red-600 text-sm mb-2">
                      Insufficient balance (need {cartTotal - balance} more)
                    </p>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || cartTotal > balance || cart.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    {purchasing ? 'Processing...' : 'Complete Purchase'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}