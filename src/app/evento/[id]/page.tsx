import { notFound } from 'next/navigation'
import { getEvent } from '@/app/actions/eventos'
import EventoPublicoClient from './evento-publico-client'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const event = await getEvent(params.id)
  
  if (!event) {
    return { title: 'Evento não encontrado' }
  }

  return {
    title: `${event.title} | Palin & Martins`,
    description: event.description || `Inscreva-se no evento ${event.title}`,
    openGraph: {
      title: event.title,
      description: event.description || `Inscreva-se no evento ${event.title}`,
      type: 'article',
    }
  }
}

export default async function EventoPublicoPage({ params }: { params: { id: string } }) {
  const event = await getEvent(params.id)
  
  if (!event) {
    return notFound()
  }

  // Se for evento já realizado ou lotado, poderíamos validar aqui
  // Mas vamos deixar a view lidar pra renderizar "Inscricoes Encerradas"

  return <EventoPublicoClient event={event} />
}
