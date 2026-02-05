'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Countdown to hackathon end - CHANGE THIS DATE/TIME
  const targetDate = new Date('2026-03-07T08:00:00').getTime()

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/shop')
      }
    }
    checkUser()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate - now

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        })
        if (error) throw error
        router.push('/shop')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/shop')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-black via-blue-950 to-cyan-950">
      {/* Animated stars background */}
      <div className="absolute inset-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Nebula effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Countdown Timer */}
        <div className="mb-8 text-center">
          <h2 className="text-cyan-400 text-sm font-semibold mb-4 tracking-widest uppercase">
            Catalyst begins in...
          </h2>
          <div className="flex space-x-4">
            <TimeUnit value={timeLeft.days} label="Days" />
            <TimeUnit value={timeLeft.hours} label="Hours" />
            <TimeUnit value={timeLeft.minutes} label="Minutes" />
            <TimeUnit value={timeLeft.seconds} label="Seconds" />
          </div>
        </div>

        {/* --- GARGANTUA BLACK HOLE (Center Right) --- */}
      <div className="absolute top-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] md:w-[1000px] lg:w-[1200px] h-[600px] sm:h-[800px] md:h-[1000px] lg:h-[1200px] flex items-center justify-center z-0 pointer-events-none scale-50 sm:scale-75 md:scale-100 lg:scale-110">
        
        {/* TILT CONTAINER: Rotate -25deg to match the movie poster angle */}
        <div className="relative w-full h-full rotate-[-25deg]">

        {/* 1. GRAVITATIONAL LENSING (TOP ARCH) 
           The light bending over the top of the hole 
        */}
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[280px] sm:w-[380px] md:w-[550px] h-[200px] sm:h-[280px] md:h-[400px] bg-orange-600/20 rounded-t-full blur-[30px] sm:blur-[40px] md:blur-[60px]"></div>
        <div className="absolute top-[24%] left-1/2 -translate-x-1/2 w-[240px] sm:w-[320px] md:w-[460px] h-[150px] sm:h-[210px] md:h-[300px] rounded-t-full border-t-[25px] sm:border-t-[35px] md:border-t-[50px] border-orange-200/50 blur-xl mix-blend-screen opacity-90"></div>
        
        {/* 2. ACCRETION DISK (BACK) 
           The ring passing *behind* the sphere
        */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[630px] md:w-[900px] h-[450px] sm:h-[630px] md:h-[900px]">
             <div className="w-full h-full rounded-full transform scale-y-[0.14] scale-x-100 relative">
            <div className="absolute inset-0 rounded-full disk-gradient blur-[2px] sm:blur-[3px] md:blur-[4px] opacity-90"></div>
            <div className="absolute inset-0 rounded-full disk-texture opacity-70 animate-[texture-spin_30s_linear_infinite]"></div>
             </div>
        </div>

        {/* 3. THE EVENT HORIZON (Black Sphere) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] sm:w-[196px] md:w-[280px] h-[140px] sm:h-[196px] md:h-[280px] bg-black rounded-full z-20 animate-[horizon-pulse_4s_ease-in-out_infinite]">
            {/* Note: The 'glow' is handled by the box-shadow keyframes above for maximum thickness */}
            {/* Inner Void */}
            <div className="absolute inset-0 rounded-full bg-black"></div>
        </div>

        {/* 4. ACCRETION DISK (FRONT) 
           The ring passing *in front* of the sphere. 
           We mask the top half so it looks like it crosses over.
        */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[630px] md:w-[900px] h-[450px] sm:h-[630px] md:h-[900px] z-30">
             <div className="w-full h-full rounded-full transform scale-y-[0.14] scale-x-100 relative">
             {/* GLOWING CORE */}
             <div className="absolute inset-0 rounded-full disk-gradient mix-blend-screen blur-[2px] [mask-image:linear-gradient(to_bottom,transparent_48%,black_52%)]"></div>
             {/* TEXTURE */}
             <div className="absolute inset-0 rounded-full disk-texture opacity-90 animate-[texture-spin_30s_linear_infinite] [mask-image:linear-gradient(to_bottom,transparent_48%,black_52%)]"></div>
             </div>
        </div>

        {/* 5. GRAVITATIONAL LENSING (BOTTOM ARCH) 
           Light bending under the hole
        */}
        <div className="absolute bottom-[24%] left-1/2 -translate-x-1/2 w-[240px] sm:w-[336px] md:w-[480px] h-[110px] sm:h-[154px] md:h-[220px] border-b-[20px] sm:border-b-[28px] md:border-b-[40px] border-orange-600/50 rounded-b-full blur-xl opacity-80"></div>
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[290px] sm:w-[406px] md:w-[580px] h-[140px] sm:h-[196px] md:h-[280px] bg-red-900/30 rounded-b-full blur-[30px] sm:blur-[40px] md:blur-[60px]"></div>

        </div>
      </div>


        {/* Login Box */}
        <div className="w-full max-w-md">
          <div className="bg-gray-900/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 text-transparent bg-clip-text">
                  Hardware Shop
                </span>
              </h1>
              <p className="text-gray-400 text-sm">
                Get the parts you need for your project
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              {isSignUp && (
                <div>
                  <label className="block text-cyan-300 text-sm font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                             focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                             text-white placeholder-gray-500 transition-all"
                    placeholder="Enter your name"
                    required={isSignUp}
                  />
                </div>
              )}

              <div>
                <label className="block text-cyan-300 text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                           focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                           text-white placeholder-gray-500 transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-cyan-300 text-sm font-medium mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                           focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                           text-white placeholder-gray-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 
                         disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
                         text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200
                         shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-gray-500 text-sm">
          Powered by innovation and caffeine ☕
        </p>
      </div>
    </div>
  )
}

// Time unit component for countdown
function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-gray-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-4 py-3 min-w-[70px]">
        <span className="text-3xl font-bold bg-gradient-to-b from-cyan-300 to-blue-400 text-transparent bg-clip-text">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="text-gray-400 text-xs mt-2 uppercase tracking-wider">{label}</span>
    </div>
  )
}