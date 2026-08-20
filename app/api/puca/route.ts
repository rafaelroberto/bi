import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.PUCA_BASE_URL || 'https://lifeapps.puca.app'
  const apiKey = process.env.PUCA_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'PUCA_API_KEY não configurada no servidor' }, { status: 500 })
  }

  try {
    // 1. Autenticação no PUCA
    const loginRes = await fetch(`${baseUrl}/puca-user/system_user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.5.0'
      },
      body: JSON.stringify({ api_key: apiKey }),
      cache: 'no-store'
    })

    if (!loginRes.ok) {
      return NextResponse.json({ error: 'Falha na autenticação com o PUCA' }, { status: 401 })
    }

    const loginData = await loginRes.json()
    const token = loginData.token || loginData.session_token || loginData.data?.token

    // 2. Consulta à View do Funil de Venda
    const viewRes = await fetch(`${baseUrl}/puca-crud-api/user-table/user_funil_venda/find`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.5.0'
      },
      body: JSON.stringify({
        from: 'user_funil_venda',
        fields: [
          'Chave Única',
          'Título',
          'Data de criação do registro',
          'Data de entrada na etapa',
          'Nome de Usuário',
          'Nome',
          'Indicação',
          'Razão Social',
          'Nome.1'
        ]
      }),
      cache: 'no-store'
    })

    if (!viewRes.ok) {
      return NextResponse.json({ error: 'Erro ao consultar view no PUCA' }, { status: 500 })
    }

    const rawData = await viewRes.json()
    const rows = rawData.data || rawData

    // 3. Tratamento dos dados para o formato do Dashboard
    const dealsFormatados = rows.map((item: any) => {
      const rawEtapaOuStatus = (item['Nome'] || '').toString().trim()
      let statusFinal = 'Aberto'
      if (rawEtapaOuStatus.toLowerCase() === 'ganho') statusFinal = 'Ganho'
      else if (rawEtapaOuStatus.toLowerCase() === 'perdido') statusFinal = 'Perdido'

      return {
        cliente_razao_social: item['Razão Social'] || item['Título'] || 'N/A',
        vendedor: item['Nome de Usuário'] || 'Não Definido',
        origem: item['Indicação'] || 'Outros',
        etapa: rawEtapaOuStatus || 'Inicial',
        status: statusFinal,
        motivo_perda: item['Nome.1'] || null,
        data_criacao: item['Data de criação do registro'] || new Date().toISOString(),
        data_mudanca_etapa: item['Data de entrada na etapa'] || null
      }
    })

    return NextResponse.json({ success: true, total: dealsFormatados.length, data: dealsFormatados })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}