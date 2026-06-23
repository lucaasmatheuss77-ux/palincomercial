'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Clock3,
  Copy,
  ExternalLink,
  Search,
  ShieldCheck,
  UsersRound,
  X,
  Upload,
  RefreshCcw,
  Video,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Phone,
  PhoneCall,
} from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import {
  activateContract,
  cancelContract,
  createClientRecord,
  renewContract,
  saveClientContract,
  updateClient,
  uploadContractPdfFromForm,
} from '@/app/actions/clientes'
import {
  listClientMeetings,
  createClientMeeting,
  deleteClientMeeting,
  type ClientMeeting,
} from '@/app/actions/reunioes'
import { createCallLog, type CallOutcome } from '@/app/actions/ligacoes'

export type ClientRow = {
  id: string
  clientRecordId: string
  leadId: string | null
  dealId: string | null
  contractId: string | null
  name: string
  company: string
  email: string
  phone: string
  whatsapp: string
  document: string
  product: string
  consultant: string
  sourceLabel: string
  clientStatusLabel: string
  contractStatusLabel: string
  contractNumber: string | null
  contractValue: number
  contractSignedAt: string | null
  contractValidUntil: string | null
  contractStartAt: string | null
  contractUpdatedAt: string | null
  contractNotes: string | null
  pdfName: string | null
  pdfPath: string | null
  pdfUrl: string | null
  pdfBucket: string | null
  pdfMimeType: string | null
  pdfUploadedAt: string | null
  pdfVersion: number | null
  signingUrl: string | null
  contractHistory: Array<{
    title: string
    detail: string
    date: string | null
    tone: 'info' | 'success' | 'warning' | 'muted'
  }>
  commercialHistory: Array<{
    title: string
    detail: string
    date: string | null
    tone: 'info' | 'success' | 'warning' | 'muted'
  }>
  createdAt: string | null
  updatedAt: string | null
}

type StatusTone = {
  color: string
  background: string
  border: string
}

const STATUS_TONES: Record<string, StatusTone> = {
  'Cliente criado': { color: '#93c5fd', background: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.22)' },
  'Contrato pendente': { color: 'var(--brand-primary)', background: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.22)' },
  'Contrato ativo': { color: '#86efac', background: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.22)' },
  'A vencer': { color: '#facc15', background: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.22)' },
  Vencido: { color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.22)' },
  'Contrato cancelado': { color: '#cbd5e1', background: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.22)' },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return 'Nao cadastrada'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Data invalida'
  return parsed.toLocaleDateString('pt-BR')
}

function formatAge(value: string | null) {
  if (!value) return 'Sem data'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Sem data'
  const days = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)))
  if (days < 1) return 'Hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

function getTone(status: string) {
  return STATUS_TONES[status] || STATUS_TONES['Cliente criado']
}

function buildCrmLeadHref(leadId: string | null) {
  if (!leadId) return '/dashboard/pipeline'
  return `/dashboard/pipeline?lead=${encodeURIComponent(leadId)}`
}


