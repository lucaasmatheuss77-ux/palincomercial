export function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, '') || ''
}

export function formatCnpj(value?: string | null) {
  const digits = onlyDigits(value).slice(0, 14)
  if (!digits) return ''

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
