'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Scan, Package, CheckCircle, User, Clock, Usb, AlertCircle, Sparkles, RefreshCw, Bug, Edit, BookOpen, Zap } from 'lucide-react'

// TypeScript types for Web Serial API
interface SerialPort {
  readable: ReadableStream | null
  writable: WritableStream | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

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

interface NFCData {
  hex: string
  ascii: string
  timestamp: Date
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
  
  const [debugMode, setDebugMode] = useState(true)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [nfcMode, setNfcMode] = useState<'scan' | 'read' | 'write'>('scan')
  const [writeData, setWriteData] = useState('')
  const [readData, setReadData] = useState<NFCData | null>(null)
  const [isWriting, setIsWriting] = useState(false)
  const [isReading, setIsReading] = useState(false)
  
  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const supabase = createClient()

  // Add debug log function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setDebugLog(prev => [...prev.slice(-20), logMessage])
  }

  useEffect(() => {
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
    addDebugLog('🔌 Connection attempt started')
    
    // Check if Web Serial API is available
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported. Use Chrome, Edge, or Opera.')
    }

    addDebugLog('✓ Web Serial API detected')

    // Check if port is already open
    if (portRef.current) {
      addDebugLog('⚠️  Port already exists, closing...')
      try {
        await portRef.current.close()
      } catch {}
      portRef.current = null
    }

    // Get available ports (if any are already authorized)
    const ports = await (navigator as any).serial.getPorts()
    addDebugLog(`📋 Found ${ports.length} previously authorized ports`)

    let port: SerialPort

    if (ports.length > 0) {
      // Use first available port
      addDebugLog('✓ Using previously authorized port')
      port = ports[0]
    } else {
      // Request new port
      addDebugLog('📋 Requesting new port...')
      setSerialState(prev => ({ ...prev, status: 'Select your ESP32 port...' }))
      
      port = await (navigator as any).serial.requestPort({
        filters: [
          { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // CP2102
          { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // CH340
          { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI
          { usbVendorId: 0x1a86, usbProductId: 0x55d4 }, // CH9102
        ]
      })
      addDebugLog('✓ Port selected by user')
    }

    // Get port info
    const portInfo = port.getInfo()
    addDebugLog(`📊 Port Info:`)
    addDebugLog(`   Vendor ID: 0x${portInfo.usbVendorId?.toString(16) || 'unknown'}`)
    addDebugLog(`   Product ID: 0x${portInfo.usbProductId?.toString(16) || 'unknown'}`)

    // Try to open port
    setSerialState(prev => ({ ...prev, status: 'Opening port...' }))
    addDebugLog('🔓 Opening port with 115200 baud...')

    try {
      await port.open({ 
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 255,
        flowControl: 'none'
      })
    } catch (openErr: any) {
      if (openErr.name === 'InvalidStateError') {
        addDebugLog('❌ Port already open in another program!')
        throw new Error('Port is in use. Close Arduino IDE, Serial Monitor, or any other program using this port, then try again.')
      }
      throw openErr
    }

    addDebugLog('✅ Port opened successfully')
    portRef.current = port

    setSerialState(prev => ({ 
      ...prev, 
      isConnected: true,
      status: 'Connected - Waiting for ESP32 boot...' 
    }))
    setError('')

    // Give ESP32 time to reset after connection
    addDebugLog('⏳ Waiting 2 seconds for ESP32 to initialize...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    addDebugLog('✓ Starting data reader...')
    setSerialState(prev => ({ ...prev, status: 'Ready - Waiting for NFC scan' }))

    // Start reading
    readSerialData(port)
    
  } catch (err: any) {
    console.error('Connection error:', err)
    addDebugLog(`❌ FATAL: ${err.message}`)
    
    let errorMsg = 'Connection failed: '
    
    if (err.name === 'NotFoundError') {
      errorMsg = 'No port selected. Click "Connect ESP32" and choose your COM port.'
    } else if (err.name === 'InvalidStateError' || err.message.includes('already open')) {
      errorMsg = '⚠️ Port is BUSY. Close these programs and try again:\n• Arduino IDE\n• Arduino Serial Monitor\n• PlatformIO\n• Any terminal (screen/minicom)\n\nThen unplug and replug ESP32.'
    } else if (err.name === 'NetworkError') {
      errorMsg = 'Device not responding. Check:\n• ESP32 is plugged in via USB\n• Correct port selected\n• ESP32 has power (LED should be on)'
    } else {
      errorMsg = err.message
    }
    
    setError(errorMsg)
    setSerialState(prev => ({ ...prev, status: 'Connection failed', isConnected: false }))
    
    // Cleanup
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
      if (readerRef.current) {
        await readerRef.current.cancel()
        readerRef.current = null
      }
      if (portRef.current) {
        await portRef.current.close()
        portRef.current = null
      }
      setSerialState({
        isConnected: false,
        status: 'Disconnected',
        lastScan: '',
        stats: { totalScans: 0, successfulReads: 0, successfulWrites: 0, uptime: 0 }
      })
      addDebugLog('📴 Disconnected')
    } catch (err) {
      console.error('Error disconnecting:', err)
    }
  }

  const readSerialData = async (port: SerialPort) => {
    addDebugLog('📖 Serial reader started')
    
    const textDecoder = new TextDecoderStream()
    const readableStreamClosed = port.readable!.pipeTo(textDecoder.writable)
    const reader = textDecoder.readable.getReader()
    readerRef.current = reader

    let buffer = ''
    let lineCount = 0

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          addDebugLog('📪 Stream closed')
          break
        }

        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          lineCount++
          
          if (trimmed && debugMode) {
            addDebugLog(`RX: ${trimmed}`)
          }

          if (trimmed.startsWith('NFC_SCAN:')) {
            const nfcId = trimmed.replace('NFC_SCAN:', '').trim()
            addDebugLog(`🎯 NFC: ${nfcId}`)
            setSerialState(prev => ({ ...prev, lastScan: nfcId }))
            
            if (nfcMode === 'scan') {
              handleNFCScan(nfcId)
            }
          }
          else if (trimmed === 'NFC_READY') {
            addDebugLog('✅ ESP32 READY')
            setSerialState(prev => ({ ...prev, status: 'Ready' }))
          }
          else if (trimmed === 'WRITE_MODE_ACTIVE') {
            addDebugLog('✍️  Write mode')
            setSerialState(prev => ({ ...prev, status: 'Write mode - Tap tag' }))
          }
          else if (trimmed === 'READ_MODE_ACTIVE') {
            addDebugLog('📖 Read mode')
            setSerialState(prev => ({ ...prev, status: 'Read mode - Tap tag' }))
          }
          else if (trimmed === 'NORMAL_MODE_ACTIVE') {
            addDebugLog('🔄 Normal mode')
            setSerialState(prev => ({ ...prev, status: 'Ready' }))
            setIsWriting(false)
            setIsReading(false)
          }
          else if (trimmed.startsWith('WRITE_SUCCESS:')) {
            const type = trimmed.replace('WRITE_SUCCESS:', '')
            addDebugLog(`✅ Write OK (${type})`)
            setSuccess(`Written to NFC tag! (${type})`)
            setIsWriting(false)
            setTimeout(() => setSuccess(''), 3000)
            playSuccessSound()
          }
          else if (trimmed === 'WRITE_FAILED') {
            addDebugLog('❌ Write failed')
            setError('Write failed. Try again.')
            setIsWriting(false)
            playErrorSound()
          }
          else if (trimmed.startsWith('READ_SUCCESS:')) {
            const type = trimmed.replace('READ_SUCCESS:', '')
            addDebugLog(`✅ Read OK (${type})`)
          }
          else if (trimmed.startsWith('DATA_HEX:')) {
            const hex = trimmed.replace('DATA_HEX:', '')
            setReadData(prev => ({ ...prev, hex, timestamp: new Date() } as NFCData))
            addDebugLog(`📊 Hex: ${hex}`)
          }
          else if (trimmed.startsWith('DATA_ASCII:')) {
            const ascii = trimmed.replace('DATA_ASCII:', '')
            setReadData(prev => ({ ...prev, ascii } as NFCData))
            addDebugLog(`📝 ASCII: ${ascii}`)
            setSuccess('Data read successfully!')
            setIsReading(false)
            playSuccessSound()
          }
          else if (trimmed === 'READ_FAILED') {
            addDebugLog('❌ Read failed')
            setError('Read failed. Tag might be empty.')
            setIsReading(false)
            playErrorSound()
          }
          else if (trimmed.startsWith('⏱️  Uptime:')) {
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
        }
      }
    } catch (err: any) {
      addDebugLog(`❌ Read error: ${err.message}`)
      console.error('Serial read error:', err)
      
      if (err.message !== 'The port has been closed.') {
        setError('Serial error: ' + err.message)
        setSerialState(prev => ({ 
          ...prev, 
          isConnected: false,
          status: 'Disconnected' 
        }))
      }
    }
  }

