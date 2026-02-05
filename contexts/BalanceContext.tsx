'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BalanceContextType {
  balance: number
  setBalance: (balance: number) => void
  refreshBalance: () => Promise<void>
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined)

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(0)
  const supabase = createClient()

  const refreshBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('virtual_currency')
        .eq('id', user.id)
        .single()
      
      if (data) {
        setBalance(data.virtual_currency)
      }
    }
  }

  useEffect(() => {
    refreshBalance()
  }, [])

  return (
    <BalanceContext.Provider value={{ balance, setBalance, refreshBalance }}>
      {children}
    </BalanceContext.Provider>
  )
}

export function useBalance() {
  const context = useContext(BalanceContext)
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider')
  }
  return context
}
