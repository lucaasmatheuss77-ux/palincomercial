// Server wrapper — force-dynamic impede prerender estático e evita
// "Server Functions cannot be called during initial render" do React 19,
// pois o UsuariosSection chama server action (listUsers) em useEffect.
export const dynamic = 'force-dynamic'

import ConfiguracoesClient from './configuracoes-client'

export default function ConfiguracoesPage() {
  return <ConfiguracoesClient />
}
