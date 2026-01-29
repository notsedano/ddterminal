import type { VercelRequest, VercelResponse } from '@vercel/node';

// Get backend URL from environment variables
// Supports both VITE_API_BASE (for consistency) and ELIZA_API_BASE
const BACKEND_URL = process.env.VITE_API_BASE || 
                    process.env.ELIZA_API_BASE || 
                    'https://3a6615a6-aeris-agent.containers.elizacloud.ai';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the path from the catch-all parameter
  const { path: pathParam } = req.query;
  const pathSegments = Array.isArray(pathParam) ? pathParam : [pathParam];
  const apiPath = pathSegments.filter(Boolean).join('/');

  // Build query string from remaining query params
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue; // Skip the path parameter
    if (typeof value === 'string') {
      queryParams.append(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string') {
          queryParams.append(key, v);
        }
      }
    }
  }

  const queryString = queryParams.toString();
  const fullPath = queryString ? `${apiPath}?${queryString}` : apiPath;

  // Build the backend URL
  const backendUrl = `${BACKEND_URL}/api/messaging/${fullPath}`;

  // Prepare headers for the backend request
  const headers: Record<string, string> = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };

  // Forward Accept header (critical for SSE streaming)
  if (req.headers.accept) {
    headers['Accept'] = req.headers.accept;
  }

  // Forward Authorization header if present
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  // Forward other important headers
  if (req.headers['user-agent']) {
    headers['User-Agent'] = req.headers['user-agent'];
  }

  // Prepare request body
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    if (typeof req.body === 'string') {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }
  }

  try {
    console.log(`[messaging proxy] ${req.method} ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: req.method,
      headers,
      body,
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
      // Skip headers that Vercel manages or could cause issues
      const skipHeaders = [
        'content-encoding',
        'transfer-encoding',
        'connection',
        'keep-alive',
        'upgrade',
      ];
      if (!skipHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Set status code
    res.status(response.status);

    // Handle SSE streaming (text/event-stream)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        
        // Stream the response chunk by chunk
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
        
        res.end();
        return;
      }
    }

    // For regular responses, read and send the body
    const text = await response.text();
    res.send(text);
  } catch (error) {
    console.error('[messaging proxy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'Failed to proxy request to backend',
        details: errorMessage,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
