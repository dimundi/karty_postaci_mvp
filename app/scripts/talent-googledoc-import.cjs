const XLSX = require('xlsx')

function parseGoogleDocWorkbook(buffer, group, subgroup, isDarkGift, validateTalent) {
  if (!subgroup?.trim()) throw new Error('Wpisz podgrupę dla importu GoogleDoc.')
  if (buffer.subarray(0, 2).toString() !== 'PK') throw new Error('GoogleDoc wymaga pliku XLSX.')
  const book = XLSX.read(buffer, { type: 'buffer', sheetRows: 10022, cellFormula: true })
  const sheet = book.Sheets.Arkusz1
  if (!sheet?.['!ref']) throw new Error('Brak arkusza Arkusz1 z talentami.')
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'])
  if (range.e.r > 10020 || range.e.c > 100) throw new Error('Arkusz przekracza dozwolony zakres importu.')
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!')) continue
    if (XLSX.utils.decode_cell(address).c > 6) continue
    if (cell.f || cell.t === 'e') throw new Error(`Komórka ${address}: usuń formułę lub błąd arkusza.`)
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, range: { s: { r: 0, c: 0 }, e: { r: range.e.r, c: 6 } } })
  const normalize = (v) => String(v).trim().normalize('NFC').toLocaleLowerCase('pl')
  const headers = ['nazwa', 'akcja', 'opis fabularny', 'opis mechaniczny', 'użycia', 'typ']
  const headerIndex = rows.findIndex((row, i) => i < 20 && headers.every((header, c) => normalize(row[c + 1]) === header))
  if (headerIndex < 0) throw new Error('Arkusz1: oczekiwane kolumny B–G: Nazwa, Akcja, Opis fabularny, Opis mechaniczny, Użycia, Typ.')
  if (rows.slice(0, headerIndex).some((row) => row.some((v) => String(v).trim()))) throw new Error('Dane przed nagłówkiem Arkusz1 wymagają sprawdzenia.')
  const talents = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((v) => v === '')) continue
    try {
      const action = normalize(row[2])
      if (!['', 'akcja', 'tak', 'nie'].includes(action)) throw new Error('Akcja: dozwolone puste, akcja, tak lub nie.')
      const oncePerScene = normalize(row[5]) === '1/scenę'
      if (!oncePerScene && !/^[0-3]$/.test(String(row[5]))) throw new Error('Użycia: podaj jawną liczbę od 0 do 3 albo 1/scenę.')
      talents.push(validateTalent({ name: row[1], flavorDescription: row[3], description: row[4], usesPerMission: oncePerScene ? 0 : Number(row[5]), oncePerScene, dev_type: row[6] || null, group, subgroup, code: null, isAction: action === 'akcja' || action === 'tak', isDarkGift }, false))
    } catch (error) { throw new Error(`Arkusz1, wiersz ${i + 1}: ${error.message}`) }
  }
  if (!talents.length || talents.length > 10000) throw new Error('Import wymaga od 1 do 10000 talentów.')
  return { talents, ignoredSheets: book.SheetNames.filter((name) => name !== 'Arkusz1') }
}

module.exports = { parseGoogleDocWorkbook }
