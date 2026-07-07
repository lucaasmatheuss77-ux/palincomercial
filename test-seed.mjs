import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://bjdjgnfxbacbbmbqnuxj.supabase.co', 'sb_secret_NKSgQDsMZqqAhiTyQAzvwQ_f9vdkhFe');

async function seed() {
  const leads = [
    { name: 'Alpha Solutions', company: 'Alpha SA', stage: 'Proposta', estimated_value: 20000, ai_status: 'revisar', ai_score: 95 },
    { name: 'Beta Tech', company: 'Beta Corp', stage: 'Contato Inicial', estimated_value: 5000, ai_status: 'revisar', ai_score: 50 }
  ];
  for (const lead of leads) {
    const { data: newLead, error } = await supabase.from('leads').insert(lead).select().single();
    if (newLead && lead.stage === 'Proposta') {
      await supabase.from('ai_qualifications').upsert({ lead_id: newLead.id, status: 'vermelho', score: 95, summary: 'Ligar agora para fechamento.' });
    }
  }
}
seed();
