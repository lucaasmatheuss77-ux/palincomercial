'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import InsiderLogo from '@/components/insider-logo'
import {
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  FileText,
  Gauge,
  LineChart,
  LogOut,
  Package,
  PartyPopper,
  Rocket,
  Settings,
  Target,
  UserCircle2,
  Users2,
  UserSearch,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BrandLogo from '@/components/brand-logo'
import AgendaAssistantPanel from './components/agenda-assistant-panel'
import NotificationBell from '@/components/notification-bell'
import { getMyProfile } from '@/app/actions/profile'
import { Profile } from '@/lib/types'

type NavItem = {
  href: string
  label: string
  accent: string
  icon: LucideIcon | null
  customIcon?: (color: string) => React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge, accent: 'var(--brand-primary)' },
  { href: '/dashboard/produtos', label: 'Produtos', icon: Package, accent: '#10b981' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: FileText, accent: '#38bdf8' },
  { href: '/dashboard/pipeline', label: 'CRM', icon: Rocket, accent: '#f97316' },
  { href: '/dashboard/agenda', label: 'Reunioes', icon: CalendarDays, accent: '#22c55e' },
  { href: '/dashboard/eventos', label: 'Eventos', icon: PartyPopper, accent: '#14b8a6' },
  { href: '/dashboard/clube', label: 'Clube', icon: null, accent: '#0ea5e9', customIcon: (color: string) => <InsiderLogo size={17} color={color} /> },
  { href: '/dashboard/metas', label: 'Metas', icon: Target, accent: '#e879f9' },
  { href: '/dashboard/comissoes', label: 'Comissoes', icon: BadgeDollarSign, accent: '#fb7185' },
  { href: '/dashboard/relatorios', label: 'Relatorios', icon: BarChart3, accent: '#38bdf8' },
  { href: '/dashboard/indicadores', label: 'Indicadores', icon: LineChart, accent: '#059669' },
  { href: '/dashboard/planejamento', label: 'Planejamento', icon: Target, accent: '#f43f5e' },
]

