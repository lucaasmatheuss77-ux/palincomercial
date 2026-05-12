# Plano de Correção: Login Mobile Premium

Este plano visa transformar a tela de login mobile de um layout quebrado em uma experiência de alta fidelidade, idêntica ao Web, seguindo os padrões Ouro e Preto.

## Problemas Identificados (via Screenshot)
1. **Falha de CSS**: Os estilos parecem não estar sendo aplicados (fallback para HTML padrão).
2. **Alinhamento**: Itens desalinhados à esquerda; falta de centralização vertical/horizontal.
3. **Escala**: Logo e campos fora de proporção.

## Ações de Orquestração

### 1. Refatoração de Estilo (`frontend-specialist`)
- **Ação**: Converter `styled-jsx` para classes nativas do Tailwind CSS para garantir compatibilidade máxima.
- **Ação**: Implementar container `flex` centralizado com `min-h-screen`.
- **Ação**: Aplicar o tema "Palin Gold":
    - Fundo: `#070c08` (Black Depth).
    - Bordas: `rgba(251,191,36,0.2)` (Gold Glow).
    - Inputs: Estilo glassmorphism com texto escuro e fundo claro/transparente.

### 2. Ajuste de Responsividade (`frontend-specialist`)
- **Ação**: Garantir `max-w-md` no card de login para telas pequenas.
- **Ação**: Otimizar o tamanho do logo para 200px no mobile (em vez de 280px).

### 3. Validação (`test-engineer`)
- **Ação**: Verificar renderização em `localhost:3001/login` simulando dispositivos móveis.
- **Ação**: Garantir que o teclado mobile não quebre o layout (uso de `flex-col` inteligente).

## Entrega
- [ ] Tela de login centralizada e estilizada.
- [ ] Botão "Acessar" com gradiente Ouro e sombra pulsante.
- [ ] Placeholder e ícones alinhados.
