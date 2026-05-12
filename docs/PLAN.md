# Plano de Estabilização e Overhaul Premium (Web & Mobile)

Este plano visa resolver a falha na celebração de vendas no Web, isolar completamente o ambiente Mobile e elevar o design para um nível "Premium State of the Art" usando o sistema UI/UX Pro Max.

## Problemas Identificados
1. **Confetes Web**: Falha no trigger do Supabase Realtime ou execução da biblioteca.
2. **Isolamento Mobile**: O usuário não quer links do Mobile no Web Dashboard.
3. **Design Mobile**: Necessidade de uma interface mais "viva", bonita e objetiva (estilo App nativo).

## Agentes Envolvidos (Orquestração)
1. `project-planner`: Coordenação e manutenção do plano.
2. `backend-specialist`: Correção do trigger de confetes (Realtime) e validação de banco.
3. `frontend-specialist`: Overhaul visual do Mobile e limpeza da UI Web.
4. `test-engineer`: Verificação final de todos os fluxos.

## Mudanças Propostas

### 1. Celebração de Vendas (Web)
- **Status**: [MODIFY] `src/app/dashboard/layout.tsx`
- **Ação**: Refatorar o listener do Supabase Realtime para ser mais resiliente (reconexão automática e log de eventos).
- **Ação**: Garantir que o `canvas-confetti` seja disparado corretamente no contexto do cliente.

### 2. Isolamento do Ecossistema Mobile
- **Status**: [MODIFY] `src/app/dashboard/layout.tsx`
- **Ação**: Remover o item "Pocket CRM" da barra lateral do dashboard.
- **Ação**: Garantir que `/mobile` seja o único ponto de entrada para consultores em campo.

### 3. Overhaul "UI/UX Pro Max" (Mobile)
- **Status**: [MODIFY] `src/app/dashboard/mobile-crm/mobile-client.tsx`
- **Estilo**: Glassmorphism Futurista (Deep Spatial).
- **Paleta**: Ocean Depth (#0f172a, #38bdf8, #10b981).
- **Componentes**: 
  - Cartões com blur dinâmico e bordas de gradiente sutil.
  - Radar de Leads com scanner circular real (SVG animado).
  - Feedback tátil visual (micro-interações ao clicar).

## Cronograma de Execução
1. **Fase 1**: Correção dos Confetes e Remoção de links (Backend/Frontend Foundation).
2. **Fase 2**: Overhaul Visual do Pocket CRM (Frontend Premium).
3. **Fase 3**: Testes de ponta a ponta e scripts de verificação (QA).

---

## Você aprova este plano? (Y/N)
- Y: Iniciar implementação paralela com os agentes.
- N: Ajustar pontos específicos.
