// Thin fetch wrapper. Credentials:'include' sends the httpOnly auth cookie.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  listServers: () => request('/servers'),
  createServer: (name) => request('/servers', { method: 'POST', body: JSON.stringify({ name }) }),
  createChannel: (serverId, name) =>
    request(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify({ name }) }),

  listMessages: (channelId) => request(`/channels/${channelId}/messages`),
  sendMessage: (channelId, content) =>
    request(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  toggleReaction: (messageId, emoji) =>
    request(`/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
};