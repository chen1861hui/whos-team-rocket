// Viewer rotation changes presentation only; the server's seating order is untouched.
export function seatLayout(players, viewerId, radius = 7.2) {
  const viewer = Math.max(0, players.findIndex(player => player.id === viewerId));
  return players.map((player, index) => {
    const slot = (index - viewer + players.length) % players.length;
    const angle = slot * Math.PI * 2 / players.length;
    return {id: player.id, index, slot, angle, x: Math.sin(angle) * radius, z: Math.cos(angle) * radius};
  });
}

// Leave the largest gaps beside the foreground seat and group the far seats.
const sixSeatCoastalAngles = [0,78,138,180,222,282].map(degrees=>degrees*Math.PI/180);

export function coastalSeatLayout(players, viewerId) {
  const viewerIndex = players.findIndex(player => player.id===viewerId);
  const leaderIndex = players.findIndex(player => player.leader);
  const count = players.length;
  const radius = 7.35;
  return players.map((player,index) => {
    let angle = index*Math.PI*2/count;
    if (viewerIndex>=0) {
      const fromViewer = (index-viewerIndex+count)%count;
      angle = count===6 ? sixSeatCoastalAngles[fromViewer] : fromViewer*Math.PI*2/count;
    } else if (leaderIndex>=0) {
      const fromLeader = (index-leaderIndex+count)%count;
      angle = count===6 ? sixSeatCoastalAngles[(fromLeader+3)%count] : (Math.PI+fromLeader*Math.PI*2/count)%(Math.PI*2);
    }
    return {id:player.id,index,angle,x:Math.sin(angle)*radius,z:Math.cos(angle)*radius};
  });
}

export function coastalStationLayout(players, viewerId) {
  const seats = coastalSeatLayout(players);
  const viewer = seats.find(seat => seat.id === viewerId);
  const sceneryAngle = -(viewer?.angle ?? 0);
  return {
    sceneryAngle,
    seated: Boolean(viewer),
    stations: new Map(seats.map(seat => [seat.id, {
      angle: seat.angle + sceneryAngle,
      rear: Boolean(players[seat.index].leader),
    }])),
  };
}

export function fireGymLayout(players, viewerId) {
  const fixedSeats = coastalSeatLayout(players);
  const viewer = fixedSeats.find(seat => seat.id===viewerId);
  const sceneryAngle = -(viewer?.angle ?? 0);
  return {
    sceneryAngle,
    seated: Boolean(viewer),
    seats:fixedSeats.map(seat => {
      const angle = seat.angle + sceneryAngle;
      const radius = Math.hypot(seat.x,seat.z);
      return {...seat,angle,x:Math.sin(angle)*radius,z:Math.cos(angle)*radius};
    }),
  };
}

export function pokemonLevelScale(level) {
  return [0.92, 1.10, 1.30][level - 1] ?? 1;
}

// National Pokédex heights in decimetres for the bundled forms.
// https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon.csv
const pokedexHeights = {
  1: 7, 2: 10, 3: 20, 4: 6, 5: 11, 6: 17, 7: 5, 8: 10, 9: 16,
  10: 3, 11: 7, 12: 11, 13: 3, 14: 6, 15: 10, 16: 3, 17: 11, 18: 15,
  25: 4, 26: 8, 27: 6, 28: 10, 32: 5, 33: 9, 34: 14, 35: 6, 36: 13,
  37: 6, 38: 11, 39: 5, 50: 2, 51: 7, 52: 4, 53: 10, 54: 8, 55: 17,
  56: 5, 57: 10, 58: 7, 59: 19, 63: 9, 64: 13, 65: 15, 66: 8, 67: 15, 68: 16,
  79: 12, 80: 16, 81: 3, 82: 10, 83: 8, 88: 9, 89: 12, 90: 3, 91: 15,
  92: 13, 93: 16, 94: 15, 102: 4, 103: 20, 104: 4, 105: 10, 109: 6, 110: 12,
  111: 10, 112: 19, 113: 11, 115: 22, 120: 8, 121: 11, 122: 13, 123: 15, 124: 14,
  125: 11, 128: 14, 129: 9, 130: 65, 131: 25, 137: 8, 142: 18, 143: 21,
  144: 17, 145: 16, 146: 20, 147: 18, 148: 40, 149: 22, 150: 20, 151: 4,
};

export function pokemonArenaModelScale(dex, bounds) {
  const width = Math.max(bounds.x,.01);
  const height = Math.max(bounds.y,.01);
  const depth = Math.max(bounds.z,.01);
  const decimetres = pokedexHeights[dex];
  if (!decimetres) {
    return Math.max(2.25/Math.max(width,height,depth),Math.min(1.85/height,4.55/width,3.40/depth));
  }
  // Compress the height range so small forms read at a distance and large forms fit their seat.
  const targetHeight = Math.max(1.18,Math.min(2.85,1.76*(decimetres/6)**.39));
  const large = Math.max(0,Math.min(1,(targetHeight-1.75)/.9));
  return Math.min(targetHeight/height,(4.35+.48*large)/width,(3.40+.65*large)/depth);
}
