const MAILING_GROUP = 'Dary Ciemności'
const MAILING_SUBGROUP = 'Ekskluzywne'
const normalize = (value) => typeof value === 'string' ? value.trim().normalize('NFC').toLocaleLowerCase('pl') : ''
const isMailingTalent = (talent) => normalize(talent?.group) === normalize(MAILING_GROUP) && normalize(talent?.subgroup) === normalize(MAILING_SUBGROUP)
module.exports = { MAILING_GROUP, MAILING_SUBGROUP, isMailingTalent }
