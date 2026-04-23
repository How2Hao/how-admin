interface JsonRequestInit {
  method?: string
  body?: BodyInit | Record<string, unknown> | null
  headers?: HeadersInit
}

function parseJsonText<T>(text: string) {
  return JSON.parse(text) as T
}

function extractErrorMessage(payloadText: string, response: Response | null, fallback?: unknown) {
  const trimmed = payloadText.trim()

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as {
        statusMessage?: string
        message?: string
        statusText?: string
      }

      return parsed.statusMessage || parsed.message || parsed.statusText || trimmed
    }
    catch {
      return trimmed
    }
  }

  if (fallback instanceof Error && fallback.message) {
    return fallback.message
  }

  return response?.statusText || '请求失败'
}

export async function requestJson<T>(url: string, init: JsonRequestInit = {}) {
  const headers = new Headers(init.headers)
  const hasBody = init.body !== undefined && init.body !== null
  const isRawBody = typeof init.body === 'string' || init.body instanceof FormData

  if (hasBody && !isRawBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const body = hasBody
    ? (isRawBody ? init.body : JSON.stringify(init.body))
    : null

  const {
    data,
    error,
    execute,
    response,
  } = useFetch(
    url,
    {
      method: init.method ?? 'GET',
      body: body as BodyInit | null,
      headers,
    },
    {
      immediate: false,
    },
  ).text()

  await execute()

  const payloadText = data.value ?? ''

  if (error.value || !response.value?.ok) {
    throw new Error(extractErrorMessage(payloadText, response.value, error.value))
  }

  return payloadText ? parseJsonText<T>(payloadText) : null as T
}