  const handleNFCScan = async (nfcId: string) => {
    addDebugLog(`🔍 Looking up: ${nfcId}`)
    setSerialState(prev => ({ ...prev, status: `Looking up: ${nfcId}...` }))
    setError('')
    setSuccess('')
    setUserOrders(null)

    try {
      addDebugLog('📡 Querying database...')
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('nfc_id', nfcId)
        .single()

      if (profileError) {
        addDebugLog(`❌ DB error: ${profileError.message}`)
        throw profileError
      }

      if (!profile) {
        addDebugLog(`❌ No user with NFC: ${nfcId}`)
        setError(`NFC ID "${nfcId}" not found in database`)
        setSerialState(prev => ({ ...prev, status: 'Ready' }))
        playErrorSound()
        return
      }

      addDebugLog(`✓ User: ${profile.email}`)
      addDebugLog(`📦 Fetching orders...`)

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

      if (ordersError) {
        addDebugLog(`❌ Orders error: ${ordersError.message}`)
        throw ordersError
      }

      addDebugLog(`✓ Found ${orders?.length || 0} orders`)

      setUserOrders({
        profile: profile as UserProfile,
        orders: (orders || []) as Order[]
      })

      if (!orders || orders.length === 0) {
        addDebugLog('⚠️  No pending orders')
        setError('No pending orders')
        setSerialState(prev => ({ ...prev, status: 'Ready' }))
        playWarningSound()
      } else {
        addDebugLog(`✓ SUCCESS!`)
        setSerialState(prev => ({ 
          ...prev, 
          status: `Found: ${profile.full_name || profile.email}` 
        }))
        playSuccessSound()
      }
    } catch (err: any) {
      addDebugLog(`❌ Error: ${err.message}`)
      setError(err.message || 'Lookup failed')
      setSerialState(prev => ({ ...prev, status: 'Ready' }))
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
      addDebugLog(`📤 Sent: ${command}`)
    } catch (err: any) {
      setError('Failed to send command: ' + err.message)
      addDebugLog(`❌ Send failed: ${err.message}`)
    }
  }

const handleWriteToTag = async () => {
  if (!writeData.trim()) {
    setError('Please enter data to write')
    return
  }

  if (writeData.length > 16) {
    setError('Data too long! Maximum 16 characters.')
    return
  }

  setIsWriting(true)
  setError('')
  setSuccess('')
  addDebugLog(`📤 Sending write command: ${writeData}`)

  try {
    await sendSerialCommand(`WRITE:${writeData}`)
    addDebugLog('✓ Write command sent, waiting for tag...')
  } catch (err: any) {
    setError('Failed to send write command: ' + err.message)
    setIsWriting(false)
  }
}

const handleReadFromTag = async () => {
  setIsReading(true)
  setError('')
  setSuccess('')
  setReadData(null)
  addDebugLog('📤 Sending read command')

  try {
    await sendSerialCommand('READ')
    addDebugLog('✓ Read command sent, waiting for tag...')
  } catch (err: any) {
    setError('Failed to send read command: ' + err.message)
    setIsReading(false)
  }
}

const handleNormalMode = async () => {
  try {
    await sendSerialCommand('NORMAL')
    setNfcMode('scan')
    setIsWriting(false)
    setIsReading(false)
    setReadData(null)
    setSerialState(prev => ({ ...prev, status: 'Ready - Scan mode' }))
    addDebugLog('🔄 Switched to normal scan mode')
  } catch (err: any) {
    setError('Mode switch failed: ' + err.message)
  }
}

