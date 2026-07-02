export const ORIGINAL_DEBTS = [
  { id: 1,  lender: 'Perpay Inc',        originalBalance: 93,   limit: 1000, phase: 1 },
  { id: 2,  lender: 'Kikoff Lending',    originalBalance: 140,  limit: 3750, phase: 1 },
  { id: 3,  lender: 'Pinnacle Bank',     originalBalance: 170,  limit: 200,  phase: 1 },
  { id: 4,  lender: 'Avant / Webbank',   originalBalance: 202,  limit: 300,  phase: 1 },
  { id: 5,  lender: 'Credit One Bank',   originalBalance: 331,  limit: 300,  phase: 2 },
  { id: 6,  lender: 'Mission Lane',      originalBalance: 397,  limit: 300,  phase: 2 },
  { id: 7,  lender: 'OpenSky Capital',   originalBalance: 503,  limit: 500,  phase: 2 },
  { id: 8,  lender: 'Capital One (A)',   originalBalance: 564,  limit: 500,  phase: 2 },
  { id: 9,  lender: 'Capital One (B)',   originalBalance: 572,  limit: 500,  phase: 2 },
  { id: 10, lender: 'Lead Bank',         originalBalance: 958,  limit: 975,  phase: 3 },
  { id: 11, lender: 'Webbank / OneMain', originalBalance: 1082, limit: 1000, phase: 3 },
  { id: 12, lender: 'Apple Card - GS',   originalBalance: 2038, limit: 2000, phase: 3 },
]

export const TOTAL_ORIGINAL_DEBT = ORIGINAL_DEBTS.reduce((sum, d) => sum + d.originalBalance, 0)

export const PHASES = {
  1: {
    label: 'PHASE 01',
    name: 'INITIATION',
    desc: 'Low balance targets — eliminate fast, build momentum',
  },
  2: {
    label: 'PHASE 02',
    name: 'ESCALATION',
    desc: 'Mid-range targets — overlimit accounts, high pressure',
  },
  3: {
    label: 'PHASE 03',
    name: 'TERMINATION',
    desc: 'High-value targets — final elimination sequence',
  },
}

export const VILLAIN_DATA = {
  1:  { name: 'PAYDAY PAT',     villainClass: 'Street Grunt',      flavor: 'Talks big for ninety-three bucks. Embarrassing.' },
  2:  { name: 'KIKOFF KID',     villainClass: 'Pickpocket',        flavor: 'Small-time. Sneaky. Irritating.' },
  3:  { name: 'THE PINNACLE',   villainClass: 'Loan Shark',        flavor: 'Dangerous relative to size. Do not underestimate.' },
  4:  { name: 'AVANT GARDE',    villainClass: 'Mercenary',         flavor: 'Hired muscle. No loyalty. Mid-tier threat.' },
  5:  { name: 'CREDIT REAPER',  villainClass: 'Fee Vampire',       flavor: 'Drinks your interest. Over limit and proud.' },
  6:  { name: 'MISS LANE',      villainClass: 'Debt Collector',    flavor: 'Highest utilization. 132% and climbing.' },
  7:  { name: 'SKY BARON',      villainClass: 'Extortionist',      flavor: 'Over-limit enforcer. Controls airspace.' },
  8:  { name: 'CAP ONE ALPHA',  villainClass: 'Corporate Soldier', flavor: 'First of the twins. Eliminate Alpha first.' },
  9:  { name: 'CAP ONE BETA',   villainClass: 'Corporate Soldier', flavor: 'Waiting behind Alpha. Same uniform. Same fate.' },
  10: { name: 'LEAD WEIGHT',    villainClass: 'Heavy',             flavor: 'Slow but massive. Near maxed. Close to the edge.' },
  11: { name: 'THE MAINFRAME',  villainClass: 'Cyber Enforcer',    flavor: 'Digital. Over-limit. Upgrading constantly.' },
  12: { name: 'THE APPLE BOSS', villainClass: 'FINAL BOSS',        flavor: 'Two grand and climbing. This is the endgame.' },
}

export const VILLAIN_TAUNTS = {
  1:  ['Ninety-three dollars? I own you.', 'Starting to sweat, huh?', 'Wait — please, man — I got kids!'],
  2:  ['You cannot catch what you cannot see.', 'Keep trying. It is cute.', 'I am broke. Take it. Just stop.'],
  3:  ['The Pinnacle cannot be touched.', 'You are making this personal.', 'Okay. Okay. I will negotiate.'],
  4:  ['I was paid to be here. Nothing personal.', 'My employer is watching.', 'Tell them you fought hard. Please.'],
  5:  ['Every day costs you. Every. Single. Day.', 'The fees are just starting.', 'Cut a deal. I am almost done.'],
  6:  ['One-thirty-two percent utilization. Fear me.', 'You cannot outrun collection.', 'Wait — I can waive the fees—'],
  7:  ['The sky belongs to the Baron.', 'Fees stack. Time works for me.', 'I yield. I yield. Please stop.'],
  8:  ['Alpha never falls first.', 'You will run out of money before I run out of interest.', 'Tell Beta I said goodbye.'],
  9:  ['Beta follows Alpha. Into the void.', 'Stubborn. I respect it. Sort of.', 'Do what you must. I am ready.'],
  10: ['Lead sinks. So will you.', 'The weight is accumulating.', 'I am... heavier... than I look.'],
  11: ['I am the system. The system cannot be killed.', 'Error. Error. Recalculating threat.', 'SYSTEM FAILURE IMMINENT.'],
  12: ['You think you can fight the Apple?', 'Two thousand dollars says otherwise.', 'Impossible. This is... impossible.'],
}
