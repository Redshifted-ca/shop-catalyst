'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Scan, Package, CheckCircle, User, Clock, Usb, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'

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

interface SerialConnectionState {
  isConnected: boolean
  status: string
  lastScan: string
  stats: {
    totalScans: number
    successfulReads: number
    successfulWrites: number
    uptime: number
  }
}

export default function CashierPage() {
  const [userOrders, setUserOrders] = useState<UserOrders | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [serialState, setSerialState] = useState<SerialConnectionState>({
    isConnected: false,
    status: 'Disconnected',
    lastScan: '',
    stats: { totalScans: 0, successfulReads: 0, successfulWrites: 0, uptime: 0 }
  })
  
  const portRef = useRef<any | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Check if Web Serial API is supported
    if (!('serial' in navigator)) {
      setError('Web Serial API not supported. Please use Chrome, Edge, or Opera.')
    }

    return () => {
      disconnectSerial()
    }
  }, [])

  const connectSerial = async () => {
    try {
      setError('')
      setSerialState(prev => ({ ...prev, status: 'Requesting port...' }))

      // Request a port with filters for common ESP32 chips
      const port = await (navigator as any).serial.requestPort({
        filters: [
          { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // CP2102
          { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // CH340
          { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI
        ]
      })

      setSerialState(prev => ({ ...prev, status: 'Opening port...' }))
      
      await port.open({ 
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 255,
        flowControl: 'none'
      })

      portRef.current = port
      setSerialState(prev => ({ 
        ...prev, 
        isConnected: true,
        status: 'Connected - Initializing...' 
      }))
      setError('')

      // Give ESP32 time to reset after serial connection
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSerialState(prev => ({ ...prev, status: 'Ready - Waiting for NFC scan...' }))

      // Start reading
      readSerialData(port)
    } catch (err: any) {
      console.error('Serial connection error:', err)
      
      let errorMsg = 'Failed to connect to ESP32: '
      
      if (err.name === 'NotFoundError') {
        errorMsg += 'No port selected. Please select your ESP32 port and try again.'
      } else if (err.name === 'InvalidStateError') {
        errorMsg += 'Port is already open. Close Arduino Serial Monitor and try again.'
      } else if (err.message.includes('Failed to open')) {
        errorMsg += 'Port is in use. Close any program using the ESP32 (Arduino IDE, PlatformIO, etc.) and try again.'
      } else {
        errorMsg += err.message
      }
      
      setError(errorMsg)
      setSerialState(prev => ({ ...prev, status: 'Connection failed' }))
      
      // Clean up
      if (portRef.current) {
        try {
          await portRef.current.close()
        } catch {}
        portRef.current = null
      }
    }
  }

  const disconnectSerial = async () => {
    try {
      // First, close the port which will cause the reader to error out
      if (portRef.current) {
        try {
          await portRef.current.close()
        } catch (err) {
          console.error('Error closing port:', err)
        }
        portRef.current = null
      }

      // Then release and cancel the reader
      if (readerRef.current) {
        try {
          // Release the lock before cancelling
          readerRef.current.releaseLock()
        } catch (err) {
          // Already released, ignore
        }
        readerRef.current = null
      }

      setSerialState({
        isConnected: false,
        status: 'Disconnected',
        lastScan: '',
        stats: { totalScans: 0, successfulReads: 0, successfulWrites: 0, uptime: 0 }
      })
    } catch (err) {
      console.error('Error disconnecting:', err)
    }
  }

  const readSerialData = async (port: any) => {
    const textDecoder = new TextDecoderStream()
    const readableStreamClosed = port.readable!.pipeTo(textDecoder.writable)
    const reader = textDecoder.readable.getReader()
    readerRef.current = reader

    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += value

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          
          // Log all serial output for debugging
          if (trimmed) {
            console.log('ESP32:', trimmed)
          }

          // Parse different message types
          if (trimmed.startsWith('NFC_SCAN:')) {
            const nfcId = trimmed.replace('NFC_SCAN:', '')
            setSerialState(prev => ({ ...prev, lastScan: nfcId }))
            handleNFCScan(nfcId)
          } 
          else if (trimmed === 'NFC_READY') {
            setSerialState(prev => ({ ...prev, status: 'Ready - Waiting for NFC scan...' }))
          } 
          else if (trimmed.startsWith('NFC_ERROR:')) {
            setError(trimmed.replace('NFC_ERROR:', ''))
          }
          else if (trimmed.startsWith('⏱️  Uptime:')) {
            // Parse stats: "⏱️  Uptime: 15s | Scans: 3 | Reads: 3 | Writes: 0"
            const uptimeMatch = trimmed.match(/Uptime: (\d+)s/)
            const scansMatch = trimmed.match(/Scans: (\d+)/)
            const readsMatch = trimmed.match(/Reads: (\d+)/)
            const writesMatch = trimmed.match(/Writes: (\d+)/)
            
            if (uptimeMatch && scansMatch && readsMatch && writesMatch) {
              setSerialState(prev => ({
                ...prev,
                stats: {
                  uptime: parseInt(uptimeMatch[1]),
                  totalScans: parseInt(scansMatch[1]),
                  successfulReads: parseInt(readsMatch[1]),
                  successfulWrites: parseInt(writesMatch[1])
                }
              }))
            }
          }
          else if (trimmed.includes('✓ NFC TAG DETECTED')) {
            setSerialState(prev => ({ ...prev, status: 'Tag detected! Reading...' }))
          }
        }
      }
    } catch (err: any) {
      console.error('Serial read error:', err)
      if (err.message !== 'The port has been closed.') {
        setError('Serial communication error: ' + err.message)
        setSerialState(prev => ({ 
          ...prev, 
          isConnected: false,
          status: 'Disconnected' 
        }))
      }
    }
  }

  const handleNFCScan = async (nfcId: string) => {
    setSerialState(prev => ({ ...prev, status: `Looking up: ${nfcId}...` }))
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
        setSerialState(prev => ({ ...prev, status: 'Ready - Waiting for NFC scan...' }))
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
        setSerialState(prev => ({ ...prev, status: 'Ready - Waiting for NFC scan...' }))
        playWarningSound()
      } else {
        setSerialState(prev => ({ 
          ...prev, 
          status: `User found: ${profile.full_name || profile.email}` 
        }))
        playSuccessSound()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to lookup user')
      setSerialState(prev => ({ ...prev, status: 'Ready - Waiting for NFC scan...' }))
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

  const sendSerialCommand = async (command: string) => {
    if (!portRef.current || !portRef.current.writable) {
      setError('Serial port not connected')
      return
    }

    try {
      const writer = portRef.current.writable.getWriter()
      const encoder = new TextEncoder()
      await writer.write(encoder.encode(command + '\n'))
      writer.releaseLock()
    } catch (err: any) {
      setError('Failed to send command: ' + err.message)
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 text-transparent bg-clip-text mb-8">
          Cashier Station
        </h1>

        {/* Serial Connection Card */}
        <div className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Usb className={`w-6 h-6 ${serialState.isConnected ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />
              <div>
                <h2 className="text-lg font-semibold text-cyan-300">ESP32 NFC Reader</h2>
                <p className={`text-sm ${serialState.isConnected ? 'text-green-400' : 'text-gray-400'}`}>
                  {serialState.status}
                </p>
              </div>
            </div>
            
            {!serialState.isConnected ? (
              <button
                onClick={connectSerial}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center shadow-lg shadow-cyan-500/30"
              >
                <Usb className="w-4 h-4 mr-2" />
                Connect ESP32
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => sendSerialCommand('STATS')}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                  title="Get Stats"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={disconnectSerial}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Stats Display */}
          {serialState.isConnected && serialState.stats.uptime > 0 && (
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-cyan-500/20">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Uptime</p>
                <p className="text-cyan-300 font-bold">{serialState.stats.uptime}s</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Total Scans</p>
                <p className="text-cyan-300 font-bold">{serialState.stats.totalScans}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Reads</p>
                <p className="text-cyan-300 font-bold">{serialState.stats.successfulReads}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Writes</p>
                <p className="text-cyan-300 font-bold">{serialState.stats.successfulWrites}</p>
              </div>
            </div>
          )}

          {serialState.lastScan && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Last scanned NFC ID:</strong> <span className="font-mono">{serialState.lastScan}</span>
              </p>
            </div>
          )}

          {!serialState.isConnected && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-300">
                  <p className="font-medium mb-1">Setup Instructions:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Connect ESP32 to laptop via USB</li>
                    <li>Make sure NFC reader code is uploaded to ESP32</li>
                    <li>Close Arduino Serial Monitor if open</li>
                    <li>Click "Connect ESP32" button above</li>
                    <li>Select the correct serial port (COM3, /dev/ttyUSB0, etc.)</li>
                    <li>Wait for "Ready" status</li>
                    <li>Scan NFC stickers to lookup orders</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-900/50 backdrop-blur-sm border border-red-500/50 text-red-200 px-6 py-4 rounded-lg animate-shake">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-900/50 backdrop-blur-sm border border-green-500/50 text-green-200 px-6 py-4 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        {/* User Info & Orders */}
        {userOrders && (
          <div className="space-y-6">
            {/* User Profile Card */}
            <div className="bg-gradient-to-r from-cyan-600/80 to-blue-600/80 backdrop-blur-sm rounded-xl shadow-md p-6 text-white border border-cyan-400/30">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <User className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">
                    {userOrders.profile.full_name || 'No name'}
                  </h2>
                  <p className="text-cyan-100">{userOrders.profile.email}</p>
                  <p className="text-sm text-cyan-100 mt-1">
                    Balance: {userOrders.profile.virtual_currency} coins
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cyan-100">NFC ID</p>
                  <p className="text-lg font-mono font-bold">{serialState.lastScan}</p>
                </div>
              </div>
            </div>

            {/* Pending Orders */}
            {userOrders.orders.length === 0 ? (
              <div className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/30 text-yellow-200 px-6 py-8 rounded-xl text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
                <p className="font-medium">No pending orders for this user</p>
                <p className="text-sm text-yellow-300 mt-2">All orders have been picked up!</p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Pending Orders ({userOrders.orders.length})
                </h3>
                <div className="space-y-4">
                  {userOrders.orders.map(order => (
                    <div key={order.id} className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400/60 transition-all">
                      <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 px-6 py-3 border-b border-cyan-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">
                              {new Date(order.created_at).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            Order #{order.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      <div className="p-6">
                        {/* Order Items */}
                        <div className="space-y-3 mb-4">
                          {order.order_items.map(item => (
                            <div key={item.id} className="flex justify-between items-center py-2 border-b border-cyan-500/10">
                              <div>
                                <p className="font-medium text-cyan-200">{item.item_name}</p>
                                <p className="text-sm text-gray-400">
                                  {item.quantity} × {item.price_at_purchase} coins
                                </p>
                              </div>
                              <p className="font-semibold text-lg text-yellow-400">
                                {item.quantity * item.price_at_purchase}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center mb-4 pt-4 border-t border-cyan-500/30">
                          <span className="font-semibold text-lg text-cyan-300">Total</span>
                          <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-200 text-transparent bg-clip-text">
                            {order.total_price} coins
                          </span>
                        </div>

                        {/* Notes */}
                        {order.notes && (
                          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-sm text-blue-300">
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
                            className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                                     focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white
                                     placeholder-gray-500 transition-all"
                          />
                        </div>

                        {/* Mark as Picked Up Button */}
                        <button
                          onClick={() => handleMarkAsPickedUp(order.id)}
                          disabled={processing === order.id}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 
                                   disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
                                   text-white font-bold py-3 px-4 rounded-lg transition-all duration-200
                                   shadow-lg shadow-green-500/30 hover:shadow-green-500/50 flex items-center justify-center"
                        >
                          {processing === order.id ? (
                            <>
                              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5 mr-2" />
                              Mark as Picked Up
                            </>
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
                setSerialState(prev => ({ 
                  ...prev, 
                  lastScan: '',
                  status: 'Ready - Waiting for NFC scan...' 
                }))
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Clear / Ready for Next Customer
            </button>
          </div>
        )}

        {/* Waiting State */}
        {!userOrders && serialState.isConnected && (
          <div className="bg-gray-900/40 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-12 text-center">
            <Scan className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-semibold text-cyan-300 mb-2">
              Waiting for NFC Scan...
            </h3>
            <p className="text-gray-400">
              Ask the customer to tap their NFC sticker on the reader
            </p>
          </div>
        )}
      </div>
    </div>
  )
}