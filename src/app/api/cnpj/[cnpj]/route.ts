import { NextResponse } from 'next/server'

type NormalizedCnpjData = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  situacao: string | null
  abertura: string | null
  naturezaJuridica: string | null
  atividadePrincipal: string | null
  cnaePrincipal: string | null
  telefone: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  origem: 'brasilapi' | 'receitaws'
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function textOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeBrasilApi(data: Record<string, unknown>, cnpj: string): NormalizedCnpjData {
  const cnaePrincipal = Array.isArray(data.cnaes_secundarios) ? null : textOrNull(data.cnae_fiscal)?.replace(/\D/g, '') || null
  return {
    cnpj,
    razaoSocial: textOrNull(data.razao_social) || textOrNull(data.nome) || '',
    nomeFantasia: textOrNull(data.nome_fantasia),
    situacao: textOrNull(data.descricao_situacao_cadastral),
    abertura: textOrNull(data.data_inicio_atividade),
    naturezaJuridica: textOrNull(data.natureza_juridica),
    atividadePrincipal: textOrNull(data.cnae_fiscal_descricao),
    cnaePrincipal,
    telefone: [textOrNull(data.ddd_telefone_1), textOrNull(data.ddd_telefone_2)].filter(Boolean).join(' / ') || null,
    email: textOrNull(data.email),
    cep: textOrNull(data.cep),
    logradouro: textOrNull(data.logradouro),
    numero: textOrNull(data.numero),
    complemento: textOrNull(data.complemento),
    bairro: textOrNull(data.bairro),
    municipio: textOrNull(data.municipio),
    uf: textOrNull(data.uf),
    origem: 'brasilapi',
  }
}

function normalizeReceitaWs(data: Record<string, unknown>, cnpj: string): NormalizedCnpjData {
  const atividade = Array.isArray(data.atividade_principal) ? data.atividade_principal[0] as Record<string, unknown> | undefined : undefined
  return {
    cnpj,
    razaoSocial: textOrNull(data.nome) || '',
    nomeFantasia: textOrNull(data.fantasia),
    situacao: textOrNull(data.situacao),
    abertura: textOrNull(data.abertura),
    naturezaJuridica: textOrNull(data.natureza_juridica),
    atividadePrincipal: textOrNull(atividade?.text),
    cnaePrincipal: textOrNull(atividade?.code),
    telefone: textOrNull(data.telefone),
    email: textOrNull(data.email),
    cep: textOrNull(data.cep),
    logradouro: textOrNull(data.logradouro),
    numero: textOrNull(data.numero),
    complemento: textOrNull(data.complemento),
    bairro: textOrNull(data.bairro),
    municipio: textOrNull(data.municipio),
    uf: textOrNull(data.uf),
    origem: 'receitaws',
  }
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 * 60 * 24 * 7 },
  })
  if (!response.ok) return null
  return await response.json() as Record<string, unknown>
}

export async function GET(_request: Request, context: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: rawCnpj } = await context.params
  const cnpj = onlyDigits(rawCnpj || '')

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ invalido. Informe 14 digitos.' }, { status: 400 })
  }

  const brasilApi = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
  if (brasilApi) {
    const normalized = normalizeBrasilApi(brasilApi, cnpj)
    if (normalized.razaoSocial) return NextResponse.json(normalized)
  }

  const receitaWs = await fetchJson(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`)
  if (receitaWs && receitaWs.status !== 'ERROR') {
    const normalized = normalizeReceitaWs(receitaWs, cnpj)
    if (normalized.razaoSocial) return NextResponse.json(normalized)
  }

  return NextResponse.json({ error: 'CNPJ nao encontrado.' }, { status: 404 })
}
