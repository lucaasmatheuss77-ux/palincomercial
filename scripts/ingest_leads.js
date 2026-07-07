const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envData = fs.readFileSync(envPath, 'utf8');
  envData.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSVLine(text) {
  let row = [''], i = 0, r = 0, s = true;
  for (; i < text.length; i++) {
    let c = text[i];
    if (c === '"') {
      if (!s && text[i+1] === '"') { row[r] += '"'; i++; }
      else { s = !s; }
    } else if (c === ',' && s) {
      row[++r] = '';
    } else {
      row[r] += c;
    }
  }
  return row;
}

async function run() {
  console.log("Reading leads_clickup_palin.csv...");
  const csvPath = path.join(__dirname, '../leads_clickup_palin.csv');
  const data = fs.readFileSync(csvPath, 'utf8');
  const lines = data.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  const headers = parseCSVLine(lines[0]);
  const parsedLeads = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = row[idx] ? row[idx].trim() : '';
    });
    parsedLeads.push(obj);
  }

  let stats = {
    total: parsedLeads.length, inserted: 0, duplicates: 0, errors: 0, skipped_no_contact: 0,
    stages: { 'Contato Inicial': 0, 'Qualificacao': 0, 'Apresentacao': 0, 'Proposta': 0, 'Fechado': 0, 'Perdido': 0 }
  };

  const batchSize = 100;
  for (let i = 0; i < parsedLeads.length; i += batchSize) {
    const batch = parsedLeads.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (row) => {
      if (!row.nome_razao_social) return;

      const importFunil = row.importar_funil_ativo || 'Sim';
      let stage = 'Contato Inicial';
      
      if (importFunil === 'Não' || row.estagio_kanban === 'FORA_DO_FUNIL') {
        stage = 'Perdido';
      } else {
        const s = (row.estagio_kanban || '').toLowerCase();
        if (s === 'fechamento') stage = 'Fechado';
        else if (s === 'qualificacao') stage = 'Qualificacao';
        else if (s === 'contato_inicial') stage = 'Contato Inicial';
        else stage = 'Contato Inicial';
      }

      // FULL MAPPING WITH TASK_ID AND OTHER FIELDS
      const leadRecord = {
        task_id: row.task_id || null,
        name: row.nome_razao_social,
        cnpj_cpf: row.cnpj_cpf || null,
        cidade: row.cidade || null,
        phone: row.telefones || null,
        email: row.email || null,
        tipo_lead: row.tipo_lead_origem || null,
        responsavel: row.responsavel || null,
        confianca: row.confianca_mapeamento || null,
        stage: stage,
        origem: 'Importação Excel',
        temperature: 'morno'
      };

      try {
        // Checking duplicate by task_id if it exists, otherwise by name
        let existing;
        if (leadRecord.task_id) {
          const res = await supabase.from('leads').select('id').eq('task_id', leadRecord.task_id);
          existing = res.data;
        } else {
          const res = await supabase.from('leads').select('id').ilike('name', leadRecord.name);
          existing = res.data;
        }

        if (existing && existing.length > 0) {
          stats.duplicates++;
          return;
        }

        const { error } = await supabase.from('leads').insert([leadRecord]);
        if (error) {
          console.error("Error inserting:", leadRecord.name, error.message);
          stats.errors++;
        } else {
          stats.inserted++;
          stats.stages[stage]++;
          if (!leadRecord.phone && !leadRecord.email) {
            stats.skipped_no_contact++;
          }
        }
      } catch (err) {
        stats.errors++;
      }
    }));
    
    process.stdout.write(`\rProcessed ${Math.min(i + batchSize, parsedLeads.length)} / ${parsedLeads.length}`);
  }

  console.log(`\n\n=== IMPORT REPORT ===`);
  console.log(`Total rows in CSV: ${stats.total}`);
  console.log(`Successfully inserted: ${stats.inserted}`);
  console.log(`Skipped (duplicates): ${stats.duplicates}`);
  console.log(`Leads with NO contact info: ${stats.skipped_no_contact}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`\n--- INSERTIONS BY STAGE ---`);
  for (const s in stats.stages) {
    if (stats.stages[s] > 0) console.log(`${s}: ${stats.stages[s]}`);
  }
  console.log(`=====================\n`);
}

run().catch(console.error);
