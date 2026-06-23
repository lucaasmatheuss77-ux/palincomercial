# Implementation Plan: Mobile Access & Purple Ban

## 1. Mobile Access Fix (DevOps/Network)
**Goal:** Allow the user to access the local development server (Next.js running on 0.0.0.0:80) from their mobile device.

**Steps:**
- **Step 1.1:** Set up a secure tunnel using `npx localtunnel --port 80` to create a publicly accessible URL for the local server.
- **Step 1.2:** Se a porta 80 estiver bloqueada pelo Firewall do Windows para conexões locais no celular, vou executar um script rápido para adicionar a permissão no Firewall (porta 80) permitindo acesso via Wi-Fi.
- **Step 1.3:** Fornecer o link gerado ou o IP validado para o usuário abrir agora mesmo.

## 2. Removing Purple Colors (Frontend UI/UX)
**Goal:** Enforce the design preferences by removing all purple/violet hues from the UI and replacing them with a suitable brand color palette (e.g., brand-primary, amber, slate).

**Steps:**
- **Step 2.1:** Scan the codebase for Tailwind classes related to purple/violet (e.g., `bg-purple-*`, `text-violet-*`, `indigo-*`, `fuchsia-*`) and hex codes (como `#a855f7` e derivados).
- **Step 2.2:** Systematically replace these classes and variables with the new primary/accent colors (tons de slate, blue ou amber para combinar com o padrão premium que construímos).
- **Step 2.3:** Review UI components to ensure the new color scheme is consistent, premium, and fully devoid of purple.
