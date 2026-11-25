import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRulebook } from '../public/rulebook.js';
import { RADIO_TOWER, VIRIDIAN_GYM } from '../public/match-mode.js';
import { HOENN_PACK, MIXED_PACK, TOUR_PACK } from '../public/expansion-content.js';

const section=(book,id)=>book.sections.find(stage=>stage.id===id);
test('Rulebook shows the selected mode and its specific partners, settings and victory routes',()=>{
  const original=buildRulebook();
  assert.equal(original.mode,'identity');
  assert.equal(original.cards,108);
  assert.equal(section(original,'victory').steps.length,3);
  assert.equal(buildRulebook({}, {practiceDuel:true}).mode,'practice-duel');
  assert.equal(section(original,'radio'),undefined);
  const teams=buildRulebook({matchMode:'teams',contentPack:TOUR_PACK},{seatCount:30});
  assert.equal(teams.cards,264);
  assert.match(section(teams,'setup').copy.zh,/按座位/);
  assert.equal(section(teams,'victory').steps,undefined);
  assert.ok(section(teams,'follow-me'));
  const radio=buildRulebook({matchMode:'teams',teamScenario:RADIO_TOWER,teamAssignment:'random'});
  assert.match(section(radio,'setup').copy.zh,/随机组/);
  assert.match(section(radio,'victory').copy.en,/4 intelligence points/);
  assert.match(section(radio,'radio').copy.en,/different printed weather/);
});

test('Rulebook reflects compatible overlays and shows Gym Guard only when selected',()=>{
  const options={identityScenario:VIRIDIAN_GYM,contentPack:MIXED_PACK,weatherLab:true};
  const base=buildRulebook(options,{deckCardCount:172});
  assert.equal(base.mode,VIRIDIAN_GYM);
  assert.match(section(base,'setup').copy.zh,/第 3 轮/);
  assert.equal(section(base,'viridian').steps.length,1);
  assert.equal(base.cards,172);
  assert.equal(section(base,'weather').steps.length,4);
  const guarded=buildRulebook({...options,gymGuard:true});
  assert.equal(section(guarded,'viridian').steps.at(-1)[0].zh,'道馆护卫');
  assert.equal(section(guarded,'response').copy.en.includes('rescue'),true);
  const paired=buildRulebook({...options,rocketPartners:true});
  assert.equal(section(paired,'viridian').steps.at(-1)[0].en,'Jessie and James');
  assert.match(section(paired,'victory').steps.at(-1)[1].en,/Both partners win/);
  assert.match(section(base,'victory').steps.at(-1)[1].en,/sole survivor/);
  assert.equal(section(buildRulebook({gymGuard:true,contentPack:HOENN_PACK}),'viridian'),undefined);
  assert.equal(section(buildRulebook({weatherLab:true}),'weather'),undefined);
});


test('Rulebook describes the selected Infiltrator choice, combined capacity and independent victory',()=>{
  const book=buildRulebook({identityScenario:VIRIDIAN_GYM,rocketInfiltration:true,rocketPartners:true});
  assert.match(section(book,'setup').copy.en,/Start with 6/);
  assert.match(section(book,'viridian').steps.at(-1)[1].en,/round 2/);
  assert.match(section(book,'viridian').steps.at(-1)[1].en,/Resolve any forecast first/);
  assert.match(section(book,'victory').steps[1][1].en,/sole survivor/);
  assert.equal(section(buildRulebook({identityScenario:VIRIDIAN_GYM}),'viridian').steps.length,1);
});
