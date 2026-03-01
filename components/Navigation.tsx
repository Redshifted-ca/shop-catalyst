'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { ShoppingCart, Package, Upload, Settings, LogOut, Coins, Sparkles } from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
  virtual_currency: number
  nfc_id: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export default function Navigation() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial user
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Auth error:', error)
          setLoading(false)
          return
        }

        setUser(user)

        if (user) {
          // Get profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (profileError) {
            console.error('Profile error:', profileError)
          } else {
            setProfile(profileData)
          }
        }
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          // Verify user after state change
          const { data: { user } } = await supabase.auth.getUser()
          setUser(user)
          
          if (user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()
            setProfile(profileData)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    window.location.href = '/' // Changed from router.push('/')
  }

  // Don't render anything while loading
  if (loading) {
    return null
  }

  // Don't render if no user
  if (!user) {
    return null
  }

  const navItems = [
    { href: '/shop', label: 'Shop', icon: Package },
    { href: '/cart', label: 'My Orders', icon: ShoppingCart },
    { href: '/submit', label: 'Submit', icon: Upload },
    { href: '/gallery', label: 'Gallery', icon: Sparkles },
  ]

  if (profile?.role === 'admin') {
    navItems.push({ href: '/admin', label: 'Admin', icon: Settings })
  }

  if (profile?.role === 'cashier' || profile?.role === 'admin') {
    navItems.push({ href: '/cashier', label: 'Cashier', icon: ShoppingCart })
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-green-50 px-3 py-1 rounded-full">
              <Coins className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm font-medium text-green-700">
                {profile?.virtual_currency || 0} coins
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}