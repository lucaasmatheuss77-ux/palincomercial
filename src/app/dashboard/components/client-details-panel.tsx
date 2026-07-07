'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, AlertTriangle, BadgeCheck, Clock3, Copy, ExternalLink, ShieldCheck,
  X, Upload, RefreshCcw, Video, Sparkles, Plus, ChevronDown, ChevronUp, Loader2, Trash2, Phone, PhoneCall, MessageCircle,
  Building2, Edit3
} from 'lucide-react'
import { toast } from 'sonner'

import {
  activateContract, cancelContract, renewContract, saveClientContract, updateClient, uploadContractPdfFromForm
} from '@/app/actions/clientes'
import {
  listClientMeetings, createClientMeeting, deleteClientMeeting, type ClientMeeting
} from '@/app/actions/reunioes'
import { createCallLog, type CallOutcome } from '@/app/actions/ligacoes'
import {
  listFiliaisByClient, createFilial, updateFilial, deleteFilial, type FilialRecord
} from '@/app/actions/filiais'
import {
  listClientServices, createClientService, updateClientService, deleteClientService, type ClientServiceRecord
} from '@/app/actions/client-services'
import type { ClientRow } from '../clientes/clientes-client'

const STATUS_TONES: Record<string, { color: string; background: string; border: string }> = {
  'Cliente criado': { color: '#93c5fd', background: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.22)' },
  'Contrato pendente': { color: 'var(--brand-primary)', background: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.22)' },
  'Contrato ativo': { color: '#86efac', background: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.22)' },
  'A vencer': { color: '#facc15', background: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.22)' },
  Vencido: { color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.22)' },
  'Contrato cancelado': { color: '#cbd5e1', background: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.22)' },
}
function formatCurrency(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0) }
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
function getTone(status: string) { return STATUS_TONES[status] || STATUS_TONES['Cliente criado'] }

