'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1']

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
  const [filtroData, setFiltroData] = useState('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/bi/login'
        return
      }
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

  // Filtragem Lógica por Data e Campos
  const dealsFiltrados = deals.filter(d => {
    // 1. Filtro Vendedor, Origem, Etapa
    const matchVendedor = filtroVendedor === '' || d.vendedor === filtroVendedor
    const matchOrigem = filtroOrigem === '' || (d.origem && d.origem.toLowerCase().includes(filtroOrigem.toLowerCase()))
    const matchEtapa = filtroEtapa === '' || d.etapa === filtroEtapa

    // 2. Filtro Data
    if (!d.data_criacao) return matchVendedor && matchOrigem && matchEtapa
    
    const dataCriacao = new Date(d.data_criacao)
    const hoje = new Date()
    let matchData = true

    if (filtroData === 'hoje') {
      matchData = dataCriacao.toDateString() === hoje.toDateString()
    } else if (filtroData === 'ontem') {
      const ontem = new Date()
      ontem.setDate(hoje.getDate() - 1)
      matchData = dataCriacao.toDateString() === ontem.toDateString()
    } else if (filtroData === 'este_mes') {
      matchData = dataCriacao.getMonth() === hoje.getMonth() && dataCriacao.getFullYear() === hoje.getFullYear()
    } else if (filtroData === 'mes_passado') {
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      matchData = dataCriacao.getMonth() === mesPassado.getMonth() && dataCriacao.getFullYear() === mesPassado.getFullYear()
    } else if (filtroData === 'este_ano') {
      matchData = dataCriacao.getFullYear() === hoje.getFullYear()
    } else if (filtroData === 'ano_passado') {
      matchData = dataCriacao.getFullYear() === hoje.getFullYear() - 1
    } else if (filtroData === 'personalizado' && dataInicioCustom && dataFimCustom) {
      const ini = new Date(dataInicioCustom)
      const fim = new Date(dataFimCustom)
      fim.setHours(23, 59, 59)
      matchData = dataCriacao >= ini && dataCriacao <= fim
    }

    return matchVendedor && matchOrigem && matchEtapa && matchData
  })

  // KPIs
  const totalCriadas = dealsFiltrados.length
  const ganhos = dealsFiltrados.filter(d => d.status === 'Ganho').length
  const perdidos = dealsFiltrados.filter(d => d.status === 'Perdido').length
  const abertas = dealsFiltrados.filter(d => d.status === 'Aberto').length
  const taxaConversao = totalCriadas > 0 ? ((ganhos / totalCriadas) * 100).toFixed(1) : '0'

  // Dados para Gráfico: Ranking de Vendedores (Ganhos)
  const rankingVendedoresMap: Record<string, number> = {}
  dealsFiltrados.forEach(d => {
    const v = d.vendedor || 'Não Definido'
    if (!rankingVendedoresMap[v]) rankingVendedoresMap[v] = 0
    if (d.status === 'Ganho') rankingVendedoresMap[v] += 1
  })
  const rankingVendedoresData = Object.keys(rankingVendedoresMap).map(k => ({
    name: k,
    ganhos: rankingVendedoresMap[k]
  })).sort((a, b) => b.ganhos - a.ganhos).slice(0, 10)

  // Dados para Gráfico: Motivos de Perda
  const motivosPerdaMap: Record<string, number> = {}
  dealsFiltrados.filter(d => d.status === 'Perdido').forEach(d => {
    const m = d.motivo_perda || 'Não informado'
    motivosPerdaMap[m] = (motivosPerdaMap[m] || 0) + 1
  })
  const motivosPerdaData = Object.keys(motivosPerdaMap).map(k => ({
    name: k,
    value: motivosPerdaMap[k]
  }))

  // Dados para Gráfico: Ranking de Origem
  const origemMap: Record<string, number> = {}
  dealsFiltrados.forEach(d => {
    const o = d.origem || 'Outros'
    origemMap[o] = (origemMap[o] || 0) + 1
  })
  const origemData = Object.keys(origemMap).map(k => ({
    name: k,
    total: origemMap[k]
  })).sort((a, b) => b.total - a.total).slice(0, 8)

  if (loading) {
    return <div className="p-8 text-center text-slate-600 font-sans">Carregando Dashboard RMR...</div>
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      {/* Topo */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard RMR - Reunião Mensal de Resultados</h1>
          <p className="text-xs text-slate-500 font-medium">Análise de Performance Comercial & Indicadores Chave</p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <div className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full font-semibold">
              Última atualização: {lastUpdate}
            </div>
          )}
          <a href="/bi/admin" className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-lg transition">
            Área Admin
          </a>
          <button 
            onClick={handleLogout}
            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Barra de Filtros Completa */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Período de Data</label>
          <select 
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)} 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-700"
          >
            <option value="todos">Todo o Período</option>
            <option value="hoje">Hoje</option>
            <option value="ontem">Ontem</option>
            <option value="este_mes">Este Mês</option>
            <option value="mes_passado">Mês Passado</option>
            <option value="este_ano">Este Ano</option>
            <option value="ano_passado">Ano Passado</option>
            <option value="personalizado">Data Personalizada</option>
          </select>
        </div>

        {filtroData === 'personalizado' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Data Início</label>
              <input 
                type="date" 
                value={dataInicioCustom} 
                onChange={(e) => setDataInicioCustom(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Data Fim</label>
              <input 
                type="date" 
                value={dataFimCustom} 
                onChange={(e) => setDataFimCustom(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm text-slate-700"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Vendedor</label>
          <select 
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)} 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-700 min-w-[150px]"
          >
            <option value="">Todos os Vendedores</option>
            {Array.from(new Set(deals.map(d => d.vendedor))).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Origem (Pesquisar)</label>
          <input 
            type="text" 
            placeholder="Buscar origem..." 
            value={filtroOrigem} 
            onChange={(e) => setFiltroOrigem(e.target.value)} 
            className="p-2 border border-slate-300 rounded-lg text-sm text-slate-700 min-w-[160px]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Etapa</label>
          <select 
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)} 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-700 min-w-[150px]"
          >
            <option value="">Todas as Etapas</option>
            {Array.from(new Set(deals.map(d => d.etapa))).map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {(filtroVendedor || filtroOrigem || filtroEtapa || filtroData !== 'todos') && (
          <button 
            onClick={() => { 
              setFiltroVendedor(''); setFiltroOrigem(''); setFiltroEtapa(''); setFiltroData('todos');
              setDataInicioCustom(''); setDataFimCustom('');
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold p-2 transition"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Criadas</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalCriadas}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 bg-emerald-50/20">
          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Ganhos</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-1">{ganhos}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-200 bg-rose-50/20">
          <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Perdidos</p>
          <p className="text-3xl font-extrabold text-rose-600 mt-1">{perdidos}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 bg-amber-50/20">
          <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Abertas</p>
          <p className="text-3xl font-extrabold text-amber-600 mt-1">{abertas}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200 bg-blue-50/20">
          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Taxa de Conversão</p>
          <p className="text-3xl font-extrabold text-blue-600 mt-1">{taxaConversao}%</p>
        </div>
      </div>

      {/* Seção de Gráficos e Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Gráfico 1: Ranking Vendedores */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Ranking de Vendedores (Ganhos)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingVendedoresData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="ganhos" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Motivos de Perda */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Motivos de Perda</h3>
          <div className="h-64">
            {motivosPerdaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={motivosPerdaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {motivosPerdaData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 text-center pt-20">Nenhum motivo de perda registrado no filtro atual.</p>
            )}
          </div>
        </div>

        {/* Gráfico 3: Ranking de Origem */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Ranking por Origem do Lead</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={origemData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela de Detalhamento das Contas */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <h3 className="font-bold text-slate-800 text-base mb-4">Detalhamento das Contas</h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
              <th className="p-3">Cliente (Razão Social)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Data Criação</th>
              <th className="p-3">Ciclo de Venda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dealsFiltrados.slice(0, 100).map((deal) => (
              <tr key={deal.id} className="hover:bg-slate-50/80 transition">
                <td className="p-3 font-semibold text-slate-800">{deal.cliente_razao_social}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    deal.status === 'Ganho' ? 'bg-emerald-100 text-emerald-800' :
                    deal.status === 'Perdido' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {deal.status}
                  </span>
                </td>
                <td className="p-3 text-slate-600 font-medium">{deal.etapa}</td>
                <td className="p-3 text-slate-600">{deal.origem}</td>
                <td className="p-3 text-slate-600 font-medium">{deal.vendedor}</td>
                <td className="p-3 text-slate-500">{deal.data_criacao ? new Date(deal.data_criacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 font-bold text-slate-700">
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