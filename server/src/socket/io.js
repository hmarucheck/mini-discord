// Module-level holder so REST routes can broadcast realtime events
// without circular imports. Set once at server bootstrap.
let io = null;

export function setIO(instance) {
  io = instance;
}

export function getIO() {
  return io;
}