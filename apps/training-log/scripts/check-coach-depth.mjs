import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const coachPath = path.join(process.cwd(), 'api', 'coach.js')
const source = fs.readFileSync(coachPath, 'utf8')
const lowerSource = source.toLowerCase()

const requiredPromptMarkers = [
  'Coach response structure for chat answers',
  'What I see',
  'What you need to do',
  'Why this works',
  'Watch-outs',
]

for (const marker of requiredPromptMarkers) {
  assert.ok(source.includes(marker), `coach prompt must include depth marker: ${marker}`)
}

assert.ok(
  lowerSource.includes('use bullet lists by default'),
  'coach prompt must require bullet-list answers by default'
)

assert.ok(
  source.includes("callAi(buildChatSystemPrompt(coachRow.notes, coachRow.patterns_cache || [], intent), allMessages, { maxTokens: 1800 })"),
  'chat calls must request enough tokens for in-depth coaching answers'
)

assert.ok(
  source.includes('Answer in a coaching-report format'),
  'fallback chat answer should be more useful than one generic sentence'
)

console.log('Coach depth regression guard passed: chat prompt requires structured, in-depth, actionable answers.')
