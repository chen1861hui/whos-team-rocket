export const ROOM_CAPACITY = 30;
export const IDENTITY_CAPACITY = 6;
export const seatCapacity = settings => settings.matchMode === 'teams' ? ROOM_CAPACITY : IDENTITY_CAPACITY;
export const validTeamSize = count => count >= 2 && count <= ROOM_CAPACITY && count % 2 === 0;
export const teamRoles = ['team-a', 'team-b'];
export const isTeamRole = role => teamRoles.includes(role);
