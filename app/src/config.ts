declare const __TEMPLATES_BASE_URL__: string
declare const __CLAN_LOGOS_BASE_URL__: string

export const appConfig = {
  templatesBaseUrl: __TEMPLATES_BASE_URL__.replace(/\/$/, ''),
  clanLogosBaseUrl: __CLAN_LOGOS_BASE_URL__.replace(/\/$/, ''),
}

export function templateUrl(relativePath: string) {
  return `${appConfig.templatesBaseUrl}/${relativePath.replace(/^\/+/, '')}`
}

export function clanLogoUrl(fileName: string) {
  return `${appConfig.clanLogosBaseUrl}/${encodeURIComponent(fileName)}`
}
