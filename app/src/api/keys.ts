import { apiFetch } from './client'

export interface DownloadData {
  blob: string
  filename: string
}

export interface GenerateKeyResponse {
  hash: string
  downloadData: DownloadData
}

export async function generateKey(token: string): Promise<GenerateKeyResponse> {
  return apiFetch<GenerateKeyResponse>('/api/keys/generate', {
    method: 'POST',
    token,
  })
}
