'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Scan, Package, CheckCircle, User, Clock, Usb, AlertCircle } from 'lucide-react'
import { SerialPort } from 'serialport'

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
  notes: string | null
  order_items: OrderItem[]
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  virtual_currency: number
}

interface UserOrders {
  profile: UserProfile
  orders: Order[]
}

export default function CashierPage() {
  const [userOrders, setUserOrders] = useState<UserOrders | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSerialConnected, setIsSerialConnected] = useState(false)
  const [serialStatus, setSerialStatus] = useState('Disconnected')
  const [lastScannedId, setLastScannedId] = useState('')
  
  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Check if Web Serial API is supported
    if (!('serial' in navigator)) {
      setError('Web Serial API not supported in this browser. Please use Chrome, Edge, or Opera.')
    }

    return () => {
      disconnectSerial()
    }
  }, [])

  const connectSerial = async () => {
    try {
      // Request a port
      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate: 115200 })

      portRef.current = port
      setIsSerialConnected(true)
      setSerialStatus('Connected')
      setError('')

      // Start reading
      readSerialData(port)
    } catch (err: any) {
      console.error('Serial connection error:', err)
      setError('Failed to connect to ESP32: ' + err.message)
      setSerialStatus('Connection failed')
    }
  }

  const disconnectSerial = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel()
        readerRef.current = null
      }
      if (portRef.current) {
        await portRef.current.close()
        portRef.current = null
      }
      setIsSerialConnected(false)
      setSerialStatus('Disconnected')
    } catch (err) {
      console.error('Error disconnecting:', err)
    }
  }

  

  const readSerialData = async (port: SerialPort) => {
    const textDecoder = new TextDecoderStream()
    const reader = textDecoder.readable.getReader()
    readerRef.current = reader

    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += value

        // Process complete lines
        // In readSerialData function
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          console.log('Serial:', trimmed)

          if (trimmed.startsWith('NFC_SCAN:')) {
            const nfcId = trimmed.replace('NFC_SCAN:', '')
            handleNFCScan(nfcId)
          } else if (trimmed.startsWith('NFC_DATA:')) {
            // NEW: Handle data read from tag
            const data = trimmed.replace('NFC_DATA:', '')
            console.log('Tag contains:', data)
            // Could use this instead of/in addition to UID lookup
          } else if (trimmed === 'NFC_READY') {
            setSerialStatus('Ready - Waiting for NFC scan...')
          } else if (trimmed.startsWith('NFC_ERROR:')) {
            setError(trimmed.replace('NFC_ERROR:', ''))
          }
        }
      }
    } catch (err: any) {
      console.error('Serial read error:', err)
      if (err.message !== 'The port has been closed.') {
        setError('Serial communication error: ' + err.message)
        setIsSerialConnected(false)
        setSerialStatus('Disconnected')
      }
    }
  }

  const handleNFCScan = async (nfcId: string) => {
    setLastScannedId(nfcId)
    setSerialStatus(`Scanned: ${nfcId}`)
    setError('')
    setSuccess('')
    setUserOrders(null)

    try {
      // Find user by NFC ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('nfc_id', nfcId)
        .single()

      if (profileError || !profile) {
        setError(`NFC ID "${nfcId}" not found. Please assign this NFC to a user first.`)
        playErrorSound()
        return
      }

      // Get user's pending orders
      const { data: orders, error: ordersError } = await supabase
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
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (ordersError) throw ordersError

      setUserOrders({
        profile: profile as UserProfile,
        orders: (orders || []) as Order[]
      })

      if (!orders || orders.length === 0) {
        setError('No pending orders found for this user.')
        playWarningSound()
      } else {
        playSuccessSound()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to lookup user')
      playErrorSound()
    }
  }

  const handleMarkAsPickedUp = async (orderId: string) => {
    setProcessing(orderId)
    setError('')
    setSuccess('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'picked_up',
          picked_up_at: new Date().toISOString(),
          picked_up_by: user.id
        })
        .eq('id', orderId)

      if (error) throw error

      setSuccess('Order marked as picked up!')
      playSuccessSound()
      
      // Refresh orders
      if (userOrders) {
        setUserOrders({
          ...userOrders,
          orders: userOrders.orders.filter(o => o.id !== orderId)
        })
      }

      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update order')
      playErrorSound()
    } finally {
      setProcessing(null)
    }
  }

  const handleAddNote = async (orderId: string, note: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ notes: note })
        .eq('id', orderId)

      if (error) throw error
    } catch (err: any) {
      alert('Failed to add note: ' + err.message)
    }
  }

  // Audio feedback
  const playSuccessSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFApGn+DyvmwhBjiP1/PMeSwFJHfH8N2RQAoUXrTp66hVFA==')
    audio.play().catch(() => {})
  }

  const playErrorSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgP8A//8AAACA/wD/gIAA/4CA//8A/wCA/wD/gP+A/wD//4CA/wCAgID/AICA/wD//wAAgP8A/4CA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A//+AgP8AgICA/wAAgP8A//8AAICA/wD//4AA/wD/gP+A/wD//wCA/wD/gICA//8A/4D/gP8A/w==')
    audio.play().catch(() => {})
  }

  const playWarningSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/4CAgP+AgID/gICA/w==')
    audio.play().catch(() => {})
  }
  // Add to state
