/**
 * avatar-utils — Funções utilitárias de avatar que podem rodar no servidor E no cliente.
 * NÃO usa 'use client' — importável em Server Components.
 */

export type AvatarSkin = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type AvatarAccessory =
  | 'none'
  | 'cowboy'       // Chapéu de cowboy + botina — Consultor Rural
  | 'calculator'   // Calculadora — Backoffice / Tributação
  | 'briefcase'    // Maleta — Consultor comercial
  | 'star'         // Estrela — SDR / Hunter
  | 'crown'        // Coroa — líder

/** Determina skin pelo nome do usuário (determinístico, sem randomness) */
export function skinFromName(name: string): AvatarSkin {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return (Math.abs(h) % 7) as AvatarSkin
}

/** Detecta adereço pelo role/produto automaticamente */
export function accessoryFromRole(role?: string, produtoFoco?: string): AvatarAccessory {
  const text = `${role ?? ''} ${produtoFoco ?? ''}`.toLowerCase()

  if (
    text.includes('rural') ||
    text.includes('crédito rural') ||
    text.includes('credito rural') ||
    text.includes('cat 153') ||
    text.includes('produtor') ||
    text.includes('agro')
  ) return 'cowboy'

  if (
    text.includes('tributar') ||
    text.includes('tribut') ||
    text.includes('fiscal') ||
    text.includes('contab') ||
    text.includes('assistente') ||
    text.includes('administrador') ||
    text.includes('gestão') ||
    text.includes('gestor') ||
    text.includes('financeiro')
  ) return 'calculator'

  if (text.includes('sdr') || text.includes('hunter') || text.includes('prospec')) return 'star'

  if (text.includes('consultor') || text.includes('comercial') || text.includes('vendedor')) return 'briefcase'

  return 'none'
}
