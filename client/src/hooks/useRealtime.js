import { useEffect, useRef } from 'react';
import { connectSocket, getSocket } from '../socket/index.js';

// useRealtime wires the app socket and registers a handler for realtime events
// for a specific channel. Re-subscribes when channelId changes.
export function useRealtime(channelId, handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = connectSocket();
    if (socket.disconnected) socket.connect();

    socket.emit('channel:join', { channelId });

    const onMessage = (data) => handlersRef.current?.onMessage?.(data);
    const onReaction = (data) => handlersRef.current?.onReaction?.(data);

    socket.on('message:new', onMessage);
    socket.on('reaction:update', onReaction);

    return () => {
      socket.emit('channel:leave', { channelId });
      socket.off('message:new', onMessage);
      socket.off('reaction:update', onReaction);
    };
  }, [channelId]);

  return getSocket();
}

// useUserRealtime listens for events targeted at this user
// (group:added = someone added me to their group; member:joined = propagated via server room).
export function useUserRealtime(onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    const socket = connectSocket();
    if (socket.disconnected) socket.connect();

    const onAdded = (data) => cbRef.current?.({ type: 'group:added', ...data });
    socket.on('group:added', onAdded);

    return () => {
      socket.off('group:added', onAdded);
    };
  }, []);

  return getSocket();
}