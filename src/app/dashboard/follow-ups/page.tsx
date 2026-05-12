import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type FollowUpMeeting = {
  id: string
  title: string
  lead_name: string | null
  company_name: string | null
  next_step: string | null
  next_contact_at: string | null
  owner_name: string | null
  status: string
}

type FollowUpTask = {
  id: string
  title: string
  due_at: string | null
  priority: string
  status: string
  owner_name: string | null
  meeting_id: string | null
}

function formatDate(value: string | null) {
  if (!value) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getUrgencyColor(date: string | null) {
  if (!date) return '#94a3b8'
  const diff = new Date(date).getTime() - Date.now()
  const hours = diff / (1000 * 60 * 60)
  if (hours < 0) return '#f87171'
  if (hours <= 24) return 'var(--brand-primary)'
  return '#86efac'
}

export default async function FollowUpsPage() {
  const supabase = await createClient()

  const [{ data: meetingsData }, { data: tasksData }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, lead_name, company_name, next_step, next_contact_at, owner_name, status')
      .or('next_step.not.is.null,next_contact_at.not.is.null')
      .order('next_contact_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('meeting_tasks')
      .select('id, title, due_at, priority, status, owner_name, meeting_id')
      .neq('status', 'concluida')
      .order('due_at', { ascending: true, nullsFirst: false }),
  ])

  const meetings = (meetingsData || []) as FollowUpMeeting[]
  const tasks = (tasksData || []) as FollowUpTask[]

  const overdueMeetings = meetings.filter((m) => m.next_contact_at && new Date(m.next_contact_at).getTime() < Date.now())
  const todayMeetings = meetings.filter((m) => {
    if (!m.next_contact_at) return false
    return new Date(m.next_contact_at).toDateString() === new Date().toDateString()
  })

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Follow-ups</h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>
            {meetings.length} em aberto
            {overdueMeetings.length > 0 ? <span style={{ color: '#f87171' }}> · {overdueMeetings.length} atrasados</span> : null}
            {todayMeetings.length > 0 ? <span style={{ color: 'var(--brand-primary)' }}> · {todayMeetings.length} para hoje</span> : null}
          </p>
        </div>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '18px' }}>
        <div className="glass-card" style={{ padding: '22px', display: 'grid', gap: '12px' }}>
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 850, fontSize: '1rem' }}>Proximos contatos</div>
            <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: '4px' }}>Sequencia recomendada a partir das reunioes e combinados.</div>
          </div>

          {meetings.length ? meetings.map((meeting) => (
            <div key={meeting.id} style={{ padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>{meeting.title}</div>
                <span style={{ color: getUrgencyColor(meeting.next_contact_at), fontSize: '0.78rem', fontWeight: 800 }}>
                  {formatDate(meeting.next_contact_at)}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                {(meeting.lead_name || 'Lead nao informado') + (meeting.company_name ? ` - ${meeting.company_name}` : '')}
              </div>
              <div style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {meeting.next_step || 'Sem proximo passo definido.'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                Responsavel: {meeting.owner_name || 'Sem responsavel'} · Status: {meeting.status}
              </div>
            </div>
          )) : (
            <div style={{ padding: '18px', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              Nenhum follow-up registrado ainda.
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: '22px', display: 'grid', gap: '12px' }}>
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 850, fontSize: '1rem' }}>Tarefas abertas</div>
            <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: '4px' }}>Checklist comercial e operacional em andamento.</div>
          </div>

          {tasks.length ? tasks.map((task) => (
            <div key={task.id} style={{ padding: '14px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>{task.title}</div>
                <span style={{ color: task.priority === 'Alta' ? '#f87171' : 'var(--brand-primary)', fontSize: '0.76rem', fontWeight: 800 }}>
                  {task.priority}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Prazo: {formatDate(task.due_at)}</div>
              <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Responsavel: {task.owner_name || 'Sem responsavel'}</div>
            </div>
          )) : (
            <div style={{ padding: '18px', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              Nenhuma tarefa de follow-up em aberto.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
