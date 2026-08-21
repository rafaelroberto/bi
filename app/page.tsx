'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import RGL, { WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ReactGridLayout = WidthProvider(RGL)

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

const defaultLayout = [
  { i: 'card-forecast', x: 0, y: 0, w: 12, h: 6 },
  { i: 'card-evolucao', x: 0, y: 6, w: 6, h: 7 },
  { i: 'card-funil', x: 6, y: 6, w: 6, h: 7 },
  { i: 'card-vendedores', x: 0, y: 13, w: 6, h: 7 },
  { i: 'card-origens', x: 6, y: 13, w: 6, h: 7 },
  { i: 'card-motivos', x: 0, y: 20, w: 12, h: 6 },
  { i: 'card-detalhamento', x: 0, y: 26, w: 12, h: 8 },
]

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<any[]>([])
  const [forecasts, setForecasts] = useState<any[]>([])

  const [layout, setLayout] = useState<any[]>(defaultLayout)
  const [isEditMode, setIsEditMode] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)

  const [periodFilter, setPeriodFilter] = useState('este_ano')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([])
  const [selectedOrigens, setSelectedOrigens] = useState<string[]>([])
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([])

  const [statusFilterKpi, setStatusFilterKpi] = useState<string | null>(null)

  const [origensLimit, setOrigensLimit] = useState<number>(10)
  const [detalhamentoLimit, setDetalhamentoLimit] = useState<number>(10)
  const [buscaDetalhamento, setBuscaDetalhamento] = useState('')

  const [vendedorSortField, setVendedorSortField] = useState<string>('criadas')
  const [vendedorSortDir, setVendedorSortDir] = useState<'asc' | 'desc'>('desc')

  const [origemSortField, setOrigemSortField] = useState<string>('criadas')
  const [origemSortDir, setOrigemSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    async function loadData() {
      const { data: dealsData } = await supabase.from('deals').select('*')
      const { data: forecastsData } = await supabase.from('forecasts').select('*')
      const { data: layoutData } = await supabase.from('dashboard_layouts').select('layout_data').limit(1).single()

      if (dealsData) {
        const dealsNormalizados = dealsData.map(d => ({
          ...d,
          vendedor: normalizeName(d.vendedor),
          origem: normalizeName(d.origem),
          motivo_perda: d.motivo_perda || d['Nome.1'] || d['Motivo de Perda'] || d.motivo || null
        }))
        setDeals(dealsNormalizados)
      }

      if (forecastsData) setForecasts(forecastsData)
      if (layoutData && layoutData.layout_data) {
        setLayout(layoutData.layout_data)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  // Função de Sair / Logoff
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/bi/login'
  }

  async function handleSaveLayout() {
    setSavingLayout(true)
    const { error } = await supabase
      .from('dashboard_layouts')
      .upsert({ layout_data: layout }, { onConflict: 'id' })

    if (!error) {
      alert('Layout salvo com sucesso!')
      setIsEditMode(false)
    } else {
      alert('Erro ao salvar layout: ' + error.message)
    }
    setSavingLayout(false)
  }

  function isDateInSelectedPeriod(dateStr: string | null, filter: string, start?: string, end?: string) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const now = new Date()

    if (filter === 'este_ano') return d.getFullYear() === now.getFullYear()
    if (filter === 'este_mes') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
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

  const listaVendedores = Array.from(new Set(deals.map(d => d.vendedor))).filter(Boolean).sort()
  const listaOrigens = Array.from(new Set(deals.map(d => d.origem))).filter(Boolean).sort()
  const listaEtapas = Array.from(new Set(deals.map(d => d.etapa))).filter(Boolean).sort()

  const dealsFiltrados = deals.filter(d => {
    const matchVendedor = selectedVendedores.length === 0 || selectedVendedores.includes(d.vendedor)
    const matchOrigem = selectedOrigens.length === 0 || selectedOrigens.includes(d.origem)
    const matchEtapa = selectedEtapas.length === 0 || selectedEtapas.includes(d.etapa)
    const matchStatus = statusFilterKpi === null || d.status === statusFilterKpi

    return matchVendedor && matchOrigem && matchEtapa && matchStatus
  })

  const dealsCriadosNoPeriodo = dealsFiltrados.filter(d => 
    isDateInSelectedPeriod(d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  const dealsGanhosNoPeriodo = dealsFiltrados.filter(d => 
    d.status === 'Ganho' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  const dealsPerdidosNoPeriodo = dealsFiltrados.filter(d => 
    d.status === 'Perdido' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  const dealsAbertosNoPeriodo = dealsCriadosNoPeriodo.filter(d => d.status === 'Aberto')

  const dealsCriadosEFechadosMesmaSafra = dealsCriadosNoPeriodo.filter(d => 
    d.status === 'Ganho' && 
    isDateInSelectedPeriod(d.data_mudanca_etapa || d.data_criacao, periodFilter, customStartDate, customEndDate)
  )

  const totalCriadas = dealsCriadosNoPeriodo.length
  const totalConvertidasMesmaSafra = dealsCriadosEFechadosMesmaSafra.length

  const taxaConversao = totalCriadas > 0 
    ? ((totalConvertidasMesmaSafra / totalCriadas) * 100).toFixed(1) 
    : '0.0'

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

  const forecastIncluidos = forecasts.filter(f => Boolean(f.incluido_forecast))
  const totalSetupForecast = forecastIncluidos.reduce((acc, f) => acc + Number(f.valor_setup || 0), 0)
  const totalMrrForecast = forecastIncluidos.reduce((acc, f) => acc + Number(f.valor_mrr || 0), 0)

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

  const porMotivoPerda = dealsPerdidosNoPeriodo.reduce((acc: any, d) => {
    const m = d.motivo_perda ? normalizeName(d.motivo_perda) : 'Não Informado'
    acc[m] = (acc[m] || 0) + 1
    return acc
  }, {})

  const listaDetalhamento = dealsFiltrados.filter(d => {
    const matchBusca = (d.cliente_razao_social || '').toLowerCase().includes(buscaDetalhamento.toLowerCase()) ||
                       (d.vendedor || '').toLowerCase().includes(buscaDetalhamento.toLowerCase()) ||
                       (d.origem || '').toLowerCase().includes(buscaDetalhamento.toLowerCase())
    return matchBusca
  })

  const handleVendedorSort = (field: string) => {
    if (vendedorSortField === field) setVendedorSortDir(vendedorSortDir === 'asc' ? 'desc' : 'asc')
    else { setVendedorSortField(field); setVendedorSortDir('desc') }
  }

  const handleOrigemSort = (field: string) => {
    if (origemSortField === field) setOrigemSortDir(origemSortDir === 'asc' ? 'desc' : 'asc')
    else { setOrigemSortField(field); setOrigemSortDir('desc') }
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

        <div className="flex gap-2 items-center">
          {isEditMode ? (
            <button
              onClick={handleSaveLayout}
              disabled={savingLayout}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm"
            >
              {savingLayout ? 'Salvando...' : '💾 Salvar Layout'}
            </button>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-xl transition shadow-sm"
            >
              ✏️ Customizar Layout
            </button>
          )}

          <a href="/bi/admin" className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl transition shadow-sm">
            ⚙️ Painel Admin
          </a>

          {/* Botão Sair / Logoff */}
          <button
            onClick={handleLogout}
            className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-4 py-2 rounded-xl transition border border-rose-200 shadow-sm"
          >
            🚪 Sair
          </button>
        </div>
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

        <MultiSelectDropdown label="Vendedor" options={listaVendedores} selectedValues={selectedVendedores} onChange={setSelectedVendedores} />
        <MultiSelectDropdown label="Origem" options={listaOrigens} selectedValues={selectedOrigens} onChange={setSelectedOrigens} />
        <MultiSelectDropdown label="Etapa" options={listaEtapas} selectedValues={selectedEtapas} onChange={setSelectedEtapas} />

        {statusFilterKpi && (
          <button onClick={() => setStatusFilterKpi(null)} className="mt-4 text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200">
            ✕ Limpar Filtro ({statusFilterKpi})
          </button>
        )}
      </div>

      {/* Cards de KPIs Clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div onClick={() => toggleStatusKpi(null)} className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${statusFilterKpi === null ? 'bg-white border-slate-400 ring-2 ring-slate-900/10' : 'bg-white/60 border-slate-200'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Criadas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{dealsCriadosNoPeriodo.length}</p>
        </div>

        <div onClick={() => toggleStatusKpi('Ganho')} className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${statusFilterKpi === 'Ganho' ? 'bg-emerald-100 border-emerald-500' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Ganhos</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{dealsGanhosNoPeriodo.length}</p>
        </div>

        <div onClick={() => toggleStatusKpi('Perdido')} className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${statusFilterKpi === 'Perdido' ? 'bg-rose-100 border-rose-500' : 'bg-rose-50/50 border-rose-100'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Perdidos</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{dealsPerdidosNoPeriodo.length}</p>
        </div>

        <div onClick={() => toggleStatusKpi('Aberto')} className={`p-5 rounded-2xl border transition cursor-pointer select-none shadow-sm ${statusFilterKpi === 'Aberto' ? 'bg-amber-100 border-amber-500' : 'bg-amber-50/50 border-amber-100'}`}>
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

      {/* Grid Interativo Arrastável dos Cards */}
      <ReactGridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={60}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={(newLayout) => setLayout(newLayout)}
      >
        <div key="card-forecast" className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex flex-col justify-between">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-4 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <span>📊 Projeção do Forecast Comercial do Mês</span>
                <span className="bg-blue-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                  {forecastIncluidos.length} Selecionadas
                </span>
              </h2>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Setup</p>
                <p className="text-sm font-black text-emerald-400">R$ {totalSetupForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase">MRR</p>
                <p className="text-sm font-black text-blue-400">R$ {totalMrrForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            {forecastIncluidos.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th className="p-2">Cliente</th>
                    <th className="p-2">Vendedor</th>
                    <th className="p-2 text-right">Setup (R$)</th>
                    <th className="p-2 text-right">MRR (R$)</th>
                    <th className="p-2 text-center">Previsão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {forecastIncluidos.map((f) => (
                    <tr key={f.id || f.cliente_razao_social}>
                      <td className="p-2 font-bold text-slate-200">{f.cliente_razao_social}</td>
                      <td className="p-2 text-slate-400">{f.vendedor}</td>
                      <td className="p-2 text-right font-bold text-emerald-400">R$ {Number(f.valor_setup || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-bold text-blue-400">R$ {Number(f.valor_mrr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-center text-slate-300">{f.data_previsao ? new Date(f.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-4 text-slate-400 text-xs">Nenhum item no Forecast.</p>
            )}
          </div>
        </div>

        <div key="card-evolucao" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h2 className="text-base font-bold text-slate-800 mb-4">Evolução Mensal (Criadas vs Ganhos)</h2>
          <div className="h-40 flex items-end justify-between gap-2 pt-2 border-b border-slate-100 pb-2">
            {evolucaoMensal.map((item) => {
              const heightCriadas = (item.criadas / maxEvolucao) * 100
              const heightGanhos = (item.ganhos / maxEvolucao) * 100
              return (
                <div key={item.mes} className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="w-full flex justify-center items-end gap-1 h-full">
                    <div style={{ height: `${heightCriadas}%` }} className="w-2 bg-blue-500 rounded-t-sm"></div>
                    <div style={{ height: `${heightGanhos}%` }} className="w-2 bg-emerald-500 rounded-t-sm"></div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 mt-1">{item.mes}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div key="card-funil" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h2 className="text-base font-bold text-slate-800 mb-4">Funil de Vendas por Etapa</h2>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {Object.entries(porEtapa).sort((a: any, b: any) => b[1] - a[1]).map(([etapa, count]: any) => {
              const pct = totalCriadas > 0 ? ((count / totalCriadas) * 100).toFixed(0) : 0
              return (
                <div key={etapa}>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>{etapa}</span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-xl overflow-hidden p-0.5">
                    <div className="bg-blue-600 h-full rounded-lg" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div key="card-vendedores" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h2 className="text-base font-bold text-slate-800 mb-4">Desempenho por Vendedor</h2>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                  <th onClick={() => handleVendedorSort('nome')} className="p-2 cursor-pointer">Vendedor</th>
                  <th onClick={() => handleVendedorSort('criadas')} className="p-2 text-center cursor-pointer">Criadas</th>
                  <th onClick={() => handleVendedorSort('ganhos')} className="p-2 text-center cursor-pointer">Ganhos</th>
                  <th onClick={() => handleVendedorSort('conversao')} className="p-2 text-center cursor-pointer">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaVendedoresOrdenados.map((val: any) => {
                  const convVend = val.criadas > 0 ? ((val.ganhos / val.criadas) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={val.nome}>
                      <td className="p-2 font-bold text-slate-800">{val.nome}</td>
                      <td className="p-2 text-center text-slate-600 font-bold">{val.criadas}</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">{val.ganhos}</td>
                      <td className="p-2 text-center font-extrabold text-blue-600">{convVend}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div key="card-origens" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h2 className="text-base font-bold text-slate-800 mb-4">Origem das Oportunidades</h2>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                  <th onClick={() => handleOrigemSort('nome')} className="p-2 cursor-pointer">Origem</th>
                  <th onClick={() => handleOrigemSort('criadas')} className="p-2 text-center cursor-pointer">Criadas</th>
                  <th onClick={() => handleOrigemSort('ganhos')} className="p-2 text-center cursor-pointer">Ganhos</th>
                  <th onClick={() => handleOrigemSort('conversao')} className="p-2 text-center cursor-pointer">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaOrigensOrdenadas.slice(0, origensLimit).map((val: any) => {
                  const convOrigem = val.criadas > 0 ? ((val.ganhos / val.criadas) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={val.nome}>
                      <td className="p-2 font-bold text-slate-800">{val.nome}</td>
                      <td className="p-2 text-center text-slate-600 font-bold">{val.criadas}</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">{val.ganhos}</td>
                      <td className="p-2 text-center font-extrabold text-blue-600">{convOrigem}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div key="card-motivos" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h2 className="text-base font-bold text-slate-800 mb-4">Principais Motivos de Perda (Coluna K)</h2>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {Object.entries(porMotivoPerda).sort((a: any, b: any) => b[1] - a[1]).map(([motivo, count]: any) => {
              const pct = dealsPerdidosNoPeriodo.length > 0 ? ((count / dealsPerdidosNoPeriodo.length) * 100).toFixed(0) : 0
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

        <div key="card-detalhamento" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-extrabold text-slate-900">📋 Detalhamento Geral das Oportunidades</h2>
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={buscaDetalhamento} 
              onChange={(e) => setBuscaDetalhamento(e.target.value)} 
              className="p-1.5 border border-slate-300 rounded-xl text-xs w-48"
            />
          </div>

          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase">
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Criação</th>
                  <th className="p-2">Origem</th>
                  <th className="p-2">Vendedor</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Motivo Perda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaDetalhamento.slice(0, detalhamentoLimit).map((deal, idx) => (
                  <tr key={deal.id || idx}>
                    <td className="p-2 font-bold text-slate-800">{deal.cliente_razao_social}</td>
                    <td className="p-2 text-slate-500">{deal.data_criacao ? new Date(deal.data_criacao).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-2 font-semibold text-slate-600">{deal.origem}</td>
                    <td className="p-2 font-semibold text-slate-700">{deal.vendedor}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${deal.status === 'Ganho' ? 'bg-emerald-100 text-emerald-800' : deal.status === 'Perdido' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                        {deal.status}
                      </span>
                    </td>
                    <td className="p-2 text-rose-700 font-medium">{deal.motivo_perda || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ReactGridLayout>
    </div>
  )
}