export function ClientDetailsPanel({ selectedRow, onClose }: { selectedRow: ClientRow; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'geral' | 'reunioes' | 'contratos' | 'filiais' | 'trabalhos'>('geral')
  const [contractForm, setContractForm] = useState({ contractNumber: '', contractValue: '', startAt: '', signedAt: '', validUntil: '', notes: '', status: 'pendente_assinatura', signingUrl: '' })
  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '', whatsapp: '', document: '' })
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [selectedPdfPreview, setSelectedPdfPreview] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [meetings, setMeetings] = useState<ClientMeeting[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingFormOpen, setMeetingFormOpen] = useState(false)
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null)
  const [pautaLoading, setPautaLoading] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ meeting_date: new Date().toISOString().split('T')[0], title: '', recording_link: '', participants: '', duration_min: '', pauta: '', notes: '' })
  
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [callPending, setCallPending] = useState(false)
  const [callForm, setCallForm] = useState({ outcome: 'atendeu' as CallOutcome, durationMin: '', recordingUrl: '', notes: '' })

  const [filiais, setFiliais] = useState<FilialRecord[]>([])
  const [filiaisLoading, setFiliaisLoading] = useState(false)
  const [filialFormOpen, setFilialFormOpen] = useState(false)
  const [editingFilialId, setEditingFilialId] = useState<string | null>(null)
  const [filialForm, setFilialForm] = useState({ nome: '', documento: '', cidade: '', estado: '' })
  const [filialSaving, setFilialSaving] = useState(false)

  const [services, setServices] = useState<ClientServiceRecord[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [serviceFormOpen, setServiceFormOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState({
    nome: '', tipo_honorario: 'percentual' as 'percentual' | 'fixo', honorario_valor: '', honorario_percentual: '', base_calculo: '', status: 'ativo', data_inicio: '', data_fim: '', notas: '',
  })
  const [serviceSaving, setServiceSaving] = useState(false)

  const selectedTone = selectedRow ? getTone(selectedRow.clientStatusLabel) : STATUS_TONES['Cliente criado']

  useEffect(() => {
    if (!selectedRow) return
    setContractForm({
      contractNumber: selectedRow.contractNumber || '', contractValue: selectedRow.contractValue ? String(selectedRow.contractValue) : '', startAt: selectedRow.contractStartAt ? selectedRow.contractStartAt.slice(0, 10) : '', signedAt: selectedRow.contractSignedAt ? selectedRow.contractSignedAt.slice(0, 10) : '', validUntil: selectedRow.contractValidUntil ? selectedRow.contractValidUntil.slice(0, 10) : '', notes: selectedRow.contractNotes || '',
      status: selectedRow.clientStatusLabel === 'Contrato ativo' || selectedRow.clientStatusLabel === 'A vencer' ? 'ativo' : selectedRow.clientStatusLabel === 'Contrato cancelado' ? 'cancelado' : selectedRow.clientStatusLabel === 'Vencido' ? 'vencido' : 'pendente_assinatura',
      signingUrl: selectedRow.signingUrl || '',
    })
    setClientForm({ name: selectedRow.name || '', company: selectedRow.company || '', email: selectedRow.email || '', phone: selectedRow.phone || '', whatsapp: selectedRow.whatsapp || '', document: selectedRow.document || '' })
    setSelectedPdfFile(null)
    setSelectedPdfPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [selectedRow])

  useEffect(() => {
    if (!selectedRow?.clientRecordId) { setMeetings([]); return }
    setMeetingsLoading(true)
    listClientMeetings(selectedRow.clientRecordId)
      .then((result) => setMeetings(result.data))
      .catch(() => setMeetings([]))
      .finally(() => setMeetingsLoading(false))
    setMeetingFormOpen(false)
    setExpandedMeetingId(null)
    setMeetingForm({ meeting_date: new Date().toISOString().split('T')[0], title: '', recording_link: '', participants: '', duration_min: '', pauta: '', notes: '' })
  }, [selectedRow?.clientRecordId])

  useEffect(() => {
    if (!selectedPdfFile) { setSelectedPdfPreview(''); return }
    const previewUrl = URL.createObjectURL(selectedPdfFile)
    setSelectedPdfPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedPdfFile])

  useEffect(() => {
    if (!selectedRow?.clientRecordId) { setFiliais([]); return }
    setFiliaisLoading(true)
    listFiliaisByClient(selectedRow.clientRecordId)
      .then((result) => setFiliais(result))
      .catch(() => setFiliais([]))
      .finally(() => setFiliaisLoading(false))
    setFilialFormOpen(false)
    setEditingFilialId(null)
    setFilialForm({ nome: '', documento: '', cidade: '', estado: '' })
  }, [selectedRow?.clientRecordId])

  function openNewFilial() {
    setEditingFilialId(null)
    setFilialForm({ nome: '', documento: '', cidade: '', estado: '' })
    setFilialFormOpen(true)
  }

  function openEditFilial(filial: FilialRecord) {
    setEditingFilialId(filial.id)
    setFilialForm({ nome: filial.nome, documento: filial.documento || '', cidade: filial.cidade || '', estado: filial.estado || '' })
    setFilialFormOpen(true)
  }

  async function handleSaveFilial() {
    if (!selectedRow?.clientRecordId) return
    if (!filialForm.nome.trim()) { toast.error('Informe o nome da filial.'); return }
    setFilialSaving(true)
    try {
      const payload = {
        client_id: selectedRow.clientRecordId,
        nome: filialForm.nome.trim(),
        documento: filialForm.documento.trim() || null,
        cidade: filialForm.cidade.trim() || null,
        estado: filialForm.estado.trim() || null,
      }
      const result = editingFilialId ? await updateFilial(editingFilialId, payload) : await createFilial(payload)
      if (!result.success) throw new Error(result.error)
      const updated = await listFiliaisByClient(selectedRow.clientRecordId)
      setFiliais(updated)
      toast.success(editingFilialId ? 'Filial atualizada.' : 'Filial cadastrada.')
      setFilialFormOpen(false)
      setEditingFilialId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar filial.')
    } finally {
      setFilialSaving(false)
    }
  }

  async function handleDeleteFilial(filialId: string) {
    if (!selectedRow?.clientRecordId) return
    if (!confirm('Tem certeza que deseja excluir esta filial?')) return
    try {
      const result = await deleteFilial(filialId)
      if (!result.success) throw new Error(result.error)
      const updated = await listFiliaisByClient(selectedRow.clientRecordId)
      setFiliais(updated)
      toast.success('Filial removida.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover filial.')
    }
  }

  useEffect(() => {
    if (!selectedRow?.clientRecordId) { setServices([]); return }
    setServicesLoading(true)
    listClientServices(selectedRow.clientRecordId)
      .then((result) => setServices(result))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false))
    setServiceFormOpen(false)
    setEditingServiceId(null)
    setServiceForm({ nome: '', tipo_honorario: 'percentual', honorario_valor: '', honorario_percentual: '', base_calculo: '', status: 'ativo', data_inicio: '', data_fim: '', notas: '' })
  }, [selectedRow?.clientRecordId])

  function openNewService() {
    setEditingServiceId(null)
    setServiceForm({ nome: '', tipo_honorario: 'percentual', honorario_valor: '', honorario_percentual: '', base_calculo: '', status: 'ativo', data_inicio: '', data_fim: '', notas: '' })
    setServiceFormOpen(true)
  }

  function openEditService(service: ClientServiceRecord) {
    setEditingServiceId(service.id)
    setServiceForm({
      nome: service.nome,
      tipo_honorario: service.tipo_honorario || (service.honorario_valor != null ? 'fixo' : 'percentual'),
      honorario_valor: service.honorario_valor != null ? String(service.honorario_valor) : '',
      honorario_percentual: service.honorario_percentual != null ? String(service.honorario_percentual) : '',
      base_calculo: service.base_calculo || '',
      status: service.status || 'ativo',
      data_inicio: service.data_inicio ? service.data_inicio.slice(0, 10) : '',
      data_fim: service.data_fim ? service.data_fim.slice(0, 10) : '',
      notas: service.notas || '',
    })
    setServiceFormOpen(true)
  }

  async function handleSaveService() {
    if (!selectedRow?.clientRecordId) return
    if (!serviceForm.nome.trim()) { toast.error('Informe o nome do trabalho/servico.'); return }
    if (serviceForm.tipo_honorario === 'percentual' && !serviceForm.honorario_percentual) { toast.error('Informe o percentual do honorario.'); return }
    if (serviceForm.tipo_honorario === 'fixo' && !serviceForm.honorario_valor) { toast.error('Informe o valor fixo do honorario.'); return }
    setServiceSaving(true)
    try {
      const payload = {
        client_id: selectedRow.clientRecordId,
        nome: serviceForm.nome.trim(),
        tipo_honorario: serviceForm.tipo_honorario,
        honorario_valor: serviceForm.honorario_valor ? Number(serviceForm.honorario_valor) : null,
        honorario_percentual: serviceForm.honorario_percentual ? Number(serviceForm.honorario_percentual) : null,
        base_calculo: serviceForm.base_calculo.trim() || null,
        status: serviceForm.status,
        data_inicio: serviceForm.data_inicio || null,
        data_fim: serviceForm.data_fim || null,
        notas: serviceForm.notas.trim() || null,
      }
      const result = editingServiceId ? await updateClientService(editingServiceId, payload) : await createClientService(payload)
      if (!result.success) throw new Error(result.error)
      const updated = await listClientServices(selectedRow.clientRecordId)
      setServices(updated)
      toast.success(editingServiceId ? 'Trabalho atualizado.' : 'Trabalho cadastrado.')
      setServiceFormOpen(false)
      setEditingServiceId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar trabalho.')
    } finally {
      setServiceSaving(false)
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!selectedRow?.clientRecordId) return
    if (!confirm('Tem certeza que deseja excluir este trabalho?')) return
    try {
      const result = await deleteClientService(serviceId)
      if (!result.success) throw new Error(result.error)
      const updated = await listClientServices(selectedRow.clientRecordId)
      setServices(updated)
      toast.success('Trabalho removido.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover trabalho.')
    }
  }

  function setFormField<K extends keyof typeof contractForm>(field: K, value: (typeof contractForm)[K]) { setContractForm((current) => ({ ...current, [field]: value })) }
  function setClientField<K extends keyof typeof clientForm>(field: K, value: (typeof clientForm)[K]) { setClientForm((current) => ({ ...current, [field]: value })) }

  async function copyContact() {
    const contact = selectedRow.whatsapp || selectedRow.phone || selectedRow.email
    if (!contact) { toast.info('Nenhum contato cadastrado para copiar.'); return }
    try { await navigator.clipboard.writeText(contact); toast.success('Contato copiado.') } catch { toast.error('Nao foi possivel copiar o contato.') }
  }

  async function handleGeneratePauta() {
    if (!meetingForm.recording_link.trim() && !selectedRow?.name) { toast.error('Informe o link da gravação ou o nome do cliente.'); return }
    setPautaLoading(true)
    try {
      const response = await fetch('/api/assistant/pauta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: selectedRow?.name || 'Cliente', recordingLink: meetingForm.recording_link || '', additionalContext: meetingForm.notes || '' }),
      })
      const data = await response.json() as { pauta?: string; error?: string }
      if (!response.ok || data.error) { toast.error(data.error || 'Erro ao gerar pauta.'); return }
      setMeetingForm((current) => ({ ...current, pauta: data.pauta || '' }))
      toast.success('Pauta gerada pela IA. Revise antes de salvar.')
    } catch { toast.error('Falha ao conectar com a IA.') } finally { setPautaLoading(false) }
  }

  async function handleUploadAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioUploading(true)
    try {
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('clientId', selectedRow?.clientRecordId || '')
      const response = await fetch('/api/meetings/transcribe', { method: 'POST', body: formData })
      const data = await response.json() as { transcript?: string; pauta?: string; summary?: string; recording_link?: string; error?: string }
      if (!response.ok || data.error) { toast.error(data.error || 'Erro ao transcrever áudio.'); return }
      setMeetingForm((current) => ({
        ...current, pauta: data.pauta || data.transcript || current.pauta, notes: data.summary ? (current.notes ? current.notes + '\n\nResumo IA:\n' + data.summary : 'Resumo IA:\n' + data.summary) : current.notes, recording_link: data.recording_link || current.recording_link,
      }))
      toast.success('Áudio transcrito com sucesso!')
    } catch { toast.error('Falha ao enviar áudio.') } finally { setAudioUploading(false) }
  }

  function handleSaveMeeting() {
    if (!selectedRow?.clientRecordId) return
    if (!meetingForm.title.trim()) { toast.error('Informe o titulo da reuniao.'); return }
    if (!meetingForm.meeting_date) { toast.error('Informe a data da reuniao.'); return }
    startTransition(async () => {
      const result = await createClientMeeting(selectedRow.clientRecordId, {
        meeting_date: meetingForm.meeting_date, title: meetingForm.title.trim(), recording_link: meetingForm.recording_link.trim() || null, pauta: meetingForm.pauta.trim() || null, notes: meetingForm.notes.trim() || null, participants: meetingForm.participants.trim() || null, duration_min: meetingForm.duration_min ? Number(meetingForm.duration_min) : null, ai_generated: meetingForm.pauta.length > 0 && pautaLoading === false,
      })
      if (!result.success) { toast.error(result.error || 'Erro ao salvar reuniao.'); return }
      toast.success('Reuniao registrada.')
      setMeetingFormOpen(false)
      setMeetingForm({ meeting_date: new Date().toISOString().split('T')[0], title: '', recording_link: '', participants: '', duration_min: '', pauta: '', notes: '' })
      const updated = await listClientMeetings(selectedRow.clientRecordId)
      setMeetings(updated.data)
    })
  }

  function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Tem certeza que deseja excluir esta reuniao?')) return
    startTransition(async () => {
      const result = await deleteClientMeeting(meetingId)
      if (!result.success) { toast.error(result.error || 'Erro ao excluir reuniao.'); return }
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
        leadId: selectedRow.leadId ?? null, clientId: selectedRow.clientRecordId, phone, callType: 'goto_connect', outcome: callForm.outcome, durationMin: callForm.durationMin ? Number(callForm.durationMin) : null, recordingUrl: callForm.recordingUrl.trim() || null, notes: callForm.notes.trim() || null,
      })
      if (!result.success) { toast.error(result.error || 'Erro ao registrar ligacao.'); return }
      toast.success('Ligacao registrada com sucesso.')
      setCallModalOpen(false)
      setCallForm({ outcome: 'atendeu', durationMin: '', recordingUrl: '', notes: '' })
    } finally { setCallPending(false) }
  }

  function handleSaveContract() {
    if (!selectedRow?.dealId) { toast.error('Feche o lead no fluxo comercial para gerar um deal antes de salvar o contrato.'); return }
    startTransition(async () => {
      const result = await saveClientContract({
        deal_id: selectedRow.dealId, lead_id: selectedRow.leadId, client_id: selectedRow.clientRecordId, contract_number: contractForm.contractNumber || null, value: Number(contractForm.contractValue || 0), start_date: contractForm.startAt ? new Date(contractForm.startAt).toISOString() : null, signed_at: contractForm.signedAt ? new Date(contractForm.signedAt).toISOString() : null, end_date: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : null, notes: contractForm.notes || null, status: contractForm.status, signing_url: contractForm.signingUrl.trim() || null,
      })
      if (!result.success) { toast.error(result.error || 'Nao foi possivel salvar o contrato.'); return }
      toast.success('Contrato atualizado. Reabra a tela para ver os dados consolidados.')
    })
  }

  function handleUploadPdf() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Salve o contrato antes de enviar o PDF.'); return }
    if (!selectedPdfFile) { toast.error('Escolha um arquivo PDF para upload.'); return }
    if (selectedPdfFile.type && selectedPdfFile.type !== 'application/pdf') { toast.error('Envie somente arquivos PDF.'); return }
    startTransition(async () => {
      const formData = new FormData()
      formData.append('contract_id', contractId)
      formData.append('bucket', selectedRow.pdfBucket || 'contract-pdfs')
      formData.append('file', selectedPdfFile)
      const result = await uploadContractPdfFromForm(formData)
      if (!result.success) { toast.error(result.error || 'Nao foi possivel enviar o PDF.'); return }
      setSelectedPdfFile(null); setSelectedPdfPreview('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('PDF do contrato enviado com sucesso.')
    })
  }

  function handleSaveClient() {
    if (!selectedRow?.clientRecordId) { toast.error('Cliente nao encontrado para atualizacao.'); return }
    startTransition(async () => {
      const result = await updateClient(selectedRow.clientRecordId, { name: clientForm.name || undefined, company_name: clientForm.company || null, email: clientForm.email || null, phone: clientForm.phone || null, whatsapp: clientForm.whatsapp || null, documento: clientForm.document || null })
      if (!result.success) { toast.error(result.error || 'Nao foi possivel salvar o cliente.'); return }
      toast.success('Cadastro do cliente atualizado. Reabra a tela para ver os dados consolidados.')
    })
  }

  function handleActivateContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Salve o contrato primeiro para depois ativar.'); return }
    startTransition(async () => {
      const result = await activateContract(contractId, { signed_at: contractForm.signedAt ? new Date(contractForm.signedAt).toISOString() : undefined, end_date: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : undefined, notes: contractForm.notes || undefined })
      if (!result.success) { toast.error(result.error || 'Nao foi possivel ativar o contrato.'); return }
      toast.success('Contrato ativado. Reabra a tela para ver o status atualizado.')
    })
  }

  function handleCancelContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Nao existe contrato para cancelar.'); return }
    startTransition(async () => {
      const result = await cancelContract(contractId, contractForm.notes || undefined)
      if (!result.success) { toast.error(result.error || 'Nao foi possivel cancelar o contrato.'); return }
      toast.success('Contrato cancelado. Reabra a tela para ver o status atualizado.')
    })
  }

  function handleRenewContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Nao existe contrato para renovar.'); return }
    startTransition(async () => {
      const result = await renewContract(contractId, { start_date: contractForm.startAt ? new Date(contractForm.startAt).toISOString() : null, end_date: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : null })
      if (!result.success) { toast.error(result.error || 'Nao foi possivel gerar a renovacao.'); return }
      toast.success('Renovacao criada. Reabra a tela para ver o novo ciclo contratual.')
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '900px', maxHeight: '90vh',
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        <div style={{ padding: '24px 24px 0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px',
                color: '#94a3b8', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', color: selectedTone.color, background: selectedTone.background, border: `1px solid ${selectedTone.border}`, fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {selectedRow.clientStatusLabel}
            </span>
            <span className="chip">Consultor: {selectedRow.consultant}</span>
            <span className="chip">Produto: {selectedRow.product}</span>
          </div>
          
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
            {(['geral', 'reunioes', 'contratos', 'filiais', 'trabalhos'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #38bdf8' : '2px solid transparent',
                  padding: '10px 16px', color: activeTab === tab ? '#38bdf8' : '#94a3b8', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s'
                }}
              >
                {tab === 'geral' ? 'Visão Geral' : tab === 'reunioes' ? 'Reuniões & Inteligência' : tab === 'contratos' ? 'Contratos' : tab === 'filiais' ? 'Filiais' : 'Trabalhos'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(255,255,255,0.01)' }}>
          
          {activeTab === 'geral' && (
            <>
              {/* Prioridades */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px', background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(15,23,42,0.96))', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <Sparkles size={14} /> Ação Sugerida / Prioridades
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {selectedRow.clientStatusLabel === 'A vencer' && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Entrar em contato para renovação imediata.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Agendar reunião de alinhamento de resultados.</div>
                    </>
                  )}
                  {selectedRow.clientStatusLabel === 'Contrato pendente' && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Fazer follow-up para assinatura de contrato.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Oferecer suporte em dúvidas.</div>
                    </>
                  )}
                  {selectedRow.clientStatusLabel === 'Vencido' && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Investigar motivo da não renovação.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Enviar proposta com novas condições.</div>
                    </>
                  )}
                  {(selectedRow.clientStatusLabel === 'Contrato ativo' || selectedRow.clientStatusLabel === 'Cliente criado') && (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>1. Verificar satisfação e uso do serviço atual.</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>2. Identificar oportunidades de Cross-sell.</div>
                    </>
                  )}
                </div>
              </div>

              {/* Contatos e Ações Rápidas */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contatos & Ações</div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><span style={{ color: '#cbd5e1' }}>E-mail</span><span style={{ color: '#f8fafc', fontWeight: 700 }}>{selectedRow.email || 'Nao cadastrado'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><span style={{ color: '#cbd5e1' }}>Telefone</span><span style={{ color: '#f8fafc', fontWeight: 700 }}>{selectedRow.phone || 'Nao cadastrado'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><span style={{ color: '#cbd5e1' }}>WhatsApp</span><span style={{ color: '#f8fafc', fontWeight: 700 }}>{selectedRow.whatsapp || 'Nao cadastrado'}</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px' }}>
                    <button type="button" className="btn-primary" onClick={copyContact}><Copy size={16} /> Copiar</button>
                    {(selectedRow.phone || selectedRow.whatsapp) && (
                      <button type="button" onClick={() => { const num = (selectedRow.phone || selectedRow.whatsapp || '').replace(/\D/g, ''); if (num) window.open(`tel:${num}`); setCallModalOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', cursor: 'pointer' }}><PhoneCall size={13} /> Ligar</button>
                    )}
                    {selectedRow.whatsapp && (
                      <button type="button" onClick={() => { const num = (selectedRow.whatsapp || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/55${num}`, '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(37,211,102,0.15)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)', cursor: 'pointer' }}><MessageCircle size={13} /> WhatsApp</button>
                    )}
                    <button type="button" onClick={() => setCallModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}><Phone size={13} /> Registrar ligação</button>
                    <Link href={`/dashboard/pipeline${selectedRow.leadId ? `?lead=${selectedRow.leadId}` : ''}`} className="btn-ghost" style={{ textDecoration: 'none' }}><ExternalLink size={16} /> CRM</Link>
                  </div>
                </div>
              </div>

              {/* Dados do Cliente */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dados do cliente</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  <input className="input-field" value={clientForm.name} onChange={(e) => setClientField('name', e.target.value)} placeholder="Nome" />
                  <input className="input-field" value={clientForm.company} onChange={(e) => setClientField('company', e.target.value)} placeholder="Empresa" />
                  <input className="input-field" value={clientForm.email} onChange={(e) => setClientField('email', e.target.value)} placeholder="E-mail" />
                  <input className="input-field" value={clientForm.document} onChange={(e) => setClientField('document', e.target.value)} placeholder="Documento" />
                  <input className="input-field" value={clientForm.phone} onChange={(e) => setClientField('phone', e.target.value)} placeholder="Telefone" />
                  <input className="input-field" value={clientForm.whatsapp} onChange={(e) => setClientField('whatsapp', e.target.value)} placeholder="WhatsApp" />
                </div>
                <button type="button" className="btn-primary" onClick={handleSaveClient} disabled={isPending} style={{ marginTop: '8px' }}><CheckCircle2 size={16} /> Salvar cliente</button>
              </div>
            </>
          )}

          {activeTab === 'reunioes' && (
            <>
              {/* REUNIÕES */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Video size={15} color="#e2e8f0" />
                    <span style={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reunioes</span>
                    {meetingsLoading ? <Loader2 size={13} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{meetings.length} registrada(s)</span>}
                  </div>
                  <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: '0.76rem', gap: '5px' }} onClick={() => setMeetingFormOpen((o) => !o)}><Plus size={13} /> Nova reuniao</button>
                </div>

                {meetingFormOpen && (
                  <div style={{ display: 'grid', gap: '10px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                      <input className="input-field" type="date" value={meetingForm.meeting_date} onChange={(e) => setMeetingForm((f) => ({ ...f, meeting_date: e.target.value }))} />
                      <input className="input-field" placeholder="Titulo da reuniao" value={meetingForm.title} onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                      <input className="input-field" placeholder="Link da gravacao" value={meetingForm.recording_link} onChange={(e) => setMeetingForm((f) => ({ ...f, recording_link: e.target.value }))} />
                      <div style={{ position: 'relative' }}>
                        <input type="file" accept="audio/*,video/*" onChange={handleUploadAudio} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }} disabled={audioUploading} />
                        <button type="button" className="btn-ghost" style={{ padding: '0 12px', height: '36px', fontSize: '0.78rem', gap: '6px', whiteSpace: 'nowrap' }} disabled={audioUploading}>{audioUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{audioUploading ? 'Transcrevendo...' : 'Upload Áudio'}</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                      <input className="input-field" placeholder="Participantes" value={meetingForm.participants} onChange={(e) => setMeetingForm((f) => ({ ...f, participants: e.target.value }))} />
                      <input className="input-field" type="number" placeholder="Duracao (min)" value={meetingForm.duration_min} onChange={(e) => setMeetingForm((f) => ({ ...f, duration_min: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 700 }}>Pauta</span>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.74rem', gap: '5px', color: '#e2e8f0' }} onClick={handleGeneratePauta} disabled={pautaLoading}>{pautaLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Gerar com IA</button>
                      </div>
                      <textarea className="input-field" placeholder="Pauta da reuniao" value={meetingForm.pauta} rows={5} onChange={(e) => setMeetingForm((f) => ({ ...f, pauta: e.target.value }))} />
                    </div>
                    <textarea className="input-field" placeholder="Notas adicionais" value={meetingForm.notes} rows={2} onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))} />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-ghost" onClick={() => setMeetingFormOpen(false)}>Cancelar</button>
                      <button type="button" className="btn-primary" onClick={handleSaveMeeting} disabled={isPending}><CheckCircle2 size={14} /> Salvar reuniao</button>
                    </div>
                  </div>
                )}
                
                {meetings.length === 0 && !meetingsLoading && !meetingFormOpen && <div style={{ padding: '12px', borderRadius: '12px', border: '1px dashed rgba(148,163,184,0.18)', color: '#94a3b8', fontSize: '0.78rem' }}>Nenhuma reuniao registrada.</div>}
                
                {meetings.map((meeting, index) => {
                  const isExpanded = expandedMeetingId === meeting.id
                  return (
                    <div key={meeting.id} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer' }} onClick={() => setExpandedMeetingId(isExpanded ? null : meeting.id)}>
                        <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontWeight: 900, fontSize: '0.72rem' }}>{meetings.length - index}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{meeting.title}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '2px' }}>{formatDate(meeting.meeting_date)}{meeting.duration_min ? ` · ${meeting.duration_min} min` : ''}{meeting.ai_generated ? ' · IA' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {meeting.recording_link && <a href={meeting.recording_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#e2e8f0' }}><ExternalLink size={14} /></a>}
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(meeting.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Trash2 size={13} /></button>
                          {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '0 12px 12px', display: 'grid', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          {meeting.participants && <div><span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>Participantes</span><div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{meeting.participants}</div></div>}
                          {meeting.pauta && <div><span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>Pauta</span><div style={{ color: '#cbd5e1', fontSize: '0.78rem', whiteSpace: 'pre-wrap', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>{meeting.pauta}</div></div>}
                          {meeting.notes && <div><span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>Notas</span><div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{meeting.notes}</div></div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Historico Comercial */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Historico comercial</div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {selectedRow.commercialHistory.length ? selectedRow.commercialHistory.map((entry, index) => (
                    <div key={`${entry.title}-${index}`} style={{ padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{entry.title}</div><span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{formatDate(entry.date)}</span></div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: '4px' }}>{entry.detail}</div>
                    </div>
                  )) : <div style={{ padding: '12px', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.78rem' }}>Sem historico comercial.</div>}
                </div>
              </div>
            </>
          )}

          {activeTab === 'contratos' && (
            <>
              {/* Resumo Contrato */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resumo operacional</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  <div className="kpi-card" style={{ padding: '12px' }}><div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Contrato</div><div style={{ marginTop: '6px', color: '#f8fafc', fontWeight: 900 }}>{selectedRow.contractNumber || 'Nao gerado'}</div></div>
                  <div className="kpi-card" style={{ padding: '12px' }}><div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>Valor</div><div style={{ marginTop: '6px', color: '#86efac', fontWeight: 900 }}>{formatCurrency(selectedRow.contractValue)}</div></div>
                </div>
              </div>

              {/* Formulario Contrato */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dados do contrato</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  <input className="input-field" value={contractForm.contractNumber} onChange={(e) => setFormField('contractNumber', e.target.value)} placeholder="Numero" />
                  <input className="input-field" type="number" value={contractForm.contractValue} onChange={(e) => setFormField('contractValue', e.target.value)} placeholder="Valor" />
                  <input className="input-field" type="date" value={contractForm.startAt} onChange={(e) => setFormField('startAt', e.target.value)} />
                  <input className="input-field" type="date" value={contractForm.signedAt} onChange={(e) => setFormField('signedAt', e.target.value)} />
                  <input className="input-field" type="date" value={contractForm.validUntil} onChange={(e) => setFormField('validUntil', e.target.value)} style={{ gridColumn: 'span 2' }} />
                </div>
                <select className="input-field" value={contractForm.status} onChange={(e) => setFormField('status', e.target.value)} style={{ background: 'var(--brand-surface)' }}>
                  <option value="pendente_assinatura">Contrato pendente</option><option value="ativo">Contrato ativo</option><option value="vencido">Vencido</option><option value="cancelado">Cancelado</option>
                </select>
                <textarea className="input-field" rows={3} value={contractForm.notes} onChange={(e) => setFormField('notes', e.target.value)} placeholder="Observacoes" />
                <input className="input-field" placeholder="Link de assinatura (Clicksign, etc)" value={contractForm.signingUrl} onChange={(e) => setFormField('signingUrl', e.target.value)} />
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  <button type="button" className="btn-primary" onClick={handleSaveContract} disabled={isPending}><CheckCircle2 size={16} /> Salvar contrato</button>
                  <button type="button" className="btn-ghost" onClick={handleActivateContract} disabled={isPending || !selectedRow.dealId}><ShieldCheck size={16} /> Ativar</button>
                  <button type="button" className="btn-ghost" onClick={handleRenewContract} disabled={isPending || !selectedRow.contractId}><RefreshCcw size={16} /> Renovar</button>
                  <button type="button" className="btn-ghost" onClick={handleCancelContract} disabled={isPending || !selectedRow.contractId}><AlertTriangle size={16} /> Cancelar</button>
                </div>
              </div>

              {/* Upload PDF */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Documento PDF</div>
                <div style={{ borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', padding: '14px' }}>
                  <input ref={fileInputRef} className="input-field" type="file" accept="application/pdf,.pdf" onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)} />
                  {selectedPdfFile && <button type="button" className="btn-primary" style={{ marginTop: '8px' }} onClick={handleUploadPdf} disabled={isPending}><Upload size={16} /> Enviar PDF</button>}
                  {selectedRow.pdfUrl && !selectedPdfFile && <a href={selectedRow.pdfUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ display: 'inline-flex', marginTop: '8px', textDecoration: 'none' }}><ExternalLink size={16} /> Abrir PDF Atual</a>}
                </div>
              </div>

              {/* Historico do Contrato */}
              <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Historico do contrato</div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {selectedRow.contractHistory.length ? selectedRow.contractHistory.map((entry, index) => (
                    <div key={`${entry.title}-${index}`} style={{ padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{entry.title}</div><span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{formatDate(entry.date)}</span></div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: '4px' }}>{entry.detail}</div>
                    </div>
                  )) : <div style={{ padding: '12px', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.78rem' }}>Sem historico do contrato.</div>}
                </div>
              </div>
            </>
          )}

          {activeTab === 'filiais' && (
            <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={15} color="#22c55e" />
                  <span style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filiais</span>
                  {filiaisLoading ? <Loader2 size={13} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{filiais.length} cadastrada(s)</span>}
                </div>
                <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: '0.76rem', gap: '5px' }} onClick={openNewFilial}><Plus size={13} /> Nova filial</button>
              </div>

              {filialFormOpen && (
                <div style={{ display: 'grid', gap: '10px', padding: '12px', borderRadius: '12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                    <input className="input-field" placeholder="Nome da filial" value={filialForm.nome} onChange={(e) => setFilialForm((f) => ({ ...f, nome: e.target.value }))} />
                    <input className="input-field" placeholder="Documento (CNPJ/CPF)" value={filialForm.documento} onChange={(e) => setFilialForm((f) => ({ ...f, documento: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                    <input className="input-field" placeholder="Cidade" value={filialForm.cidade} onChange={(e) => setFilialForm((f) => ({ ...f, cidade: e.target.value }))} />
                    <input className="input-field" placeholder="Estado" value={filialForm.estado} onChange={(e) => setFilialForm((f) => ({ ...f, estado: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-ghost" onClick={() => { setFilialFormOpen(false); setEditingFilialId(null) }}>Cancelar</button>
                    <button type="button" className="btn-primary" onClick={handleSaveFilial} disabled={filialSaving}><CheckCircle2 size={14} /> {filialSaving ? 'Salvando...' : editingFilialId ? 'Salvar alteracoes' : 'Salvar filial'}</button>
                  </div>
                </div>
              )}

              {filiais.length === 0 && !filiaisLoading && !filialFormOpen && (
                <div style={{ padding: '12px', borderRadius: '12px', border: '1px dashed rgba(148,163,184,0.18)', color: '#94a3b8', fontSize: '0.78rem' }}>Nenhuma filial cadastrada para este cliente ainda.</div>
              )}

              {filiais.map((filial) => (
                <div key={filial.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.04)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{filial.nome}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '2px' }}>
                      {[filial.documento, filial.cidade, filial.estado].filter(Boolean).join(' · ') || 'Sem dados adicionais'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} aria-label={`Editar filial ${filial.nome}`} onClick={() => openEditFilial(filial)}><Edit3 size={13} /></button>
                    <button type="button" className="btn-ghost" style={{ padding: '4px 8px', color: '#f87171' }} aria-label={`Excluir filial ${filial.nome}`} onClick={() => handleDeleteFilial(filial.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'trabalhos' && (
            <div className="glass-card" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BadgeCheck size={15} color="#c084fc" />
                  <span style={{ color: '#c084fc', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trabalhos / Servicos</span>
                  {servicesLoading ? <Loader2 size={13} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{services.length} cadastrado(s)</span>}
                </div>
                <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: '0.76rem', gap: '5px' }} onClick={openNewService}><Plus size={13} /> Novo trabalho</button>
              </div>

              {services.some((service) => service.status === 'ativo') && (() => {
                const activeServices = services.filter((service) => service.status === 'ativo')
                const fixedTotal = activeServices.filter((s) => s.tipo_honorario === 'fixo').reduce((sum, s) => sum + (s.honorario_valor || 0), 0)
                const percentualCount = activeServices.filter((s) => s.tipo_honorario === 'percentual').length
                return (
                  <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700 }}>Honorarios fixos ativos</span>
                      <strong style={{ color: '#c084fc', fontSize: '0.92rem' }}>{formatCurrency(fixedTotal)}</strong>
                    </div>
                    {percentualCount > 0 && (
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>+ {percentualCount} trabalho{percentualCount === 1 ? '' : 's'} com honorario variavel (% sobre a base de calculo de cada um, veja a lista abaixo)</span>
                    )}
                  </div>
                )
              })()}

              {serviceFormOpen && (
                <div style={{ display: 'grid', gap: '10px', padding: '12px', borderRadius: '12px', background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.15)' }}>
                  <input className="input-field" placeholder="Nome do trabalho (ex: ICMS, Trabalhista, Consultoria)" value={serviceForm.nome} onChange={(e) => setServiceForm((f) => ({ ...f, nome: e.target.value }))} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setServiceForm((f) => ({ ...f, tipo_honorario: 'percentual' }))}
                      style={{
                        height: '38px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                        border: `1px solid ${serviceForm.tipo_honorario === 'percentual' ? 'rgba(192,132,252,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        background: serviceForm.tipo_honorario === 'percentual' ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.04)',
                        color: serviceForm.tipo_honorario === 'percentual' ? '#c084fc' : '#94a3b8',
                      }}
                    >
                      Variavel (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceForm((f) => ({ ...f, tipo_honorario: 'fixo' }))}
                      style={{
                        height: '38px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                        border: `1px solid ${serviceForm.tipo_honorario === 'fixo' ? 'rgba(192,132,252,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        background: serviceForm.tipo_honorario === 'fixo' ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.04)',
                        color: serviceForm.tipo_honorario === 'fixo' ? '#c084fc' : '#94a3b8',
                      }}
                    >
                      Fixo (R$)
                    </button>
                  </div>
                  {serviceForm.tipo_honorario === 'percentual' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                      <input className="input-field" type="number" step="0.01" placeholder="Ex: 5" value={serviceForm.honorario_percentual} onChange={(e) => setServiceForm((f) => ({ ...f, honorario_percentual: e.target.value }))} />
                      <input className="input-field" placeholder="Sobre o que? Ex: ICMS recuperado no mes" value={serviceForm.base_calculo} onChange={(e) => setServiceForm((f) => ({ ...f, base_calculo: e.target.value }))} />
                    </div>
                  ) : (
                    <input className="input-field" type="number" step="0.01" placeholder="Valor mensal (R$)" value={serviceForm.honorario_valor} onChange={(e) => setServiceForm((f) => ({ ...f, honorario_valor: e.target.value }))} />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                    <label style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Inicio</span>
                      <input className="input-field" type="date" value={serviceForm.data_inicio} onChange={(e) => setServiceForm((f) => ({ ...f, data_inicio: e.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Fim (se houver)</span>
                      <input className="input-field" type="date" value={serviceForm.data_fim} onChange={(e) => setServiceForm((f) => ({ ...f, data_fim: e.target.value }))} />
                    </label>
                  </div>
                  <select className="input-field" value={serviceForm.status} onChange={(e) => setServiceForm((f) => ({ ...f, status: e.target.value }))} style={{ background: 'var(--brand-surface)' }}>
                    <option value="ativo">Ativo</option>
                    <option value="pausado">Pausado</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                  <textarea className="input-field" rows={2} placeholder="Observacoes" value={serviceForm.notas} onChange={(e) => setServiceForm((f) => ({ ...f, notas: e.target.value }))} />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-ghost" onClick={() => { setServiceFormOpen(false); setEditingServiceId(null) }}>Cancelar</button>
                    <button type="button" className="btn-primary" onClick={handleSaveService} disabled={serviceSaving}><CheckCircle2 size={14} /> {serviceSaving ? 'Salvando...' : editingServiceId ? 'Salvar alteracoes' : 'Salvar trabalho'}</button>
                  </div>
                </div>
              )}

              {services.length === 0 && !servicesLoading && !serviceFormOpen && (
                <div style={{ padding: '12px', borderRadius: '12px', border: '1px dashed rgba(148,163,184,0.18)', color: '#94a3b8', fontSize: '0.78rem' }}>Nenhum trabalho/servico cadastrado para este cliente ainda.</div>
              )}

              {services.map((service) => (
                <div key={service.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(192,132,252,0.15)', background: 'rgba(192,132,252,0.04)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem' }}>{service.nome}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase',
                        color: service.status === 'ativo' ? '#86efac' : service.status === 'pausado' ? '#fbbf24' : '#94a3b8',
                        background: service.status === 'ativo' ? 'rgba(34,197,94,0.12)' : service.status === 'pausado' ? 'rgba(251,191,36,0.12)' : 'rgba(148,163,184,0.12)',
                      }}>
                        {service.status}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '2px' }}>
                      {[
                        service.tipo_honorario === 'fixo'
                          ? (service.honorario_valor ? `${formatCurrency(service.honorario_valor)}/mes` : null)
                          : (service.honorario_percentual ? `${service.honorario_percentual}% ${service.base_calculo ? `sobre ${service.base_calculo}` : '(variavel)'}` : null),
                        service.data_inicio ? `desde ${formatDate(service.data_inicio)}` : null,
                        service.data_fim ? `ate ${formatDate(service.data_fim)}` : null,
                      ].filter(Boolean).join(' · ') || 'Sem honorario definido'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} aria-label={`Editar trabalho ${service.nome}`} onClick={() => openEditService(service)}><Edit3 size={13} /></button>
                    <button type="button" className="btn-ghost" style={{ padding: '4px 8px', color: '#f87171' }} aria-label={`Excluir trabalho ${service.nome}`} onClick={() => handleDeleteService(service.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {callModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }} onClick={(e) => { if (e.target === e.currentTarget) setCallModalOpen(false) }}>
          <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', display: 'grid', gap: '16px' }}>
            <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>Registrar ligacao</div>
            <select className="input-field" value={callForm.outcome} onChange={(e) => setCallForm((f) => ({ ...f, outcome: e.target.value as CallOutcome }))} style={{ background: 'var(--brand-surface)' }}><option value="atendeu">Atendeu</option><option value="nao_atendeu">Nao atendeu</option><option value="recado">Deixou recado</option><option value="reagendado">Reagendado</option></select>
            <input className="input-field" type="number" placeholder="Duração (min)" value={callForm.durationMin} onChange={(e) => setCallForm((f) => ({ ...f, durationMin: e.target.value }))} />
            <input className="input-field" placeholder="Link da gravação" value={callForm.recordingUrl} onChange={(e) => setCallForm((f) => ({ ...f, recordingUrl: e.target.value }))} />
            <textarea className="input-field" rows={2} placeholder="Observações" value={callForm.notes} onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setCallModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleLogCall} disabled={callPending}>{callPending ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />} Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
