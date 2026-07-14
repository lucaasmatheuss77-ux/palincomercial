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
import { formatCnpj } from '@/lib/formatters'
import type { ClientRow } from '../clientes/clientes-client'

const MAIN_HONORARIO_SERVICE_NAME = 'Honorário do Contrato Principal'
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
function getHonorarioDisplay(selectedRow: ClientRow): { label: string; value: string } {
  if (selectedRow.contractValue && selectedRow.contractValue > 0) {
    return { label: 'Valor do contrato', value: formatCurrency(selectedRow.contractValue) }
  }
  const activeService = selectedRow.services?.find((service) => service.nome === MAIN_HONORARIO_SERVICE_NAME && service.status === 'ativo')
    || selectedRow.services?.find((service) => service.status === 'ativo')
    || selectedRow.services?.[0]
  if (activeService?.tipo_honorario === 'fixo' && activeService.honorario_valor) {
    return { label: 'Honorário fixo', value: formatCurrency(activeService.honorario_valor) }
  }
  if (activeService?.tipo_honorario === 'percentual' && activeService.honorario_percentual) {
    return { label: 'Honorário variável', value: `${activeService.honorario_percentual}%` }
  }
  return { label: 'Honorário', value: 'A definir' }
}

export function ClientDetailsPanel({ selectedRow, onClose }: { selectedRow: ClientRow; onClose: () => void }) {
  const [contractForm, setContractForm] = useState({ contractNumber: '', contractValue: '', contractPercentual: '', honorarioTipo: 'fixo' as 'fixo' | 'percentual', startAt: '', signedAt: '', validUntil: '', notes: '', status: 'pendente_assinatura', signingUrl: '' })
  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '', whatsapp: '', document: '', segmento: '', cidade: '', estado: '', notas: '' })
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
  const honorarioDisplay = getHonorarioDisplay(selectedRow)
  const displayRazaoSocial = selectedRow.razaoSocial || selectedRow.company || selectedRow.name
  const displayContactName = selectedRow.contactName || selectedRow.name

  useEffect(() => {
    if (!selectedRow) return
    setContractForm({
      contractNumber: selectedRow.contractNumber || '', contractValue: selectedRow.contractValue ? String(selectedRow.contractValue) : '', contractPercentual: '', honorarioTipo: selectedRow.contractValue && selectedRow.contractValue > 0 ? 'fixo' : 'fixo', startAt: selectedRow.contractStartAt ? selectedRow.contractStartAt.slice(0, 10) : '', signedAt: selectedRow.contractSignedAt ? selectedRow.contractSignedAt.slice(0, 10) : '', validUntil: selectedRow.contractValidUntil ? selectedRow.contractValidUntil.slice(0, 10) : '', notes: selectedRow.contractNotes || '',
      status: selectedRow.clientStatusLabel === 'Contrato ativo' || selectedRow.clientStatusLabel === 'A vencer' ? 'ativo' : selectedRow.clientStatusLabel === 'Contrato cancelado' ? 'cancelado' : selectedRow.clientStatusLabel === 'Vencido' ? 'vencido' : 'pendente_assinatura',
      signingUrl: selectedRow.signingUrl || '',
    })
    setClientForm({
      name: selectedRow.contactName || '',
      company: selectedRow.razaoSocial || selectedRow.company || '',
      email: selectedRow.email || '',
      phone: selectedRow.phone || '',
      whatsapp: selectedRow.whatsapp || '',
      document: formatCnpj(selectedRow.document),
      segmento: selectedRow.segmento || '',
      cidade: selectedRow.cidade || '',
      estado: selectedRow.estado || '',
      notas: selectedRow.notas || '',
    })
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
    setFilialForm({ nome: filial.nome, documento: formatCnpj(filial.documento), cidade: filial.cidade || '', estado: filial.estado || '' })
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
        documento: formatCnpj(filialForm.documento) || null,
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
      .then((result) => {
        setServices(result)
        const mainHonorario = result.find((service) => service.nome === MAIN_HONORARIO_SERVICE_NAME)
        if (mainHonorario?.tipo_honorario === 'percentual' && mainHonorario.honorario_percentual != null) {
          setContractForm((current) => ({ ...current, honorarioTipo: 'percentual', contractPercentual: String(mainHonorario.honorario_percentual) }))
        }
      })
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
    try { await navigator.clipboard.writeText(contact); toast.success('Contato copiado.') } catch { toast.error('Não foi possível copiar o contato.') }
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
      formData.append('client_id', selectedRow?.clientRecordId || '')
      const response = await fetch('/api/meetings/transcribe', { method: 'POST', body: formData })
      const data = await response.json() as { transcription?: string; summary?: string; action_items?: string[]; error?: string }
      if (!response.ok || data.error) { toast.error(data.error || 'Erro ao transcrever áudio.'); return }
      setMeetingForm((current) => ({
        ...current,
        pauta: data.transcription || current.pauta,
        notes: data.summary ? (current.notes ? current.notes + '\n\nResumo IA:\n' + data.summary : 'Resumo IA:\n' + data.summary) : current.notes,
      }))
      toast.success('Áudio transcrito e resumido pela IA!')
    } catch { toast.error('Falha ao enviar áudio.') } finally { setAudioUploading(false) }
  }

  function handleSaveMeeting() {
    if (!selectedRow?.clientRecordId) return
    if (!meetingForm.title.trim()) { toast.error('Informe o título da reunião.'); return }
    if (!meetingForm.meeting_date) { toast.error('Informe a data da reunião.'); return }
    startTransition(async () => {
      const result = await createClientMeeting(selectedRow.clientRecordId, {
        meeting_date: meetingForm.meeting_date, title: meetingForm.title.trim(), recording_link: meetingForm.recording_link.trim() || null, pauta: meetingForm.pauta.trim() || null, notes: meetingForm.notes.trim() || null, participants: meetingForm.participants.trim() || null, duration_min: meetingForm.duration_min ? Number(meetingForm.duration_min) : null, ai_generated: meetingForm.pauta.length > 0 && pautaLoading === false,
      })
      if (!result.success) { toast.error(result.error || 'Erro ao salvar reunião.'); return }
      toast.success('Reuniao registrada.')
      setMeetingFormOpen(false)
      setMeetingForm({ meeting_date: new Date().toISOString().split('T')[0], title: '', recording_link: '', participants: '', duration_min: '', pauta: '', notes: '' })
      const updated = await listClientMeetings(selectedRow.clientRecordId)
      setMeetings(updated.data)
    })
  }

  function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Tem certeza que deseja excluir esta reunião?')) return
    startTransition(async () => {
      const result = await deleteClientMeeting(meetingId)
      if (!result.success) { toast.error(result.error || 'Erro ao excluir reunião.'); return }
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
    if (!selectedRow?.clientRecordId) return
    startTransition(async () => {
      if (contractForm.honorarioTipo === 'percentual') {
        const percentualValue = Number(contractForm.contractPercentual || 0)
        if (!percentualValue) { toast.error('Informe o percentual do honorário.'); return }
        const existing = services.find((service) => service.nome === MAIN_HONORARIO_SERVICE_NAME)
        const payload = {
          client_id: selectedRow.clientRecordId, nome: MAIN_HONORARIO_SERVICE_NAME, tipo_honorario: 'percentual' as const,
          honorario_valor: null, honorario_percentual: percentualValue, base_calculo: null, status: 'ativo', data_inicio: null, data_fim: null, notas: null,
        }
        const serviceResult = existing ? await updateClientService(existing.id, payload) : await createClientService(payload)
        if (!serviceResult.success) { toast.error(serviceResult.error || 'Não foi possível salvar o honorário.'); return }
        setServices(await listClientServices(selectedRow.clientRecordId))
      } else {
        const existing = services.find((service) => service.nome === MAIN_HONORARIO_SERVICE_NAME)
        if (existing) {
          await deleteClientService(existing.id)
          setServices(await listClientServices(selectedRow.clientRecordId))
        }
      }

      if (!selectedRow.dealId) {
        toast.success('Honorário atualizado. Feche o lead no fluxo comercial para também gerar número/datas do contrato.')
        return
      }

      const result = await saveClientContract({
        deal_id: selectedRow.dealId, lead_id: selectedRow.leadId, client_id: selectedRow.clientRecordId, contract_number: contractForm.contractNumber || null, value: contractForm.honorarioTipo === 'fixo' ? Number(contractForm.contractValue || 0) : 0, start_date: contractForm.startAt ? new Date(contractForm.startAt).toISOString() : null, signed_at: contractForm.signedAt ? new Date(contractForm.signedAt).toISOString() : null, end_date: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : null, notes: contractForm.notes || null, status: contractForm.status, signing_url: contractForm.signingUrl.trim() || null,
      })
      if (!result.success) { toast.error(result.error || 'Não foi possível salvar o contrato.'); return }
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
      if (!result.success) { toast.error(result.error || 'Não foi possível enviar o PDF.'); return }
      setSelectedPdfFile(null); setSelectedPdfPreview('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('PDF do contrato enviado com sucesso.')
    })
  }

  function handleSaveClient() {
    if (!selectedRow?.clientRecordId) { toast.error('Cliente nao encontrado para atualizacao.'); return }
    startTransition(async () => {
      const result = await updateClient(selectedRow.clientRecordId, {
        name: clientForm.name || undefined,
        company_name: clientForm.company || null,
        email: clientForm.email || null,
        phone: clientForm.phone || null,
        whatsapp: clientForm.whatsapp || null,
        documento: formatCnpj(clientForm.document) || undefined,
        segmento: clientForm.segmento || null,
        cidade: clientForm.cidade || null,
        estado: clientForm.estado || null,
        notas: clientForm.notas || null,
      })
      if (!result.success) { toast.error(result.error || 'Não foi possível salvar o cliente.'); return }
      toast.success('Cadastro do cliente atualizado. Reabra a tela para ver os dados consolidados.')
    })
  }

  function handleActivateContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Salve o contrato primeiro para depois ativar.'); return }
    startTransition(async () => {
      const result = await activateContract(contractId, { signed_at: contractForm.signedAt ? new Date(contractForm.signedAt).toISOString() : undefined, end_date: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : undefined, notes: contractForm.notes || undefined })
      if (!result.success) { toast.error(result.error || 'Não foi possível ativar o contrato.'); return }
      toast.success('Contrato ativado. Reabra a tela para ver o status atualizado.')
    })
  }

  function handleCancelContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Nao existe contrato para cancelar.'); return }
    startTransition(async () => {
      const result = await cancelContract(contractId, contractForm.notes || undefined)
      if (!result.success) { toast.error(result.error || 'Não foi possível cancelar o contrato.'); return }
      toast.success('Contrato cancelado. Reabra a tela para ver o status atualizado.')
    })
  }

  function handleRenewContract() {
    const contractId = selectedRow?.contractId
    if (!contractId) { toast.error('Nao existe contrato para renovar.'); return }
    startTransition(async () => {
      const result = await renewContract(contractId, { start_date: contractForm.startAt ? new Date(contractForm.startAt).toISOString() : null, end_date: contractForm.validUntil ? new Date(contractForm.validUntil).toISOString() : null })
      if (!result.success) { toast.error(result.error || 'Não foi possível gerar a renovação.'); return }
      toast.success('Renovacao criada. Reabra a tela para ver o novo ciclo contratual.')
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '1200px', height: 'calc(100vh - 40px)', maxHeight: '95vh',
          background: 'linear-gradient(to bottom, #0f172a, #020617)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        {/* HEADER */}
        <div style={{ padding: '28px 36px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{displayRazaoSocial}</div>
              <span style={{ padding: '6px 14px', borderRadius: '999px', color: selectedTone.color, background: selectedTone.background, border: `1px solid ${selectedTone.border}`, fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {selectedRow.clientStatusLabel}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '20px', fontWeight: 500 }}>
              {displayContactName && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><PhoneCall size={15}/>Contato: {displayContactName}</span>}
              {selectedRow.document && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={15}/>{formatCnpj(selectedRow.document)}</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BadgeCheck size={15}/>{selectedRow.product}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>Consultor: <strong style={{ color: '#f8fafc' }}>{selectedRow.consultant}</strong></span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#94a3b8', cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444' }} onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY (2-COLUMN GRID) */}
        <div style={{ padding: '32px 36px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(360px, 450px) minmax(0, 1fr)', gap: '32px', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Client Data, Meetings, Filiais */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* QUICK ACTIONS */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {selectedRow.whatsapp && (
               <button type="button" onClick={() => window.open(`https://wa.me/55${selectedRow.whatsapp?.replace(/\D/g, '')}`, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: '1px solid rgba(34,197,94,0.5)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.2)' }}><MessageCircle size={16} /> Falar no WhatsApp</button>
            )}
            <button type="button" onClick={() => setCallModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}><Phone size={16} /> Registrar Ligação</button>
            <button type="button" onClick={copyContact} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}><Copy size={16} /> Copiar Contatos</button>
          </div>

          {/* RESUMO RAPIDO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Origem</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}>{selectedRow.sourceLabel || 'Nao informada'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Cliente desde</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}>{formatDate(selectedRow.createdAt)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Status do contrato</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}>{selectedRow.contractStatusLabel || 'Sem contrato'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Vencimento</div>
              <div style={{ color: selectedRow.daysToExpire !== null && selectedRow.daysToExpire <= 90 ? '#facc15' : '#e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}>
                {selectedRow.contractValidUntil ? formatDate(selectedRow.contractValidUntil) : 'Nao definido'}
              </div>
            </div>
          </div>

          {/* DADOS CADASTRAIS (RECEITA E OUTROS) */}
          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} color="#94a3b8" /> Dados Cadastrais & Empresa
              </div>
              <button type="button" onClick={handleSaveClient} style={{ background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Edit3 size={14} /> Salvar Alterações</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Contato principal</label>
                <input className="input-field" value={clientForm.name} onChange={e => setClientField('name', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>CNPJ / CPF</label>
                <input className="input-field" value={clientForm.document} onChange={e => setClientField('document', formatCnpj(e.target.value))} placeholder="00.000.000/0001-00" inputMode="numeric" style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Razão Social</label>
                <input className="input-field" value={clientForm.company} onChange={e => setClientField('company', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>E-mail</label>
                <input className="input-field" value={clientForm.email} onChange={e => setClientField('email', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Telefone</label>
                <input className="input-field" value={clientForm.phone} onChange={e => setClientField('phone', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>WhatsApp</label>
                <input className="input-field" value={clientForm.whatsapp} onChange={e => setClientField('whatsapp', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Segmento</label>
                <input className="input-field" value={clientForm.segmento} onChange={e => setClientField('segmento', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Cidade</label>
                <input className="input-field" value={clientForm.cidade} onChange={e => setClientField('cidade', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Estado</label>
                <input className="input-field" value={clientForm.estado} maxLength={2} onChange={e => setClientField('estado', e.target.value.toUpperCase())} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Observações cadastrais</label>
                <textarea className="input-field" rows={3} value={clientForm.notas} onChange={e => setClientField('notas', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
            </div>
          </div>


            
            {/* COLUMN: MEETINGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '1.1rem', fontWeight: 900 }}>
                  <Video size={20} color="#38bdf8" /> Reuniões Agendadas
                </div>
                <button type="button" onClick={() => setMeetingFormOpen(true)} style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '8px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> Marcar Reunião</button>
              </div>

              {meetingsLoading ? (
                <div style={{ padding: '32px 24px', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>Carregando reuniões...</div>
              ) : meetings.length === 0 ? (
                <div style={{ padding: '32px 24px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px', color: '#64748b', fontSize: '0.9rem', textAlign: 'center', fontWeight: 500 }}>Nenhuma reunião registrada no histórico.</div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {meetings.map((m) => (
                    <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.95rem' }}>{m.title}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>{formatDate(m.meeting_date)} {m.duration_min ? `· ${m.duration_min} min` : ''}</div>
                        </div>
                        <button type="button" onClick={() => handleDeleteMeeting(m.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                      {m.pauta && <div style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>{m.pauta}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LEFT: FILIAIS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '1.1rem', fontWeight: 900 }}>
                  <Building2 size={20} color="#93c5fd" /> Filiais ({filiais.length})
                </div>
                <button type="button" onClick={openNewFilial} style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.25)', padding: '8px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> Nova filial</button>
              </div>

              {filiaisLoading ? (
                <div style={{ padding: '32px 24px', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>Carregando filiais...</div>
              ) : filiais.length === 0 ? (
                <div style={{ padding: '32px 24px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px', color: '#64748b', fontSize: '0.9rem', textAlign: 'center', fontWeight: 500 }}>Nenhuma filial cadastrada.</div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {filiais.map((filial) => (
                    <div key={filial.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.95rem' }}>{filial.nome}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '4px' }}>
                          {[formatCnpj(filial.documento), [filial.cidade, filial.estado].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Sem dados adicionais'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => openEditFilial(filial)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Edit3 size={15} /></button>
                        <button type="button" onClick={() => handleDeleteFilial(filial.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: CONTRACTS & SERVICES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', minWidth: 0 }}>
            {/* COLUMN: CONTRACTS & SERVICES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '1.1rem', fontWeight: 900 }}>
                  <ShieldCheck size={20} color="#f59e0b" /> Contratos & Trabalhos
                </div>
                <button type="button" onClick={openNewService} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '8px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> Adicionar</button>
              </div>
              
              <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(0,0,0,0))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '24px', display: 'grid', gap: '16px', minWidth: 0 }}>
                <div>
                  <div style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Contrato Principal</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'end', gap: '16px' }}>
                    <div style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 900 }}>{selectedRow.contractNumber || 'Ainda não gerado'}</div>
                    <div style={{ textAlign: 'right', minWidth: '140px' }}>
                      <div style={{ color: '#4ade80', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{honorarioDisplay.label}</div>
                      <div style={{ color: '#86efac', fontSize: '1.4rem', fontWeight: 900, overflowWrap: 'anywhere' }}>{honorarioDisplay.value}</div>
                    </div>
                  </div>
                </div>

                <input className="input-field" placeholder="Numero do contrato" value={contractForm.contractNumber} onChange={(e) => setFormField('contractNumber', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />

                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    <button type="button" onClick={() => setFormField('honorarioTipo', 'fixo')} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', border: `1px solid ${contractForm.honorarioTipo === 'fixo' ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.1)'}`, background: contractForm.honorarioTipo === 'fixo' ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.2)', color: contractForm.honorarioTipo === 'fixo' ? '#4ade80' : '#94a3b8' }}>Valor Fixo (R$)</button>
                    <button type="button" onClick={() => setFormField('honorarioTipo', 'percentual')} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', border: `1px solid ${contractForm.honorarioTipo === 'percentual' ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.1)'}`, background: contractForm.honorarioTipo === 'percentual' ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.2)', color: contractForm.honorarioTipo === 'percentual' ? '#4ade80' : '#94a3b8' }}>Honorário Variável (%)</button>
                  </div>
                  {contractForm.honorarioTipo === 'fixo' ? (
                    <input className="input-field" type="number" placeholder="Valor (R$)" value={contractForm.contractValue} onChange={(e) => setFormField('contractValue', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                  ) : (
                    <input className="input-field" type="number" placeholder="Percentual (ex: 15)" value={contractForm.contractPercentual} onChange={(e) => setFormField('contractPercentual', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                  )}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>Inicio</span>
                    <input className="input-field" type="date" value={contractForm.startAt} onChange={(e) => setFormField('startAt', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>Assinado em</span>
                    <input className="input-field" type="date" value={contractForm.signedAt} onChange={(e) => setFormField('signedAt', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>Vencimento</span>
                    <input className="input-field" type="date" value={contractForm.validUntil} onChange={(e) => setFormField('validUntil', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                  </label>
                </div>
                <textarea className="input-field" rows={2} placeholder="Notas do contrato" value={contractForm.notes} onChange={(e) => setFormField('notes', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button type="button" onClick={handleSaveContract} disabled={isPending} style={{ background: 'rgba(34,197,94,0.12)', color: '#86efac', border: '1px solid rgba(34,197,94,0.25)', padding: '9px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>Salvar Contrato</button>
                  <button type="button" onClick={handleActivateContract} disabled={isPending} style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '9px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Ativar</button>
                  <button type="button" onClick={handleRenewContract} disabled={isPending} style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.25)', padding: '9px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><RefreshCcw size={14} /> Renovar</button>
                  <button type="button" onClick={handleCancelContract} disabled={isPending} style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', padding: '9px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                  <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px dashed rgba(147,197,253,0.4)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: '1 1 220px' }}
                  >
                    <Upload size={14} /> {selectedPdfFile ? selectedPdfFile.name : selectedRow.pdfName ? 'Trocar PDF' : 'Escolher PDF'}
                  </button>
                  <button type="button" onClick={handleUploadPdf} disabled={isPending || !selectedPdfFile} style={{ background: selectedPdfFile ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', color: selectedPdfFile ? '#86efac' : '#64748b', border: selectedPdfFile ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: selectedPdfFile ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Enviar PDF</button>
                  {selectedPdfPreview && <a href={selectedPdfPreview} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><ExternalLink size={12} /> Abrir selecionado</a>}
                </div>
              </div>

              {services.length > 0 && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {servicesLoading && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Atualizando trabalhos...</div>}
                  {services.map((s) => (
                    <div key={s.id} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.95rem' }}>{s.nome}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>Status: {s.status}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: '#f59e0b', fontWeight: 900, fontSize: '1.1rem' }}>
                          {s.tipo_honorario === 'fixo' ? formatCurrency(s.honorario_valor || 0) : `${s.honorario_percentual}%`}
                        </div>
                        <button type="button" onClick={() => openEditService(s)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Edit3 size={15} /></button>
                        <button type="button" onClick={() => handleDeleteService(s.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>


          </div>
        </div>
      </div>

      {/* MODAL: FILIAL */}
      {filialFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }} onClick={(e) => { if (e.target === e.currentTarget) setFilialFormOpen(false) }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '450px', display: 'grid', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
            <div style={{ fontWeight: 900, color: '#f8fafc', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Building2 size={20} color="#93c5fd" /> {editingFilialId ? 'Editar Filial' : 'Nova Filial'}</div>
            <input className="input-field" placeholder="Nome da filial" value={filialForm.nome} onChange={(e) => setFilialForm((f) => ({ ...f, nome: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            <input className="input-field" placeholder="00.000.000/0001-00" value={filialForm.documento} onChange={(e) => setFilialForm((f) => ({ ...f, documento: formatCnpj(e.target.value) }))} inputMode="numeric" style={{ background: 'rgba(0,0,0,0.2)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input className="input-field" placeholder="Cidade" value={filialForm.cidade} onChange={(e) => setFilialForm((f) => ({ ...f, cidade: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
              <input className="input-field" placeholder="Estado (UF)" maxLength={2} value={filialForm.estado} onChange={(e) => setFilialForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setFilialFormOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={handleSaveFilial} disabled={filialSaving} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>{filialSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Salvar Filial</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR LIGAÇÃO */}
      {callModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }} onClick={(e) => { if (e.target === e.currentTarget) setCallModalOpen(false) }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '450px', display: 'grid', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
            <div style={{ fontWeight: 900, color: '#f8fafc', fontSize: '1.2rem' }}>Registrar Ligação</div>
            <select className="input-field" value={callForm.outcome} onChange={(e) => setCallForm((f) => ({ ...f, outcome: e.target.value as CallOutcome }))} style={{ background: 'rgba(0,0,0,0.2)' }}><option value="atendeu">Atendeu</option><option value="nao_atendeu">Nao atendeu</option><option value="recado">Deixou recado</option><option value="reagendado">Reagendado</option></select>
            <input className="input-field" type="number" placeholder="Duração (minutos)" value={callForm.durationMin} onChange={(e) => setCallForm((f) => ({ ...f, durationMin: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }}/>
            <input className="input-field" placeholder="Link da gravação (Opcional)" value={callForm.recordingUrl} onChange={(e) => setCallForm((f) => ({ ...f, recordingUrl: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }}/>
            <textarea className="input-field" rows={3} placeholder="Anotações da ligação" value={callForm.notes} onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }}/>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setCallModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={handleLogCall} disabled={callPending} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>{callPending ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} Salvar Registro</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MARCAR REUNIÃO */}
      {meetingFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }} onClick={(e) => { if (e.target === e.currentTarget) setMeetingFormOpen(false) }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '550px', display: 'grid', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
            <div style={{ fontWeight: 900, color: '#f8fafc', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Video size={20} color="#38bdf8" /> Agendar Reunião</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input className="input-field" type="date" value={meetingForm.meeting_date} onChange={(e) => setMeetingForm((f) => ({ ...f, meeting_date: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
              <input className="input-field" placeholder="Título da reunião" value={meetingForm.title} onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            </div>
            <textarea className="input-field" rows={4} placeholder="Pauta ou Notas..." value={meetingForm.pauta} onChange={(e) => setMeetingForm((f) => ({ ...f, pauta: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={handleGeneratePauta} disabled={pautaLoading} style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)', padding: '8px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {pautaLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Gerar pauta com IA
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: '10px' }}>
                {audioUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Transcrever áudio ou vídeo
                <input type="file" accept="audio/*,video/*" onChange={handleUploadAudio} disabled={audioUploading} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setMeetingFormOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={handleSaveMeeting} disabled={isPending} style={{ background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(56,189,248,0.3)' }}><CheckCircle2 size={16} /> Confirmar Reunião</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO SERVIÇO */}
      {serviceFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }} onClick={(e) => { if (e.target === e.currentTarget) setServiceFormOpen(false) }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '500px', display: 'grid', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
            <div style={{ fontWeight: 900, color: '#f8fafc', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={20} color="#c084fc" /> Novo Trabalho/Contrato</div>
            <input className="input-field" placeholder="Nome do Serviço (ex: Trabalhista)" value={serviceForm.nome} onChange={(e) => setServiceForm((f) => ({ ...f, nome: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button type="button" onClick={() => setServiceForm((f) => ({ ...f, tipo_honorario: 'fixo' }))} style={{ padding: '12px', borderRadius: '10px', fontWeight: 800, border: `1px solid ${serviceForm.tipo_honorario === 'fixo' ? '#c084fc' : 'rgba(255,255,255,0.1)'}`, background: serviceForm.tipo_honorario === 'fixo' ? 'rgba(192,132,252,0.1)' : 'rgba(0,0,0,0.2)', color: serviceForm.tipo_honorario === 'fixo' ? '#c084fc' : '#94a3b8' }}>Valor Fixo</button>
              <button type="button" onClick={() => setServiceForm((f) => ({ ...f, tipo_honorario: 'percentual' }))} style={{ padding: '12px', borderRadius: '10px', fontWeight: 800, border: `1px solid ${serviceForm.tipo_honorario === 'percentual' ? '#c084fc' : 'rgba(255,255,255,0.1)'}`, background: serviceForm.tipo_honorario === 'percentual' ? 'rgba(192,132,252,0.1)' : 'rgba(0,0,0,0.2)', color: serviceForm.tipo_honorario === 'percentual' ? '#c084fc' : '#94a3b8' }}>Percentual (%)</button>
            </div>
            {serviceForm.tipo_honorario === 'fixo' ? (
              <input className="input-field" type="number" placeholder="Valor (R$)" value={serviceForm.honorario_valor} onChange={(e) => setServiceForm((f) => ({ ...f, honorario_valor: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            ) : (
              <input className="input-field" type="number" placeholder="Percentual (ex: 15)" value={serviceForm.honorario_percentual} onChange={(e) => setServiceForm((f) => ({ ...f, honorario_percentual: e.target.value }))} style={{ background: 'rgba(0,0,0,0.2)' }} />
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setServiceFormOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={handleSaveService} disabled={serviceSaving} style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(168,85,247,0.3)' }}><CheckCircle2 size={16} /> Salvar Serviço</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

