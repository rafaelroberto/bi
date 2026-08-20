'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  'https://lqmuwffifroxlhqcogtt.supabase.co',
  'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Carrega credenciais salvas se existirem
  useEffect(() => {
    const savedEmail = localStorage.getItem('rmr_remember_email')
    const savedPassword = localStorage.getItem('rmr_remember_password')
    if (savedEmail && savedPassword) {
      setEmail(savedEmail)
      setPassword(savedPassword)
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    // Trata opção de lembrar e-mail/senha no cache local
    if (rememberMe) {
      localStorage.setItem('rmr_remember_email', email)
      localStorage.setItem('rmr_remember_password', password)
    } else {
      localStorage.removeItem('rmr_remember_email')
      localStorage.removeItem('rmr_remember_password')
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', data.user.id)
      .single()

    if (profile?.status === 'inativo') {
      setErrorMsg('Sua conta está inativa. Fale com o administrador.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md border border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1 text-center">B.I. RMR - Login</h1>
        <p className="text-xs text-slate-500 mb-6 text-center">Acesse com suas credenciais de usuário ou admin</p>

        {errorMsg && <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-bold mb-4 border border-rose-200">{errorMsg}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">E-mail</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm"
              placeholder="seuemail@empresa.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Senha</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input 
              type="checkbox" 
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="remember" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
              Lembrar meu e-mail e senha neste navegador
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl transition text-sm shadow-sm mt-2"
          >
            {loading ? 'Acessando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}