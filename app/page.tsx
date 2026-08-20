'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function calcularCicloVenda(dataCriacao: string, status: string, dataMudancaEtapa?: string): number {
  if (!dataCriacao) return 0
  const inicio = new Date(dataCriacao).getTime()
  let fim = new Date().getTime()

  if (status === 'Ganho' && dataMudancaEtapa) {
    fim = new Date(dataMudancaEtapa).getTime()
  }

  const diffMs = fim - inicio
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export default function UserDashboard() {
  const [deals, setDeals] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')

  useEffect(() => {
    async function init() {
      // 1. Checa Sessão do Usuário
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/bi/login'
        return
      }

      // 2. Busca Dados e Logs
      await fetchDeals()
      await fetchLog()
      setLoading(false)
    }

    init()
  }, [])

  async function fetchDeals() {
    const { data } = await supabase.from('deals').select('*')
    if (data) setDeals(data)
  }

  async function fetchLog() {
    const { data } = await supabase.from('sheet_logs').select('*').order('updated_at', { ascending: false }).limit(1)
    if (data && data.length > 0) {
      setLastUpdate(new Date(data[0].updated_at).toLocaleString('pt-BR'))
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/bi/login'
  }

  // Filtragem
  const dealsFiltrados = deals.filter(d => {
    return (
      (filtroVendedor === '' || d.vendedor === filtroVendedor) &&
      (filtroOrigem === '' || (d.origem && d.origem.toLowerCase().includes(filtroOrigem.toLowerCase()))) &&
      (filtroEtapa === '' || d.etapa === filtroEtapa)
    )
  })

  // KPIs
  const totalCriadas = dealsFiltrados.length
  const ganhos = dealsFiltrados.filter(d => d.status === 'Ganho').length
  const perdidos = dealsFiltrados.filter(d => d.status === 'Perdido').length
  const abertas = dealsFiltrados.filter(d => d.status === 'Aberto').length
  const taxaConversao = totalCriadas > 0 ? ((ganhos / totalCriadas) * 100).toFixed(1) : '0'

  if (loading) {
    return <div className="p-8 text-center text-slate-600">Carregando Dashboard...</div>
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      {/* Topo */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard RMR - Reunião Mensal de Resultados</h1>
          <p className="text-xs text-slate-500">Visão Comercial e Funil de Vendas</p>
        </div>
        
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <div className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full font-medium">
              Atualizado em: {lastUpdate}
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Vendedor</label>
          <select 
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)} 
            className="p-2 border rounded-lg text-sm bg-white min-w-[160px]"
          >
            <option value="">Todos os Vendedores</option>
            {Array.from(new Set(deals.map(d => d.vendedor))).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Origem (Pesquisar)</label>
          <input 
            type="text" 
            placeholder="Buscar origem..." 
            value={filtroOrigem} 
            onChange={(e) => setFiltroOrigem(e.target.value)} 
            className="p-2 border rounded-lg text-sm min-w-[180px]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Etapa</label>
          <select 
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)} 
            className="p-2 border rounded-lg text-sm bg-white min-w-[160px]"
          >
            <option value="">Todas as Etapas</option>
            {Array.from(new Set(deals.map(d => d.etapa))).map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {(filtroVendedor || filtroOrigem || filtroEtapa) && (
          <button 
            onClick={() => { setFiltroVendedor(''); setFiltroOrigem(''); setFiltroEtapa('') }}
            className="text-xs text-blue-600 font-semibold p-2 hover:underline"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold">Oportunidades Criadas</p>
          <p className="text-2xl font-bold text-slate-800">{totalCriadas}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/30">
          <p className="text-xs text-emerald-600 font-semibold">Ganhos</p>
          <p className="text-2xl font-bold text-emerald-700">{ganhos}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50/30">
          <p className="text-xs text-rose-600 font-semibold">Perdidos</p>
          <p className="text-2xl font-bold text-rose-700">{perdidos}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 bg-amber-50/30">
          <p className="text-xs text-amber-600 font-semibold">Abertas / Em Andamento</p>
          <p className="text-2xl font-bold text-amber-700">{abertas}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 bg-blue-50/30">
          <p className="text-xs text-blue-600 font-semibold">Taxa de Conversão</p>
          <p className="text-2xl font-bold text-blue-700">{taxaConversao}%</p>
        </div>
      </div>

      {/* Tabela de Detalhamento */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <h3 className="font-bold text-slate-800 mb-4">Detalhamento das Contas</h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-600">
              <th className="p-3">Cliente (Razão Social)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Data Criação</th>
              <th className="p-3">Ciclo de Venda</th>
            </tr>
          </thead>
          <tbody>
            {dealsFiltrados.map((deal) => (
              <tr key={deal.id} className="border-b hover:bg-slate-50">
                <td className="p-3 font-medium">{deal.cliente_razao_social}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    deal.status === 'Ganho' ? 'bg-emerald-100 text-emerald-800' :
                    deal.status === 'Perdido' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {deal.status}
                  </span>
                </td>
                <td className="p-3">{deal.etapa}</td>
                <td className="p-3">{deal.origem}</td>
                <td className="p-3">{deal.vendedor}</td>
                <td className="p-3">{deal.data_criacao ? new Date(deal.data_criacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 font-semibold text-slate-700">
                  {calcularCicloVenda(deal.data_criacao, deal.status, deal.data_mudanca_etapa)} dias
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}