import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { useRealtime } from '../hooks/useRealtime.js';
import { disconnectSocket } from '../socket/index.js';

export default function ServerView() {
  const { user, logout } = useAuth();

  const [groups, setGroups] = useState([]); // {id,name,icon,ownerId,chats[],members[]}
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  const [newGroup, setNewGroup] = useState('');
  const [newChat, setNewChat] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [error, setError] = useState('');
  const msgEndRef = useRef(null);

  // Load groups on mount.
  useEffect(() => {
    api.listServers().then(({ servers }) => {
      setGroups(servers);
      if (servers.length > 0) {
        const g = servers[0];
        setActiveGroup(g);
        if (g.chats.length > 0) setActiveChatId(g.chats[0].id);
      }
    }).catch(() => {});
  }, []);

  const pickGroup = (g) => {
    setActiveGroup(g);
    setActiveChatId(g.chats[0]?.id ?? null);
    setMessages([]);
  };

  // Fetch messages when chat changes.
  useEffect(() => {
    if (!activeChatId) return setMessages([]);
    api.listMessages(activeChatId).then(({ messages }) => setMessages(messages)).catch((e) => setError(e.message));
  }, [activeChatId]);

  const applyMessage = useCallback(({ message }) => {
    if (message.channelId === activeChatId) {
      setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
    }
  }, [activeChatId]);

  const applyReaction = useCallback(({ messageId, emoji, reacted, userId }) => {
    setMessages((msgs) => msgs.map((m) => {
      if (m.id !== messageId) return m;
      const myReact = m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
      if (reacted) myReact.push({ emoji, userId });
      return { ...m, reactions: myReact };
    }));
  }, []);

  useRealtime(activeChatId, { onMessage: applyMessage, onReaction: applyReaction });

  useEffect(() => {
    msgEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeChatId) return;
    setDraft('');
    try {
      const { message } = await api.sendMessage(activeChatId, content);
      setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
    } catch (err) {
      setError(err.message);
      setDraft(content);
    }
  };

  const toggleReact = async (messageId, emoji) => {
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

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.trim()) return;
    try {
      const { server } = await api.createServer(newGroup.trim());
      setGroups((g) => [...g, server]);
      setNewGroup('');
      pickGroup(server);
    } catch (err) {
      setError(err.message);
    }
  };

  const createChat = async (e) => {
    e.preventDefault();
    if (!newChat.trim() || !activeGroup) return;
    try {
      const { chat } = await api.createChat(activeGroup.id, newChat.trim());
      setActiveGroup((g) => ({ ...g, chats: [...g.chats, chat] }));
      setActiveChatId(chat.id);
      setNewChat('');
    } catch (err) {
      setError(err.message);
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim() || !activeGroup) return;
    try {
      const { member } = await api.inviteMember(activeGroup.id, inviteUsername.trim());
      setActiveGroup((g) => ({ ...g, members: [...g.members, member] }));
      setInviteUsername('');
      setError('');
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
      {/* Group rail */}
      <div className="rail">
        {groups.map((g) => (
          <button
            key={g.id}
            className={`rail-btn ${activeGroup?.id === g.id ? 'active' : ''}`}
            onClick={() => pickGroup(g)}
            title={g.name}
          >
            {g.icon ?? '👥'}
          </button>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="server-name">{activeGroup?.name ?? 'No group'}</div>

        <div className="section-label">Chats</div>
        <div className="channel-scroller">
          {activeGroup?.chats.map((c) => (
            <button
              key={c.id}
              className={`channel ${activeChatId === c.id ? 'active' : ''}`}
              onClick={() => setActiveChatId(c.id)}
            >
              # {c.name}
            </button>
          ))}
          <form className="mini-form" onSubmit={createChat}>
            <input value={newChat} onChange={(e) => setNewChat(e.target.value)} placeholder="+ new chat" />
          </form>
        </div>

        <div className="section-label">Members ({activeGroup?.members.length ?? 0})</div>
        <div className="channel-scroller members-list">
          {activeGroup?.members.map((m) => (
            <div key={m.id} className={`member ${m.id === user.id ? 'me' : ''}`}>
              <span className="member-icon">{m.icon ?? '👤'}</span>
              <span className="member-name">{m.name}</span>
              {m.role === 'owner' && <span className="owner-badge">👑</span>}
            </div>
          ))}
        </div>

        {/* Invite by username */}
        <form className="mini-form" onSubmit={invite}>
          <input
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="+ invite by username"
          />
        </form>

        <form className="mini-form" onSubmit={createGroup}>
          <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="+ new group" />
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
        <div className="chat-header">
          # {activeGroup?.chats.find((c) => c.id === activeChatId)?.name ?? 'general'}
        </div>

        {error && <div className="error chat-error" onClick={() => setError('')}>⚠ {error}</div>}

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">
              No messages yet — say hi!<br />
              <span className="muted">Tip: invite friends with their username (top-right of the sidebar) or create a new chat.</span>
            </div>
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
            placeholder={`Message ${activeGroup?.chats.find((c) => c.id === activeChatId)?.name ?? ''}`}
            disabled={!activeChatId}
          />
          <button type="submit" disabled={!draft.trim() || !activeChatId}>➤</button>
        </form>
      </main>
    </div>
  );
}

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