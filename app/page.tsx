'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Função de Normalização para unificar textos similares
function normalizeName(str: string | null | undefined): string {
  if (!str) return 'Não Informado'
  let s = str.toString().trim()
  if (!s) return 'Não Informado'

  const cleanKey = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (cleanKey.includes('mylead')) return 'MyLead'

  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function MultiSelectDropdown({ 
  label, 
  options, 
  selectedValues, 
  onChange 
}: { 
  label: string, 
  options: string[], 
  selectedValues: string[], 
  onChange: (vals: string[]) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchText] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(item => item !== option))
    } else {
      onChange([...selectedValues, option])
    }
  }

  const selectAll = () => onChange([...options])
  const clearAll = () => onChange([])

  return (
    <div className="relative min-w-[180px]" ref={dropdownRef}>
      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white flex justify-between items-center shadow-sm text-left truncate"
      >
        <span className="truncate">
          {selectedValues.length === 0 
            ? `Todas as ${label}s` 
            : selectedValues.length === options.length 
              ? `Todas (${options.length})` 
              : `${selectedValues.length} selecionada(s)`}
        </span>
        <span className="ml-2 text-slate-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2">
          <input
            type="text"
            placeholder={`Pesquisar ${label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full p-2 mb-2 border border-slate-200 rounded-lg text-xs"
          />

          <div className="flex justify-between text-[10px] font-bold px-1 mb-2 text-blue-600 border-b border-slate-100 pb-1">
            <button type="button" onClick={selectAll} className="hover:underline">Marcar Todos</button>
            <button type="button" onClick={clearAll} className="hover:underline text-rose-500">Limpar</button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <label key={option} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="rounded text-blue-600"
                  />
                  <span className="truncate">{option}</span>
                </label>
              ))
            ) : (
              <p className="text-[11px] text-slate-400 p-2 text-center">Nenhum resultado</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<any[]>([])
  const [forecasts, setForecasts] = useState<any[]>([])

  // Filtros Globais
  const [periodFilter, setPeriodFilter] = useState('este_ano')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Filtros Multi-Seleção
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([])
  const [selectedOrigens, setSelectedOrigens] = useState<string[]>([])
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([])

  // Filtro por clique em KPI
  const [statusFilterKpi, setStatusFilterKpi] = useState<string | null>(null)

  // Paginação da Tabela de Origens e da Tabela de Detalhamento
  const [origensLimit, setOrigensLimit] = useState<number>(10)
  const [detalhamentoLimit, setDetalhamentoLimit] = useState<number>(10)
  const [buscaDetalhamento, setBuscaDetalhamento] = useState('')

  // Estados de Ordenação das Tabelas dos Cards
  const [vendedorSortField, setVendedorSortField] = useState<string>('criadas')
  const [vendedorSortDir, setVendedorSortDir] = useState<'asc' | 'desc'>('desc')

  const [origemSortField, setOrigemSortField] = useState<string>('criadas')
  const [origemSortDir, setOrigemSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    async function loadData() {
      const { data: dealsData } = await supabase.from('deals').select('*')
      const { data: forecastsData } = await supabase.from('forecasts').select('*')

      if (dealsData) {
        const dealsNormalizados = dealsData.map(d => ({
          ...d,
          vendedor: normalizeName(d.vendedor),
          origem: normalizeName(d.origem),
          // Mapeamento Estrito para Garantir a Coluna K
          motivo_perda: d.motivo_perda || d['Nome.1'] || d['Motivo de Perda'] || d.motivo || null
        }))
        setDeals(dealsNormalizados)
      }

      if (forecastsData) setForecasts(forecastsData)

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

  // Opções para os Filtros
  const listaVendedores = Array.from(new Set(deals.map(d => d.vendedor))).filter(Boolean).sort()
  const listaOrigens = Array.from(new Set(deals.map(d => d.origem))).filter(Boolean).sort()
  const listaEtapas = Array.from(new Set(deals.map(d => d.etapa))).filter(Boolean).sort()

  // Oportunidades Filtradas
  const dealsFiltrados = deals.filter(d => {
    const matchVendedor = selectedVendedores.length === 0 || selectedVendedores.includes(d.vendedor)
    const matchOrigem = selectedOrigens.length === 0 || selectedOrigens.includes(d.origem)
    const matchEtapa = selectedEtapas.length === 0 || selectedEtapas.includes(d.etapa)
    const matchStatus = statusFilterKpi === null || d.status === statusFilterKpi

    return matchVendedor && matchOrigem && matchEtapa && matchStatus
  })

  // 1. CRIADAS NO PERÍODO
  const dealsCriadosNoPeriodo = dealsFiltrados.filter(d => 
    isDateInSelectedPeriod(d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  // 2. GANHOS NO PERÍODO
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

  // 5. TAXA DE CONVERSÃO SAFRA / COHORT
  const dealsCriadosEFechadosMesmaSafra = dealsCriadosNoPeriodo.filter(d => 
    d.status === 'Ganho' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  const totalCriadas = dealsCriadosNoPeriodo.length
  const totalConvertidasMesmaSafra = dealsCriadosEFechadosMesmaSafra.length

  const taxaConversao = totalCriadas > 0 
    ? ((totalConvertidasMesmaSafra / totalCriadas) * 100).toFixed(1) 
    : '0.0'

  // Ciclo Médio
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

  // Forecast Comercial
  const forecastIncluidos = forecasts.filter(f => Boolean(f.incluido_forecast))
  const totalSetupForecast = forecastIncluidos.reduce((acc, f) => acc + Number(f.valor_setup || 0), 0)
  const totalMrrForecast = forecastIncluidos.reduce((acc, f) => acc + Number(f.valor_mrr || 0), 0)

  // Evolução Mensal
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

  // Mapeamento por Vendedor
  const porVendedorMap = dealsFiltrados.reduce((acc: any, d) => {
    const v = d.vendedor
    if (!acc[v]) acc[v] = { nome: v, criadas: 0, ganhos: 0, perdidos: 0 }
    if (isDateInSelectedPeriod(d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[v].criadas++
    if (d.status === 'Ganho' && isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[v].ganhos++
    if (d.status === 'Perdido' && isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[v].perdidos++
    return acc
  }, {})

  const listaVendedoresOrdenados = Object.values(porVendedorMap).sort((a: any, b: any) => {
    let valA: any = a[vendedorSortField]
    let valB: any = b[vendedorSortField]

    if (vendedorSortField === 'conversao') {
      valA = a.criadas > 0 ? (a.ganhos / a.criadas) : 0
      valB = b.criadas > 0 ? (b.ganhos / b.criadas) : 0
    }

    if (valA < valB) return vendedorSortDir === 'asc' ? -1 : 1
    if (valA > valB) return vendedorSortDir === 'asc' ? 1 : -1
    return 0
  })

  // Mapeamento por Origem
  const porOrigemMap = dealsFiltrados.reduce((acc: any, d) => {
    const o = d.origem
    if (!acc[o]) acc[o] = { nome: o, criadas: 0, ganhos: 0, perdidos: 0 }
    if (isDateInSelectedPeriod(d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[o].criadas++
    if (d.status === 'Ganho' && isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[o].ganhos++
    if (d.status === 'Perdido' && isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)) acc[o].perdidos++
    return acc
  }, {})

  const listaOrigensOrdenadas = Object.values(porOrigemMap).sort((a: any, b: any) => {
    let valA: any = a[origemSortField]
    let valB: any = b[origemSortField]

    if (origemSortField === 'conversao') {
      valA = a.criadas > 0 ? (a.ganhos / a.criadas) : 0
      valB = b.criadas > 0 ? (b.ganhos / b.criadas) : 0
    }

    if (valA < valB) return origemSortDir === 'asc' ? -1 : 1
    if (valA > valB) return origemSortDir === 'asc' ? 1 : -1
    return 0
  })

  const porEtapa = dealsCriadosNoPeriodo.reduce((acc: any, d) => {
    const e = d.etapa || 'Inicial'
    acc[e] = (acc[e] || 0) + 1
    return acc
  }, {})

  // Captura Completa de Motivos de Perda (Coluna K)
  const porMotivoPerda = dealsPerdidosNoPeriodo.reduce((acc: any, d) => {
    const m = d.motivo_perda ? normalizeName(d.motivo_perda) : 'Não Informado'
    acc[m] = (acc[m] || 0) + 1
    return acc
  }, {})

  // Lista Filtrada para a Tabela de Detalhamento Geral
  const listaDetalhamento = dealsFiltrados.filter(d => {
    const matchBusca = (d.cliente_razao_social || '').toLowerCase().includes(buscaDetalhamento.toLowerCase()) ||
                       (d.vendedor || '').toLowerCase().includes(buscaDetalhamento.toLowerCase()) ||
                       (d.origem || '').toLowerCase().includes(buscaDetalhamento.toLowerCase())
    return matchBusca
  })

  const handleVendedorSort = (field: string) => {
    if (vendedorSortField === field) {
      setVendedorSortDir(vendedorSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setVendedorSortField(field)
      setVendedorSortDir('desc')
    }
  }

  const handleOrigemSort = (field: string) => {
    if (origemSortField === field) {
      setOrigemSortDir(origemSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setOrigemSortField(field)
      setOrigemSortDir('desc')
    }
  }

  const toggleStatusKpi = (status: string | null) => {
    setStatusFilterKpi(statusFilterKpi === status ? null : status)
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-600 font-sans">Carregando Dashboard Comercial...</div>
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      {/* Cabeçalho */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard Comercial - B.I. RMR</h1>
          <p className="text-xs text-slate-500 font-medium">Acompanhamento de Desempenho, Forecast e Eficiência de Vendas</p>
        </div>

        <a href="/bi/admin" className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl transition shadow-sm">
          ⚙️ Painel Admin
        </a>
      </div>

      {/* Barra de Filtros com Multi-Seleção e Busca */}
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

        <MultiSelectDropdown 
          label="Vendedor" 
          options={listaVendedores} 
          selectedValues={selectedVendedores} 
          onChange={setSelectedVendedores} 
        />

        <MultiSelectDropdown 
          label="Origem" 
          options={listaOrigens} 
          selectedValues={selectedOrigens} 
          onChange={setSelectedOrigens} 
        />

        <MultiSelectDropdown 
          label="Etapa" 
          options={listaEtapas} 
          selectedValues={selectedEtapas} 
          onChange={setSelectedEtapas} 
        />

        {statusFilterKpi && (
          <button
            onClick={() => setStatusFilterKpi(null)}
            className="mt-4 text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200"
          >
            ✕ Limpar Filtro ({statusFilterKpi})
          </button>
        )}
      </div>

      {/* Cards de KPIs Clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div 
          onClick={() => toggleStatusKpi(null)}
          className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${
            statusFilterKpi === null ? 'bg-white border-slate-400 ring-2 ring-slate-900/10' : 'bg-white/60 border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Criadas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{dealsCriadosNoPeriodo.length}</p>
        </div>

        <div 
          onClick={() => toggleStatusKpi('Ganho')}
          className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${
            statusFilterKpi === 'Ganho' ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Ganhos</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{dealsGanhosNoPeriodo.length}</p>
        </div>

        <div 
          onClick={() => toggleStatusKpi('Perdido')}
          className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${
            statusFilterKpi === 'Perdido' ? 'bg-rose-100 border-rose-500 ring-2 ring-rose-500/20' : 'bg-rose-50/50 border-rose-100 hover:border-rose-200'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Perdidos</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{dealsPerdidosNoPeriodo.length}</p>
        </div>

        <div 
          onClick={() => toggleStatusKpi('Aberto')}
          className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${
            statusFilterKpi === 'Aberto' ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500/20' : 'bg-amber-50/50 border-amber-100 hover:border-amber-200'
          }`}
        >
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

      {/* MÓDULO VISUAL DO FORECAST COMERCIAL */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <span>📊 Projeção do Forecast Comercial do Mês</span>
              <span className="bg-blue-600 text-white text-[10px] px-3 py-1 rounded-full font-bold">
                {forecastIncluidos.length} Oportunidades Selecionadas
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Previsão financeira estimada com base nas oportunidades em negociação avançada</p>
          </div>

          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Setup Projetado</p>
              <p className="text-xl font-black text-emerald-400">R$ {totalSetupForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total MRR Projetado</p>
              <p className="text-xl font-black text-blue-400">R$ {totalMrrForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {forecastIncluidos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                  <th className="p-2.5">Cliente (Razão Social)</th>
                  <th className="p-2.5">Vendedor</th>
                  <th className="p-2.5 text-right">Valor Setup (R$)</th>
                  <th className="p-2.5 text-right">Valor MRR (R$)</th>
                  <th className="p-2.5 text-center">Previsão Fechamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {forecastIncluidos.map((f) => (
                  <tr key={f.id || f.cliente_razao_social} className="hover:bg-slate-800/40 transition">
                    <td className="p-2.5 font-bold text-slate-200">{f.cliente_razao_social}</td>
                    <td className="p-2.5 text-slate-400">{f.vendedor}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">
                      R$ {Number(f.valor_setup || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-bold text-blue-400">
                      R$ {Number(f.valor_mrr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center text-slate-300 font-medium">
                      {f.data_previsao ? new Date(f.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
            Nenhuma conta adicionada ao Forecast para o período selecionado. Monte o Forecast no <strong>Painel Admin</strong>.
          </div>
        )}
      </div>

      {/* BLOCO DE GRÁFICOS VISUAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        
        {/* EVOLUÇÃO TEMPORAL */}
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
                    <div 
                      style={{ height: `${heightCriadas}%` }} 
                      className="w-2.5 bg-blue-500 rounded-t-sm transition-all group-hover:bg-blue-600 relative"
                      title={`Criadas em ${item.mes}: ${item.criadas}`}
                    ></div>
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

        {/* FUNIL COMERCIAL */}
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

      {/* BLOCO DE TABELAS COM ORDENAÇÃO POR COLUNAS (VENDEDOR E ORIGEM) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        
        {/* TABELA: DESEMPENHO POR VENDEDOR */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4">Desempenho por Vendedor</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase select-none">
                  <th onClick={() => handleVendedorSort('nome')} className="p-2.5 cursor-pointer hover:bg-slate-50">
                    Vendedor {vendedorSortField === 'nome' ? (vendedorSortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th onClick={() => handleVendedorSort('criadas')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                    Criadas {vendedorSortField === 'criadas' ? (vendedorSortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th onClick={() => handleVendedorSort('ganhos')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                    Ganhos {vendedorSortField === 'ganhos' ? (vendedorSortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th onClick={() => handleVendedorSort('perdidos')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                    Perdidos {vendedorSortField === 'perdidos' ? (vendedorSortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th onClick={() => handleVendedorSort('conversao')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                    Conversão {vendedorSortField === 'conversao' ? (vendedorSortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaVendedoresOrdenados.map((val: any) => {
                  const convVend = val.criadas > 0 ? ((val.ganhos / val.criadas) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={val.nome} className="hover:bg-slate-50/80 transition">
                      <td className="p-2.5 font-bold text-slate-800">{val.nome}</td>
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

        {/* TABELA: ORIGEM DAS OPORTUNIDADES COM ORDENAÇÃO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-800">Origem das Oportunidades</h2>
              <span className="text-xs font-semibold text-slate-400">
                Mostrando {Math.min(origensLimit, listaOrigensOrdenadas.length)} de {listaOrigensOrdenadas.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase select-none">
                    <th onClick={() => handleOrigemSort('nome')} className="p-2.5 cursor-pointer hover:bg-slate-50">
                      Origem {origemSortField === 'nome' ? (origemSortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th onClick={() => handleOrigemSort('criadas')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                      Criadas {origemSortField === 'criadas' ? (origemSortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th onClick={() => handleOrigemSort('ganhos')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                      Ganhos {origemSortField === 'ganhos' ? (origemSortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th onClick={() => handleOrigemSort('perdidos')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                      Perdidos {origemSortField === 'perdidos' ? (origemSortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th onClick={() => handleOrigemSort('conversao')} className="p-2.5 text-center cursor-pointer hover:bg-slate-50">
                      Conversão {origemSortField === 'conversao' ? (origemSortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listaOrigensOrdenadas.slice(0, origensLimit).map((val: any) => {
                    const convOrigem = val.criadas > 0 ? ((val.ganhos / val.criadas) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={val.nome} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 font-bold text-slate-800">{val.nome}</td>
                        <td className="p-2.5 text-center text-slate-600 font-bold">{val.criadas}</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">{val.ganhos}</td>
                        <td className="p-2.5 text-center text-rose-600 font-bold">{val.perdidos}</td>
                        <td className="p-2.5 text-center font-extrabold text-blue-600">{convOrigem}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botões de Expandir Paginação Origem */}
          {listaOrigensOrdenadas.length > 10 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              {origensLimit < listaOrigensOrdenadas.length ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setOrigensLimit(prev => prev + 10)}
                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition"
                  >
                    + Mostrar mais 10
                  </button>
                  <button
                    onClick={() => setOrigensLimit(listaOrigensOrdenadas.length)}
                    className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition"
                  >
                    Ver Todos ({listaOrigensOrdenadas.length})
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOrigensLimit(10)}
                  className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition"
                >
                  ▲ Recolher para Top 10
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* MOTIVOS DE PERDA DETALHADOS (COLUNA K) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-4">Principais Motivos de Perda (Coluna K)</h2>
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

      {/* NOVO BLOCO: DETALHAMENTO GERAL DE CONTAS / OPORTUNIDADES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">📋 Detalhamento Geral das Oportunidades</h2>
            <p className="text-xs text-slate-500 mt-0.5">Listagem completa das contas com histórico de datas, etapas e motivos de perda</p>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="text" 
              placeholder="Pesquisar por cliente, vendedor ou origem..."
              value={buscaDetalhamento}
              onChange={(e) => setBuscaDetalhamento(e.target.value)}
              className="p-2 border border-slate-300 rounded-xl text-xs w-64 shadow-sm"
            />
          </div>
        </div>

        {listaDetalhamento.length > 0 ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Cliente (Razão Social)</th>
                    <th className="p-3">Data de Criação</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Vendedor</th>
                    <th className="p-3">Etapa Atual</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Fechamento / Mudança Etapa</th>
                    <th className="p-3">Motivo de Perda (Coluna K)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listaDetalhamento.slice(0, detalhamentoLimit).map((deal, idx) => (
                    <tr key={deal.id || idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-800">{deal.cliente_razao_social}</td>
                      <td className="p-3 text-slate-500">
                        {deal.data_criacao ? new Date(deal.data_criacao).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-3 font-semibold text-slate-600">{deal.origem}</td>
                      <td className="p-3 font-semibold text-slate-700">{deal.vendedor}</td>
                      <td className="p-3 font-medium text-slate-700">{deal.etapa}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          deal.status === 'Ganho' ? 'bg-emerald-100 text-emerald-800' :
                          deal.status === 'Perdido' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {deal.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {deal.data_mudanca_etapa ? new Date(deal.data_mudanca_etapa).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-3 text-rose-700 font-medium">
                        {deal.motivo_perda || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação da Tabela de Detalhamento */}
            {listaDetalhamento.length > 10 && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400">
                  Exibindo {Math.min(detalhamentoLimit, listaDetalhamento.length)} de {listaDetalhamento.length} oportunidades
                </span>

                {detalhamentoLimit < listaDetalhamento.length ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetalhamentoLimit(prev => prev + 10)}
                      className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition"
                    >
                      + Mostrar mais 10
                    </button>
                    <button
                      onClick={() => setDetalhamentoLimit(listaDetalhamento.length)}
                      className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition"
                    >
                      Ver Todos ({listaDetalhamento.length})
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDetalhamentoLimit(10)}
                    className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition"
                  >
                    ▲ Recolher para Top 10
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
            Nenhuma oportunidade encontrada com o termo pesquisado.
          </div>
        )}
      </div>
    </div>
  )
}