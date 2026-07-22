/**
 * Microsoft Graph API Integration Module
 * 
 * This module handles authentication and file uploads to SharePoint/OneDrive
 * via Microsoft Graph API using client credentials flow (app-only).
 */

interface GraphTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface GraphUploadResponse {
  id: string
  name: string
  webUrl: string
  size: number
}

// In-memory token cache
let tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const tenantId = process.env.GRAPH_TENANT_ID
  const clientId = process.env.GRAPH_CLIENT_ID
  const clientSecret = process.env.GRAPH_CLIENT_SECRET

  if (!tenantId || tenantId === 'your-tenant-id' || !clientId || !clientSecret || clientSecret === 'your-client-secret') {
    throw new Error('Graph API credentials are not configured properly.')
  }

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[GraphAPI] Token acquisition failed:', error)
    throw new Error('Failed to acquire Graph API token. Check tenant ID, client ID, and secret.')
  }

  const data: GraphTokenResponse = await response.json()
  
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  }

  return data.access_token
}

function getMaltaDateString(): string {
  const now = new Date()
  const maltaString = now.toLocaleString('en-US', { timeZone: 'Europe/Malta' })
  const maltaDate = new Date(maltaString)
  const y = maltaDate.getFullYear()
  const m = (maltaDate.getMonth() + 1).toString().padStart(2, '0')
  const d = maltaDate.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function uploadToSharePoint(
  fileName: string,
  fileBuffer: Buffer,
  contractNumber: string
): Promise<{ graphItemId: string; graphDriveId: string; webUrl: string }> {
  const accessToken = await getAccessToken()

  const driveId = process.env.GRAPH_DRIVE_ID
  const siteId = process.env.GRAPH_SITE_ID

  if (!driveId && !siteId) {
    throw new Error('No SharePoint drive/site ID configured in environment variables.')
  }

  const safeContractNumber = encodeURIComponent(contractNumber)
  const safeFileName = encodeURIComponent(fileName)
  const folderName = `CheckIn_${safeContractNumber}_${getMaltaDateString()}`
  const safeFolderName = encodeURIComponent(folderName)

  let baseEndpoint: string
  if (driveId) {
    baseEndpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${safeFolderName}`
  } else {
    baseEndpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${safeFolderName}`
  }

  // 1. Ensure folder exists
  const folderResponse = await fetch(baseEndpoint, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'Rename',
    }),
  })

  if (!folderResponse.ok) {
    const error = await folderResponse.text()
    console.error('[GraphAPI] Folder creation failed:', error)
    throw new Error('Failed to create or access folder in SharePoint.')
  }

  // 2. Upload file
  let result: GraphUploadResponse

  if (fileBuffer.length > 4 * 1024 * 1024) {
    // Use chunked upload session for files > 4MB
    result = await uploadInChunks(baseEndpoint, safeFileName, fileBuffer, accessToken)
  } else {
    // Simple upload for files <= 4MB
    const uploadEndpoint = `${baseEndpoint}/${safeFileName}:/content`
    const uploadResponse = await fetch(uploadEndpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      console.error('[GraphAPI] Simple upload failed:', error)
      throw new Error('Failed to upload file to SharePoint.')
    }
    result = await uploadResponse.json()
  }

  return {
    graphItemId: result.id,
    graphDriveId: driveId || '',
    webUrl: result.webUrl,
  }
}

async function uploadInChunks(
  baseEndpoint: string,
  safeFileName: string,
  fileBuffer: Buffer,
  accessToken: string
): Promise<GraphUploadResponse> {
  // Create upload session
  const sessionEndpoint = `${baseEndpoint}/${safeFileName}:/createUploadSession`
  const sessionResponse = await fetch(sessionEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
      },
    }),
  })

  if (!sessionResponse.ok) {
    const error = await sessionResponse.text()
    console.error('[GraphAPI] Create upload session failed:', error)
    throw new Error('Failed to create upload session for large file.')
  }

  const sessionData = await sessionResponse.json()
  const uploadUrl = sessionData.uploadUrl

  const chunkSize = 4 * 1024 * 1024 // 4MB chunks
  const totalSize = fileBuffer.length
  let offset = 0

  while (offset < totalSize) {
    const chunkEnd = Math.min(offset + chunkSize, totalSize) - 1
    const chunk = fileBuffer.subarray(offset, chunkEnd + 1)

    const chunkResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${chunkEnd}/${totalSize}`,
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    })

    if (!chunkResponse.ok) {
      const error = await chunkResponse.text()
      console.error('[GraphAPI] Chunk upload failed at offset', offset, error)
      throw new Error('Failed to upload file chunk.')
    }

    // If chunkResponse gives us the final file data, we are done
    const data = await chunkResponse.json().catch(() => null)
    if (data && data.id) {
      return data as GraphUploadResponse
    }

    offset = chunkEnd + 1
  }

  // Fallback if loop ends without returning (shouldn't happen with Graph API)
  throw new Error('Chunked upload completed but no file ID was returned.')
}

export async function deleteFromSharePoint(graphItemId: string, graphDriveId: string): Promise<void> {
  try {
    const accessToken = await getAccessToken()
    const driveId = graphDriveId || process.env.GRAPH_DRIVE_ID
    
    if (!driveId) return
    
    const deleteEndpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${graphItemId}`
    await fetch(deleteEndpoint, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (error) {
    console.error('[GraphAPI] Failed to delete file from SharePoint:', error)
  }
}

export async function isGraphConfigured(): Promise<boolean> {
  const tenantId = process.env.GRAPH_TENANT_ID
  const clientId = process.env.GRAPH_CLIENT_ID
  const clientSecret = process.env.GRAPH_CLIENT_SECRET
  return !!(
    tenantId && tenantId !== 'your-tenant-id' &&
    clientId && clientId !== 'your-client-id' &&
    clientSecret && clientSecret !== 'your-client-secret'
  )
}
