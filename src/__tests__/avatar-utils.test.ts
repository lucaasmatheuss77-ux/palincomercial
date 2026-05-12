/**
 * @jest-environment node
 *
 * Testes unitários para avatar-utils.ts
 * Cobre: skinFromName, accessoryFromRole
 */

import { skinFromName, accessoryFromRole, type AvatarSkin, type AvatarAccessory } from '../components/avatar-utils'

// ─────────────────────────────────────────────
// skinFromName
// ─────────────────────────────────────────────

describe('skinFromName', () => {
  it('retorna um número entre 0 e 6 para qualquer string', () => {
    const names = ['Ana', 'Carlos', 'Maria Silva', 'João Pedro Oliveira', 'Z', '']
    names.forEach((name) => {
      const skin = skinFromName(name)
      expect(skin).toBeGreaterThanOrEqual(0)
      expect(skin).toBeLessThanOrEqual(6)
    })
  })

  it('é determinístico — mesmo nome sempre retorna mesmo skin', () => {
    const name = 'Rodrigo Mendonça'
    expect(skinFromName(name)).toBe(skinFromName(name))
    expect(skinFromName(name)).toBe(skinFromName(name))
  })

  it('nomes diferentes podem produzir skins diferentes', () => {
    const skins = new Set(['Ana', 'Bruno', 'Carlos', 'Diana', 'Eduardo', 'Fernanda', 'Gabriel'].map(skinFromName))
    // Espera que ao menos 2 skins distintos sejam gerados
    expect(skins.size).toBeGreaterThanOrEqual(2)
  })

  it('retorna tipo AvatarSkin (0–6)', () => {
    const result: AvatarSkin = skinFromName('Teste')
    expect([0, 1, 2, 3, 4, 5, 6]).toContain(result)
  })

  it('string vazia retorna skin válido', () => {
    const skin = skinFromName('')
    expect(skin).toBeGreaterThanOrEqual(0)
    expect(skin).toBeLessThanOrEqual(6)
  })
})

// ─────────────────────────────────────────────
// accessoryFromRole — cowboy
// ─────────────────────────────────────────────

describe('accessoryFromRole — cowboy (Rural)', () => {
  const ruralCases: [string | undefined, string | undefined][] = [
    ['Consultor Rural', undefined],
    [undefined, 'Crédito Rural'],
    [undefined, 'credito rural'],
    [undefined, 'CAT 153'],
    ['Produtor Agrícola', undefined],
    [undefined, 'Agronegócio'],
    ['Consultor', 'rural'],
  ]

  ruralCases.forEach(([role, produto]) => {
    it(`retorna 'cowboy' para role="${role}" produtoFoco="${produto}"`, () => {
      expect(accessoryFromRole(role, produto)).toBe<AvatarAccessory>('cowboy')
    })
  })
})

// ─────────────────────────────────────────────
// accessoryFromRole — calculator (Backoffice)
// ─────────────────────────────────────────────

describe('accessoryFromRole — calculator (Backoffice)', () => {
  const calcCases: [string | undefined, string | undefined][] = [
    ['Analista Tributário', undefined],
    ['Gestão Financeira', undefined],
    ['Administrador do Sistema', undefined],
    ['Contabilidade', undefined],
    ['Assistente Administrativo', undefined],
    [undefined, 'fiscal'],
    ['Gestor de Equipe', undefined],
  ]

  calcCases.forEach(([role, produto]) => {
    it(`retorna 'calculator' para role="${role}" produtoFoco="${produto}"`, () => {
      expect(accessoryFromRole(role, produto)).toBe<AvatarAccessory>('calculator')
    })
  })
})

// ─────────────────────────────────────────────
// accessoryFromRole — star (SDR / Hunter)
// ─────────────────────────────────────────────

describe('accessoryFromRole — star (SDR/Hunter)', () => {
  it("retorna 'star' para role='SDR'", () => {
    expect(accessoryFromRole('SDR')).toBe<AvatarAccessory>('star')
  })
  it("retorna 'star' para role='Hunter de Negócios'", () => {
    expect(accessoryFromRole('Hunter de Negócios')).toBe<AvatarAccessory>('star')
  })
  it("retorna 'star' para produtoFoco='prospecção ativa'", () => {
    expect(accessoryFromRole(undefined, 'prospecção ativa')).toBe<AvatarAccessory>('star')
  })
})

// ─────────────────────────────────────────────
// accessoryFromRole — briefcase (Consultor Comercial)
// ─────────────────────────────────────────────

describe('accessoryFromRole — briefcase (Consultor Comercial)', () => {
  it("retorna 'briefcase' para role='Consultor Comercial'", () => {
    expect(accessoryFromRole('Consultor Comercial')).toBe<AvatarAccessory>('briefcase')
  })
  it("retorna 'briefcase' para role='Vendedor'", () => {
    expect(accessoryFromRole('Vendedor')).toBe<AvatarAccessory>('briefcase')
  })
  it("retorna 'briefcase' para role='Executivo Comercial'", () => {
    expect(accessoryFromRole('Executivo Comercial')).toBe<AvatarAccessory>('briefcase')
  })
})

// ─────────────────────────────────────────────
// accessoryFromRole — none (sem match)
// ─────────────────────────────────────────────

describe('accessoryFromRole — none (sem match)', () => {
  it("retorna 'none' quando role e produtoFoco são undefined", () => {
    expect(accessoryFromRole(undefined, undefined)).toBe<AvatarAccessory>('none')
  })
  it("retorna 'none' quando role e produtoFoco são strings vazias", () => {
    expect(accessoryFromRole('', '')).toBe<AvatarAccessory>('none')
  })
  it("retorna 'none' para role desconhecido", () => {
    expect(accessoryFromRole('Engenheiro de Dados')).toBe<AvatarAccessory>('none')
  })
})

// ─────────────────────────────────────────────
// Prioridade: Rural > Calculator > Star > Briefcase
// ─────────────────────────────────────────────

describe('accessoryFromRole — prioridade de regras', () => {
  it("rural tem prioridade sobre consultor comercial (cowboy > briefcase)", () => {
    // role contém "consultor" mas produtoFoco contém "rural" → cowboy
    expect(accessoryFromRole('Consultor', 'Crédito Rural')).toBe<AvatarAccessory>('cowboy')
  })

  it("SDR é detectado antes de 'consultor' se role for 'SDR Consultor'", () => {
    // "sdr" é detectado → star
    expect(accessoryFromRole('SDR Consultor')).toBe<AvatarAccessory>('star')
  })
})
