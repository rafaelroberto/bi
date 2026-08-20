'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AdminDashboard() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setMsg('Processando e reclassificando todos os registros...')

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data: any[] = XLSX.utils.sheet_to_json(ws)

        // Limpa a base antiga antes de sobrescrever
        await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // Mapeamento inteligente que lê qualquer coluna ou formato de status
        const rows = data.map((item: any) => {
          // Procura o valor de status em qualquer coluna comum de CRM/Planilhas
          const rawStatus = (
            item['Status'] || 
            item['status'] || 
            item['Situação'] || 
            item['Situacao'] || 
            item['Fase'] || 
            item['Etapa'] ||
            ''
          ).toString().trim().toLowerCase()

          let statusFinal = 'Aberto'

          // Mapeia termos de sucesso
          if (
            rawStatus.includes('ganho') || 
            rawStatus.includes('ganha') || 
            rawStatus.includes('fechado') || 
            rawStatus.includes('vendido') || 
            rawStatus.includes('won')
          ) {
            statusFinal = 'Ganho'
          } 
          // Mapeia termos de perda
          else if (
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

        // Envia os dados reclassificados para o Supabase
        const { error } = await supabase.from('deals').insert(rows)

        if (!error) {
          await supabase.from('sheet_logs').insert({
            file_name: file.name,
            total_records: rows.length,
            updated_by: 'admin@rmr.com',
          })
          setMsg(`Sucesso! ${rows.length} registros processados e categorizados.`)
        } else {
          setMsg('Erro ao salvar no banco: ' + error.message)
        }
      } catch (err: any) {
        setMsg('Erro ao processar arquivo: ' + err.message)
      }
      setLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  async function handleClearDatabase() {
    if (!confirm('Tem certeza de que deseja apagar a planilha do banco?')) return
    setLoading(true)
    const { error } = await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (!error) {
      setMsg('Planilha apagada com sucesso.')
    } else {
      setMsg('Erro: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div className="p-8 bg-slate-100 min-h-screen font-sans">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Painel Administrativo - Gestão RMR</h1>

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
    </div>
  )
}