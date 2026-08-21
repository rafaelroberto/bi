'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<any[]>([])
  
  // Filtros
  const [periodFilter, setPeriodFilter] = useState('este_ano')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedVendedor, setSelectedVendedor] = useState('todos')
  const [selectedOrigem, setSelectedOrigem] = useState('todas')

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('deals').select('*')
      if (data) setDeals(data)
      setLoading(false)
    }
    loadData()
  }, [])

  function isDateInSelectedPeriod(dateStr: string | null, filter: string, start?: string, end?: string) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const now = new Date()

    if (filter === 'este_ano') {
      return d.getFullYear() === now.getFullYear()
    }
    if (filter === 'este_mes') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    if (filter === 'mes_passado') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth()
    }
    if (filter === 'personalizado' && start && end) {
      const startDate = new Date(start)
      const endDate = new Date(end)
      endDate.setHours(23, 59, 59, 999)
      return d >= startDate && d <= endDate
    }
    return true
  }

  // Oportunidades Filtradas por Vendedor e Origem
  const dealsFiltrados = deals.filter(d => {
    const matchVendedor = selectedVendedor === 'todos' || d.vendedor === selectedVendedor
    const matchOrigem = selectedOrigem === 'todas' || d.origem === selectedOrigem
    return matchVendedor && matchOrigem
  })

  // 1. CRIADAS NO PERÍODO
  const dealsCriadosNoPeriodo = dealsFiltrados.filter(d => 
    isDateInSelectedPeriod(d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  // 2. GANHOS NO PERÍODO (Volume real fechado dentro do filtro de data)
  const dealsGanhosNoPeriodo = dealsFiltrados.filter(d => 
    d.status === 'Ganho' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  // 3. PERDIDOS NO PERÍODO
  const dealsPerdidosNoPeriodo = dealsFiltrados.filter(d => 
    d.status === 'Perdido' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  // 4. ABERTAS NO PERÍODO
  const dealsAbertosNoPeriodo = dealsCriadosNoPeriodo.filter(d => d.status === 'Aberto')

  // 5. TAXA DE CONVERSÃO REGRADA (COHORT / SAFRA)
  // Criadas no período X e Ganhas no mesmo período X
  const dealsCriadosEFechadosMesmaSafra = dealsCriadosNoPeriodo.filter(d => 
    d.status === 'Ganho' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  const totalCriadas = dealsCriadosNoPeriodo.length
  const totalConvertidasMesmaSafra = dealsCriadosEFechadosMesmaSafra.length

  const taxaConversao = totalCriadas > 0 
    ? ((totalConvertidasMesmaSafra / totalCriadas) * 100).toFixed(1) 
    : '0.0'

  // Ciclo Médio de Vendas
  const temposFechamento = dealsGanhosNoPeriodo
    .map(d => {
      if (!d.data_criacao || !d.data_mudanca_etapa) return null
      const inicio = new Date(d.data_criacao).getTime()
      const fim = new Date(d.data_mudanca_etapa).getTime()
      const diffDias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24))
      return diffDias >= 0 ? diffDias : null
    })
    .filter((d): d is number => d !== null)

  const cicloMedio = temposFechamento.length > 0 
    ? Math.round(temposFechamento.reduce((a, b) => a + b, 0) / temposFechamento.length)
    : 0

  // AGRUPAMENTOS E DADOS DOS GRÁFICOS
  // 1. Evolução Mensal (Criadas vs Ganhos)
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const evolucaoMensal = mesesNomes.map((mes, idx) => {
    const criadasNoMes = dealsFiltrados.filter(d => {
      if (!d.data_criacao) return false
      const dt = new Date(d.data_criacao)
      return dt.getMonth() === idx && dt.getFullYear() === new Date().getFullYear()
    }).length

    const ganhosNoMes = dealsFiltrados.filter(d => {
      if (d.status !== 'Ganho') return false
      const dt = new Date(d.data_mudanca_etapa || d.data_criacao)
      return dt.getMonth() === idx && dt.getFullYear() === new Date().getFullYear()
    }).length

    return { mes, criadas: criadasNoMes, ganhos: ganhosNoMes }
  })

  const maxEvolucao = Math.max(...evolucaoMensal.map(m => Math.max(m.criadas, m.ganhos)), 1)

  // 2. Desempenho por Vendedor
  const porVendedor = dealsFiltrados.reduce((acc: any, d) => {
    const v = d.vendedor || 'Não Definido'
    if (!acc[v]) acc[v] = { criadas: 0, ganhos: 0, perdidos: 0 }
    if (isDateInSelectedPeriod(d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[v].criadas++
    if (d.status === 'Ganho' && isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[v].ganhos++
    if (d.status === 'Perdido' && isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[v].perdidos++
    return acc
  }, {})

  // 3. Origem das Oportunidades
  const porOrigem = dealsCriadosNoPeriodo.reduce((acc: any, d) => {
    const o = d.origem || 'Outros'
    acc[o] = (acc[o] || 0) + 1
    return acc
  }, {})

  // 4. Funil por Etapas
  const porEtapa = dealsCriadosNoPeriodo.reduce((acc: any, d) => {
    const e = d.etapa || 'Inicial'
    acc[e] = (acc[e] || 0) + 1
    return acc
  }, {})

  // 5. Motivos de Perda
  const porMotivoPerda = dealsPerdidosNoPeriodo.reduce((acc: any, d) => {
    const m = d.motivo_perda || 'Não Informado'
    acc[m] = (acc[m] || 0) + 1
    return acc
  }, {})

  const listaVendedores = Array.from(new Set(deals.map(d => d.vendedor))).filter(Boolean)
  const listaOrigens = Array.from(new Set(deals.map(d => d.origem))).filter(Boolean)

  if (loading) {
    return <div className="p-8 text-center text-slate-600 font-sans">Carregando Dashboard Comercial...</div>
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      {/* Cabeçalho */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard Comercial - B.I. RMR</h1>
          <p className="text-xs text-slate-500 font-medium">Acompanhamento de Desempenho e Eficiência de Vendas</p>
        </div>

        <a href="/bi/admin" className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl transition shadow-sm">
          ⚙️ Painel Admin
        </a>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Período</label>
          <select 
            value={periodFilter} 
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="este_ano">Este Ano</option>
            <option value="este_mes">Este Mês</option>
            <option value="mes_passado">Mês Passado</option>
            <option value="todos">Todo o Histórico</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        {periodFilter === 'personalizado' && (
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Início</label>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fim</label>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Vendedor</label>
          <select 
            value={selectedVendedor} 
            onChange={(e) => setSelectedVendedor(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="todos">Todos os Vendedores</option>
            {listaVendedores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Origem</label>
          <select 
            value={selectedOrigem} 
            onChange={(e) => setSelectedOrigem(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="todas">Todas as Origens</option>
            {listaOrigens.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Criadas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{dealsCriadosNoPeriodo.length}</p>
        </div>

        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Ganhos</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{dealsGanhosNoPeriodo.length}</p>
        </div>

        <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Perdidos</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{dealsPerdidosNoPeriodo.length}</p>
        </div>

        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Abertas</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{dealsAbertosNoPeriodo.length}</p>
        </div>

        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Taxa Conversão</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{taxaConversao}%</p>
        </div>

        <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Ciclo Médio</p>
          <p className="text-2xl font-black text-purple-600 mt-1">{cicloMedio} <span className="text-xs font-semibold">dias</span></p>
        </div>
      </div>

      {/* BLOCO DE GRÁFICOS VISUAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        
        {/* GRÁFICO 1: EVOLUÇÃO TEMPORAL (MÊS A MÊS) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-slate-800">Evolução Mensal (Criadas vs Ganhos)</h2>
            <div className="flex gap-4 text-xs font-bold">
              <span className="flex items-center gap-1 text-slate-600"><span className="w-3 h-3 bg-blue-500 rounded-sm"></span> Criadas</span>
              <span className="flex items-center gap-1 text-emerald-600"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Ganhos</span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-4 border-b border-slate-100 pb-2">
            {evolucaoMensal.map((item) => {
              const heightCriadas = (item.criadas / maxEvolucao) * 100
              const heightGanhos = (item.ganhos / maxEvolucao) * 100

              return (
                <div key={item.mes} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex justify-center items-end gap-1 h-full">
                    {/* Barra Criadas */}
                    <div 
                      style={{ height: `${heightCriadas}%` }} 
                      className="w-2.5 bg-blue-500 rounded-t-sm transition-all group-hover:bg-blue-600 relative"
                      title={`Criadas em ${item.mes}: ${item.criadas}`}
                    ></div>
                    {/* Barra Ganhos */}
                    <div 
                      style={{ height: `${heightGanhos}%` }} 
                      className="w-2.5 bg-emerald-500 rounded-t-sm transition-all group-hover:bg-emerald-600 relative"
                      title={`Ganhos em ${item.mes}: ${item.ganhos}`}
                    ></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 mt-2">{item.mes}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* GRÁFICO 2: FUNIL COMERCIAL VISUAL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-6">Funil de Vendas por Etapa</h2>
          <div className="space-y-4">
            {Object.entries(porEtapa)
              .sort((a: any, b: any) => b[1] - a[1])
              .map(([etapa, count]: any) => {
                const pct = totalCriadas > 0 ? ((count / totalCriadas) * 100).toFixed(0) : 0
                return (
                  <div key={etapa} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{etapa}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-xl overflow-hidden p-0.5">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-lg transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* BLOCO DE TABELAS E MOTIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        
        {/* TABELA: DESEMPENHO POR VENDEDOR */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
          <h2 className="text-base font-bold text-slate-800 mb-4">Desempenho por Vendedor</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                  <th className="p-2.5">Vendedor</th>
                  <th className="p-2.5 text-center">Criadas</th>
                  <th className="p-2.5 text-center">Ganhos</th>
                  <th className="p-2.5 text-center">Perdidos</th>
                  <th className="p-2.5 text-center">Conversão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(porVendedor)
                  .sort((a: any, b: any) => b[1].criadas - a[1].criadas)
                  .map(([v, val]: any) => {
                    const convVend = val.criadas > 0 ? ((val.ganhos / val.criadas) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={v} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 font-bold text-slate-800">{v}</td>
                        <td className="p-2.5 text-center text-slate-600 font-bold">{val.criadas}</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">{val.ganhos}</td>
                        <td className="p-2.5 text-center text-rose-600 font-bold">{val.perdidos}</td>
                        <td className="p-2.5 text-center font-extrabold text-blue-600">{convVend}%</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOTIVOS DE PERDA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4">Principais Motivos de Perda</h2>
          <div className="space-y-4">
            {Object.entries(porMotivoPerda)
              .sort((a: any, b: any) => b[1] - a[1])
              .map(([motivo, count]: any) => {
                const pct = dealsPerdidosNoPeriodo.length > 0 
                  ? ((count / dealsPerdidosNoPeriodo.length) * 100).toFixed(0) 
                  : 0
                return (
                  <div key={motivo}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-700">{motivo}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

      </div>

      {/* ORIGEM DAS OPORTUNIDADES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-4">Origem das Oportunidades</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(porOrigem)
            .sort((a: any, b: any) => b[1] - a[1])
            .map(([origem, count]: any) => {
              const pct = totalCriadas > 0 ? ((count / totalCriadas) * 100).toFixed(0) : 0
              return (
                <div key={origem} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500">{origem}</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{count} <span className="text-xs font-medium text-slate-400">({pct}%)</span></p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}