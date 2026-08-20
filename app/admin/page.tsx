'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Conexão com o seu banco do Supabase
const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AdminDashboard() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // 1. Função para carregar planilha, sobrescrever o banco e registrar log
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setMsg('Processando a planilha e atualizando o banco de dados...')

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data: any[] = XLSX.utils.sheet_to_json(ws)

        // Limpa a tabela atual para sobrescrever
        await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // Normalização flexível dos campos de status e dados
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

          if (['ganho', 'ganha', 'fechado', 'vendido', 'won'].includes(rawStatus)) {
            statusFinal = 'Ganho'
          } else if (['perdido', 'perdida', 'cancelado', 'lost', 'perda'].includes(rawStatus)) {
            statusFinal = 'Perdido'
          }

          return {
            cliente_razao_social: item['Razao Social'] || item['Cliente'] || item['Empresa'] || 'N/A',
            vendedor: item['Vendedor'] || item['Proprietário'] || 'N/A',
            origem: item['Origem'] || item['Canal'] || 'Outros',
            etapa: item['Etapa'] || item['Fase Atual'] || 'Inicial',
            status: statusFinal,
            motivo_perda: item['Motivo Perda'] || item['Motivo de Perda'] || null,
            data_criacao: item['Data Criacao'] || item['Data de Criacao'] 
              ? new Date(item['Data Criacao'] || item['Data de Criacao']).toISOString() 
              : new Date().toISOString(),
            data_mudanca_etapa: item['Data Fechamento'] || item['Data Mudanca Etapa'] 
              ? new Date(item['Data Fechamento'] || item['Data Mudanca Etapa']).toISOString() 
              : null,
          }
        })

        // Inserção no Supabase
        const { error } = await supabase.from('deals').insert(rows)

        if (!error) {
          // Registra data e hora da atualização para que Admin e Usuário vejam
          await supabase.from('sheet_logs').insert({
            file_name: file.name,
            total_records: rows.length,
            updated_by: 'admin@rmr.com',
          })
          setMsg(`Sucesso! ${rows.length} registros atualizados no banco.`)
        } else {
          setMsg('Erro ao salvar no banco: ' + error.message)
        }
      } catch (err: any) {
        setMsg('Erro ao ler arquivo: ' + err.message)
      }
      setLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  // 2. Função para apagar a planilha do banco
  async function handleClearDatabase() {
    if (!confirm('Tem certeza de que deseja apagar todos os dados da planilha no banco?')) return

    setLoading(true)
    const { error } = await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (!error) {
      setMsg('Planilha apagada do banco com sucesso.')
    } else {
      setMsg('Erro ao apagar banco: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div className="p-8 bg-slate-100 min-h-screen font-sans">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Painel Administrativo - Gestão RMR</h1>

      {/* Botões do Banco de Dados */}
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
        {msg && <p className="mt-4 text-sm font-semibold text-slate-700">{msg}</p>}
      </div>

      {/* Gestão de Usuários */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Gestão de Usuários</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="email" placeholder="E-mail do usuário" className="p-2 border rounded-lg text-sm" />
          <input type="password" placeholder="Senha" className="p-2 border rounded-lg text-sm" />
          <button className="bg-slate-800 text-white font-medium p-2 rounded-lg text-sm hover:bg-slate-900 transition">
            Criar Usuário
          </button>
        </div>
      </div>
    </div>
  )
}