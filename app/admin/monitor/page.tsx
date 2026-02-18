// app/admin/monitor/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignInMonitor() {
  const [signedInCount, setSignedInCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const checkSignIns = async () => {
      // This requires a custom function or table to track active sessions
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      
      setSignedInCount(count || 0)
    }

    checkSignIns()
    const interval = setInterval(checkSignIns, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center p-8">
      <h1 className="text-4xl font-bold mb-4">Active Sign-Ins</h1>
      <div className="text-6xl font-bold text-cyan-400">
        {signedInCount} / 85
      </div>
    </div>
  )
}