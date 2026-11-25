export const RADIO_TOWER = 'goldenrod-radio';
export const LAKE_RAGE = 'lake-rage';
export const SILPH_CONTROL = 'silph-control';
export const LAKE_CHALLENGER_LIMIT = 6;
export const SILPH_TEAM_SIZES = [6,12];
export const isLakeRaid = settings => settings.matchMode==='teams' && settings.teamScenario===LAKE_RAGE;
export const isSilphControl = settings => settings.matchMode==='teams' && settings.teamScenario===SILPH_CONTROL;
export const VIRIDIAN_GYM = 'viridian-gym';
export const VIRIDIAN_MIN = 5;
export const VIRIDIAN_MAX = 8;
export const VIRIDIAN_REVEAL_ROUND = 3;
export const INFILTRATOR_ROUND = 2;
export const RADIO_GOAL = 4;
export const ROOM_CAPACITY = 30;
export const IDENTITY_CAPACITY = 6;
export const seatCapacity = settings => {
  if (isLakeRaid(settings)) return LAKE_CHALLENGER_LIMIT;
  if (isSilphControl(settings)) return SILPH_TEAM_SIZES.at(-1);
  if (settings.matchMode === 'teams') return ROOM_CAPACITY;
  return settings.identityScenario === VIRIDIAN_GYM ? VIRIDIAN_MAX : IDENTITY_CAPACITY;
};
export const viridianMinimum = settings => settings.rocketPartners && settings.rocketInfiltration ? VIRIDIAN_MIN+1 : VIRIDIAN_MIN;
export const validViridianSize = (count, settings={}) => count >= viridianMinimum(settings) && count <= VIRIDIAN_MAX;
export const openingGymAce = (room, player) => room.scenario?.viridian
  ? player.id === room.scenario.viridian.proxyId : player.role === 'leader';
export const validTeamSize = count => count >= 2 && count <= ROOM_CAPACITY && count % 2 === 0;
export const teamRoles = ['team-a', 'team-b'];
export const silphTeamRoles = [...teamRoles,'team-c'];
export const isTeamRole = role => silphTeamRoles.includes(role);
export const matchTeamRoles = settings => isSilphControl(settings) ? silphTeamRoles : teamRoles;
export const validTeamScenarioSize = (count, settings) => isLakeRaid(settings) ? count>=2 && count<=LAKE_CHALLENGER_LIMIT :
  isSilphControl(settings) ? SILPH_TEAM_SIZES.includes(count) : validTeamSize(count);
