const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid')

const env = process.env.PLAID_ENV_DEBT || process.env.PLAID_ENV || 'sandbox'
const clientId = process.env.PLAID_CLIENT_ID_DEBT || process.env.PLAID_CLIENT_ID
const secret = process.env.PLAID_SECRET_DEBT || process.env.PLAID_SECRET

const configuration = new Configuration({
  basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    },
  },
})

const plaidClient = new PlaidApi(configuration)

module.exports = { plaidClient, plaidConfig: { env, hasClientId: Boolean(clientId), hasSecret: Boolean(secret) } }