import GlobalCelebration from '@/components/global-celebration'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement | null>(null)
  const [isNavCompact, setIsNavCompact] = useState(false)
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => {})
    // Captura o userId para autenticar o assistente mesmo no mobile via IP
    const supabaseClient = createClient()
    supabaseClient.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id)
    }).catch(() => {})
  }, [])


  function updateNavScrollState() {
    const nav = navRef.current
    if (!nav) return
    setIsNavCompact(nav.scrollWidth > nav.clientWidth + 24)
  }

  useEffect(() => {
    updateNavScrollState()
    const nav = navRef.current
    if (!nav) return

    nav.addEventListener('scroll', updateNavScrollState, { passive: true })
    window.addEventListener('resize', updateNavScrollState)

    return () => {
      nav.removeEventListener('scroll', updateNavScrollState)
      window.removeEventListener('resize', updateNavScrollState)
    }
  }, [])

  useEffect(() => {
    updateNavScrollState()
  }, [pathname])

  useEffect(() => {
    const handleOpenAura = () => setIsAgendaOpen(true)
    window.addEventListener('aura-query', handleOpenAura)
    return () => window.removeEventListener('aura-query', handleOpenAura)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--brand-darker)' }}>
      <header
        style={{
          background: 'rgba(13,17,23,0.97)',
          borderBottom: '1px solid rgba(251,191,36,0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* TOP BAR: Logo + Agent Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            gap: '16px',
          }}
        >
          {/* Logo - BIGGER */}
          <Link href="/dashboard" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <BrandLogo height={50} compact={false} showSubtitle />
          </Link>

          {/* Actions: Notifications + Settings (Centered) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <NotificationBell />
            <Link
              href="/dashboard/configuracoes"
              title="Configurações"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                color: '#adbac7',
                textDecoration: 'none',
                transition: 'all 0.2s',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Settings size={20} />
            </Link>
          </div>

          {/* Profile Avatar — links to Configurações */}
          <Link
            href="/dashboard/configuracoes"
            title="Meu Perfil"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px 6px 6px',
              borderRadius: '12px',
              border: '1px solid rgba(251,191,36,0.25)',
              background: 'rgba(251,191,36,0.05)',
              textDecoration: 'none',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Avatar"
                width={34}
                height={34}
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(251,191,36,0.4)',
                }}
                unoptimized
              />
            ) : (
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: 'rgba(251,191,36,0.15)',
                border: '2px solid rgba(251,191,36,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand-primary)', fontWeight: 900, fontSize: '0.85rem',
              }}>
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <UserCircle2 size={18} />}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--brand-text)' }}>
                {profile?.full_name?.split(' ')[0] || 'Perfil'}
              </div>
            </div>
          </Link>
        </div>

        {/* NAV BAR */}
        <div style={{ borderTop: '1px solid rgba(251,191,36,0.08)', padding: '5px 12px' }}>
          <div className="menu-scroll-shell" data-compact={isNavCompact}>
            <nav
              ref={navRef}
              className="no-scrollbar top-menu-scroll"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                padding: '4px 8px',
              }}
            >
              {navItems.map(({ href, label, icon: Icon, customIcon }) => {
                const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link-clean${isActive ? ' nav-link-active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: isActive ? 'var(--brand-primary)' : '#adbac7',
                      background: isActive ? 'rgba(251,191,36,0.12)' : 'transparent',
                      transition: 'color 0.15s ease, background-color 0.15s ease',
                      border: 'none',
                      textDecoration: 'none',
                      minHeight: '40px',
                      flexShrink: 0,
                    }}
                  >
                    {customIcon ? customIcon(isActive ? 'var(--brand-primary)' : '#adbac7') : Icon ? <Icon size={17} aria-hidden="true" /> : null}
                    <span>{label}</span>
                  </Link>
                )
              })}

              {/* Logout at end of nav */}
              <button
                type="button"
                onClick={handleLogout}
                className="nav-link-clean"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--brand-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  minHeight: '40px',
                }}
                aria-label="Sair"
              >
                <LogOut size={17} aria-hidden="true" />
                <span>Sair</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-page-shell" style={{ flex: 1, padding: '24px', maxWidth: '1540px', margin: '0 auto', width: '100%' }}>
          <GlobalCelebration />
          {children}
        </div>
      </main>

      {/* Global Aura FAB - Centered on Mobile, Offset on Desktop */}
      {!['/dashboard/mobile-crm', '/mobile'].includes(pathname) && (
        <button
          onClick={() => setIsAgendaOpen(true)}
          className="aura-fab-responsive"
          style={{
            position: 'fixed',
            zIndex: 900,
          }}
        >
          <UserCircle2 size={24} color="#0d1117" />
          <div className="aura-fab-label">PALIN AI</div>
        </button>
      )}

      <AgendaAssistantPanel isOpen={isAgendaOpen} onClose={() => setIsAgendaOpen(false)} userId={userId} />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .menu-scroll-shell {
          width: 100%;
          min-width: 0;
          position: relative;
          overflow: hidden;
          border-radius: 8px;
        }

        .menu-scroll-shell[data-compact='true']:before,
        .menu-scroll-shell[data-compact='true']:after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 20px;
          z-index: 2;
          pointer-events: none;
        }

        .menu-scroll-shell[data-compact='true']:before {
          left: 0;
          background: linear-gradient(90deg, rgba(13,17,23,0.97), rgba(13,17,23,0));
        }

        .menu-scroll-shell[data-compact='true']:after {
          right: 0;
          background: linear-gradient(270deg, rgba(13,17,23,0.97), rgba(13,17,23,0));
        }

        .nav-link-clean {
          position: relative;
        }

        .nav-link-clean:not(.nav-link-active):hover {
          color: var(--brand-text) !important;
          background-color: rgba(255,255,255,0.05) !important;
        }

        .nav-link-clean:focus-visible {
          outline: 2px solid rgba(251,191,36,0.7);
          outline-offset: 2px;
          color: var(--brand-text) !important;
        }

        @media (max-width: 960px) {
          .dashboard-page-shell {
            padding: 16px !important;
          }
        }

        @media (max-width: 640px) {
          .dashboard-page-shell {
            padding: 12px !important;
          }
        }

        .aura-fab-responsive {
          bottom: 32px;
          right: 32px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--brand-primary);
          border: none;
          box-shadow: 0 8px 32px rgba(251, 191, 36, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @media (max-width: 768px) {
          .aura-fab-responsive {
            bottom: 20px;
            right: 50%;
            transform: translateX(50%);
            width: 48px;
            height: 48px;
          }
          
          /* Hide label on mobile to avoid clutter */
          .aura-fab-label {
            display: none;
          }
        }

        .aura-fab-responsive:hover {
          transform: scale(1.1) translateY(-4px);
          box-shadow: 0 12px 40px rgba(251, 191, 36, 0.4);
        }

        .aura-fab-label {
          position: absolute;
          right: 100%;
          margin-right: 12px;
          background: var(--brand-primary);
          color: #0d1117;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 800;
          white-space: nowrap;
          opacity: 0;
          transform: translateX(10px);
          transition: all 0.2s ease;
          pointer-events: none;
        }

        .aura-fab-responsive:hover .aura-fab-label {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
    </div>
  )
}
