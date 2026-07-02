import sleepHandler from '../lib/api-handlers/sleep.js'
import stepsHandler from '../lib/api-handlers/steps.js'
import weightHandler from '../lib/api-handlers/weight.js'
import labsHandler from '../lib/api-handlers/labs.js'

// Labs extraction (Blob upload + Claude document/vision call) runs longer than
// the other metrics, so this raises the shared function's ceiling to 60s.
export const config = { maxDuration: 60 }

function parseBody(req) {
  if (!req.body || typeof req.body !== 'string') return req.body || {}
  try { return JSON.parse(req.body) } catch { return {} }
}

function getMetric(req) {
  const body = parseBody(req)
  return String(req.query?.metric || body?.metric || '').toLowerCase()
}

export default async function handler(req, res) {
  const metric = getMetric(req)

  if (metric === 'sleep') {
    return sleepHandler(req, res)
  }
  if (metric === 'steps') {
    return stepsHandler(req, res)
  }
  if (metric === 'weight') {
    return weightHandler(req, res)
  }
  if (metric === 'labs') {
    return labsHandler(req, res)
  }

  return res.status(400).json({
    error: 'Invalid health metric',
    supported: ['sleep', 'steps', 'weight', 'labs'],
  })
}
