export type TalentTemplate = { schemaVersion: 2; page: { width: number; height: number }; padding: number; verticalPadding: number; statusHeight: number; iconGap: number; textGap: number; fontSize: number; minFontSize: number; lineHeight: number; autoFit: boolean; color: string; flavorColor: string; background: string }
export type PreviewTalent = { id: string; name: string; flavorDescription: string; description: string; usesPerMission: number; isDarkGift: boolean; isAction: boolean; oncePerScene?: boolean; code: string | null }
export const ASSETS: Record<string, string>
export const PARTS: Record<string, string>
export function defaultTemplate(): TalentTemplate
export type TalentFontUrls = { regular: string; semibold?: string; bold: string; italic: string; boldItalic: string }
export function renderTemplate(template: TalentTemplate, talent: PreviewTalent | null, options?: { fontUrl?: string; fontUrls?: TalentFontUrls; images?: Record<string, string>; highlight?: string }): string
export function fitText(root?: Document): string[]