export default function ClientesClient({
  rows,
  products,
  profiles,
  initialSelectedClientId,
}: {
  rows: ClientRow[]
  products: Array<{ id: string; name: string | null }>
  profiles: Array<{ id: string; full_name: string | null }>
  initialSelectedClientId?: string | null
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedClientId && rows.some((row) => row.clientRecordId === initialSelectedClientId)
      ? initialSelectedClientId
      : null
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [contractForm, setContractForm] = useState({
    contractNumber: '',
    contractValue: '',
    startAt: '',
    signedAt: '',
    validUntil: '',
    notes: '',
    status: 'pendente_assinatura',
    signingUrl: '',
  })
  const [clientForm, setClientForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    whatsapp: '',
    document: '',
  })
  const [createForm, setCreateForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    whatsapp: '',
    document: '',
    crmStage: 'Contato Inicial',
    consultantId: '',
    productId: '',
  })
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [selectedPdfPreview, setSelectedPdfPreview] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // --- Reuniões ---
  const [meetings, setMeetings] = useState<ClientMeeting[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingFormOpen, setMeetingFormOpen] = useState(false)
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null)
  const [pautaLoading, setPautaLoading] = useState(false)
  const [meetingForm, setMeetingForm] = useState({
    meeting_date: new Date().toISOString().split('T')[0],
    title: '',
    recording_link: '',
    participants: '',
    duration_min: '',
    pauta: '',
    notes: '',
  })

  // --- Ligações GoTo ---
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [callPending, setCallPending] = useState(false)
  const [callForm, setCallForm] = useState({
    outcome: 'atendeu' as CallOutcome,
    durationMin: '',
    recordingUrl: '',
    notes: '',
  })

  const statusOptions = useMemo(() => ['Todos', ...Array.from(new Set(rows.map((row) => row.clientStatusLabel)))], [rows])
  const crmStageOptions = ['Contato Inicial', 'Qualificacao', 'Apresentacao', 'Proposta', 'Negociacao', 'Fechado', 'Perdido']

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        [row.name, row.company, row.consultant, row.product, row.contractNumber || '', row.email, row.phone, row.whatsapp]
          .join(' ')
          .toLowerCase()
          .includes(q)
      const matchesStatus = statusFilter === 'Todos' || row.clientStatusLabel === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, rows, statusFilter])

  const selectedRow = useMemo(
    () => (selectedId ? filteredRows.find((row) => row.id === selectedId) || rows.find((row) => row.id === selectedId) || null : null),
    [filteredRows, rows, selectedId]
  )

  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((row) => row.clientStatusLabel === 'Contrato ativo' || row.clientStatusLabel === 'A vencer').length
    const pending = rows.filter((row) => row.clientStatusLabel === 'Contrato pendente').length
    const expiring = rows.filter((row) => row.clientStatusLabel === 'A vencer').length
    const withoutPdf = rows.filter((row) => !row.pdfName && row.clientStatusLabel !== 'Cliente criado').length
    return { total, active, pending, expiring, withoutPdf }
  }, [rows])

  async function copyContact(row: ClientRow) {
    const contact = row.whatsapp || row.phone || row.email
    if (!contact) {
      toast.info('Nenhum contato cadastrado para copiar.')
      return
    }

    try {
      await navigator.clipboard.writeText(contact)
      toast.success('Contato copiado.')
    } catch {
      toast.error('Nao foi possivel copiar o contato.')
    }
  }

  async function handleCreateClient() {
    if (!createForm.name.trim()) {
      toast.error('Informe o nome do cliente.')
      return
    }

    startTransition(async () => {
      const result = await createClientRecord({
        name: createForm.name,
        company_name: createForm.company || null,
        email: createForm.email || null,
        phone: createForm.phone || null,
        whatsapp: createForm.whatsapp || null,
        documento: createForm.document || null,
        crm_stage: createForm.crmStage || null,
        consultor_responsavel_id: createForm.consultantId || null,
        produto_foco_id: createForm.productId || null,
      })

      if (!result.success) {
        toast.error('Erro ao criar cliente', { description: result.error })
        return
      }

      toast.success(result.leadId ? 'Cliente criado e enviado ao CRM.' : 'Cliente criado com sucesso.')
      setCreateOpen(false)
      setCreateForm({
        name: '',
        company: '',
        email: '',
        phone: '',
        whatsapp: '',
        document: '',
        crmStage: 'Contato Inicial',
        consultantId: '',
        productId: '',
      })
      router.refresh()
    })
  }

  const selectedTone = selectedRow ? getTone(selectedRow.clientStatusLabel) : STATUS_TONES['Cliente criado']

  useEffect(() => {
    if (!selectedRow) return

    setContractForm({
      contractNumber: selectedRow.contractNumber || '',
      contractValue: selectedRow.contractValue ? String(selectedRow.contractValue) : '',
      startAt: selectedRow.contractStartAt ? selectedRow.contractStartAt.slice(0, 10) : '',
      signedAt: selectedRow.contractSignedAt ? selectedRow.contractSignedAt.slice(0, 10) : '',
      validUntil: selectedRow.contractValidUntil ? selectedRow.contractValidUntil.slice(0, 10) : '',
      notes: selectedRow.contractNotes || '',
      status:
        selectedRow.clientStatusLabel === 'Contrato ativo' || selectedRow.clientStatusLabel === 'A vencer'
          ? 'ativo'
          : selectedRow.clientStatusLabel === 'Contrato cancelado'
            ? 'cancelado'
            : selectedRow.clientStatusLabel === 'Vencido'
              ? 'vencido'
              : 'pendente_assinatura',
      signingUrl: selectedRow.signingUrl || '',
    })
    setClientForm({
      name: selectedRow.name || '',
      company: selectedRow.company || '',
      email: selectedRow.email || '',
      phone: selectedRow.phone || '',
      whatsapp: selectedRow.whatsapp || '',
      document: selectedRow.document || '',
    })
    setSelectedPdfFile(null)
    setSelectedPdfPreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [selectedRow])

  function setFormField<K extends keyof typeof contractForm>(field: K, value: (typeof contractForm)[K]) {
    setContractForm((current) => ({ ...current, [field]: value }))
  }

  function setClientField<K extends keyof typeof clientForm>(field: K, value: (typeof clientForm)[K]) {
    setClientForm((current) => ({ ...current, [field]: value }))
  }

  // Carregar reuniões ao trocar de cliente
  useEffect(() => {
    if (!selectedRow?.clientRecordId) {
      setMeetings([])
      return
    }
    setMeetingsLoading(true)
    listClientMeetings(selectedRow.clientRecordId)
      .then((result) => setMeetings(result.data))
      .catch(() => setMeetings([]))
      .finally(() => setMeetingsLoading(false))
    setMeetingFormOpen(false)
    setExpandedMeetingId(null)
    setMeetingForm({
      meeting_date: new Date().toISOString().split('T')[0],
      title: '',
      recording_link: '',
      participants: '',
      duration_min: '',
      pauta: '',
      notes: '',
    })
  }, [selectedRow?.clientRecordId])

  async function handleGeneratePauta() {
    if (!meetingForm.recording_link.trim() && !selectedRow?.name) {
      toast.error('Informe o link da gravacao ou o nome do cliente.')
      return
    }
    setPautaLoading(true)
    try {
      const response = await fetch('/api/assistant/pauta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: selectedRow?.name || 'Cliente',
          recordingLink: meetingForm.recording_link || '',
          additionalContext: meetingForm.notes || '',
        }),
      })
      const data = await response.json() as { pauta?: string; error?: string }
      if (!response.ok || data.error) {
        toast.error(data.error || 'Erro ao gerar pauta.')
        return
      }
      setMeetingForm((current) => ({ ...current, pauta: data.pauta || '' }))
      toast.success('Pauta gerada pela IA. Revise antes de salvar.')
    } catch {
      toast.error('Falha ao conectar com a IA.')
    } finally {
      setPautaLoading(false)
    }
  }

  function handleSaveMeeting() {
    if (!selectedRow?.clientRecordId) return
    if (!meetingForm.title.trim()) { toast.error('Informe o titulo da reuniao.'); return }
    if (!meetingForm.meeting_date) { toast.error('Informe a data da reuniao.'); return }

    startTransition(async () => {
      const result = await createClientMeeting(selectedRow.clientRecordId, {
        meeting_date: meetingForm.meeting_date,
        title: meetingForm.title.trim(),
        recording_link: meetingForm.recording_link.trim() || null,
        pauta: meetingForm.pauta.trim() || null,
        notes: meetingForm.notes.trim() || null,
        participants: meetingForm.participants.trim() || null,
        duration_min: meetingForm.duration_min ? Number(meetingForm.duration_min) : null,
        ai_generated: meetingForm.pauta.length > 0 && pautaLoading === false,
      })
      if (!result.success) {
        toast.error(result.error || 'Erro ao salvar reuniao.')
        return
      }
      toast.success('Reuniao registrada.')
      setMeetingFormOpen(false)
      setMeetingForm({
        meeting_date: new Date().toISOString().split('T')[0],
        title: '',
        recording_link: '',
        participants: '',
        duration_min: '',
        pauta: '',
        notes: '',
      })
      const updated = await listClientMeetings(selectedRow.clientRecordId)
      setMeetings(updated.data)
    })
  }

  function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Tem certeza que deseja excluir esta reuniao?')) return
    startTransition(async () => {
      const result = await deleteClientMeeting(meetingId)
      if (!result.success) {
        toast.error(result.error || 'Erro ao excluir reuniao.')
        return
      }
      toast.success('Reuniao excluida.')
      if (selectedRow?.clientRecordId) {
        const updated = await listClientMeetings(selectedRow.clientRecordId)
        setMeetings(updated.data)
      }
    })
  }

  async function handleLogCall() {
    if (!selectedRow) return
    setCallPending(true)
    try {
      const phone = selectedRow.phone || selectedRow.whatsapp || undefined
      const result = await createCallLog({
        leadId: selectedRow.leadId ?? null,
        clientId: selectedRow.clientRecordId,
        phone,
        callType: 'goto_connect',
        outcome: callForm.outcome,
        durationMin: callForm.durationMin ? Number(callForm.durationMin) : null,
        recordingUrl: callForm.recordingUrl.trim() || null,
        notes: callForm.notes.trim() || null,
      })
      if (!result.success) {
        toast.error(result.error || 'Erro ao registrar ligacao.')
        return
      }
      toast.success('Ligacao registrada com sucesso.')
      setCallModalOpen(false)
      setCallForm({ outcome: 'atendeu', durationMin: '', recordingUrl: '', notes: '' })
    } finally {
      setCallPending(false)
    }
  }

  useEffect(() => {
    if (!selectedPdfFile) {
      setSelectedPdfPreview('')
      return
    }

    const previewUrl = URL.createObjectURL(selectedPdfFile)
    setSelectedPdfPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedPdfFile])

  function handleSaveContract() {
    if (!selectedRow?.dealId) {
      toast.error('Feche o lead no fluxo comercial para gerar um deal antes de salvar o contrato.')
      return
    }

    startTransition(async () => {
      const result = await saveClientContract({
        deal_id: selectedRow.dealId,
        lead_id: selectedRow.leadId,
        client_id: selectedRow.clientRecordId,
        contract_number: contractForm.contractNumber || null,
        value: Number(contractForm.contractValue || 0),
        start_at: contractForm.startAt ? new Date(contractForm.startAt).toISOString() : null,
        signed_at: contractForm.signedAt ? new Date(contractForm.signedAt).toISOString() : null,
        end_at: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : null,
        notes: contractForm.notes || null,
        status: contractForm.status,
        signing_url: contractForm.signingUrl.trim() || null,
      })

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel salvar o contrato.')
        return
      }

      toast.success('Contrato atualizado. Reabra a tela para ver os dados consolidados.')
    })
  }

  function handleUploadPdf() {
    const contractId = selectedRow?.contractId
    if (!contractId) {
      toast.error('Salve o contrato antes de enviar o PDF.')
      return
    }

    if (!selectedPdfFile) {
      toast.error('Escolha um arquivo PDF para upload.')
      return
    }

    if (selectedPdfFile.type && selectedPdfFile.type !== 'application/pdf') {
      toast.error('Envie somente arquivos PDF.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('contract_id', contractId)
      formData.append('bucket', selectedRow.pdfBucket || 'contract-pdfs')
      formData.append('file', selectedPdfFile)

      const result = await uploadContractPdfFromForm(formData)

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel enviar o PDF.')
        return
      }

      setSelectedPdfFile(null)
      setSelectedPdfPreview('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast.success('PDF do contrato enviado com sucesso.')
    })
  }

  function handleSaveClient() {
    if (!selectedRow?.clientRecordId) {
      toast.error('Cliente nao encontrado para atualizacao.')
      return
    }

    startTransition(async () => {
      const result = await updateClient(selectedRow.clientRecordId, {
        name: clientForm.name || undefined,
        company_name: clientForm.company || null,
        email: clientForm.email || null,
        phone: clientForm.phone || null,
        whatsapp: clientForm.whatsapp || null,
        documento: clientForm.document || null,
      })

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel salvar o cliente.')
        return
      }

      toast.success('Cadastro do cliente atualizado. Reabra a tela para ver os dados consolidados.')
    })
  }

  function handleActivateContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) {
      toast.error('Salve o contrato primeiro para depois ativar.')
      return
    }

    startTransition(async () => {
      const result = await activateContract(contractId, {
        signed_at: contractForm.signedAt ? new Date(contractForm.signedAt).toISOString() : undefined,
        end_at: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : undefined,
        notes: contractForm.notes || undefined,
      })

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel ativar o contrato.')
        return
      }

      toast.success('Contrato ativado. Reabra a tela para ver o status atualizado.')
    })
  }

  function handleCancelContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) {
      toast.error('Nao existe contrato para cancelar.')
      return
    }

    startTransition(async () => {
      const result = await cancelContract(contractId, contractForm.notes || undefined)

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel cancelar o contrato.')
        return
      }

      toast.success('Contrato cancelado. Reabra a tela para ver o status atualizado.')
    })
  }

  function handleRenewContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) {
      toast.error('Nao existe contrato para renovar.')
      return
    }

    startTransition(async () => {
      const result = await renewContract(contractId, {
        start_at: contractForm.startAt ? new Date(contractForm.startAt).toISOString() : null,
        end_at: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : null,
      })

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel gerar a renovacao.')
        return
      }

      toast.success('Renovacao criada. Reabra a tela para ver o novo ciclo contratual.')
    })
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Clientes</h1>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            {[
              { label: `${stats.total} total`, color: '#7dd3fc' },
              { label: `${stats.active} ativos`, color: '#86efac' },
              stats.expiring > 0 ? { label: `${stats.expiring} a vencer`, color: '#facc15' } : null,
              stats.withoutPdf > 0 ? { label: `${stats.withoutPdf} sem PDF`, color: '#fca5a5' } : null,
            ].filter(Boolean).map((chip) => (
              <span key={chip!.label} style={{ fontSize: '0.72rem', fontWeight: 700, color: chip!.color }}>{chip!.label}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            <UsersRound size={15} aria-hidden="true" />
            Novo cliente
          </button>
          <Link href="/dashboard/pipeline" className="btn-ghost" style={{ textDecoration: 'none' }}>
            <ArrowRight size={15} aria-hidden="true" />
            Fluxo comercial
          </Link>
        </div>
      </div>

      {/* Busca */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(180px, 0.5fr)', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 900, display: 'none' }}>Busca e filtros</div>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '4px', display: 'none' }}>
            Filtre por nome, empresa, produto, consultor ou fase do contrato.
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              className="input-field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente, empresa, consultor, produto, contrato..."
              style={{ paddingLeft: '42px' }}
              aria-label="Buscar cliente"
            />
          </div>
        </div>
        <select
          className="input-field"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ background: 'var(--brand-surface)', color: statusFilter === 'Todos' ? '#64748b' : '#e2e8f0' }}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>
      <section style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Base de clientes
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
              Cada linha mostra o status operacional do cliente, o consultor responsavel, o produto e a vigencia estimada.
            </p>
          </div>
          <div className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <BadgeCheck size={14} />
            Leitura operacional
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '1180px', display: 'grid', gap: '10px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.3fr) 170px 180px 170px 170px 140px 160px',
                gap: '12px',
                padding: '0 16px',
                color: '#94a3b8',
                fontSize: '0.7rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
            <span>Cliente</span>
            <span>Fase</span>
            <span>Consultor</span>
            <span>Produto</span>
            <span>Validade</span>
              <span>Documento</span>
              <span>Acoes</span>
            </div>

            {filteredRows.length ? (
              filteredRows.map((row) => {
                const isSelected = selectedRow?.id === row.id
                const tone = getTone(row.clientStatusLabel)
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.3fr) 170px 180px 170px 170px 140px 160px',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '16px',
                      borderRadius: '18px',
                      border: isSelected ? '1px solid rgba(56, 189, 248, 0.42)' : '1px solid rgba(255,255,255,0.06)',
                      background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255,255,255,0.03)',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
                      <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '0.94rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.company || 'Sem empresa'} · {row.sourceLabel}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '5px 9px',
                          borderRadius: '999px',
                          color: tone.color,
                          background: tone.background,
                          border: `1px solid ${tone.border}`,
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {row.clientStatusLabel}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.consultant}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.74rem' }}>{row.email || row.phone || row.whatsapp || 'Sem contato'}</div>
                    </div>

                    <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.product}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.74rem' }}>{row.contractNumber || 'Contrato nao gerado'}</div>
                    </div>

                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>{formatDate(row.contractValidUntil)}</div>
                      <div style={{ color: '#64748b', fontSize: '0.74rem' }}>{row.contractSignedAt ? `Assinado ha ${formatAge(row.contractSignedAt)}` : 'Aguardando assinatura'}</div>
                    </div>

                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>{row.pdfName || 'Pendente'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.74rem' }}>{row.contractStatusLabel}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 10px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.03)',
                          color: '#e2e8f0',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                        }}
                      >
                        <Clock3 size={13} />
                        {formatCurrency(row.contractValue)}
                      </span>
                    </div>
                  </button>
                )
              })
            ) : (
              <div
                style={{
                  padding: '34px 18px',
                  borderRadius: '20px',
                  border: '1px dashed rgba(148, 163, 184, 0.18)',
                  color: '#94a3b8',
                  textAlign: 'center',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={22} color="var(--brand-primary)" style={{ margin: '0 auto' }} />
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>Nenhum cliente encontrado com os filtros atuais.</div>
                <div style={{ fontSize: '0.82rem' }}>Tente ajustar a busca ou voltar ao status completo da lista.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedRow ? (
        <aside
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(2, 6, 23, 0.66)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedId(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(100vw, 520px)',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-20px 0 50px rgba(2,6,23,0.45)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#7dd3fc', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <BadgeCheck size={14} />
                    Cliente selecionado
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 900, lineHeight: 1.25 }}>{selectedRow.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5 }}>
                    {selectedRow.company || 'Sem empresa'} · {selectedRow.product}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    borderRadius: '8px',
                    color: '#94a3b8', 
                    cursor: 'pointer', 
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  aria-label="Fechar"
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                    e.currentTarget.style.color = '#ef4444'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    color: selectedTone.color,
                    background: selectedTone.background,
                    border: `1px solid ${selectedTone.border}`,
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {selectedRow.clientStatusLabel}
                </span>
                <span className="chip">Consultor: {selectedRow.consultant}</span>
                <span className="chip">Produto: {selectedRow.product}</span>
              </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'grid', gap: '16px' }}>
              {/* Prioridades / Ação Sugerida */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px', background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(15,23,42,0.96))', border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <Sparkles size={14} />
                  Ação Sugerida / Prioridades
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {selectedRow.clientStatusLabel === 'A vencer' && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Entrar em contato para renovação imediata (Contrato a vencer).</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Agendar reunião de alinhamento de resultados.</div>
                    </>
                  )}
                  {selectedRow.clientStatusLabel === 'Contrato pendente' && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Fazer follow-up para assinatura de contrato.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Oferecer suporte em dúvidas jurídicas ou de escopo.</div>
                    </>
                  )}
                  {selectedRow.clientStatusLabel === 'Vencido' && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Investigar motivo da não renovação e tentar resgate.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Enviar proposta com novas condições.</div>
                    </>
                  )}
                  {(selectedRow.clientStatusLabel === 'Contrato ativo' || selectedRow.clientStatusLabel === 'Cliente criado') && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Verificar satisfação e uso do serviço atual.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Identificar oportunidades de Cross-sell (Mix de Serviços).</div>
                    </>
                  )}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Resumo operacional
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  <div className="kpi-card" style={{ padding: '12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Contrato</div>
                    <div style={{ marginTop: '6px', color: '#f8fafc', fontWeight: 900 }}>{selectedRow.contractNumber || 'Nao gerado'}</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Valor</div>
                    <div style={{ marginTop: '6px', color: '#86efac', fontWeight: 900 }}>{formatCurrency(selectedRow.contractValue)}</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Assinatura</div>
                    <div style={{ marginTop: '6px', color: '#f8fafc', fontWeight: 900 }}>{formatDate(selectedRow.contractSignedAt)}</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Inicio</div>
                    <div style={{ marginTop: '6px', color: '#f8fafc', fontWeight: 900 }}>{formatDate(selectedRow.contractStartAt)}</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Validade</div>
                    <div style={{ marginTop: '6px', color: '#f8fafc', fontWeight: 900 }}>{formatDate(selectedRow.contractValidUntil)}</div>
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Dados do cliente
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <input
                      className="input-field"
                      value={clientForm.name}
                      onChange={(event) => setClientField('name', event.target.value)}
                      placeholder="Nome do cliente"
                    />
                    <input
                      className="input-field"
                      value={clientForm.company}
                      onChange={(event) => setClientField('company', event.target.value)}
                      placeholder="Empresa"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <input
                      className="input-field"
                      value={clientForm.email}
                      onChange={(event) => setClientField('email', event.target.value)}
                      placeholder="E-mail"
                    />
                    <input
                      className="input-field"
                      value={clientForm.document}
                      onChange={(event) => setClientField('document', event.target.value)}
                      placeholder="Documento"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <input
                      className="input-field"
                      value={clientForm.phone}
                      onChange={(event) => setClientField('phone', event.target.value)}
                      placeholder="Telefone"
                    />
                    <input
                      className="input-field"
                      value={clientForm.whatsapp}
                      onChange={(event) => setClientField('whatsapp', event.target.value)}
                      placeholder="WhatsApp"
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Contatos
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1' }}>E-mail</span>
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>{selectedRow.email || 'Nao cadastrado'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1' }}>Telefone</span>
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>{selectedRow.phone || 'Nao cadastrado'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1' }}>WhatsApp</span>
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>{selectedRow.whatsapp || 'Nao cadastrado'}</span>
                  </div>

                  {/* Botões de ação rápida */}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                    {(selectedRow.phone || selectedRow.whatsapp) && (
                      <button
                        type="button"
                        onClick={() => {
                          const num = (selectedRow.phone || selectedRow.whatsapp || '').replace(/\D/g, '')
                          if (num) window.open(`tel:${num}`)
                          setCallModalOpen(true)
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem',
                          fontWeight: 700, background: 'rgba(34,197,94,0.12)',
                          color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)',
                          cursor: 'pointer',
                        }}
                      >
                        <PhoneCall size={13} />
                        Ligar via GoTo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCallModalOpen(true)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem',
                        fontWeight: 700, background: 'rgba(96,165,250,0.1)',
                        color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)',
                        cursor: 'pointer',
                      }}
                    >
                      <Phone size={13} />
                      Registrar ligacao
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal registro de ligação */}
              {callModalOpen && (
                <div
                  style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 500,
                  }}
                  onClick={(e) => { if (e.target === e.currentTarget) setCallModalOpen(false) }}
                >
                  <div style={{
                    background: '#161b22', border: '1px solid rgba(251,191,36,0.2)',
                    borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px',
                    display: 'grid', gap: '16px',
                  }}>
                    <div style={{ fontWeight: 800, color: 'var(--brand-text)', fontSize: '0.95rem' }}>
                      Registrar ligacao GoTo
                    </div>

                    <div style={{ display: 'grid', gap: '10px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                        Resultado *
                      </label>
                      <select
                        className="input-field"
                        value={callForm.outcome}
                        onChange={(e) => setCallForm((f) => ({ ...f, outcome: e.target.value as CallOutcome }))}
                        style={{ background: 'var(--brand-surface)', color: '#e2e8f0' }}
                      >
                        <option value="atendeu">Atendeu</option>
                        <option value="nao_atendeu">Nao atendeu</option>
                        <option value="recado">Deixou recado</option>
                        <option value="reagendado">Reagendado</option>
                      </select>

                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                        Duracao (min)
                      </label>
                      <input
                        className="input-field"
                        type="number"
                        min={0}
                        placeholder="Ex: 15"
                        value={callForm.durationMin}
                        onChange={(e) => setCallForm((f) => ({ ...f, durationMin: e.target.value }))}
                      />

                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                        Link da gravacao (opcional)
                      </label>
                      <input
                        className="input-field"
                        placeholder="https://app.goto.com/..."
                        value={callForm.recordingUrl}
                        onChange={(e) => setCallForm((f) => ({ ...f, recordingUrl: e.target.value }))}
                      />

                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                        Observacoes
                      </label>
                      <textarea
                        className="input-field"
                        rows={2}
                        placeholder="Resumo da conversa..."
                        value={callForm.notes}
                        onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setCallModalOpen(false)}
                        style={{ fontSize: '0.8rem' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void handleLogCall()}
                        disabled={callPending}
                        style={{ fontSize: '0.8rem' }}
                      >
                        {callPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={14} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  PDF do contrato
                </div>
                <div style={{ borderRadius: '16px', border: '1px dashed rgba(148, 163, 184, 0.18)', padding: '14px', display: 'grid', gap: '10px' }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Envie o PDF real do contrato para salvar no Storage e registrar o documento na linha do tempo.
                  </div>
                  <input
                    ref={fileInputRef}
                    className="input-field"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setSelectedPdfFile(event.target.files?.[0] || null)}
                  />
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                      {selectedPdfFile ? `Selecionado: ${selectedPdfFile.name}` : selectedRow.pdfName || 'Nenhum PDF registrado ainda'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>
                      {selectedPdfFile
                        ? `${Math.round(selectedPdfFile.size / 1024)} KB · ${selectedPdfFile.type || 'application/pdf'}`
                        : selectedRow.pdfBucket
                          ? `Bucket: ${selectedRow.pdfBucket}`
                          : 'Bucket ainda nao configurado para este contrato'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>
                      {selectedRow.pdfUploadedAt
                        ? `Enviado em ${formatDate(selectedRow.pdfUploadedAt)}${selectedRow.pdfVersion ? ` · versao ${selectedRow.pdfVersion}` : ''}`
                        : 'Nenhum upload registrado ainda'}
                    </span>
                    {selectedRow.pdfMimeType ? (
                      <span style={{ color: '#64748b', fontSize: '0.74rem' }}>{selectedRow.pdfMimeType}</span>
                    ) : null}
                    {selectedPdfPreview ? (
                      <a
                        href={selectedPdfPreview}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#7dd3fc', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}
                      >
                        Abrir arquivo selecionado
                      </a>
                    ) : null}
                    {!selectedPdfPreview && selectedRow.pdfUrl ? (
                      <a
                        href={selectedRow.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#7dd3fc', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}
                      >
                        Abrir PDF atual
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Dados do contrato
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <input
                      className="input-field"
                      value={contractForm.contractNumber}
                      onChange={(event) => setFormField('contractNumber', event.target.value)}
                      placeholder="Numero do contrato"
                    />
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      value={contractForm.contractValue}
                      onChange={(event) => setFormField('contractValue', event.target.value)}
                      placeholder="Valor do contrato"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <input
                      className="input-field"
                      type="date"
                      value={contractForm.startAt}
                      onChange={(event) => setFormField('startAt', event.target.value)}
                    />
                    <input
                      className="input-field"
                      type="date"
                      value={contractForm.signedAt}
                      onChange={(event) => setFormField('signedAt', event.target.value)}
                    />
                    <input
                      className="input-field"
                      type="date"
                      value={contractForm.validUntil}
                      onChange={(event) => setFormField('validUntil', event.target.value)}
                    />
                  </div>
                  <select
                    className="input-field"
                    value={contractForm.status}
                    onChange={(event) => setFormField('status', event.target.value)}
                    style={{ background: 'var(--brand-surface)', color: '#e2e8f0' }}
                  >
                    <option value="pendente_assinatura">Contrato pendente</option>
                    <option value="ativo">Contrato ativo</option>
                    <option value="vencido">Vencido</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={contractForm.notes}
                    onChange={(event) => setFormField('notes', event.target.value)}
                    placeholder="Observacoes, detalhes do contrato e contexto da conta"
                  />

                  {/* Link de assinatura externa */}
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                      Link de assinatura (Clicksign, DocuSign, etc.)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        className="input-field"
                        style={{ flex: 1 }}
                        placeholder="https://app.clicksign.com/..."
                        value={contractForm.signingUrl}
                        onChange={(e) => setFormField('signingUrl', e.target.value)}
                      />
                      {(contractForm.signingUrl.trim() || selectedRow?.signingUrl) && (
                        <a
                          href={contractForm.signingUrl.trim() || selectedRow?.signingUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem',
                            fontWeight: 700, background: 'rgba(251,191,36,0.12)',
                            color: 'var(--brand-primary)', border: '1px solid rgba(251,191,36,0.25)',
                            textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          <ExternalLink size={13} />
                          Abrir para assinar
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Historico do contrato
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                    {selectedRow.contractHistory.length} evento(s) rastreado(s)
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {selectedRow.contractHistory.length ? (
                    selectedRow.contractHistory.map((entry, index) => (
                      <div
                        key={`${entry.title}-${index}`}
                        style={{
                          display: 'grid',
                          gap: '4px',
                          padding: '12px',
                          borderRadius: '14px',
                          border: '1px solid rgba(148, 163, 184, 0.12)',
                          background:
                            entry.tone === 'success'
                              ? 'rgba(34,197,94,0.08)'
                              : entry.tone === 'warning'
                                ? 'rgba(251,191,36,0.08)'
                                : entry.tone === 'info'
                                  ? 'rgba(56,189,248,0.08)'
                                  : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{entry.title}</div>
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{formatDate(entry.date)}</span>
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.5 }}>{entry.detail}</div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '14px',
                        border: '1px dashed rgba(148, 163, 184, 0.18)',
                        color: '#94a3b8',
                        fontSize: '0.78rem',
                      }}
                    >
                      Sem historico adicional para este contrato ainda.
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ color: '#7dd3fc', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Historico comercial
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                    {selectedRow.commercialHistory.length} evento(s) no processo
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {selectedRow.commercialHistory.length ? (
                    selectedRow.commercialHistory.map((entry, index) => (
                      <div
                        key={`${entry.title}-${index}`}
                        style={{
                          display: 'grid',
                          gap: '4px',
                          padding: '12px',
                          borderRadius: '14px',
                          border: '1px solid rgba(148, 163, 184, 0.12)',
                          background:
                            entry.tone === 'success'
                              ? 'rgba(34,197,94,0.08)'
                              : entry.tone === 'warning'
                                ? 'rgba(251,191,36,0.08)'
                                : entry.tone === 'info'
                                  ? 'rgba(56,189,248,0.08)'
                                  : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{entry.title}</div>
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{formatDate(entry.date)}</span>
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.5 }}>{entry.detail}</div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '14px',
                        border: '1px dashed rgba(148, 163, 184, 0.18)',
                        color: '#94a3b8',
                        fontSize: '0.78rem',
                      }}
                    >
                      Sem historico comercial adicional para este cliente ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* ─── REUNIÕES ─── */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Video size={15} color="#818cf8" />
                    <span style={{ color: '#818cf8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Reunioes
                    </span>
                    {meetingsLoading ? (
                      <Loader2 size={13} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{meetings.length} registrada(s)</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '5px 10px', fontSize: '0.76rem', gap: '5px' }}
                    onClick={() => setMeetingFormOpen((open) => !open)}
                  >
                    <Plus size={13} />
                    Nova reuniao
                  </button>
                </div>

                {/* Formulário de nova reunião */}
                {meetingFormOpen && (
                  <div style={{ display: 'grid', gap: '10px', padding: '12px', borderRadius: '12px', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                      <input
                        className="input-field"
                        type="date"
                        value={meetingForm.meeting_date}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, meeting_date: e.target.value }))}
                      />
                      <input
                        className="input-field"
                        placeholder="Titulo da reuniao"
                        value={meetingForm.title}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <input
                      className="input-field"
                      placeholder="Link da gravacao (Google Meet, Zoom, Loom...)"
                      value={meetingForm.recording_link}
                      onChange={(e) => setMeetingForm((f) => ({ ...f, recording_link: e.target.value }))}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                      <input
                        className="input-field"
                        placeholder="Participantes"
                        value={meetingForm.participants}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, participants: e.target.value }))}
                      />
                      <input
                        className="input-field"
                        type="number"
                        placeholder="Duracao (min)"
                        value={meetingForm.duration_min}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, duration_min: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 700 }}>Pauta</span>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '4px 10px', fontSize: '0.74rem', gap: '5px', color: '#3b82f6' }}
                          onClick={() => void handleGeneratePauta()}
                          disabled={pautaLoading}
                        >
                          {pautaLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                          {pautaLoading ? 'Gerando...' : 'Gerar com IA'}
                        </button>
                      </div>
                      <textarea
                        className="input-field"
                        placeholder="Pauta da reuniao (ou clique em &apos;Gerar com IA&apos;)"
                        value={meetingForm.pauta}
                        rows={5}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, pauta: e.target.value }))}
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>
                    <textarea
                      className="input-field"
                      placeholder="Notas adicionais (opcional)"
                      value={meetingForm.notes}
                      rows={2}
                      onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))}
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setMeetingFormOpen(false)}>
                        Cancelar
                      </button>
                      <button type="button" className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={handleSaveMeeting} disabled={isPending}>
                        <CheckCircle2 size={14} />
                        Salvar reuniao
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de reuniões */}
                {meetings.length === 0 && !meetingsLoading && !meetingFormOpen && (
                  <div style={{ padding: '12px', borderRadius: '12px', border: '1px dashed rgba(148,163,184,0.18)', color: '#94a3b8', fontSize: '0.78rem' }}>
                    Nenhuma reuniao registrada para este cliente ainda.
                  </div>
                )}

                {meetings.map((meeting, index) => {
                  const isExpanded = expandedMeetingId === meeting.id
                  return (
                    <div
                      key={meeting.id}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid rgba(129,140,248,0.15)',
                        background: 'rgba(129,140,248,0.04)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header do card */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer' }}
                        onClick={() => setExpandedMeetingId(isExpanded ? null : meeting.id)}
                      >
                        <div style={{
                          minWidth: '24px', height: '24px', borderRadius: '50%',
                          background: 'rgba(129,140,248,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#818cf8', fontWeight: 900, fontSize: '0.72rem',
                        }}>
                          {meetings.length - index}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {meeting.title}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '2px' }}>
                            {formatDate(meeting.meeting_date)}
                            {meeting.duration_min ? ` · ${meeting.duration_min} min` : ''}
                            {meeting.ai_generated ? ' · IA' : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {meeting.recording_link && (
                            <a
                              href={meeting.recording_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir gravacao"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#818cf8', display: 'flex' }}
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            type="button"
                            title="Excluir reuniao"
                            onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(meeting.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '2px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                          {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                        </div>
                      </div>

                      {/* Conteúdo expandido */}
                      {isExpanded && (
                        <div style={{ padding: '0 12px 12px', display: 'grid', gap: '8px', borderTop: '1px solid rgba(129,140,248,0.1)' }}>
                          {meeting.participants && (
                            <div style={{ paddingTop: '8px' }}>
                              <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Participantes</span>
                              <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '4px' }}>{meeting.participants}</div>
                            </div>
                          )}
                          {meeting.pauta && (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Pauta</span>
                                {meeting.ai_generated && <Sparkles size={11} color="#3b82f6" />}
                              </div>
                              <div style={{
                                color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.6,
                                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)',
                              }}>
                                {meeting.pauta}
                              </div>
                            </div>
                          )}
                          {meeting.notes && (
                            <div>
                              <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Notas</span>
                              <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '4px', lineHeight: 1.5 }}>{meeting.notes}</div>
                            </div>
                          )}
                          {!meeting.pauta && !meeting.notes && !meeting.participants && (
                            <div style={{ color: '#64748b', fontSize: '0.78rem', paddingTop: '8px' }}>Sem pauta ou notas registradas.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Acoes rapidas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button type="button" className="btn-primary" onClick={handleSaveClient} disabled={isPending}>
                    <CheckCircle2 size={16} />
                    Salvar cliente
                  </button>
                  <button type="button" className="btn-primary" onClick={handleSaveContract} disabled={isPending}>
                    <CheckCircle2 size={16} />
                    Salvar contrato
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleUploadPdf} disabled={isPending || !selectedPdfFile}>
                    <Upload size={16} />
                    Enviar PDF
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleActivateContract} disabled={isPending || !selectedRow.dealId}>
                    <ShieldCheck size={16} />
                    Ativar contrato
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleCancelContract} disabled={isPending || !selectedRow.contractId}>
                    <AlertTriangle size={16} />
                    Cancelar contrato
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleRenewContract} disabled={isPending || !selectedRow.contractId}>
                    <RefreshCcw size={16} />
                    Renovar contrato
                  </button>
                  <button type="button" className="btn-primary" onClick={() => void copyContact(selectedRow)}>
                    <Copy size={16} />
                    Copiar contato
                  </button>
                  <Link href={buildCrmLeadHref(selectedRow.leadId)} className="btn-ghost" style={{ textDecoration: 'none' }}>
                    <ExternalLink size={16} />
                    Abrir lead no CRM
                  </Link>
                  <Link href="/dashboard/pipeline" className="btn-ghost" style={{ textDecoration: 'none' }}>
                    <ExternalLink size={16} />
                    Abrir fluxo comercial
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      <ActionDialog
        open={createOpen}
        title="Novo cliente"
        subtitle="Cadastre o cliente. Ele entrará automaticamente no CRM em 'Contato Inicial'."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={() => void handleCreateClient()} disabled={isPending}>
              Criar cliente
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div className="agenda-form-grid">
            <input
              className="input-field"
              placeholder="Nome do cliente"
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Empresa"
              value={createForm.company}
              onChange={(event) => setCreateForm((current) => ({ ...current, company: event.target.value }))}
            />
          </div>
          <div className="agenda-form-grid">
            <input
              className="input-field"
              placeholder="Email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Documento"
              value={createForm.document}
              onChange={(event) => setCreateForm((current) => ({ ...current, document: event.target.value }))}
            />
          </div>
          <div className="agenda-form-grid">
            <input
              className="input-field"
              placeholder="Telefone"
              value={createForm.phone}
              onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <input
              className="input-field"
              placeholder="WhatsApp"
              value={createForm.whatsapp}
              onChange={(event) => setCreateForm((current) => ({ ...current, whatsapp: event.target.value }))}
            />
          </div>
          <div className="agenda-form-grid">
            <select
              className="input-field"
              value={createForm.productId}
              onChange={(event) => setCreateForm((current) => ({ ...current, productId: event.target.value }))}
              style={{ background: 'var(--brand-surface)', color: '#e2e8f0' }}
            >
              <option value="">Produto foco</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name || 'Produto sem nome'}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={createForm.consultantId}
              onChange={(event) => setCreateForm((current) => ({ ...current, consultantId: event.target.value }))}
              style={{ background: 'var(--brand-surface)', color: '#e2e8f0' }}
            >
              <option value="">Consultor responsavel</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>
          <div className="agenda-form-grid">
            <select
              className="input-field"
              value={createForm.crmStage}
              onChange={(event) => setCreateForm((current) => ({ ...current, crmStage: event.target.value }))}
              style={{ background: 'var(--brand-surface)', color: '#e2e8f0' }}
            >
              <option value="Contato Inicial">Contato Inicial (padrão)</option>
              {crmStageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <div className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '42px' }}>
              Se escolher uma etapa, o cliente entra no CRM como lead vinculado.
            </div>
          </div>
        </div>
      </ActionDialog>
    </div>
  )
}
