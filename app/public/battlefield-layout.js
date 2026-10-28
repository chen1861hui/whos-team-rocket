// Viewer rotation changes presentation only; the server's seating order is untouched.
export function seatLayout(players, viewerId, radius = 7.2) {
  const viewer = Math.max(0, players.findIndex(player => player.id === viewerId));
  return players.map((player, index) => {
    const slot = (index - viewer + players.length) % players.length;
    const angle = slot * Math.PI * 2 / players.length;
    return {id: player.id, index, slot, angle, x: Math.sin(angle) * radius, z: Math.cos(angle) * radius};
  });
}