  // Audio feedback
  const playSuccessSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==')
    audio.play().catch(() => {})
  }

  const playErrorSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgP8A//8AAACA/wD/gIAA/4CA==')
    audio.play().catch(() => {})
  }

  const playWarningSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICA/4CAgP8AgID/gICA==')
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

      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-1/3 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 text-transparent bg-clip-text">
            Cashier Station
          </h1>
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              debugMode 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <Bug className="w-4 h-4" />
            <span>{debugMode ? 'Debug ON' : 'Debug OFF'}</span>
          </button>
        </div>

        {/* Debug Console */}
        {debugMode && (
          <div className="bg-black/80 backdrop-blur-sm border border-green-500/30 rounded-xl p-4 mb-8 font-mono text-xs">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-green-400 font-bold">DEBUG CONSOLE</h3>
              <button
                onClick={() => setDebugLog([])}
                className="text-gray-400 hover:text-white text-xs"
              >
                Clear
              </button>
            </div>
            <div className="h-48 overflow-y-auto space-y-1 text-green-300">
              {debugLog.length === 0 ? (
                <p className="text-gray-500">Waiting for events...</p>
              ) : (
                debugLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))
              )}
              {/* Mode Selection & Read/Write Interface */}
{serialState.isConnected && (
  <div className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 mb-8">
    <h3 className="text-lg font-semibold text-cyan-300 mb-4">NFC Operations</h3>
    
    {/* Mode Tabs */}
    <div className="flex space-x-2 mb-6">
      <button
        onClick={handleNormalMode}
        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
          nfcMode === 'scan'
            ? 'bg-cyan-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        <Scan className="w-4 h-4 inline mr-2" />
        Scan (Lookup)
      </button>
      <button
        onClick={handleReadFromTag}
        disabled={isReading}
        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
          nfcMode === 'read'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <BookOpen className="w-4 h-4 inline mr-2" />
        {isReading ? 'Waiting...' : 'Read'}
      </button>
      <button
        onClick={() => {
          setNfcMode('write')
          setIsWriting(false)
        }}
        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
          nfcMode === 'write'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        <Edit className="w-4 h-4 inline mr-2" />
        Write
      </button>
    </div>

    {/* Write Interface */}
    {nfcMode === 'write' && (
      <div className="space-y-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div>
          <label className="block text-purple-300 text-sm font-medium mb-2">
            Data to Write (Max 16 characters)
          </label>
          <input
            type="text"
            value={writeData}
            onChange={(e) => setWriteData(e.target.value.slice(0, 16))}
            placeholder="Enter text..."
            maxLength={16}
            disabled={isWriting}
            className="w-full px-4 py-2 bg-gray-800 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-400 mt-1">
            {writeData.length}/16 characters
          </p>
        </div>
        
        {isWriting && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-300 text-sm flex items-center">
              <Zap className="w-4 h-4 mr-2 animate-pulse" />
              Waiting for NFC tag... Tap now!
            </p>
          </div>
        )}
        
        <button
          onClick={handleWriteToTag}
          disabled={isWriting || !writeData.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
        >
          {isWriting ? (
            <>
              <Zap className="w-5 h-5 mr-2 animate-pulse" />
              Tap NFC Tag Now...
            </>
          ) : (
            <>
              <Edit className="w-5 h-5 mr-2" />
              Write to NFC Tag
            </>
          )}
        </button>
        
        <div className="text-xs text-gray-400 space-y-1">
          <p>💡 Examples:</p>
          <p>• participant1@example.com</p>
          <p>• USER001</p>
          <p>• ADMIN</p>
        </div>
      </div>
    )}

    {/* Read Interface */}
    {nfcMode === 'read' && (
      <div className="space-y-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        {isReading ? (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-300 text-sm flex items-center">
              <BookOpen className="w-4 h-4 mr-2 animate-pulse" />
              Waiting for NFC tag... Tap now!
            </p>
          </div>
        ) : (
          <p className="text-blue-300 text-sm">
            Click the "Read" button above and tap an NFC tag to read its data.
          </p>
        )}
      </div>
    )}

        {/* Read Data Display */}
        {readData && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3">
            <h4 className="text-blue-300 font-semibold flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Data Read from Tag
            </h4>
            <div>
              <p className="text-xs text-gray-400">ASCII:</p>
              <p className="font-mono text-blue-200 text-lg">{readData.ascii}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Hex:</p>
              <p className="font-mono text-xs text-blue-200 break-all">{readData.hex}</p>
            </div>
            <p className="text-xs text-gray-500">
              Read at: {readData.timestamp.toLocaleTimeString()}
            </p>
            <button
              onClick={() => setReadData(null)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    )}
            </div>
          </div>
        )}

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
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
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

          {serialState.isConnected && serialState.stats.uptime > 0 && (
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-cyan-500/20">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Uptime</p>
                <p className="text-cyan-300 font-bold">{serialState.stats.uptime}s</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Scans</p>
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
          {serialState.isConnected && (
            <div className="mt-4 flex space-x-2">
              <button
                onClick={async () => {
                  addDebugLog('🧪 Sending test command: STATS')
                  await sendSerialCommand('STATS')
                }}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Send Test Command
              </button>
              <button
                onClick={async () => {
                  addDebugLog('🧪 Requesting heartbeat...')
                  // ESP32 should respond with uptime stats within 5 seconds
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Check Heartbeat
              </button>
            </div>
          )}
          {serialState.lastScan && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Last NFC:</strong> <span className="font-mono">{serialState.lastScan}</span>
              </p>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-900/50 backdrop-blur-sm border border-red-500/50 text-red-200 px-6 py-4 rounded-lg">
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