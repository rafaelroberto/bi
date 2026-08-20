'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts'

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

  const [itensVisiveis, setItensVisiveis] = useState(10)

  // Filtro por Clicar no KPI
  const [filtroKPI, setFiltroKPI] = useState<string>('todos')

  // Filtros Tradicionais
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

  // 1. Filtragem Base
  const dealsBaseData = deals.filter(d => {
    const vend = (d.vendedor || '').toString().toLowerCase()
    const orig = (d.origem || '').toString().toLowerCase()
    const etap = (d.etapa || '').toString().toLowerCase()

    const matchVendedor = filtroVendedor === '' || vend === filtroVendedor.toLowerCase()
    const matchOrigem = filtroOrigem === '' || orig.includes(filtroOrigem.toLowerCase())
    const matchEtapa = filtroEtapa === '' || etap === filtroEtapa.toLowerCase()

    const dataRefStr = (d.status === 'Ganho' && d.data_mudanca_etapa) ? d.data_mudanca_etapa : d.data_criacao
    if (!dataRefStr) return matchVendedor && matchOrigem && matchEtapa
    
    const dataRef = new Date(dataRefStr)
    const hoje = new Date()
    let matchData = true

    if (filtroData === 'hoje') {
      matchData = dataRef.toDateString() === hoje.toDateString()
    } else if (filtroData === 'ontem') {
      const ontem = new Date()
      ontem.setDate(hoje.getDate() - 1)
      matchData = dataRef.toDateString() === ontem.toDateString()
    } else if (filtroData === 'este_mes') {
      matchData = dataRef.getMonth() === hoje.getMonth() && dataRef.getFullYear() === hoje.getFullYear()
    } else if (filtroData === 'mes_passado') {
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      matchData = dataRef.getMonth() === mesPassado.getMonth() && dataRef.getFullYear() === mesPassado.getFullYear()
    } else if (filtroData === 'este_ano') {
      matchData = dataRef.getFullYear() === hoje.getFullYear()
    } else if (filtroData === 'ano_passado') {
      matchData = dataRef.getFullYear() === hoje.getFullYear() - 1
    } else if (filtroData === 'personalizado' && dataInicioCustom && dataFimCustom) {
      const ini = new Date(dataInicioCustom)
      const fim = new Date(dataFimCustom)
      fim.setHours(23, 59, 59)
      matchData = dataRef >= ini && dataRef <= fim
    }

    return matchVendedor && matchOrigem && matchEtapa && matchData
  })

  // KPIs Globais
  const totalCriadas = dealsBaseData.length
  const ganhos = dealsBaseData.filter(d => (d.status || '').toLowerCase() === 'ganho').length
  const perdidos = dealsBaseData.filter(d => (d.status || '').toLowerCase() === 'perdido').length
  const abertas = dealsBaseData.filter(d => (d.status || '').toLowerCase() === 'aberto').length

  const totalEncerradas = ganhos + perdidos
  const taxaConversao = totalEncerradas > 0 ? ((ganhos / totalEncerradas) * 100).toFixed(1) : (totalCriadas > 0 ? ((ganhos / totalCriadas) * 100).toFixed(1) : '0.0')

  const ganhosList = dealsBaseData.filter(d => (d.status || '').toLowerCase() === 'ganho')
  const totalDiasCiclo = ganhosList.reduce((acc, d) => acc + calcularCicloVenda(d.data_criacao, d.status, d.data_mudanca_etapa), 0)
  const mediaCicloVendas = ganhosList.length > 0 ? Math.round(totalDiasCiclo / ganhosList.length) : 0

  // 2. Aplicar Filtro do KPI
  const dealsFiltrados = dealsBaseData.filter(d => {
    const st = (d.status || '').toLowerCase()
    if (filtroKPI === 'ganho') return st === 'ganho'
    if (filtroKPI === 'perdido') return st === 'perdido'
    if (filtroKPI === 'aberto') return st === 'aberto'
    if (filtroKPI === 'encerrados') return st === 'ganho' || st === 'perdido'
    return true
  })

  const toggleKPIFilter = (kpiName: string) => {
    if (filtroKPI === kpiName) {
      setFiltroKPI('todos')
    } else {
      setFiltroKPI(kpiName)
      setItensVisiveis(10)
    }
  }

  // Dados do Funil em Ordem do Topo para a Base
  const etapasFunilOrdem = [
    { label: 'Qualificação', key: 'qualificação', color: 'from-cyan-900 to-cyan-800' },
    { label: 'Prospecção', key: 'prospecção', color: 'from-cyan-800 to-cyan-700' },
    { label: 'Demonstração', key: 'demonstração', color: 'from-cyan-700 to-cyan-600' },
    { label: 'Proposta', key: 'proposta', color: 'from-cyan-600 to-teal-600' },
    { label: 'Negociação', key: 'negociação', color: 'from-teal-600 to-teal-500' },
    { label: 'Assinatura', key: 'assinatura', color: 'from-teal-500 to-emerald-500' },
    { label: 'Ganho', key: 'ganho', color: 'from-emerald-600 to-emerald-500' },
    { label: 'Perdido', key: 'perdido', color: 'from-rose-600 to-rose-500' }
  ]

  const funilCalculado = etapasFunilOrdem.map((etapaObj, idx) => {
    const count = dealsBaseData.filter(d => {
      const e = (d.etapa || '').toString().toLowerCase()
      const st = (d.status || '').toString().toLowerCase()
      if (etapaObj.key === 'ganho') return st === 'ganho' || e === 'ganho'
      if (etapaObj.key === 'perdido') return st === 'perdido' || e === 'perdido'
      return e.includes(etapaObj.key)
    }).length

    // Largura visual trapezoidal
    const widthPercent = Math.max(28, 100 - idx * 9)

    return {
      ...etapaObj,
      count,
      widthPercent
    }
  })

  // Dados para Gráficos
  const rankingVendedoresMap: Record<string, number> = {}
  dealsFiltrados.forEach(d => {
    const v = d.vendedor || 'Não Definido'
    if (!rankingVendedoresMap[v]) rankingVendedoresMap[v] = 0
    rankingVendedoresMap[v] += 1
  })
  const rankingVendedoresData = Object.keys(rankingVendedoresMap).map(k => ({
    name: k,
    total: rankingVendedoresMap[k]
  })).sort((a, b) => b.total - a.total).slice(0, 10)

  const motivosPerdaMap: Record<string, number> = {}
  dealsFiltrados.filter(d => (d.status || '').toLowerCase() === 'perdido').forEach(d => {
    const m = (d.motivo_perda && d.motivo_perda.toString().trim() !== '') ? d.motivo_perda.toString().trim() : 'Sem Justificativa (CRM)'
    motivosPerdaMap[m] = (motivosPerdaMap[m] || 0) + 1
  })
  const motivosPerdaData = Object.keys(motivosPerdaMap).map(k => ({
    name: k,
    total: motivosPerdaMap[k]
  })).sort((a, b) => b.total - a.total)

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
          <p className="text-xs text-slate-500 font-medium">Análise de Performance Comercial & Funil de Vendas</p>
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

      {/* Barra de Filtros */}
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
            {Array.from(new Set(deals.map(d => d.vendedor).filter(Boolean))).map(v => (
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
            {Array.from(new Set(deals.map(d => d.etapa).filter(Boolean))).map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {(filtroVendedor || filtroOrigem || filtroEtapa || filtroData !== 'todos' || filtroKPI !== 'todos') && (
          <button 
            onClick={() => { 
              setFiltroVendedor(''); setFiltroOrigem(''); setFiltroEtapa(''); setFiltroData('todos');
              setFiltroKPI('todos'); setDataInicioCustom(''); setDataFimCustom('');
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold p-2 transition"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Grid de KPIs Clicáveis */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
        <div 
          onClick={() => toggleKPIFilter('todos')}
          className={`p-4 rounded-2xl cursor-pointer transition shadow-sm border ${
            filtroKPI === 'todos' ? 'ring-2 ring-slate-800 bg-slate-100 border-slate-400' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Criadas</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalCriadas}</p>
        </div>

        <div 
          onClick={() => toggleKPIFilter('ganho')}
          className={`p-4 rounded-2xl cursor-pointer transition shadow-sm border ${
            filtroKPI === 'ganho' ? 'ring-2 ring-emerald-600 bg-emerald-100 border-emerald-400' : 'bg-white border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
          }`}
        >
          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Ganhos</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{ganhos}</p>
        </div>

        <div 
          onClick={() => toggleKPIFilter('perdido')}
          className={`p-4 rounded-2xl cursor-pointer transition shadow-sm border ${
            filtroKPI === 'perdido' ? 'ring-2 ring-rose-600 bg-rose-100 border-rose-400' : 'bg-white border-rose-200 bg-rose-50/20 hover:border-rose-300'
          }`}
        >
          <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Perdidos</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{perdidos}</p>
        </div>

        <div 
          onClick={() => toggleKPIFilter('aberto')}
          className={`p-4 rounded-2xl cursor-pointer transition shadow-sm border ${
            filtroKPI === 'aberto' ? 'ring-2 ring-amber-600 bg-amber-100 border-amber-400' : 'bg-white border-amber-200 bg-amber-50/20 hover:border-amber-300'
          }`}
        >
          <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Abertas</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{abertas}</p>
        </div>

        <div 
          onClick={() => toggleKPIFilter('encerrados')}
          className={`p-4 rounded-2xl cursor-pointer transition shadow-sm border ${
            filtroKPI === 'encerrados' ? 'ring-2 ring-blue-600 bg-blue-100 border-blue-400' : 'bg-white border-blue-200 bg-blue-50/20 hover:border-blue-300'
          }`}
        >
          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Taxa Conversão</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">{taxaConversao}%</p>
        </div>

        <div 
          onClick={() => toggleKPIFilter('ganho')}
          className={`p-4 rounded-2xl cursor-pointer transition shadow-sm border ${
            filtroKPI === 'ganho' ? 'ring-2 ring-purple-600 bg-purple-100 border-purple-400' : 'bg-white border-purple-200 bg-purple-50/20 hover:border-purple-300'
          }`}
        >
          <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">Ciclo Médio</p>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">{mediaCicloVendas} <span className="text-xs font-semibold">dias</span></p>
        </div>
      </div>

      {/* NOVO: Gráfico Visual de Funil de Vendas Trapezoidal */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-base font-extrabold text-slate-800 mb-1">Funil de Vendas por Etapa</h3>
        <p className="text-xs text-slate-500 mb-6">Progressão do Funil da Qualificação até o Fechamento / Perda</p>

        <div className="flex flex-col items-center gap-2 max-w-2xl mx-auto py-2">
          {funilCalculado.map((f) => (
            <div 
              key={f.label} 
              onClick={() => { setFiltroEtapa(f.label); setItensVisiveis(10); }}
              style={{ width: `${f.widthPercent}%` }}
              className={`bg-gradient-to-r ${f.color} text-white font-bold py-2.5 px-4 rounded-xl shadow-sm cursor-pointer hover:opacity-95 transition flex justify-between items-center text-xs md:text-sm`}
            >
              <span>{f.label}</span>
              <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-extrabold">
                {f.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Seção de Gráficos Secundários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Ranking de Vendedores</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingVendedoresData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Motivos de Perda</h3>
          <p className="text-[10px] text-slate-400 mb-3">*Contas perdidas</p>
          <div className="h-56">
            {motivosPerdaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={motivosPerdaData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 text-center pt-20">Nenhum motivo de perda no filtro atual.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Ranking por Origem</h3>
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

      {/* Tabela de Detalhamento */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 text-base">
            Detalhamento das Contas Exibindo {Math.min(itensVisiveis, dealsFiltrados.length)} de {dealsFiltrados.length}
          </h3>
        </div>

        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
              <th className="p-3">Cliente (Razão Social)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Motivo Perda</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Data Criação</th>
              <th className="p-3">Data Fechamento</th>
              <th className="p-3">Ciclo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dealsFiltrados.slice(0, itensVisiveis).map((deal) => (
              <tr key={deal.id} className="hover:bg-slate-50/80 transition">
                <td className="p-3 font-semibold text-slate-800">{deal.cliente_razao_social}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    (deal.status || '').toLowerCase() === 'ganho' ? 'bg-emerald-100 text-emerald-800' :
                    (deal.status || '').toLowerCase() === 'perdido' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {deal.status}
                  </span>
                </td>
                <td className="p-3 text-slate-600 font-medium">{deal.etapa}</td>
                <td className="p-3 text-slate-500 text-xs italic">{deal.motivo_perda || '-'}</td>
                <td className="p-3 text-slate-600">{deal.origem}</td>
                <td className="p-3 text-slate-600 font-medium">{deal.vendedor}</td>
                <td className="p-3 text-slate-500">{deal.data_criacao ? new Date(deal.data_criacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 text-slate-500">{deal.data_mudanca_etapa ? new Date(deal.data_mudanca_etapa).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 font-bold text-slate-700">
                  {calcularCicloVenda(deal.data_criacao, deal.status, deal.data_mudanca_etapa)} dias
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Controles de Expansão */}
        <div className="mt-6 flex justify-center gap-3">
          {itensVisiveis < dealsFiltrados.length && (
            <>
              <button 
                onClick={() => setItensVisiveis(prev => prev + 10)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Mostrar +10
              </button>
              <button 
                onClick={() => setItensVisiveis(dealsFiltrados.length)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Mostrar Todos ({dealsFiltrados.length})
              </button>
            </>
          )}

          {itensVisiveis > 10 && (
            <button 
              onClick={() => setItensVisiveis(10)}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2 rounded-xl transition border border-rose-200"
            >
              Recolher para 10
            </button>
          )}
        </div>
      </div>
    </div>
  )
}