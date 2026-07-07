# PLAN.md - Comercial Palin Updates

## 1. Atenção Requerida (SLAs) Restructuring
**Target File**: `src/app/dashboard/pipeline/pipeline-board.tsx`
- Update `CADENCE_DAYS` mapping to reflect the new strict SLAs:
  - `Contato Inicial`: 1 day (Priority)
  - `Qualificacao`: Start counting days and prompt consultant to contact.
  - `Apresentacao`: Track days actively.
  - `Proposta`: Max 2 days limit.
- Update `getStalledStyle()` and `getLeadAttention()` to enforce these new SLA limits and display prominent warnings when the SLA is breached, especially for `Contato Inicial` and `Proposta`.

## 2. Card Reversion Logic (Backward Movement)
**Target File**: `src/app/dashboard/pipeline/pipeline-board.tsx` (and potentially a new server action)
- In the `handleDrop` function, compare the indexes of `newStage` and `currentLead.stage` using the `stages` array.
- **Condition**: If `stages.indexOf(newStage) < stages.indexOf(currentLead.stage)` (moving backwards):
  - **Do NOT** trigger `triggerSingleBoom()` or `triggerSaleConfetti()`.
  - **Do** trigger a notification/alert to the manager/admin (e.g., via a new server action `notifyManagerReversion` or toast indicating an audit is required).
- Maintain the normal effects for forward movements.

## 3. Pitch and System AI Fix
**Target Files**: 
- `src/app/dashboard/perfil-cliente/page.tsx`
- `src/app/api/assistant/agenda/route.ts` (and possibly other AI routes)
- **Action**: Fix the AI integration. The `/api/assistant/agenda/route.ts` file seems to setup the AI client (`createOpenAI`), but requires proper `generateText` implementation using `model: openai('gpt-4o')` or similar. 
- Ensure `gerarPitch` in `page.tsx` correctly handles the API response and displays the generated pitch.

## 4. Fechamento Stage UI Update
**Target File**: `src/app/dashboard/pipeline/pipeline-board.tsx`
- **Action**: Modify the lead edit modal or card AI section.
- **Condition**: If `lead.stage === 'Fechado'`:
  - Hide the standard AI suggestions/help.
  - Display a question: "Contrato arquivado e assinado?" with a confirmation button.
  - When the button is clicked, update the lead's state (e.g., set `contract_status_label` to `'arquivado'`) and hide the question/button entirely.
- Maintain and improve the existing automation/AI suggestions in the "Proposta" stage as requested by the user.
