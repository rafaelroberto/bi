'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  'https://lqmuwffifroxlhqcogtt.supabase.co',
  'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    // Autentica no Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    // Busca o perfil do usuário para verificar a role (admin ou user)
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

    // Redireciona de acordo com a permissão
    if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">B.I. RMR - Login</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">Acesse com suas credenciais</p>

        {errorMsg && <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm mb-4">{errorMsg}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm"
              placeholder="seuemail@empresa.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Senha</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium p-2.5 rounded-lg transition text-sm"
          >
            {loading ? 'Acessando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}