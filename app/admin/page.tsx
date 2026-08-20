'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function parseBRDate(dateStr: any) {
  if (!dateStr) return null
  const s = dateStr.toString().trim()
  const parts = s.split(' ')
  if (parts[0]) {
    const dateParts = parts[0].split('/')
    if (dateParts.length === 3) {
      const day = dateParts[0].padStart(2, '0')
      const month = dateParts[1].padStart(2, '0')
      const year = dateParts[2]
      const time = parts[1] || '00:00:00'
      return new Date(`${year}-${month}-${day}T${time}`).toISOString()
    }
  }
  return null
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState('')
  const [userMsg, setUserMsg] = useState('')

  const [profiles, setProfiles] = useState<any[]>([])
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('user')

  const [changePasswordUserId, setChangePasswordUserId] = useState<string | null>(null)
  const [newPasswordAdmin, setNewPasswordAdmin] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')

  useEffect(() => {
    async function initAdmin() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/bi/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        alert('Acesso restrito para Administradores.')
        window.location.href = '/bi/'
        return
      }

      await fetchProfiles()
      setLoading(false)
    }

    initAdmin()
  }, [])

  async function fetchProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      setProfiles(data)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatusMsg('Importando planilha...')

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data: any[] = XLSX.utils.sheet_to_json(ws)

        await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        const rows = data.map((item: any) => {
          const rawEtapaOuStatus = (item['Nome'] || '').toString().trim()
          
          let statusFinal = 'Aberto'
          if (rawEtapaOuStatus.toLowerCase() === 'ganho') {
            statusFinal = 'Ganho'
          } else if (rawEtapaOuStatus.toLowerCase() === 'perdido') {
            statusFinal = 'Perdido'
          }

          const dataCriacaoIso = parseBRDate(item['Data de criação do registro']) || new Date().toISOString()
          const dataMudancaIso = parseBRDate(item['Data de entrada na etapa'])

          return {
            cliente_razao_social: item['Razão Social'] || item['Título'] || 'N/A',
            vendedor: item['Nome de Usuário'] || 'Não Definido',
            origem: item['Indicação'] || 'Outros',
            etapa: rawEtapaOuStatus || 'Inicial',
            status: statusFinal,
            motivo_perda: item['Nome.1'] || null,
            data_criacao: dataCriacaoIso,
            data_mudanca_etapa: dataMudancaIso,
          }
        })

        const { error } = await supabase.from('deals').insert(rows)

        if (!error) {
          await supabase.from('sheet_logs').insert({
            file_name: file.name,
            total_records: rows.length,
            updated_by: 'Admin',
          })
          setStatusMsg(`Sucesso! ${rows.length} registros importados com sucesso.`)
        } else {
          setStatusMsg('Erro ao salvar no banco: ' + error.message)
        }
      } catch (err: any) {
        setStatusMsg('Erro ao ler arquivo: ' + err.message)
      }
      setLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  async function handleClearDatabase() {
    if (!confirm('Deseja realmente apagar todos os dados da planilha no banco?')) return
    setLoading(true)
    const { error } = await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (!error) {
      setStatusMsg('Base de dados limpa com sucesso.')
    } else {
      setStatusMsg('Erro ao limpar banco: ' + error.message)
    }
    setLoading(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setUserMsg('Criando usuário...')

    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
    })

    if (error) {
      setUserMsg('Erro ao criar usuário: ' + error.message)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: newEmail,
        role: newRole,
        status: 'ativo'
      })

      setUserMsg(`Usuário (${newEmail}) cadastrado com sucesso!`)
      setNewEmail('')
      setNewPassword('')
      await fetchProfiles()
    }
  }

  // Redefinição de Senha do Usuário
  async function handleUpdatePassword(userEmail: string) {
    if (!newPasswordAdmin || newPasswordAdmin.length < 6) {
      alert('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }

    // Envia link de redefinição/atualização de senha direto para o e-mail do usuário
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: 'https://rafaelroberto.github.io/bi/login',
    })

    if (!error) {
      alert(`Instrução para redefinir senha enviada para ${userEmail}.`)
      setChangePasswordUserId(null)
      setNewPasswordAdmin('')
    } else {
      alert('Erro ao solicitar troca de senha: ' + error.message)
    }
  }

  async function handleToggleStatus(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo'
    const { error } = await supabase.from('profiles').update({ status: nextStatus }).eq('id', userId)
    if (!error) {
      await fetchProfiles()
    } else {
      alert('Erro ao alterar status: ' + error.message)
    }
  }

  async function handleSaveRole(userId: string) {
    const { error } = await supabase.from('profiles').update({ role: editRole }).eq('id', userId)
    if (!error) {
      setEditingUserId(null)
      await fetchProfiles()
    } else {
      alert('Erro ao atualizar permissão: ' + error.message)
    }
  }

  async function handleDeleteUser(userId: string, email: string) {
    if (!confirm(`Tem certeza de que deseja remover o usuário ${email}?`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (!error) {
      await fetchProfiles()
    } else {
      alert('Erro ao excluir usuário: ' + error.message)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-600 font-sans">Carregando Painel Administrativo...</div>
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Painel Administrativo - B.I. RMR</h1>
          <p className="text-xs text-slate-500 font-medium">Gestão de Base de Dados e Controle de Usuários</p>
        </div>
        
        <a href="/bi/" className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl transition shadow-sm">
          ← Voltar ao Dashboard
        </a>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-1">Gestão da Base de Dados (Planilha)</h2>
        <p className="text-xs text-slate-500 mb-4">Reenvie o arquivo para popular os indicadores com a estrutura correta.</p>
        
        <div className="flex flex-wrap items-center gap-4">
          <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl cursor-pointer transition text-sm shadow-sm">
            Adicionar Planilha Nova (XLS, XLSX, CSV)
            <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFileUpload} className="hidden" disabled={loading} />
          </label>

          <button 
            onClick={handleClearDatabase}
            disabled={loading}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-5 py-2.5 rounded-xl transition text-sm border border-rose-200"
          >
            Apagar Planilha do Banco
          </button>
        </div>
        {statusMsg && <p className="mt-4 text-xs font-bold text-slate-700 bg-slate-100 p-3 rounded-lg">{statusMsg}</p>}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-1">Cadastrar Novo Usuário</h2>
        <p className="text-xs text-slate-500 mb-4">Crie novos acessos para a equipe e defina suas permissões.</p>

        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              placeholder="usuario@empresa.com" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Senha</label>
            <input 
              type="password" 
              required
              placeholder="••••••••" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Perfil de Acesso</label>
            <select 
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white font-medium text-slate-700"
            >
              <option value="user">Usuário (Visualização)</option>
              <option value="admin">Administrador (Acesso Total)</option>
            </select>
          </div>

          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-xl text-sm transition shadow-sm">
            Cadastrar Usuário
          </button>
        </form>

        {userMsg && <p className="mt-4 text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">{userMsg}</p>}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <h2 className="text-base font-bold text-slate-800 mb-4">Usuários Cadastrados ({profiles.length})</h2>

        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
              <th className="p-3">E-mail</th>
              <th className="p-3">Perfil</th>
              <th className="p-3">Status</th>
              <th className="p-3">Data de Cadastro</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition">
                <td className="p-3 font-semibold text-slate-800">{p.email}</td>
                <td className="p-3">
                  {editingUserId === p.id ? (
                    <div className="flex items-center gap-2">
                      <select 
                        value={editRole} 
                        onChange={(e) => setEditRole(e.target.value)}
                        className="p-1 border rounded text-xs bg-white font-medium"
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <button onClick={() => handleSaveRole(p.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold">Salvar</button>
                      <button onClick={() => setEditingUserId(null)} className="text-xs text-slate-500 underline">Cancelar</button>
                    </div>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>
                      {p.role === 'admin' ? 'Administrador' : 'Usuário'}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3 text-slate-500 text-xs">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2 items-center">
                    <button 
                      onClick={() => handleUpdatePassword(p.email)}
                      className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-lg transition border border-amber-200"
                    >
                      Resetar Senha
                    </button>

                    <button 
                      onClick={() => { setEditingUserId(p.id); setEditRole(p.role) }}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition"
                    >
                      Permissão
                    </button>

                    <button 
                      onClick={() => handleToggleStatus(p.id, p.status)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
                        p.status === 'ativo' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {p.status === 'ativo' ? 'Inativar' : 'Ativar'}
                    </button>

                    <button 
                      onClick={() => handleDeleteUser(p.id, p.email)}
                      className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1 rounded-lg transition border border-rose-200"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}