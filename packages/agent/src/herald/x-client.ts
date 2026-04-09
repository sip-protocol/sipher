import { TwitterApi } from 'twitter-api-v2'

export function getReadClient(): TwitterApi {
  const bearer = process.env.X_BEARER_TOKEN
  if (!bearer) {
    throw new Error('X_BEARER_TOKEN is required for HERALD read operations')
  }
  return new TwitterApi(bearer)
}

export function getWriteClient(): TwitterApi {
  const appKey = process.env.X_CONSUMER_KEY
  const appSecret = process.env.X_CONSUMER_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessSecret = process.env.X_ACCESS_SECRET

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error(
      'X OAuth 1.0a credentials required: X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET'
    )
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  })
}

export function getHeraldUserId(): string {
  const id = process.env.HERALD_X_USER_ID
  if (!id) {
    throw new Error('HERALD_X_USER_ID is required')
  }
  return id
}
