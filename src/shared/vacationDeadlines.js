// src/shared/vacationDeadlines.js
// Contagem regressiva de "CONTAGEM DE FÉRIAS" — só aparece pra um grupo seleto de
// pessoas (lista fixa abaixo), cada uma vendo SÓ a própria data-limite na aba Início
// do Portal do Colaborador. Comparação por nome normalizado (maiúsculas, sem acento,
// espaços colapsados) contra `USER.name` — não depende de CPF/matrícula.
export const VACATION_DEADLINES = [
  { name: 'CLEANDERSON PEREIRA BATISTA',        date: '2026-09-18' },
  { name: 'GUILHERME ALVES MARQUIES',           date: '2027-01-10' },
  { name: 'MARCOS ROBERTO TORRES FILHO',        date: '2027-01-10' },
  { name: 'JOAO HERBERT DE OLIVEIRA SA',        date: '2027-01-31' },
  { name: 'VICTOR GABRIEL FERREIRA DE PAULA',   date: '2027-04-01' },
  { name: 'NICOLAS ANDRADE BARBOZA',            date: '2027-07-01' },
  { name: 'ALAN MATOS PAIXAO',                  date: '2027-07-01' },
  { name: 'MARIA RENATA VIEIRA CAMARGO',        date: '2027-08-31' },
  { name: 'RONDINEY LOURENCO DA COSTA',         date: '2027-09-01' },
  { name: 'GLEYDSON DA SILVA MARQUES',          date: '2027-09-19' },
  { name: 'MIKAEL ARAUJO SILVA',                date: '2028-01-05' },
  { name: 'BRENDA KESIA PEREIRA LIMA VIANA',    date: '2028-02-08' },
  { name: 'KARINA MARIA BARBOSA DA SILVA',      date: '2028-02-08' },
  { name: 'MARA DE SOUSA ALMEIDA',              date: '2028-02-08' },
];

const normName = (s) => String(s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

// Devolve a entrada da pessoa logada, ou null se ela não estiver na lista seleta.
export function getMyVacationDeadline(userName) {
  const key = normName(userName);
  if (!key) return null;
  return VACATION_DEADLINES.find(v => normName(v.name) === key) || null;
}

// Meses/dias cheios até a data-limite (calendário, não só divisão de dias por 30) +
// total de dias corridos, pra mostrar "faltam X meses e Y dias (Z dias)".
export function monthsDaysUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr + 'T00:00:00');
  const totalDays = Math.ceil((target - now) / 86400000);
  if (totalDays <= 0) return { months: 0, days: 0, totalDays: 0, expired: true };
  let months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  let days = target.getDate() - now.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) months = 0;
  return { months, days, totalDays, expired: false };
}
