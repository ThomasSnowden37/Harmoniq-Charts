type RequestOptions = {
  method?: string
  userId?: string | null
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.userId) {
    headers['x-user-id'] = options.userId
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed')
  }

  return data as T
}

export async function banUser(
  targetUserId: string,
  adminUserId: string,
  options: { durationMinutes?: number; endTime?: string },
): Promise<{ id: string; user_id: string; created_at: string; end_time: string }> {
  return request(`/api/admin/users/${targetUserId}/ban`, {
    method: 'POST',
    userId: adminUserId,
    body: {
      duration_minutes: options.durationMinutes,
      end_time: options.endTime,
    },
  })
}

export async function unbanUser(targetUserId: string, adminUserId: string): Promise<void> {
  await request(`/api/admin/users/${targetUserId}/ban`, {
    method: 'DELETE',
    userId: adminUserId,
  })
}
