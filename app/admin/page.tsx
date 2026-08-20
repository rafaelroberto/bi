'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = 'https://lqmuwffifroxlhqcogtt.supabase.co'
const supabaseAnonKey = 'sb_publishable_XfqKaavs6bpR9VDoot1XxA_kxeS46pk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const PUCA_API_KEY_SECRET = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzeXN0ZW1fdXNlciI6IjZjNDViMzAyLThmOTgtNDdkNS1iMDliLTI2MDM1YWQyZGE3MCIsInZlcnNpb24iOiIxIiwic2VlZCI6IjIwMjYtMDgtMjBUMTg6MDU6MzUuMTIzWiIsImlhdCI6MTc4NzI0OTEzNX0.NgXCbq9iLBUWVyY06d41BYaKKjWnoOjubbedFAgj-yExT3A26GzjklFkdmIljSELRzW-rtnnw3tNk4ev8ojrvlcIDfzQJeUmvFT_db-BI86noT_r2eaYG1NixMkLDN_-7QEBjwXi-jwUnmlzJMpdXk22CNer3OpJDdFQPCIOkr3XGWEVNh9WORL6To5pwbPlTuRKtqWF-fNrf52HLxlbOG1nNsHhfvksq03RiYCPnEXVkILSrQPOi7w_J_xFEk3Zjzi27bgLodxjjdON4PgupyiatSxB85MhTAkvpcTmpuXpaWQCbUEEaUaEJGvKxM9H9Ev1gEkNjeI4iy90RlUvW5guyH-YeiJ23iFf_L9kY42fyueJomC-s2m-uOpCZZOz9OhD0ru_IL5WIS3uHl-hzELr8zJP22LnjQg5g9F4x'

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

  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null)
  const [inputNovaSenha, setInputNovaSenha] = useState('')

  // Módulo Retrátil & Estado do Forecast
  const [forecastExpandido, setForecastExpandido] = useState(true)
  const [abaForecast, setAbaForecast] = useState<'incluidos' | 'buscar'>('incluidos')
  
  const [dealsList, setDealsList] = useState<any[]>([])
  const [forecastsMap, setForecastsMap] = useState<Record<string, any>>({})
  const [buscaClienteForecast, setBuscaClienteForecast] = useState('')
  const [savingForecastId, setSavingForecastId] = useState<string | null>(null)

  // Formulário de Cadastro de Usuário
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
      await fetchDealsAndForecasts()
      setLoading(false)
    }

    initAdmin()
  }, [])

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setProfiles(data)
  }

  async function fetchDealsAndForecasts() {
    const { data: dealsData } = await supabase.from('deals').select('*').order('cliente_razao_social', { ascending: true })
    const { data: forecastData } = await supabase.from('forecasts').select('*')

    if (dealsData) setDealsList(dealsData)

    const map: Record<string, any> = {}
    if (forecastData) {
      forecastData.forEach(f => {
        map[f.cliente_razao_social] = f
      })
    }
    setForecastsMap(map)
  }

  // ALTERAÇÃO DIRETA DE SENHA NO BANCO (SEM E-MAIL)
  async function handleSaveNewPasswordDirect(userId: string) {
    if (!inputNovaSenha || inputNovaSenha.length < 6) {
      alert('A nova senha deve possuir no mínimo 6 caracteres.')
      return
    }

    setLoading(true)

    // Tenta executar a função RPC criada no banco
    const { error } = await supabase.rpc('admin_update_user_password', {
      user_id: userId,
      new_password: inputNovaSenha
    })

    if (!error) {
      alert('Senha atualizada com sucesso no banco de dados!')
      setChangingPasswordUserId(null)
      setInputNovaSenha('')
    } else {
      alert('Erro ao atualizar senha no banco: ' + error.message)
    }

    setLoading(false)
  }

  // Sincronização Dinâmica da API do PUCA CRM
  async function handleSyncPucaApi() {
    setLoading(true)
    setStatusMsg('1/3 - Consultando o dicionário de tabelas e permissões do PUCA CRM...')

    try {
      const corsProxy = 'https://corsproxy.io/?'
      const token = PUCA_API_KEY_SECRET

      const specUrl = encodeURIComponent('https://lifeapps.puca.app/puca-crud-api/view/crud-especification')
      
      let tabelaAlvo = 'user_funil_venda'
      let tabelasEncontradas: string[] = []

      try {
        const specRes = await fetch(`${corsProxy}${specUrl}`, {
          method: 'GET',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        })

        if (specRes.ok) {
          const specData = await specRes.json()
          const viewsMap = specData.views || specData.data || specData
          
          if (typeof viewsMap === 'object') {
            tabelasEncontradas = Object.keys(viewsMap)
            const matchFunil = tabelasEncontradas.find(t => 
              t.includes('funil') || t.includes('venda') || t.includes('crm') || t.includes('deal')
            )
            if (matchFunil) {
              tabelaAlvo = matchFunil
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao consultar dicionário de views, prosseguindo com nome padrão...')
      }

      setStatusMsg(`2/3 - Consultando dados da view "${tabelaAlvo}"...`)

      const targetUrl = encodeURIComponent(`https://lifeapps.puca.app/puca-crud-api/user-table/${tabelaAlvo}/find`)

      const viewRes = await fetch(`${corsProxy}${targetUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: tabelaAlvo })
      })

      if (!viewRes.ok) {
        let msgAux = `Status ${viewRes.status}: Acesso negado para a tabela "${tabelaAlvo}".`
        if (tabelasEncontradas.length > 0) {
          msgAux += ` As tabelas liberadas para seu usuário atualmente são: ${tabelasEncontradas.join(', ')}.`
        } else {
          msgAux += ' Acesse Sys -> Integrações -> Robôs no PUCA e ative a caixa "Find/Consultar" para a tabela do funil.'
        }
        throw new Error(msgAux)
      }

      const rawData = await viewRes.json()
      const rows = rawData.data || rawData

      if (!Array.isArray(rows)) {
        throw new Error(`A tabela "${tabelaAlvo}" respondeu, mas não retornou uma lista de registros válidos.`)
      }

      setStatusMsg(`3/3 - Atualizando ${rows.length} oportunidades da tabela "${tabelaAlvo}" no Supabase...`)

      await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      const dealsToInsert = rows.map((item: any) => {
        const rawStatus = (item['Nome'] || item['etapa'] || item['status'] || '').toString().trim()
        let statusFinal = 'Aberto'
        if (rawStatus.toLowerCase() === 'ganho') statusFinal = 'Ganho'
        else if (rawStatus.toLowerCase() === 'perdido') statusFinal = 'Perdido'

        return {
          cliente_razao_social: item['Razão Social'] || item['Título'] || item['cliente'] || item['title'] || 'N/A',
          vendedor: item['Nome de Usuário'] || item['vendedor'] || item['user'] || 'Não Definido',
          origem: item['Indicação'] || item['origem'] || 'Outros',
          etapa: rawStatus || 'Inicial',
          status: statusFinal,
          motivo_perda: item['Nome.1'] || item['motivo_perda'] || null,
          data_criacao: item['Data de criação do registro'] ? parseBRDate(item['Data de criação do registro']) || new Date().toISOString() : new Date().toISOString(),
          data_mudanca_etapa: item['Data de entrada na etapa'] ? parseBRDate(item['Data de entrada na etapa']) : null,
        }
      })

      const { error: insertError } = await supabase.from('deals').insert(dealsToInsert)

      if (insertError) {
        throw new Error('Erro ao gravar dados no Supabase: ' + insertError.message)
      }

      await supabase.from('sheet_logs').insert({
        file_name: `API PUCA (${tabelaAlvo})`,
        total_records: dealsToInsert.length,
        updated_by: 'Admin'
      })

      setStatusMsg(`Sucesso! ${dealsToInsert.length} oportunidades sincronizadas da tabela "${tabelaAlvo}".`)
      await fetchDealsAndForecasts()

    } catch (err: any) {
      setStatusMsg('Aviso na Sincronização: ' + err.message)
    }

    setLoading(false)
  }

  async function handleSaveForecastItem(cliente: string, vendedor: string, dealId: string, etapa: string, setupVal: number, mrrVal: number, dataPrev: string, incluido: boolean) {
    setSavingForecastId(cliente)

    const payload = {
      cliente_razao_social: cliente,
      vendedor: vendedor || 'Não Definido',
      deal_id: dealId,
      valor_setup: setupVal || 0,
      valor_mrr: mrrVal || 0,
      data_previsao: dataPrev || null,
      incluido_forecast: incluido
    }

    const existing = forecastsMap[cliente]

    if (existing) {
      await supabase.from('forecasts').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('forecasts').insert([payload])
    }

    await fetchDealsAndForecasts()
    setSavingForecastId(null)
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
          await fetchDealsAndForecasts()
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
      await fetchDealsAndForecasts()
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

  const listaIncluidosForecast = Object.values(forecastsMap).filter(f => f.incluido_forecast === true)
  const etapasPermitidasForecast = ['demonstração', 'proposta', 'negociação', 'assinatura']

  const dealsPermitidosForecast = dealsList.filter(d => {
    const etapaLc = (d.etapa || '').toString().toLowerCase()
    const estaNaEtapaValida = etapasPermitidasForecast.some(e => etapaLc.includes(e))
    const matchBusca = (d.cliente_razao_social || '').toLowerCase().includes(buscaClienteForecast.toLowerCase()) ||
                       (d.vendedor || '').toLowerCase().includes(buscaClienteForecast.toLowerCase())
    return estaNaEtapaValida && matchBusca
  })

  if (loading) {
    return <div className="p-8 text-center text-slate-600 font-sans">Carregando Painel Administrativo...</div>
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Painel Administrativo - B.I. RMR</h1>
          <p className="text-xs text-slate-500 font-medium">Gestão de Base de Dados, Controle de Usuários e Projeção de Forecast</p>
        </div>
        
        <a href="/bi/" className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl transition shadow-sm">
          ← Voltar ao Dashboard
        </a>
      </div>

      {/* Gestão da Base de Dados */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-1">Gestão da Base de Dados (API PUCA CRM)</h2>
        <p className="text-xs text-slate-500 mb-4">Sincronize a base de dados via API oficial do PUCA CRM ou faça upload de planilha Excel.</p>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleSyncPucaApi}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm shadow-sm flex items-center gap-2"
          >
            🔄 Sincronizar via API PUCA CRM
          </button>

          <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition text-sm shadow-sm flex items-center">
            Enviar Planilha Manual (XLS, XLSX)
            <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFileUpload} className="hidden" disabled={loading} />
          </label>

          <button 
            onClick={handleClearDatabase}
            disabled={loading}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-4 py-2.5 rounded-xl transition text-sm border border-rose-200"
          >
            Apagar Banco
          </button>
        </div>

        {statusMsg && <p className="mt-4 text-xs font-bold text-slate-700 bg-slate-100 p-3 rounded-lg">{statusMsg}</p>}
      </div>

      {/* Módulo Retrátil do Forecast */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-8 overflow-hidden transition">
        <div 
          onClick={() => setForecastExpandido(!forecastExpandido)}
          className="p-5 bg-slate-900 text-white flex justify-between items-center cursor-pointer select-none hover:bg-slate-800 transition"
        >
          <div>
            <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <span>📊 Montar Forecast Comercial do Mês</span>
              <span className="bg-blue-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                {listaIncluidosForecast.length} contas no Forecast
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Apenas contas em Demonstração, Proposta, Negociação e Assinatura</p>
          </div>

          <div className="text-xs font-bold bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700">
            {forecastExpandido ? '▲ Recolher Painel' : '▼ Expandir Painel'}
          </div>
        </div>

        {forecastExpandido && (
          <div className="p-6">
            <div className="flex gap-3 mb-6 border-b border-slate-200 pb-3">
              <button 
                onClick={() => setAbaForecast('incluidos')}
                className={`text-xs font-extrabold px-4 py-2 rounded-xl transition ${
                  abaForecast === 'incluidos' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                1. Contas Selecionadas no Forecast ({listaIncluidosForecast.length})
              </button>

              <button 
                onClick={() => setAbaForecast('buscar')}
                className={`text-xs font-extrabold px-4 py-2 rounded-xl transition ${
                  abaForecast === 'buscar' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                2. Buscar Oportunidades Válidas ({dealsPermitidosForecast.length})
              </button>
            </div>

            {abaForecast === 'incluidos' && (
              <div>
                {listaIncluidosForecast.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase">
                          <th className="p-2.5 text-center">Desmarcar / Manter</th>
                          <th className="p-2.5">Cliente (Razão Social)</th>
                          <th className="p-2.5">Vendedor</th>
                          <th className="p-2.5">Valor Setup (R$)</th>
                          <th className="p-2.5">Valor MRR (R$)</th>
                          <th className="p-2.5">Previsão Fechamento</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {listaIncluidosForecast.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 text-center">
                              <input 
                                type="checkbox"
                                checked={f.incluido_forecast}
                                onChange={(e) => handleSaveForecastItem(
                                  f.cliente_razao_social, 
                                  f.vendedor, 
                                  f.deal_id, 
                                  f.etapa || '',
                                  f.valor_setup || 0, 
                                  f.valor_mrr || 0, 
                                  f.data_previsao || '', 
                                  e.target.checked
                                )}
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">{f.cliente_razao_social}</td>
                            <td className="p-2.5 text-slate-600">{f.vendedor}</td>
                            <td className="p-2.5">
                              <input 
                                type="number"
                                placeholder="0,00"
                                defaultValue={f.valor_setup || ''}
                                onBlur={(e) => handleSaveForecastItem(
                                  f.cliente_razao_social, 
                                  f.vendedor, 
                                  f.deal_id, 
                                  f.etapa || '',
                                  parseFloat(e.target.value) || 0, 
                                  f.valor_mrr || 0, 
                                  f.data_previsao || '', 
                                  f.incluido_forecast
                                )}
                                className="w-24 p-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                              />
                            </td>
                            <td className="p-2.5">
                              <input 
                                type="number"
                                placeholder="0,00"
                                defaultValue={f.valor_mrr || ''}
                                onBlur={(e) => handleSaveForecastItem(
                                  f.cliente_razao_social, 
                                  f.vendedor, 
                                  f.deal_id, 
                                  f.etapa || '',
                                  f.valor_setup || 0, 
                                  parseFloat(e.target.value) || 0, 
                                  f.data_previsao || '', 
                                  f.incluido_forecast
                                )}
                                className="w-24 p-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                              />
                            </td>
                            <td className="p-2.5">
                              <input 
                                type="date"
                                defaultValue={f.data_previsao || ''}
                                onChange={(e) => handleSaveForecastItem(
                                  f.cliente_razao_social, 
                                  f.vendedor, 
                                  f.deal_id, 
                                  f.etapa || '',
                                  f.valor_setup || 0, 
                                  f.valor_mrr || 0, 
                                  e.target.value, 
                                  f.incluido_forecast
                                )}
                                className="p-1.5 border border-slate-200 rounded-lg text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              {savingForecastId === f.cliente_razao_social ? (
                                <span className="text-[10px] text-blue-600 font-bold">Salvando...</span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">No Forecast</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    Nenhuma conta no Forecast ainda. Vá para a aba <strong>"2. Buscar Oportunidades Válidas"</strong> para adicionar.
                  </div>
                )}
              </div>
            )}

            {abaForecast === 'buscar' && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Filtrar oportunidade por nome de conta ou vendedor..."
                    value={buscaClienteForecast}
                    onChange={(e) => setBuscaClienteForecast(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase sticky top-0 bg-slate-50">
                        <th className="p-2.5 text-center">Incluir</th>
                        <th className="p-2.5">Cliente (Razão Social)</th>
                        <th className="p-2.5">Etapa Atual</th>
                        <th className="p-2.5">Vendedor</th>
                        <th className="p-2.5">Setup (R$)</th>
                        <th className="p-2.5">MRR (R$)</th>
                        <th className="p-2.5">Previsão Fechamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dealsPermitidosForecast.map((deal) => {
                        const forecastObj = forecastsMap[deal.cliente_razao_social] || {}
                        const isIncluido = forecastObj.incluido_forecast ?? false

                        return (
                          <tr key={deal.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 text-center">
                              <input 
                                type="checkbox"
                                checked={isIncluido}
                                onChange={(e) => handleSaveForecastItem(
                                  deal.cliente_razao_social, 
                                  deal.vendedor, 
                                  deal.id, 
                                  deal.etapa,
                                  forecastObj.valor_setup || 0, 
                                  forecastObj.valor_mrr || 0, 
                                  forecastObj.data_previsao || '', 
                                  e.target.checked
                                )}
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">{deal.cliente_razao_social}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                                {deal.etapa}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600">{deal.vendedor}</td>
                            <td className="p-2.5">
                              <input 
                                type="number"
                                placeholder="0,00"
                                defaultValue={forecastObj.valor_setup || ''}
                                onBlur={(e) => handleSaveForecastItem(
                                  deal.cliente_razao_social, 
                                  deal.vendedor, 
                                  deal.id, 
                                  deal.etapa,
                                  parseFloat(e.target.value) || 0, 
                                  forecastObj.valor_mrr || 0, 
                                  forecastObj.data_previsao || '', 
                                  isIncluido
                                )}
                                className="w-24 p-1.5 border border-slate-200 rounded-lg text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input 
                                type="number"
                                placeholder="0,00"
                                defaultValue={forecastObj.valor_mrr || ''}
                                onBlur={(e) => handleSaveForecastItem(
                                  deal.cliente_razao_social, 
                                  deal.vendedor, 
                                  deal.id, 
                                  deal.etapa,
                                  forecastObj.valor_setup || 0, 
                                  parseFloat(e.target.value) || 0, 
                                  forecastObj.data_previsao || '', 
                                  isIncluido
                                )}
                                className="w-24 p-1.5 border border-slate-200 rounded-lg text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input 
                                type="date"
                                defaultValue={forecastObj.data_previsao || ''}
                                onChange={(e) => handleSaveForecastItem(
                                  deal.cliente_razao_social, 
                                  deal.vendedor, 
                                  deal.id, 
                                  deal.etapa,
                                  forecastObj.valor_setup || 0, 
                                  forecastObj.valor_mrr || 0, 
                                  e.target.value, 
                                  isIncluido
                                )}
                                className="p-1.5 border border-slate-200 rounded-lg text-xs"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cadastro de Usuários */}
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

      {/* Tabela de Usuários */}
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
                    {changingPasswordUserId === p.id ? (
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                        <input 
                          type="password" 
                          placeholder="Nova senha" 
                          value={inputNovaSenha}
                          onChange={(e) => setInputNovaSenha(e.target.value)}
                          className="p-1 text-xs rounded border border-slate-300 w-28"
                        />
                        <button 
                          onClick={() => handleSaveNewPasswordDirect(p.id)}
                          className="text-xs bg-emerald-600 text-white font-bold px-2 py-1 rounded hover:bg-emerald-700 transition"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={() => { setChangingPasswordUserId(null); setInputNovaSenha(''); }}
                          className="text-xs text-slate-500 font-bold px-1 hover:text-slate-800"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setChangingPasswordUserId(p.id); setInputNovaSenha(''); }}
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-lg transition border border-amber-200"
                      >
                        Alterar Senha
                      </button>
                    )}

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