const [manualNfcId, setManualNfcId] = useState('')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Cashier Station</h1>

      {/* Serial Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Usb className={`w-6 h-6 ${isSerialConnected ? 'text-green-600' : 'text-gray-400'}`} />
            <div>
              <h2 className="text-lg font-semibold">ESP32 NFC Reader</h2>
              <p className={`text-sm ${isSerialConnected ? 'text-green-600' : 'text-gray-500'}`}>
                {serialStatus}
              </p>
            </div>
          </div>
          
          {!isSerialConnected ? (
            <button
              onClick={connectSerial}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center"
            >
              <Usb className="w-4 h-4 mr-2" />
              Connect ESP32
            </button>
          ) : (
            <button
              onClick={disconnectSerial}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        {lastScannedId && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Last scanned NFC ID:</strong> {lastScannedId}
            </p>
          </div>
        )}

        {!isSerialConnected && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Setup Instructions:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Connect ESP32 to laptop via USB</li>
                  <li>Upload the NFC reader code to ESP32</li>
                  <li>Click "Connect ESP32" button above</li>
                  <li>Select the correct serial port (usually COM3 or /dev/ttyUSB0)</li>
                  <li>Wait for "Ready" status</li>
                  <li>Scan NFC stickers to lookup orders</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          {success}
        </div>
      )}

      {/* User Info & Orders */}
      {userOrders && (
        <div className="space-y-6">
          {/* User Profile Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {userOrders.profile.full_name || 'No name'}
                </h2>
                <p className="text-blue-100">{userOrders.profile.email}</p>
                <p className="text-sm text-blue-100 mt-1">
                  Balance: {userOrders.profile.virtual_currency} coins
                </p>
              </div>
            </div>
          </div>

          {/* Pending Orders */}
          {userOrders.orders.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-8 rounded-lg text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
              <p className="font-medium">No pending orders for this user</p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Pending Orders ({userOrders.orders.length})
              </h3>
              <div className="space-y-4">
                {userOrders.orders.map(order => (
                  <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        Order #{order.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="p-6">
                      {/* Order Items */}
                      <div className="space-y-3 mb-4">
                        {order.order_items.map(item => (
                          <div key={item.id} className="flex justify-between items-center border-b pb-2">
                            <div>
                              <p className="font-medium text-gray-900">{item.item_name}</p>
                              <p className="text-sm text-gray-500">
                                {item.quantity} × {item.price_at_purchase} coins
                              </p>
                            </div>
                            <p className="font-semibold text-gray-900">
                              {item.quantity * item.price_at_purchase} coins
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex justify-between items-center mb-4 pt-4 border-t">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {order.total_price} coins
                        </span>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <strong>Note:</strong> {order.notes}
                          </p>
                        </div>
                      )}

                      {/* Add Note Input */}
                      <div className="mb-4">
                        <input
                          type="text"
                          placeholder="Add a note (optional)..."
                          onBlur={(e) => {
                            if (e.target.value.trim()) {
                              handleAddNote(order.id, e.target.value.trim())
                            }
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Mark as Picked Up Button */}
                      <button
                        onClick={() => handleMarkAsPickedUp(order.id)}
                        disabled={processing === order.id}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {processing === order.id ? (
                          'Processing...'
                        ) : (
                          <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Mark as Picked Up
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clear Button */}
          <button
            onClick={() => {
              setUserOrders(null)
              setLastScannedId('')
              setSerialStatus('Ready - Waiting for NFC scan...')
            }}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Clear / Ready for Next Customer
          </button>
        </div>
        
      )}
      {!isSerialConnected && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="font-semibold mb-3">Manual Testing (No ESP32)</h3>
          <div className="flex space-x-2">
            <input
              type="text"
              value={manualNfcId}
              onChange={(e) => setManualNfcId(e.target.value)}
              placeholder="Enter NFC ID manually..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => {
                if (manualNfcId.trim()) {
                  handleNFCScan(manualNfcId.trim())
                }
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
            >
              Test Lookup
            </button>
          </div>
        </div>
      )}
      {/* Waiting State */}
      {!userOrders && isSerialConnected && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Scan className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Waiting for NFC Scan...
          </h3>
          <p className="text-gray-600">
            Ask the customer to tap their NFC sticker on the reader
          </p>
        </div>
      )}
    </div>
  )
}