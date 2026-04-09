import { TwitterApi } from 'twitter-api-v2'

let _readClient: TwitterApi | null = null
let _writeClient: TwitterApi | null = null

export function getReadClient(): TwitterApi {
  if (!_readClient) {
    const bearer = process.env.X_BEARER_TOKEN
    if (!bearer) {
      throw new Error('X_BEARER_TOKEN is required for HERALD read operations')
    }
    _readClient = new TwitterApi(bearer)
  }
  return _readClient
}

export function getWriteClient(): TwitterApi {
  if (!_writeClient) {
    const appKey = process.env.X_CONSUMER_KEY
    const appSecret = process.env.X_CONSUMER_SECRET
    const accessToken = process.env.X_ACCESS_TOKEN
    const accessSecret = process.env.X_ACCESS_SECRET

    if (!appKey || !appSecret || !accessToken || !accessSecret) {
      throw new Error(
        'X OAuth 1.0a credentials required: X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET'
      )
    }

    _writeClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    })
  }
  return _writeClient
}

export function getHeraldUserId(): string {
  const id = process.env.HERALD_X_USER_ID
  if (!id) {
    throw new Error('HERALD_X_USER_ID is required')
  }
  return id
}
