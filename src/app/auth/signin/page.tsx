'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export default function SignInPage() {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    try {
      await signIn('azure-ad', {
        callbackUrl: '/',
      })
    } catch (error) {
      console.error('Sign in error:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#FFCB05] mb-4">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-gray-900" fill="currentColor">
              <path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">HERTZ MALTA</h1>
          <p className="text-sm text-gray-400 mt-1">Vehicle Photo Check-in — Admin</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Sign in to your account</h2>
          <p className="text-sm text-gray-500 mb-6">
            Use your Hertz Malta Microsoft 365 credentials to access the admin dashboard.
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#00a4ef] hover:bg-[#0078d4] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 21 21" className="w-5 h-5" fill="currentColor">
              <path d="M1 1h9v9H1V1zm10 0h9v9h-9V1zM1 11h9v9H1v-9zm10 0h9v9h-9v-9z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Microsoft'}
          </button>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Only Hertz Malta / United Garage accounts are allowed.
              Single-tenant authentication via Microsoft Entra ID.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Hertz Malta Check-in Portal &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
