'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState('')
  const [userMsg, setUserMsg] = useState('')

  // Formulário de Criação de Usuários
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')

  useEffect(() => {
    async function checkAdmin() {
      // 1. Verifica Sessão
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/bi/login'
        return
      }

      // 2. Verifica Nível de Acesso no Profile
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

      setLoading(false)
    }

    checkAdmin()
  }, [])

  // Subir Planilha e Sobrescrever Banco
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatusMsg('Processando e categorizando registros...')

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data: any[] = XLSX.utils.sheet_to_json(ws)

        // Limpa a base atual
        await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // Mapeamento dinâmico do status
        const rows = data.map((item: any) => {
          const rawStatus = (
            item['Status'] || 
            item['status'] || 
            item['Situação'] || 
            item['Situacao'] || 
            item['Fase'] || 
            ''
          ).toString().trim().toLowerCase()

          let statusFinal = 'Aberto'

          if (
            rawStatus.includes('ganho') || 
            rawStatus.includes('ganha') || 
            rawStatus.includes('fechado') || 
            rawStatus.includes('vendido') || 
            rawStatus.includes('won')
          ) {
            statusFinal = 'Ganho'
          } else if (
            rawStatus.includes('perdido') || 
            rawStatus.includes('perdida') || 
            rawStatus.includes('cancelado') || 
            rawStatus.includes('lost') || 
            rawStatus.includes('perda')
          ) {
            statusFinal = 'Perdido'
          }

          return {
            cliente_razao_social: item['Razao Social'] || item['Razão Social'] || item['Cliente'] || item['Empresa'] || 'N/A',
            vendedor: item['Vendedor'] || item['Proprietário'] || item['Usuario'] || 'N/A',
            origem: item['Origem'] || item['Canal'] || item['Indicação'] || 'Outros',
            etapa: item['Etapa'] || item['Fase Atual'] || 'Inicial',
            status: statusFinal,
            motivo_perda: item['Motivo Perda'] || item['Motivo de Perda'] || item['Motivo'] || null,
            data_criacao: item['Data Criacao'] || item['Data de Criacao'] || item['Data Criação']
              ? new Date(item['Data Criacao'] || item['Data de Criacao'] || item['Data Criação']).toISOString() 
              : new Date().toISOString(),
            data_mudanca_etapa: item['Data Fechamento'] || item['Data Mudanca Etapa'] || item['Data Goal']
              ? new Date(item['Data Fechamento'] || item['Data Mudanca Etapa'] || item['Data Goal']).toISOString() 
              : null,
          }
        })

        // Salva na tabela deals
        const { error } = await supabase.from('deals').insert(rows)

        if (!error) {
          // Registra a data/hora do upload
          await supabase.from('sheet_logs').insert({
            file_name: file.name,
            total_records: rows.length,
            updated_by: 'Admin',
          })
          setStatusMsg(`Sucesso! ${rows.length} registros atualizados no banco de dados.`)
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

  // Apagar Planilha
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

  // Criar Usuário
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

      setUserMsg(`Usuário (${newEmail}) criado com sucesso como ${newRole.toUpperCase()}!`)
      setNewEmail('')
      setNewPassword('')
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-600">Verificando permissões de Administrador...</div>
  }

  return (
    <div className="p-8 bg-slate-100 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Painel Administrativo - Gestão RMR</h1>
        <a href="/bi/" className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-3 py-1.5 rounded-lg transition">
          Voltar ao Dashboard
        </a>
      </div>

      {/* Gestão de Dados */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Gestão da Base de Dados (Planilha)</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg cursor-pointer transition text-sm">
            Adicionar Planilha Nova (XLS, XLSX, CSV)
            <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFileUpload} className="hidden" disabled={loading} />
          </label>

          <button 
            onClick={handleClearDatabase}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-2.5 rounded-lg transition text-sm"
          >
            Apagar Planilha do Banco
          </button>
        </div>
        {statusMsg && <p className="mt-4 text-sm font-semibold text-slate-700">{statusMsg}</p>}
      </div>

      {/* Gestão de Usuários */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Criar e Controlar Usuários</h2>
        <p className="text-xs text-slate-500 mb-4">Defina se o novo acesso será um Usuário Comum ou Administrador.</p>
        
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              placeholder="email@empresa.com" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm" 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Senha</label>
            <input 
              type="password" 
              required
              placeholder="••••••••" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm" 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Perfil de Acesso</label>
            <select 
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            >
              <option value="user">Usuário (Apenas Visualização)</option>
              <option value="admin">Administrador (Acesso Total)</option>
            </select>
          </div>

          <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-medium p-2 rounded-lg text-sm transition">
            Cadastrar Usuário
          </button>
        </form>

        {userMsg && <p className="mt-4 text-sm font-semibold text-slate-700">{userMsg}</p>}
      </div>
    </div>
  )
}