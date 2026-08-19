import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { useRealtime } from '../hooks/useRealtime.js';
import { disconnectSocket } from '../socket/index.js';

export default function ServerView() {
  const { user, logout } = useAuth();

  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  const [newServer, setNewServer] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [error, setError] = useState('');
  const msgEndRef = useRef(null);

  // Load servers on mount.
  useEffect(() => {
    api.listServers().then(({ servers }) => {
      setServers(servers);
      if (servers.length > 0) {
        setActiveServer(servers[0]);
        if (servers[0].channels.length > 0) setActiveChannelId(servers[0].channels[0].id);
      }
    }).catch(() => {});
  }, []);

  // Select a different server.
  const pickServer = (s) => {
    setActiveServer(s);
    setActiveChannelId(s.channels[0]?.id ?? null);
    setMessages([]);
  };

  // Fetch messages when channel changes.
  useEffect(() => {
    if (!activeChannelId) return setMessages([]);
    api.listMessages(activeChannelId).then(({ messages }) => setMessages(messages)).catch((e) => setError(e.message));
  }, [activeChannelId]);

  // Realtime: append new messages / patch reactions.
  const applyMessage = useCallback(({ message }) => {
    if (message.channelId === activeChannelId) {
      setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
    }
  }, [activeChannelId]);

  const applyReaction = useCallback(({ messageId, emoji, reacted, userId }) => {
    setMessages((msgs) => msgs.map((m) => {
      if (m.id !== messageId) return m;
      const myReact = m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
      if (reacted) myReact.push({ emoji, userId });
      return { ...m, reactions: myReact };
    }));
  }, []);

  useRealtime(activeChannelId, { onMessage: applyMessage, onReaction: applyReaction });

  // Auto-scroll to newest message.
  useEffect(() => {
    msgEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeChannelId) return;
    setDraft('');
    try {
      const { message } = await api.sendMessage(activeChannelId, content);
      setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
    } catch (err) {
      setError(err.message);
      setDraft(content);
    }
  };

  const toggleReact = async (messageId, emoji) => {
    // Optimistic update so reactions feel instant AND work even if the socket
    // hiccups — then reconcile with the server's authoritative answer.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const has = m.reactions.some((r) => r.userId === user.id && r.emoji === emoji);
        const reactions = m.reactions.filter((r) => !(r.userId === user.id && r.emoji === emoji));
        if (!has) reactions.push({ emoji, userId: user.id });
        return { ...m, reactions };
      })
    );
    try {
      const { reacted } = await api.toggleReaction(messageId, emoji);
      // Reconcile to server truth in case of a race.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const has = m.reactions.some((r) => r.userId === user.id && r.emoji === emoji);
          if (has === reacted) return m;
          const reactions = m.reactions.filter((r) => !(r.userId === user.id && r.emoji === emoji));
          if (reacted) reactions.push({ emoji, userId: user.id });
          return { ...m, reactions };
        })
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const createServer = async (e) => {
    e.preventDefault();
    if (!newServer.trim()) return;
    try {
      const { server } = await api.createServer(newServer.trim());
      setServers((s) => [...s, server]);
      setNewServer('');
      pickServer(server);
    } catch (err) {
      setError(err.message);
    }
  };

  const createChannel = async (e) => {
    e.preventDefault();
    if (!newChannel.trim() || !activeServer) return;
    try {
      const { channel } = await api.createChannel(activeServer.id, newChannel.trim());
      setActiveServer((s) => ({ ...s, channels: [...s.channels, channel] }));
      setActiveChannelId(channel.id);
      setNewChannel('');
    } catch (err) {
      setError(err.message);
    }
  };

  const onLogout = async () => {
    disconnectSocket();
    await logout();
  };

  return (
    <div className="shell">
      {/* Server rail */}
      <div className="rail">
        {servers.map((s) => (
          <button
            key={s.id}
            className={`rail-btn ${activeServer?.id === s.id ? 'active' : ''}`}
            onClick={() => pickServer(s)}
            title={s.name}
          >
            {s.icon ?? '🏠'}
          </button>
        ))}
      </div>

      {/* Sidebar: channels */}
      <aside className="sidebar">
        <div className="server-name">{activeServer?.name ?? 'No server'}</div>

        <div className="channel-scroller">
          {activeServer?.channels.map((c) => (
            <button
              key={c.id}
              className={`channel ${activeChannelId === c.id ? 'active' : ''}`}
              onClick={() => setActiveChannelId(c.id)}
            >
              # {c.name}
            </button>
          ))}
        </div>

        <form className="mini-form" onSubmit={createChannel}>
          <input
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            placeholder="+ new channel"
          />
        </form>

        <form className="mini-form" onSubmit={createServer}>
          <input
            value={newServer}
            onChange={(e) => setNewServer(e.target.value)}
            placeholder="+ new server"
          />
        </form>

        <div className="session">
          <span className="session-icon">{user?.icon ?? '👤'}</span>
          <div className="session-meta">
            <strong>{user?.name}</strong>
            <span className="muted">{user?.email}</span>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Log out">⏻</button>
        </div>
      </aside>

      {/* Main chat */}
      <main className="chat">
        <div className="chat-header"># {activeServer?.channels.find((c) => c.id === activeChannelId)?.name ?? 'general'}</div>

        {error && <div className="error chat-error" onClick={() => setError('')}>⚠ {error}</div>}

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">No messages yet — say hi!</div>
          ) : (
            messages.map((m) => (
              <Message key={m.id} msg={m} meId={user.id} onReact={toggleReact} />
            ))
          )}
          <div ref={msgEndRef} />
        </div>

        <form className="composer" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message #${activeServer?.channels.find((c) => c.id === activeChannelId)?.name ?? ''}`}
            disabled={!activeChannelId}
          />
          <button type="submit" disabled={!draft.trim() || !activeChannelId}>➤</button>
        </form>
      </main>
    </div>
  );
}

// A single message with author, content, and a reaction row.
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '👀'];

function Message({ msg, meId, onReact }) {
  const counts = {};
  const mine = [];
  for (const r of msg.reactions || []) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.userId === meId) mine.push(r.emoji);
  }
  const emojis = Object.keys(counts);

  return (
    <div className="message">
      <span className="msg-avatar">{msg.author?.icon ?? '👤'}</span>
      <div className="msg-body">
        <div className="msg-meta">
          <strong>{msg.author?.name}</strong>
          <span className="msg-time">{new Date(msg.createdAt).toLocaleTimeString()}</span>
        </div>
        <div className="msg-content">{msg.content}</div>

        <div className="reactions" data-reactions-for={msg.id}>
          {emojis.map((e) => (
            <button
              key={e}
              className={`reaction ${mine.includes(e) ? 'mine' : ''}`}
              onClick={() => onReact(msg.id, e)}
            >
              {e} {counts[e]}
            </button>
          ))}
          {!mine.includes('👍') && (
            <button className="reaction add" onClick={() => onReact(msg.id, '👍')} title="Add reaction">
              ➕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}