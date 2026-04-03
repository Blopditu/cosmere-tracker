import {
  CharacterAttributeKey,
  CharacterDefenseKey,
  CharacterDerivedKey,
  CharacterStatSheet,
  CombatPresetAction,
  ParticipantTemplate,
  createEmptyCharacterStatSheet,
} from '@shared/domain';
import { createId } from '../../core/default-data';

type RawStonewalkersPresetAction = {
  name: string;
  kind: CombatPresetAction['kind'];
  actionCost: number;
  focusCost: number;
  requiresTarget: boolean;
  requiresRoll: boolean;
  supportsDamage: boolean;
  defaultModifier?: number | null;
  defaultDamageFormula?: string | null;
  rangeText?: string | null;
  description?: string | null;
};

type RawStonewalkersAdversary = {
  name: string;
  role: string;
  attributes: Record<CharacterAttributeKey, number>;
  defenses: Record<CharacterDefenseKey, number>;
  resources: {
    health: number;
    focus: number;
    investiture: number;
  };
  deflect?: number | null;
  movement?: string | null;
  senses?: string | null;
  skills: Record<string, number>;
  features: string[];
  tactics?: string;
  notes?: string | null;
  presetActions: RawStonewalkersPresetAction[];
  sourceAdversaryName: string;
};

const RAW_STONEWALKERS_ADVERSARIES: RawStonewalkersAdversary[] = 
[
  {
    "name": "Archer",
    "role": "Tier 1 Minion – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 1,
      "intellect": 2,
      "willpower": 1,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 13,
      "cognitive-defense": 13,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 12,
      "focus": 3,
      "investiture": 0
    },
    "deflect": 1,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 3,
      "heavy-weaponry": 4,
      "light-weaponry": 3,
      "discipline": 3,
      "perception": 4,
      "survival": 3
    },
    "features": [
      "Minion . The archer's attacks can't critically hit, and they're immediately defeated when they suffer an injury"
    ],
    "tactics": "); GEOR T Soldiers are trained to be effective on a battlefield in their LEF O ( specialized roles. An archer fights at a distance. They use T Immobilizing Shot to immediately take the upper hand, AL then follow up with Longbow.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Knife",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": "1d4 + 3",
        "rangeText": "reach 5 ft.",
        "description": "Attack +3, reach 5 ft., one target. Graze: 2 (1d4) keen damage. Hit: 5 (1d4 + 3) keen damage"
      },
      {
        "name": "Strike: Longbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d6 + 4",
        "rangeText": "range 150/600 ft.",
        "description": "Attack +4, range 150/600 ft., one target. Graze: 3 (1d6) keen damage. Hit: 7 (1d6 + 4) keen damage"
      },
      {
        "name": "Take Aim",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "On the archer's first turn of each scene, if they aren't Surprised, they can use the Gain Advantage action as ▷ . )"
      },
      {
        "name": "Immobilizing Shot (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 150 feet",
        "description": "When an enemy the archer can sense moves while the archer is within 150 feet T ( of them, the archer makes a Longbow attack against them. On a hit, the target is also Immobilized until the end of the archer's next turn"
      }
    ],
    "sourceAdversaryName": "Archer"
  },
  {
    "name": "Axehound",
    "role": "Tier 1 Minion – Small Animal",
    "attributes": {
      "strength": 2,
      "speed": 2,
      "intellect": 0,
      "willpower": 0,
      "awareness": 3,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 10,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 12,
      "focus": 2,
      "investiture": 0
    },
    "deflect": null,
    "movement": "40 ft.",
    "senses": "40 ft.",
    "skills": {
      "agility": 4,
      "athletics": 4,
      "stealth": 3,
      "perception": 5,
      "survival": 4
    },
    "features": [
      "An axehound is rarely encountered alone, as they hunt Enhanced Senses . The axehound gains an advantage on best with a pack. Their immediate goal is to knock an non-attack tests that rely on smell. enemy prone with their",
      "Bite (with an advantage from Minion . The axehound's attacks can't critically hit, and Pack Instincts, if possible), allowing other axehounds they're immediately defeated when they suffer an injury. to move in for the kill with their On the Hunt reaction. Axehounds typically swarm a single foe rather than"
    ],
    "tactics": "features An axehound is rarely encountered alone, as they hunt Enhanced Senses . The axehound gains an advantage on best with a pack. Their immediate goal is to knock an non-attack tests that rely on smell. enemy prone with their Bite (with an advantage from Minion . The axehound's attacks can't critically hit, and Pack Instincts, if possible), allowing other axehounds they're immediately defeated when they suffer an injury. to move in for the kill with their On the Hunt reaction. Axehounds typically swarm a single foe rather than actions disperse themselves amongst a party, and they often Strike: Bite . Attack +4, reach 5 ft., one target. Graze: drag an unwitting enemy away from allies to more easily 2 (1d4) keen damage. Hit: 6 (1d4 + 4) keen damage, and if defeat them. the target is Medium or smaller, the axehound can spend 1 focus to knock the target Prone, then move up to 10 feet while dragging the target behind them. Pack Instincts . While within 5 feet of an ally, the axehound can use the Gain Advantage action as . On the Hunt . After an enemy within 30 feet of the axehound falls Prone, the axehound moves up to 15 feet toward them.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Bite",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d4 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Graze: drag an unwitting enemy away from allies to more easily 2 (1d4) keen damage. Hit: 6 (1d4 + 4) keen damage, and if defeat them. the target is Medium or smaller, the axehound can spend 1 focus to knock the target Prone, then move up to 10 feet while dragging the target behind them"
      },
      {
        "name": "Pack Instincts",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Pack Instincts"
      },
      {
        "name": "While within 5 feet of an ally, the axehound can use the Gain Advantage action as",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "While within 5 feet of an ally, the axehound can use the Gain Advantage action as"
      },
      {
        "name": "On the Hunt",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 30 feet",
        "description": "After an enemy within 30 feet of the axehound falls Prone, the axehound moves up to 15 feet toward them"
      }
    ],
    "sourceAdversaryName": "Axehound"
  },
  {
    "name": "Axies",
    "role": "Tier 3 Rival – Medium Humanoid",
    "attributes": {
      "strength": 3,
      "speed": 4,
      "intellect": 6,
      "willpower": 4,
      "awareness": 6,
      "presence": 3
    },
    "defenses": {
      "physical-defense": 17,
      "cognitive-defense": 20,
      "spiritual-defense": 19
    },
    "resources": {
      "health": 60,
      "focus": 6,
      "investiture": 0
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "50 ft.",
    "skills": {
      "agility": 6,
      "stealth": 8,
      "thievery": 8,
      "deduction": 8,
      "discipline": 5,
      "lore": 10,
      "deception": 5,
      "insight": 10,
      "perception": 10
    },
    "features": [
      "Immunities: Afflicted, Exhausted, Stunned, Unconscious",
      "Immortal . Axies can't die due to old age, natural causes, or physical injuries. If Axies is reduced to 0 health, he suffers no injuries and regains 20 (5d8) health at the start of his next turn",
      "Curse of Kind . Axies must raise the stakes when making a risky or difficult skill test, and he gains a disadvantage on all plot die rolls"
    ],
    "tactics": "species of humanoids who once populated the island Despite his immortality, Axies is a scholar who prefers nation of Aimia. Axies can shift his form in subtle to avoid any kind of physical conflict. If he finds himself ways, allowing him to \"tattoo\" research notes on in the middle of a fight, he generally proves unhelpful. his own body. He doesn't age and is difficult to kill He's always happy to use his Fun Fact to share some through physical means. For more information arcane lore about spren, but his Curse of Kind trait on Axies, see \"Notable Characters\" in this book's means his words are likely to distract his allies. introduction. PET",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Unarmed",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": "1d4 + 3",
        "rangeText": "reach 5 ft.",
        "description": "Attack +3, reach 5 ft., one target. Graze: 2 (1d4) impact damage. Hit: 5 (1d4 + 3) impact damage"
      },
      {
        "name": "Fun Fact (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 20 feet",
        "description": "Axies chooses an ally he can influence within 20 feet of him, then makes a DC 15 Lore test and raises the stakes. On a success, the chosen ally gains 2 focus. Whether the test succeeds or fails, on , that ally's next test gains an advantage, and on , that ally's next test gains a disadvantage"
      },
      {
        "name": "Shift Form (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Axies shifts his features to conceal his identity. While disguised in this way, any tests made to see through Axies's shifted form gain a disadvantage. This disguise ends when Axies chooses or when he is reduced to 0 focus. Axies Axies the Collector is a Siah Aimian, a mysterious"
      }
    ],
    "sourceAdversaryName": "Axies"
  },
  {
    "name": "Bandit",
    "role": "Tier 1 Minion – Medium Humanoid",
    "attributes": {
      "strength": 1,
      "speed": 1,
      "intellect": 1,
      "willpower": 0,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 12,
      "cognitive-defense": 11,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 11,
      "focus": 2,
      "investiture": 0
    },
    "deflect": 1,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 3,
      "athletics": 3,
      "light-weaponry": 2,
      "discipline": 1,
      "intimidation": 3,
      "perception": 3,
      "survival": 3
    },
    "features": [
      "Minion . The bandit's attacks can't critically hit, and they're ill-gotten gains. immediately defeated when they suffer an injury",
      "Momentum . If the bandit moves at least 10 feet in a straight line toward a target then makes a Mace attack against them on that turn, the bandit gains an advantage on that attack"
    ],
    "tactics": "Movement: 25 ft. A bandit is a simple but efficient attacker. They attack Senses: 10 ft. (sight) with their Shortbow from a distance, chipping away at Physical Skills: Agility +3, Athletics +3, Light Weaponry +2 an unsuspecting caravanner's health as they move in. Cognitive Skills: Discipline +1, Intimidation +3 Once within range, the bandit charges their target to Spiritual Skills: Perception +3, Survival +3 gain Momentum, then ruthlessly debilitates them with Languages: defined by culture their Mace. After overcoming the civilians (and usually features ending their lives), the bandit makes off with their Minion . The bandit's attacks can't critically hit, and they're ill-gotten gains. immediately defeated when they suffer an injury. Momentum . If the bandit moves at least 10 feet in a straight line toward a target then makes a Mace attack against them on that turn, the bandit gains an advantage on that attack. actions Strike: Mace . Attack +2, reach 5 ft., one target. Graze: 3 (1d6) impact damage. Hit: 5 (1d6 + 2) impact damage. Strike: Shortbow . Attack +2, range 80/320 ft., one target. Graze: 3 (1d6) keen damage. Hit: 5 (1d6 + 2) keen damage. Trip (Costs 1 Focus) . The bandit makes an Athletics test against a target within 5 feet of them, opposed by the target's choice of Athletics or Agility. If the bandit succeeds on this test, the target is knocked Prone. A MÓ AR",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Mace",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 2,
        "defaultDamageFormula": "1d6 + 2",
        "rangeText": "reach 5 ft.",
        "description": "Attack +2, reach 5 ft., one target. Graze: 3 (1d6) impact damage. Hit: 5 (1d6 + 2) impact damage"
      },
      {
        "name": "Strike: Shortbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 2,
        "defaultDamageFormula": "1d6 + 2",
        "rangeText": "range 80/320 ft.",
        "description": "Attack +2, range 80/320 ft., one target. Graze: 3 (1d6) keen damage. Hit: 5 (1d6 + 2) keen damage"
      },
      {
        "name": "Trip (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "The bandit makes an Athletics test against a target within 5 feet of them, opposed by the target's choice of Athletics or Agility. If the bandit succeeds on this test, the target is knocked Prone. A MÓ AR"
      }
    ],
    "sourceAdversaryName": "Bandit"
  },
  {
    "name": "Chull",
    "role": "Tier 1 Rival – Large or Huge Animal",
    "attributes": {
      "strength": 4,
      "speed": 0,
      "intellect": 0,
      "willpower": 1,
      "awareness": 3,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 11,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 30,
      "focus": 3,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "10 ft.",
    "senses": "20 ft. (sight)",
    "skills": {
      "athletics": 6,
      "perception": 5
    },
    "features": [
      "Beast of Burden. The chull's carrying capacity is 1,500 lbs.",
      "Plodding Pace. The chull can only use the Move action once per turn."
    ],
    "tactics": "A chull almost always retreats into its shell with Defense Curl during combat, then uses its large claws only when cornered or pushed past its fear.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Pincer",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "1d6 + 6",
        "rangeText": "reach 10 ft.",
        "description": "Attack +6, reach 10 ft., one target. Graze: 3 (1d6) keen damage. Hit: 9 (1d6 + 6) keen damage."
      },
      {
        "name": "Defense Curl",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The chull retracts its head and legs until the start of its next turn. While retracted, its deflect increases to 6 and it can use Brace as if in cover. At the start of each turn, it can spend 1 focus to maintain this effect for an additional round."
      }
    ],
    "sourceAdversaryName": "Chull"
  },
  {
    "name": "Commoner",
    "role": "Tier 1 Minion – Medium Humanoid",
    "attributes": {
      "strength": 0,
      "speed": 1,
      "intellect": 1,
      "willpower": 0,
      "awareness": 1,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 11,
      "cognitive-defense": 12,
      "spiritual-defense": 11
    },
    "resources": {
      "health": 10,
      "focus": 2,
      "investiture": 0
    },
    "deflect": null,
    "movement": "25 ft.",
    "senses": "10 ft. (sight)",
    "skills": {
      "athletics": 1,
      "crafting": 2,
      "insight": 2,
      "perception": 2
    },
    "features": [
      "Minion. The commoner's attacks can't critically hit, and they are immediately defeated when they suffer an injury.",
      "Capable. The commoner has a utility expertise in one profession and gains an advantage on related skill tests."
    ],
    "tactics": "In combat, a commoner usually flees and seeks safety. When forced to fight, they rely on an improvised weapon or Distract to aid a more capable ally.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Improvised Weapon",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 1,
        "defaultDamageFormula": "1d4 + 1",
        "rangeText": "reach 5 ft.",
        "description": "Attack +1, reach 5 ft., one target. On a Complication, the improvised weapon is destroyed. Graze: 2 (1d4) impact damage. Hit: 3 (1d4 + 1) impact damage."
      },
      {
        "name": "Distract",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within reach",
        "description": "When an ally makes a test against an enemy within reach of the commoner, the commoner grants that ally an advantage on the test."
      }
    ],
    "sourceAdversaryName": "Commoner"
  },
  {
    "name": "Deepest One",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 18,
      "speed": 1,
      "intellect": 17,
      "willpower": 4,
      "awareness": 16,
      "presence": 20
    },
    "defenses": {
      "physical-defense": 5,
      "cognitive-defense": 6,
      "spiritual-defense": 2
    },
    "resources": {
      "health": 45,
      "focus": 8,
      "investiture": 6
    },
    "deflect": null,
    "movement": "40 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 7,
      "light-weaponry": 8,
      "stealth": 7,
      "discipline": 9,
      "insight": 6,
      "perception": 7,
      "survival": 6
    },
    "features": [
      "Restrained condition to characters Pure Tones . The Deepest One ignores the Disoriented in that area. If the effect would apply a condition, a character condition while standing on or submerged in solid stone. can avoid it with a successful DC 15 Agility or Athletics test",
      "Swim Through Stone",
      "The Deepest One can move through Regenerate (Costs 1 Investiture) . The Deepest One solid surfaces as if moving along the ground, ignoring difficult recovers 5 (1d6 + 2) health. They can use this free action terrain. While fully submerged, the Deepest One must spend even while Unconscious or otherwise prevented from 1 focus each time they use an action other than the Move using actions. action or their Regenerate free action",
      "The Deepest One Entrap . When an enemy triggers a Reactive Strike from can't use this feature on surfaces made of wood. the",
      "Deepest One while the Deepest One is submerged, the Merging Form (Costs 1 Focus) . Before the Deepest One Deepest One can instead use their Grasping Hands as , takes impact or keen damage from a non-wooden source, spending focus as if they made a Reactive Strike. they can increase their deflect value to 6 against that"
    ],
    "tactics": "The Deepest Ones—called makay-im in the A Deepest One is an eerie foe, unsettling and ruthless. Dawnchant—are Fused who use the surge of Cohesion. They freely move within solid surfaces, striking with their Their powers enable them to glide through stone. Carapace Nails or Trip Attack while maintaining their A Deepest One has smooth skin and entirely lacks protection. They can reshape the battlefield with their Surge hairstrands. Their minimal carapace covers only their of Cohesion, hinder foes with Entrap, or drag a single enemy genitals and their head. They have a sinuous form with down to suffocate with their Grasping Hands—especially long limbs, though they're not abnormally tall, and one they already knocked prone with Trip Attack. their eerie white eyes glow red from behind. Deepest One vital] until they remove either the Restrained or Prone Tier 2 Rival – Medium Humanoid condition. Physical Cognitive Spiritual As , the Restrained target can make a DC 17 Agility str def spd int def wil awa def pre test, removing the Restrained condition on a success. If the 3 18 5 1 17 6 4 16 2 Deepest One takes at least 20 damage on a single turn, the target escapes and is no longer Restrained. Health: 45 (39–51) Focus: 8 Investiture: 6 Surge of Cohesion (Costs 1 Investiture) . The Deepest Movement: 40 ft. One chooses a Large (10-foot) or smaller area or object Senses: 20 ft. (sight, and while submerged, hearing) within 30 feet of them that is made of stone or earth and Physical Skills: Agility +7, Light Weaponry +8, Stealth +7 that isn't being worn or held. That object or area changes Cognitive Skills: Discipline +9 shape in a manner they choose, though not violently Spiritual Skills: Insight +6, Perception +7, Survival +6 enough to cause damage. Surge Skills: Cohesion +9 (3 ranks) Depending on the nature of the reshaping, this can cause Languages: Dawnchant an effect such as creating or removing cover or difficult features terrain, or applying the Restrained condition to characters Pure Tones . The Deepest One ignores the Disoriented in that area. If the effect would apply a condition, a character condition while standing on or submerged in solid stone. can avoid it with a successful DC 15 Agility or Athletics test. Swim Through Stone . The Deepest One can move through Regenerate (Costs 1 Investiture) . The Deepest One solid surfaces as if moving along the ground, ignoring difficult recovers 5 (1d6 + 2) health. They can use this free action terrain. While fully submerged, the Deepest One must spend even while Unconscious or otherwise prevented from 1 focus each time they use an action other than the Move using actions. action or their Regenerate free action. The Deepest One Entrap . When an enemy triggers a Reactive Strike from can't use this feature on surfaces made of wood. the Deepest One while the Deepest One is submerged, the Merging Form (Costs 1 Focus) . Before the Deepest One Deepest One can instead use their Grasping Hands as , takes impact or keen damage from a non-wooden source, spending focus as if they made a Reactive Strike. they can increase their deflect value to 6 against that opportunities and complications damage (no action required). The following options are available when an enemy gains actions an Opportunity or Complication during a scene with the Strike: Carapace Nails . Attack +8, reach 5 ft., one target. Deepest One: Graze: 7 (2d6) keen damage. Hit: 15 (2d6 + 8) keen damage. Opportunity . An enemy can spend to prevent the Strike: Trip Attack . Attack +8, reach 5 ft., one target. Deepest One from using their Surge of Cohesion and Graze: 3 (1d6) impact damage. Hit: 11 (1d6 + 8) impact Regenerate actions until the end of the Deepest One's damage, and the Deepest One can knock the target Prone. next turn. Additionally, if the Deepest One is submerged, they immediately emerge from that surface. Grasping Hands . The Deepest One strangles a target they Complication . The GM can spend from an enemy's test to can sense within 5 feet of them. The target must succeed on have the Deepest One use their abilities more efficiently. a DC 17 Agility test or become Restrained while the Deepest Until the end of their next turn, the Deepest One becomes One remains within 5 feet of them. If the Restrained target Focused, and they don't need to spend Investiture to use is also Prone, they begin suffocating and are Afflicted [2d10 their features or actions.",
    "notes": "Surge Skills: Cohesion +9 (3 ranks) Depending on the nature of the reshaping, this can cause",
    "presetActions": [
      {
        "name": "Opportunity or Complication during a scene with the Strike: Carapace Nails",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 8,
        "defaultDamageFormula": "2d6 + 8",
        "rangeText": "reach 5 ft.",
        "description": "Attack +8, reach 5 ft., one target. Deepest One: Graze: 7 (2d6) keen damage. Hit: 15 (2d6 + 8) keen damage"
      },
      {
        "name": "Opportunity",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Opportunity"
      },
      {
        "name": "An enemy can spend to prevent the Strike: Trip Attack",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 8,
        "defaultDamageFormula": "1d6 + 8",
        "rangeText": "reach 5 ft.",
        "description": "Attack +8, reach 5 ft., one target. Deepest One from using their Surge of Cohesion and Graze: 3 (1d6) impact damage. Hit: 11 (1d6 + 8) impact Regenerate actions until the end of the Deepest One's damage, and the Deepest One can knock the target Prone. next turn. Additionally, if the Deepest One is submerged, they immediately emerge from that surface"
      },
      {
        "name": "Grasping Hands",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Grasping Hands"
      },
      {
        "name": "The Deepest One strangles a target they Complication",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "The GM can spend from an enemy's test to can sense within 5 feet of them. The target must succeed on have the Deepest One use their abilities more efficiently. a DC 17 Agility test or become Restrained while the Deepest Until the end of their next turn, the Deepest One becomes One remains within 5 feet of them. If the Restrained target Focused, and they don't need to spend Investiture to use is also Prone, they begin suffocating and are Afflicted [2d10 their features or actions."
      }
    ],
    "sourceAdversaryName": "Deepest One"
  },
  {
    "name": "Direform Regal",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 5,
      "speed": 3,
      "intellect": 1,
      "willpower": 3,
      "awareness": 3,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 18,
      "cognitive-defense": 14,
      "spiritual-defense": 14
    },
    "resources": {
      "health": 42,
      "focus": 5,
      "investiture": 5
    },
    "deflect": 4,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 5,
      "athletics": 8,
      "heavy-weaponry": 8,
      "light-weaponry": 6,
      "discipline": 6,
      "intimidation": 6,
      "perception": 5
    },
    "features": [
      "When a weakened foe attempts to flee, the direform Martial Experience . The direform can use their Strike action uses Tackle to cut off their escape. twice on their turn",
      "Obstinate Guard . It costs the direform 1 fewer focus to resist an enemy's influence",
      "Spiked Carapace . The direform can use their carapace like a shield, allowing them to use the Brace action. While benefiting from Brace, the first time on each turn that the direform is either hit or grazed by a melee attack or is successfully Grappled or Shoved by an enemy, that enemy takes 3 (1d6) keen damage"
    ],
    "tactics": "Movement: 30 ft. A direform Regal is a brutal foe who seeks to dominate Senses: 20 ft. (sight) in hand-to-hand combat. Until an enemy draws close Physical Skills: Agility +5, Athletics +8, Heavy Weaponry +8, enough for the Regal to charge in with their Hammer, Light Weaponry +6 the direform peppers enemies with their Longbow. Once Cognitive Skills: Discipline +6, Intimidation +6 a foe nears, the direform closes the distance, uses Invested Spiritual Skills: Perception +5 Enhancement, and begins hammering away, mixing in the Languages: defined by culture Brace action to take advantage of their Spiked Carapace. features When a weakened foe attempts to flee, the direform Martial Experience . The direform can use their Strike action uses Tackle to cut off their escape. twice on their turn. Obstinate Guard . It costs the direform 1 fewer focus to resist an enemy's influence. Spiked Carapace . The direform can use their carapace like a shield, allowing them to use the Brace action. While benefiting from Brace, the first time on each turn that the direform is either hit or grazed by a melee attack or is successfully Grappled or Shoved by an enemy, that enemy takes 3 (1d6) keen damage. actions Strike: Hammer . Attack +8, reach 5 ft., one target. The dire form gains an advantage on this attack if they moved at least 10 feet in a straight line toward the target this turn. Graze: 5 (1d10) impact damage. Hit: 13 (1d10 + 8) impact damage. Strike: Longbow . Attack +8, range 150/600 ft., one target. Graze: 3 (1d6) keen damage. Hit: 11 (1d6 + 8) keen damage. Invested Enhancement (Costs 1 Investiture) . The direform becomes Enhanced [Strength +1] and Enhanced [Speed +1] until the end of their next turn. This temporarily increases each of their Physical skills by 1, including their Hammer and Longbow actions' attack and damage rolls. At the end of each of the direform's turns, they can spend 1 Investiture to maintain this effect for an additional round. Stand Firm (Costs 1 Focus) . Before the direform is unwillingly moved or knocked Prone, they ignore that effect. Tackle . When an enemy triggers a Reactive Strike from the direform, the direform can instead attempt to Grapple the enemy as , spending focus as if they made a Reactive Strike. If the Grapple succeeds, the enemy also takes 3 (1d6) WILL O'BRIEN keen damage from the direform's carapace spikes.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Hammer",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 8,
        "defaultDamageFormula": "1d10 + 8",
        "rangeText": "reach 5 ft.",
        "description": "Attack +8, reach 5 ft., one target. The dire form gains an advantage on this attack if they moved at least 10 feet in a straight line toward the target this turn. Graze: 5 (1d10) impact damage. Hit: 13 (1d10 + 8) impact damage"
      },
      {
        "name": "Strike: Longbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 8,
        "defaultDamageFormula": "1d6 + 8",
        "rangeText": "range 150/600 ft.",
        "description": "Attack +8, range 150/600 ft., one target. Graze: 3 (1d6) keen damage. Hit: 11 (1d6 + 8) keen damage"
      },
      {
        "name": "Invested Enhancement (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The direform becomes Enhanced [Strength +1] and Enhanced [Speed +1] until the end of their next turn. This temporarily increases each of their Physical skills by 1, including their Hammer and Longbow actions' attack and damage rolls. At the end of each of the direform's turns, they can spend 1 Investiture to maintain this effect for an additional round"
      },
      {
        "name": "Stand Firm (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Before the direform is unwillingly moved or knocked Prone, they ignore that effect"
      },
      {
        "name": "Tackle",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "When an enemy triggers a Reactive Strike from the direform, the direform can instead attempt to Grapple the enemy as , spending focus as if they made a Reactive Strike. If the Grapple succeeds, the enemy also takes 3 (1d6) WILL O'BRIEN keen damage from the direform's carapace spikes"
      }
    ],
    "sourceAdversaryName": "Direform Regal"
  },
  {
    "name": "Duelist Shardbearer",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 3,
      "speed": 4,
      "intellect": 2,
      "willpower": 3,
      "awareness": 2,
      "presence": 4
    },
    "defenses": {
      "physical-defense": 17,
      "cognitive-defense": 15,
      "spiritual-defense": 16
    },
    "resources": {
      "health": 40,
      "focus": 5,
      "investiture": 0
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 6,
      "heavy-weaponry": 6,
      "discipline": 4,
      "intimidation": 5,
      "insight": 4,
      "leadership": 6,
      "persuasion": 6
    },
    "features": [],
    "tactics": "Health: 40 (31–49) Focus: 5 Investiture: 0 Shardbearers are incredible warriors who control the Movement: 30 ft. battlefield. A duelist Shardbearer disrupts their opponents Senses: 10 ft. (sight) with Feint and uses their exceptional mobility to position Physical Skills: Agility +6, Heavy Weaponry +6, Light themselves for Flamestance or Windstance. With Jarring Weaponry +7 Insight, a duelist is a threat to their opponent's plans both Cognitive Skills: Discipline +4, Intimidation +5 in and out of combat. Spiritual Skills: Insight +4, Leadership +6, Persuasion +6 Languages: defined by culture traits Inspiring Leadership . When the duelist successfully uses the Gain Advantage action, they can choose one ally they can influence. That ally also gains an advantage on the next test they make against the duelist's target. actions Strike: Shardblade . Attack +6, reach 5 ft., one target. Graze: 9 (2d8) spirit damage. Hit: 22 (2d8 + 6) spirit damage. Change Stance (Costs 1 Focus) . The duelist shifts into one of the following stances, losing the effects of any previous stance and gaining the effects of the new stance: Flamestance . While there's only one enemy within 5 feet of the duelist and no allies within 5 feet of them or that enemy, the duelist can use to gain , which they can spend only on the Gain Advantage action or on an action that includes an attack test. Windstance . While there are two or more enemies within 5 feet of the duelist, the duelist can use to gain , which they can spend only on the Disengage action or on an action that includes an attack test. Feint (Costs 1 Focus) . The duelist tests Heavy Weaponry against the Cognitive defense of a target within 5 feet of them. If the duelist succeeds, the target loses and 1d4 focus. If the duelist fails, the target loses 1 focus. The duelist can spend from this test to use their Change Stance action as without spending focus. Jarring Insight . The duelist reads their enemy with prac- ticed ease, making an opposed Insight test against the target's Discipline. If the duelist succeeds, the target loses one at the beginning of their next turn, or if they're in a conversation, the target gains a disadvantage on their next contribution. Reposition (Costs 1 Focus) . Before the duelist is unwillingly moved, they ignore that effect and use the Disengage action as . JA",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Shardblade",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "2d8 + 6",
        "rangeText": "reach 5 ft.",
        "description": "Attack +6, reach 5 ft., one target. Graze: 9 (2d8) spirit damage. Hit: 22 (2d8 + 6) spirit damage"
      },
      {
        "name": "Change Stance (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Change Stance (Costs 1 Focus)"
      },
      {
        "name": "The duelist shifts into one of the following stances, losing the effects of any previous stance and gaining the effects of the new stance: Flamestance",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "While there's only one enemy within 5 feet of the duelist and no allies within 5 feet of them or that enemy, the duelist can use to gain , which they can spend only on the Gain Advantage action or on an action that includes an attack test"
      },
      {
        "name": "Windstance",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "While there are two or more enemies within 5 feet of the duelist, the duelist can use to gain , which they can spend only on the Disengage action or on an action that includes an attack test"
      },
      {
        "name": "Feint (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "The duelist tests Heavy Weaponry against the Cognitive defense of a target within 5 feet of them. If the duelist succeeds, the target loses and 1d4 focus. If the duelist fails, the target loses 1 focus. The duelist can spend from this test to use their Change Stance action as without spending focus"
      },
      {
        "name": "Jarring Insight",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The duelist reads their enemy with prac- ticed ease, making an opposed Insight test against the target's Discipline. If the duelist succeeds, the target loses one at the beginning of their next turn, or if they're in a conversation, the target gains a disadvantage on their next contribution"
      },
      {
        "name": "Reposition (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Reposition (Costs 1 Focus)"
      },
      {
        "name": "Before the duelist is unwillingly moved, they ignore that effect and use the Disengage action as",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "JA"
      }
    ],
    "sourceAdversaryName": "Duelist Shardbearer"
  },
  {
    "name": "Dustbringer of the Second Ideal",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 3,
      "intellect": 3,
      "willpower": 2,
      "awareness": 3,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 15,
      "cognitive-defense": 15,
      "spiritual-defense": 14
    },
    "resources": {
      "health": 40,
      "focus": 4,
      "investiture": 5
    },
    "deflect": 2,
    "movement": "40 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 6,
      "light-weaponry": 6,
      "stealth": 6,
      "discipline": 4,
      "intimidation": 4,
      "leadership": 3,
      "perception": 5
    },
    "features": [],
    "tactics": "",
    "notes": "Surge Skills: Abrasion +5 (2 ranks), Division +6 (3 ranks) Touch saps the strength of their bulkier foes. Ultimately,",
    "presetActions": [
      {
        "name": "Strike: Sidesword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "1d6 + 6",
        "rangeText": "reach 5 ft.",
        "description": "Attack +6, reach 5 ft., one target. Graze: 3 (1d6) keen damage. Hit: 9 (1d6 + 6) keen damage, and the Dustbringer can spend 1 focus to use the Disengage action as ▷"
      },
      {
        "name": "Strike: Shortbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "1d6 + 6",
        "rangeText": "range 80/320 ft.",
        "description": "Attack +6, range 80/320 ft., one target. Graze: 3 (1d6) keen damage. Hit: 9 (1d6 + 6) keen damage"
      },
      {
        "name": "Decaying Touch (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "3d8 + 6",
        "rangeText": "reach 5 ft.",
        "description": "Attack +6 vs Spiritual defense, reach 5 ft., one target. Graze: 13 (3d8) spirit damage. Hit: 19 (3d8 + 6) spirit damage, and the target must succeed on a DC 14 Agility test or their armor rusts and decays, permanently decreasing its deflect value by 1. Armor damaged in this way can be repaired with proper materials as a downtime activity"
      },
      {
        "name": "Burst of Flame (Costs 2 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 10 feet",
        "description": "The Dustbringer emits a burst of fire that deals 4 (1d8) energy damage to each character within 10 feet of them and sets unattended objects in that area ablaze. Additionally, the Dustbringer can spend 1 focus or more to shower sparks onto that many enemies within 30 feet of them; each target must succeed on a DC 14 Agility test or lose one on their next turn"
      },
      {
        "name": "Eroding Escape (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The Dustbringer targets themself or an ally in reach, ending one condition on them that is either applying the Immobilized condition, the Restrained condition, or a disadvantage on a physical test"
      },
      {
        "name": "Regenerate (Costs 1 Investiture)",
        "kind": "free",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The Dustbringer recovers 5 (1d6 + 2) health. They can use this free action even while Unconscious or otherwise prevented from ADER using actions"
      },
      {
        "name": "Skate (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The Dustbringer moves up to their movement rate in a straight line. ES Expert Eyes of Pala Agent Experts are those who stand out from the crowd due to Eyes of Pala agents are cunning and methodical. unique competence or convictions. Experts might be In service to the Herald of Knowledge, they pursue local leaders, headstrong youths, or savvy traders. the fundamental truths of the universe and ensure that those in power share truth with their people. Expert Tactics Through reasoning and piercing insight, these agents An expert usually fights cautiously with their Improvised bring sharp acuity to bear when they engage others Weapon, but unlike most commoners, they might run in combat. straight into danger if they believe in a cause or see a chance for glory. In conversations, they're more likely Eyes of Pala Agent than commoners stand their ground. If a PC challenges Tier 1 Rival – Medium Humanoid an expert's beliefs, the expert is more likely to spend focus Physical Cognitive Spiritual to resist influence. If sufficiently provoked, they may use str def spd int def wil awa def pre their Counter Argu ment and Stern Countenance to make 2 14 2 1 13 2 3 15 2 things difficult for their opponent. Health: 25 (20–30) Focus: 4 Investiture: 0 Movement: 25 ft"
      }
    ],
    "sourceAdversaryName": "Dustbringer of the Second Ideal"
  },
  {
    "name": "Expert",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 1,
      "speed": 1,
      "intellect": 1,
      "willpower": 2,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 12,
      "cognitive-defense": 13,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 18,
      "focus": 4,
      "investiture": 0
    },
    "deflect": null,
    "movement": "25 ft.",
    "senses": "10 ft. (sight)",
    "skills": {
      "agility": 2,
      "athletics": 2,
      "light-weaponry": 2,
      "crafting": 2,
      "deduction": 2,
      "deception": 2,
      "insight": 4,
      "perception": 4,
      "persuasion": 3
    },
    "features": [
      "Capable. The expert has a utility expertise in one profession and gains an advantage on related skill tests.",
      "Stern Countenance. After the expert spends focus to resist a character's influence, that character loses 1 focus."
    ],
    "tactics": "An expert usually fights cautiously with an improvised weapon, but may run into danger when a cause or chance for glory matters more than safety. In conversations, they are more willing than a commoner to spend focus resisting influence.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Improvised Weapon",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 2,
        "defaultDamageFormula": "1d4 + 2",
        "rangeText": "reach 5 ft.",
        "description": "Attack +2, reach 5 ft., one target. On a Complication, the improvised weapon is destroyed. Graze: 2 (1d4) impact damage. Hit: 3 (1d4 + 2) impact damage."
      },
      {
        "name": "Counter Argument",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "During a conversation, the expert makes a Persuasion test against a character's Spiritual defense. On a success, the target loses 3 focus."
      }
    ],
    "sourceAdversaryName": "Expert"
  },
  {
    "name": "Eyes of Pala Agent",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 2,
      "intellect": 1,
      "willpower": 2,
      "awareness": 3,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 13,
      "spiritual-defense": 15
    },
    "resources": {
      "health": 25,
      "focus": 4,
      "investiture": 0
    },
    "deflect": null,
    "movement": "25 ft.",
    "senses": "20 ft.",
    "skills": {
      "athletics": 4,
      "light-weaponry": 4,
      "stealth": 4,
      "discipline": 4,
      "insight": 5,
      "perception": 5
    },
    "features": [
      "Insightful Defense",
      "The agent makes an Insight test against the Spiritual defense of a character they can sense Capable . The expert has a utility expertise in one profession, within 60 feet of them. On a success, the target can't gain and they gain an advantage on skill tests related to that advantage on attacks against the agent for 1 minute or until profession. the agent uses this action on another target",
      "Stern Countenance",
      "After the expert spends focus to resist Exploit Opening . After an enemy within 5 feet of the a character's influence, that character loses 1 focus. agent grazes them with an attack, the agent makes a"
    ],
    "tactics": "",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Sidesword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d6 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Senses: 10 ft. (sight) Graze: 3 (1d6) keen damage. Hit: 7 (1d6 + 4) keen damage, Physical Skills: Agility +2, Athletics +2, Light Weaponry +2 and if the target is Prone, they lose 1 focus"
      },
      {
        "name": "Cognitive Skills: Crafting +2, Deduction +2 Strike: Shortbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d6 + 4",
        "rangeText": "range 80/320 ft.",
        "description": "Attack +4 to hit, range 80/320 ft., Spiritual Skills: Deception +2, Insight +4, Perception +4, one target. Graze: 3 (1d6) keen damage. Hit: 7 (1d6 + 4) Persuasion +3 keen damage, and the agent can spend 1 focus to knock Languages: defined by culture the target Prone. features"
      },
      {
        "name": "Insightful Defense",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Insightful Defense"
      },
      {
        "name": "The agent makes an Insight test against the Spiritual defense of a character they can sense Capable",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 60 feet",
        "description": "The expert has a utility expertise in one profession, within 60 feet of them. On a success, the target can't gain and they gain an advantage on skill tests related to that advantage on attacks against the agent for 1 minute or until profession. the agent uses this action on another target"
      },
      {
        "name": "Stern Countenance",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Stern Countenance"
      },
      {
        "name": "After the expert spends focus to resist Exploit Opening",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "After an enemy within 5 feet of the a character's influence, that character loses 1 focus. agent grazes them with an attack, the agent makes a actions"
      },
      {
        "name": "Reactive Strike (no action required) against that enemy as Strike: Improvised Weapon",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": 2,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "Attack +2, reach 5 ft., if they had voluntarily left the agent's reach. one target"
      },
      {
        "name": "On a Complication, this improvised weapon is Quick Escape",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": "1d4 + 2",
        "rangeText": "within 5 feet",
        "description": "After an ally within 5 feet of the agent hits destroyed. Graze: 2 (1d4) impact damage. Hit: 3 (1d4 + 2) a target with a melee attack, the agent moves up to half their impact damage. movement rate without triggering Reactive Strikes"
      },
      {
        "name": "Counter Argument",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "During a conversation, the expert makes a Persuasion test against a character's Spiritual defense. On a success, the target loses 3 focus."
      }
    ],
    "sourceAdversaryName": "Eyes of Pala Agent"
  },
  {
    "name": "Eyes of Pala Watcher",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 3,
      "intellect": 2,
      "willpower": 3,
      "awareness": 4,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 15,
      "cognitive-defense": 15,
      "spiritual-defense": 16
    },
    "resources": {
      "health": 42,
      "focus": 5,
      "investiture": 0
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "athletics": 4,
      "heavy-weaponry": 5,
      "stealth": 6,
      "discipline": 6,
      "intimidation": 5,
      "insight": 7,
      "perception": 7
    },
    "features": [],
    "tactics": "",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Longsword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d8 + 7",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 11 (1d8 + 7) keen damage, and the target becomes Slowed until the end of the watcher's next turn"
      },
      {
        "name": "Fan of Blades (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d8 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one or more targets of the Watcher's choice. Graze: 4 (1d8) keen damage. Hit: 9 (1d8 + 5) keen damage, and the target becomes Afflicted [1d8 vital] until they regain at least 1 health"
      },
      {
        "name": "Insightful Defense",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 60 feet",
        "description": "The watcher makes an Insight test against the Spiritual defense of a character they can sense within 60 feet of them. On a success, the target can't gain advantage on attacks against the watcher for 1 minute or until the watcher uses this action on another target"
      },
      {
        "name": "Exploitative Escape",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "After an enemy within 5 feet of the watcher grazes them with an attack, the watcher Strikes the attacker (no action required) then moves up to half their movement rate without triggering Reactive Strikes. Eyes of Pala Watcher Eyes of Pala watchers are adroit and highly trusted operatives who doggedly pursue the Herald Pailiah's goals. Each watcher wears a ceremonial green blindfold, marking their rank and signifying that their keen insight transcends eyes of pala the need for sight. Truth, knowledge, and wise agent (top) and leadership are their calling, and they wield watcher (bottoM) both honed intuition and battlefield prowess to achieve results. ALE S A ALERIA C V"
      }
    ],
    "sourceAdversaryName": "Eyes of Pala Watcher"
  },
  {
    "name": "Guard",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 3,
      "speed": 1,
      "intellect": 1,
      "willpower": 2,
      "awareness": 3,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 13,
      "spiritual-defense": 14
    },
    "resources": {
      "health": 24,
      "focus": 4,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "25 ft.",
    "senses": "20 ft.",
    "skills": {
      "athletics": 5,
      "heavy-weaponry": 5,
      "discipline": 4,
      "intimidation": 4,
      "insight": 4,
      "perception": 5
    },
    "features": [
      "Raise the Alert! After an enemy the guard can sense within 60 feet of them fails a Stealth test, or after the guard succeeds on a test to notice that enemy, this guard and each allied guard who can sense that enemy gains the Focused condition until the end of the scene."
    ],
    "tactics": "A guard quickly incapacitates their targets, especially those discovered committing a crime. They aim to knock an opponent prone with their Longspear, then use Debil- itate to inflict significant damage. While accompanied by other guards or allies, a guard uses Work as One, quickly and efficiently coordinating to subdue opponents. ZMAN T",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Longspear",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d8 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 9 (1d8 + 5) keen damage, and the guard can spend 1 focus to knock the target Prone"
      },
      {
        "name": "Debilitate (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "2d8 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one Prone target. Graze: 9 (2d8) impact damage. Hit: 14 (2d8 + 5) impact damage"
      },
      {
        "name": "Work as One (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "After the guard hits with an attack, they choose an ally who they can influence, urging them to advance. That ally can immediately Disengage (no action required)"
      }
    ],
    "sourceAdversaryName": "Guard"
  },
  {
    "name": "Juvenile Whitespine",
    "role": "Tier 1 Rival – Medium Animal",
    "attributes": {
      "strength": 0,
      "speed": 2,
      "intellect": 3,
      "willpower": 0,
      "awareness": 5,
      "presence": 3
    },
    "defenses": {
      "physical-defense": 12,
      "cognitive-defense": 13,
      "spiritual-defense": 5
    },
    "resources": {
      "health": 23,
      "focus": 4,
      "investiture": 0
    },
    "deflect": 1,
    "movement": "40 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 6,
      "athletics": 5,
      "stealth": 6,
      "intimidation": 4,
      "perception": 5,
      "survival": 5
    },
    "features": [
      "Pheromone Release (Costs 1 Focus)",
      "The whitespine Enhanced Senses . The whitespine gains an advantage on releases foul pheromones. Each non-whitespine character non-attack tests that rely on smell. within 10 feet of them must succeed on a DC 13 Discipline test or become Stunned until the end of the whitespine's Whitespine Tactics next turn. Angry about being kept in captivity, a juvenile whitespine lashes out at anyone they can. They prefer to charge at Juvenile Whitespine distant, weak opponents to deal extra damage with their Held by the Thaylen merchant Ryvlk in the warcamps, Goring Tusks, then follow with their Claws to leave prey these juvenile whitespines may be small, but they're still bleeding out. A whitespine is quick to leave an enemy's dangerous. These person-sized predators are named reach to charge yet another with their Goring Tusks for for the row of spikes that runs down the carapace on more extra damage. When a fight goes poorly, a whitespine their backs. They move on two legs and have two sets uses Pheromone Release, stupefying their opponents so of arms with long, wicked claws. the whitespine can retreat or overwhelm them. Z S FL"
    ],
    "tactics": "",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Claws",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d6 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. Graze: 3 Health: 23 (19–27) Focus: 4 Investiture: 0 (1d6) keen damage. Hit: 8 (1d6 + 5) keen damage, and the Deflect: 1 (carapace) whitespine can spend 1 focus to make the target Afflicted Movement: 40 ft. [1d4 vital] until the target regains at least 1 health. Senses: 20 ft. (smell)"
      },
      {
        "name": "Goring Tusks",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d8 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. Graze: Physical Skills: Agility +6, Athletics +5, Stealth +6 4 (1d8) impact damage. Hit: 9 (1d8 + 5) impact damage. Cognitive Skills: Intimidation +4 If the whitespine hits with this attack immediately after Spiritual Skills: Perception +5, Survival +5 moving at least 15 feet, the target takes an extra 4 (1d8) Languages: none impact damage and must succeed on a DC 12 Athletics test or be knocked Prone. features"
      },
      {
        "name": "Pheromone Release (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Pheromone Release (Costs 1 Focus)"
      },
      {
        "name": "The whitespine Enhanced Senses",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 10 feet",
        "description": "The whitespine gains an advantage on releases foul pheromones. Each non-whitespine character non-attack tests that rely on smell. within 10 feet of them must succeed on a DC 13 Discipline test or become Stunned until the end of the whitespine's Whitespine Tactics next turn. Angry about being kept in captivity, a juvenile whitespine lashes out at anyone they can. They prefer to charge at Juvenile Whitespine distant, weak opponents to deal extra damage with their Held by the Thaylen merchant Ryvlk in the warcamps, Goring Tusks, then follow with their Claws to leave prey these juvenile whitespines may be small, but they're still bleeding out. A whitespine is quick to leave an enemy's dangerous. These person-sized predators are named reach to charge yet another with their Goring Tusks for for the row of spikes that runs down the carapace on more extra damage. When a fight goes poorly, a whitespine their backs. They move on two legs and have two sets uses Pheromone Release, stupefying their opponents so of arms with long, wicked claws. the whitespine can retreat or overwhelm them. Z S FL"
      }
    ],
    "sourceAdversaryName": "Juvenile Whitespine"
  },
  {
    "name": "Kaiana",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 1,
      "speed": 3,
      "intellect": 1,
      "willpower": 2,
      "awareness": 3,
      "presence": 3
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 13,
      "spiritual-defense": 16
    },
    "resources": {
      "health": 34,
      "focus": 4,
      "investiture": 5
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 5,
      "light-weaponry": 5,
      "discipline": 4,
      "medicine": 3,
      "insight": 5,
      "leadership": 4,
      "perception": 5
    },
    "features": [
      "She can use this free action even while Passionate Ally (Costs 1 Focus) . When Kaiana successfully Unconscious or otherwise prevented from using actions. uses the",
      "Gain Advantage action, she can choose one Reflexive Growth (Costs 1 Investiture) . Before Kaiana ally she can influence within 60 feet of her. That ally also or an ally she can sense within 20 feet of her is hit by a gains an advantage on the next test they make against melee attack, she tosses a seed from her pouch and makes Kaiana's target. a Progression test against the attacker's Physical defense",
      "Quick Escape . Once per scene, Kaiana can use her On a success, a plant rapidly grows around the target;",
      "Disorienting Flash as . After she does, she immediately they are Restrained (adding a disadvantage to their test, gains that she can only use on the Interact, Disengage, potentially changing the hit into a miss), and they can't and Move actions. make Reactive Strikes until the end of their next turn"
    ],
    "tactics": "Kaiana is particularly skilled in Progression and uses it to support her allies: Her Reflexive Growth deters attackers, and when needed, she heals allies with Regrowth. Meanwhile, her Distracting Illusion can protect weaker or injured allies. When she isn't needed to react and protect (or when she runs out of Investiture), she uses her Passionate Ally to give allies an opening, and she uses her Knife to impede enemies. Kaiana Distracting Illusion (Costs 1 Investiture) . Kaiana creates Tier 1 Rival – Medium Humanoid an illusory duplicate of herself or an ally she can sense within Physical Cognitive Spiritual 30 feet of her. The illusion appears in that character's space str def spd int def wil awa def pre and moves with them. Attacks against that character gain 1 14 3 1 13 2 3 16 3 a disadvantage and can't graze. The illusion ends after an attack misses that character or at the end of the scene. Health: 34 (28–40) Focus: 4 Investiture: 5 Disorienting Flash (Costs 1 Investiture) . Kaiana Movement: 30 ft. projects light, making an Illumination test against the Senses: 20 ft. (sight) Cognitive defense of each character within 5 feet of her. Physical Skills: Agility +5, Light Weaponry +5 Each character she succeeds against becomes Disoriented Cognitive Skills: Discipline +4, Medicine +3 until the end of their next turn. Spiritual Skills: Insight +5, Leadership +4, Perception +5, Regrowth (Costs 1 Investiture) . Kaiana restores Surge Skills: Illumination +4 (1 rank), Progression 8 (1d6 + 5) health to herself or another character she +5 (2 ranks) can touch. Languages: Alethi, Reshi Regenerate (Costs 1 Investiture) . Kaiana recovers 4 features (1d6+1) health. She can use this free action even while Passionate Ally (Costs 1 Focus) . When Kaiana successfully Unconscious or otherwise prevented from using actions. uses the Gain Advantage action, she can choose one Reflexive Growth (Costs 1 Investiture) . Before Kaiana ally she can influence within 60 feet of her. That ally also or an ally she can sense within 20 feet of her is hit by a gains an advantage on the next test they make against melee attack, she tosses a seed from her pouch and makes Kaiana's target. a Progression test against the attacker's Physical defense. Quick Escape . Once per scene, Kaiana can use her On a success, a plant rapidly grows around the target; Disorienting Flash as . After she does, she immediately they are Restrained (adding a disadvantage to their test, gains that she can only use on the Interact, Disengage, potentially changing the hit into a miss), and they can't and Move actions. make Reactive Strikes until the end of their next turn. actions raysium knife actions Strike: Knife . Attack +5, reach 5 ft. or range 20/60 ft., If Kaiana is wielding the raysium knife in chapter 4, she gains one target. Graze: 2 (1d4) keen damage. Hit: 7 (1d4 + 5) keen the following action: U damage, and Kaiana can spend 1 focus to make the target Strike: Raysium Knife . Kaiana makes a Knife attack (no A LI Slowed until the end of the target's next turn. action required). On a hit, the target also loses 1 Investiture. JESSIC",
    "notes": "Surge Skills: Illumination +4 (1 rank), Progression 8 (1d6 + 5) health to herself or another character she +5 (2 ranks) can touch.",
    "presetActions": [
      {
        "name": "Strike: Knife",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft. or range 20/60 ft., If Kaiana is wielding the raysium knife in chapter 4, she gains one target. Graze: 2 (1d4) keen damage"
      },
      {
        "name": "Hit: 7 (1d4 + 5) keen the following action: U damage, and Kaiana can spend 1 focus to make the target Strike: Raysium Knife",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Kaiana makes a Knife attack (no A LI Slowed until the end of the target's next turn. action required). On a hit, the target also loses 1 Investiture. JESSIC"
      }
    ],
    "sourceAdversaryName": "Kaiana"
  },
  {
    "name": "Khornak",
    "role": "Tier 1 Rival – Medium Animal",
    "attributes": {
      "strength": 12,
      "speed": 4,
      "intellect": 1,
      "willpower": 9,
      "awareness": 1,
      "presence": 5
    },
    "defenses": {
      "physical-defense": 0,
      "cognitive-defense": 8,
      "spiritual-defense": 8
    },
    "resources": {
      "health": 26,
      "focus": 4,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "athletics": 5,
      "stealth": 4,
      "perception": 3,
      "survival": 4
    },
    "features": [
      "Terrifying Ambush",
      "At the start of each scene, each enemy Tail Sweep . Attack +5, reach 5 ft., one target. The khornak who can sense the khornak must make a DC 14 Discipline test can spend up to 2 focus to target that many additional (no action required). On a failure, that enemy can't take a fast targets with the same attack. Graze: 3 (1d6) impact damage. turn this round unless they spend 2 focus",
      "Hit: 8 (1d6 + 5) impact damage, and the target must succeed Ruthless Predator . When the khornak attacks and hits an on a DC 15 Athletics test or be knocked Prone. enemy who hasn't taken a turn yet this round, the attack",
      "Drag . The khornak moves up to 15 feet in any direction OM BABBEYdeals an extra 1d8 damage. while dragging an enemy they have Restrained behind them. T"
    ],
    "tactics": "Lurking in the shallow waters of coastal areas, the A dangerous and deadly foe, a khornak first ensnares and khornak are brutal hunters who thrive in packs—but tears into their prey with their Crushing Jaw, strengthened even one is frightening on their own. They are most by their Terrifying Ambush. While the khornak restrains dangerous in close range, where they unveil their this enemy in their jaws, they repel other opponents with primary weapon: a massive jaw lined with many rows their Tail Sweep, and they Drag their prey away to feast. of jagged teeth made for gouging prey, latching into If their meal manages to escape, the khornak hunts foes skin, and dragging victims into the water. Khornaks down with Ruthless Predator. have webbed limbs protected by carapace, along with eight beady eyes and jagged tails. The khornaks' bond with spren allows their hefty frames to glide effortlessly through the water in search of prey. Khornak Tier 1 Rival – Medium Animal actions Physical Cognitive Spiritual Strike: Crushing Jaw . Attack +5, reach 5 ft., one target. str def spd int def wil awa def pre 3 15 2 0 12 2 2 12 0 Graze: 4 (1d8) impact damage. Hit: 9 (1d8 + 5) impact damage, and the target becomes Restrained by the Health: 26 (20–32) Focus: 4 Investiture: 0 khornak's jaw while the khornak remains within 5 feet of Deflect: 2 (carapace) them. The khornak can spend 1 focus to also make the target Movement: 25 ft., swim 30 ft. Afflicted [1d4 vital] until the target regains at least 1 health. Senses: 10 ft. (sight) As , the target or a character who can reach them can Physical Skills: Athletics +5, Stealth +4 make a DC 16 Agility or Athletics test, ending the Restrained Spiritual Skills: Perception +3, Survival +4 condition on a success. Languages: none While the khornak is restraining this target, the khornak features can't make another Crushing Jaw attack. Terrifying Ambush . At the start of each scene, each enemy Tail Sweep . Attack +5, reach 5 ft., one target. The khornak who can sense the khornak must make a DC 14 Discipline test can spend up to 2 focus to target that many additional (no action required). On a failure, that enemy can't take a fast targets with the same attack. Graze: 3 (1d6) impact damage. turn this round unless they spend 2 focus. Hit: 8 (1d6 + 5) impact damage, and the target must succeed Ruthless Predator . When the khornak attacks and hits an on a DC 15 Athletics test or be knocked Prone. enemy who hasn't taken a turn yet this round, the attack Drag . The khornak moves up to 15 feet in any direction OM BABBEYdeals an extra 1d8 damage. while dragging an enemy they have Restrained behind them. T",
    "notes": null,
    "presetActions": [
      {
        "name": "Physical Cognitive Spiritual Strike: Crushing Jaw",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d8 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. str def spd int def wil awa def pre 3 15 2 0 12 2 2 12 0 Graze: 4 (1d8) impact damage. Hit: 9 (1d8 + 5) impact damage, and the target becomes Restrained by the Health: 26 (20–32) Focus: 4 Investiture: 0 khornak's jaw while the khornak remains within 5 feet of Deflect: 2 (carapace) them. The khornak can spend 1 focus to also make the target Movement: 25 ft., swim 30 ft. Afflicted [1d4 vital] until the target regains at least 1 health. Senses: 10 ft. (sight) As , the target or a character who can reach them can Physical Skills: Athletics +5, Stealth +4 make a DC 16 Agility or Athletics test, ending the Restrained Spiritual Skills: Perception +3, Survival +4 condition on a success. Languages: none While the khornak is restraining this target, the khornak features can't make another Crushing Jaw attack"
      },
      {
        "name": "Terrifying Ambush",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Terrifying Ambush"
      },
      {
        "name": "At the start of each scene, each enemy Tail Sweep",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. The khornak who can sense the khornak must make a DC 14 Discipline test can spend up to 2 focus to target that many additional (no action required). On a failure, that enemy can't take a fast targets with the same attack. Graze: 3 (1d6) impact damage. turn this round unless they spend 2 focus"
      },
      {
        "name": "Hit: 8 (1d6 + 5) impact damage, and the target must succeed Ruthless Predator",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "When the khornak attacks and hits an on a DC 15 Athletics test or be knocked Prone. enemy who hasn't taken a turn yet this round, the attack"
      },
      {
        "name": "Drag",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "up to 15 feet",
        "description": "The khornak moves up to 15 feet in any direction OM BABBEYdeals an extra 1d8 damage. while dragging an enemy they have Restrained behind them. T"
      }
    ],
    "sourceAdversaryName": "Khornak"
  },
  {
    "name": "Lilinum",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 4,
      "intellect": 6,
      "willpower": 3,
      "awareness": 4,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 16,
      "cognitive-defense": 19,
      "spiritual-defense": 15
    },
    "resources": {
      "health": 41,
      "focus": 5,
      "investiture": 6
    },
    "deflect": 2,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 7,
      "athletics": 5,
      "light-weaponry": 7,
      "discipline": 7,
      "intimidation": 7,
      "perception": 6,
      "survival": 6
    },
    "features": [
      "Regenerate (Costs 1 Investiture)",
      "Lilinum recovers 5 Instinctive Aggression . It costs Lilinum no focus to use the (1d6+2) health. She can use this free action even while Reactive Strike reaction. Unconscious or otherwise prevented from using actions",
      "Shroud of Dust",
      "When an enemy makes a ranged attack or Demolish Weapon . After Lilinum is hit or grazed by a other test against Lilinum from at least 25 feet away, if that non-Invested weapon, she can turn that weapon to dust. test relies on sight or smell, it gains a disadvantage"
    ],
    "tactics": "Devastating One Lilinum fights with a playful recklessness, engaging foes Lilinum is a Shardblade-wielding Devastating One and for maximum destruction and chaos with little heed for one of the two Fused enforcers sent to subjugate Rall her safety or that of her allies. She favors her Shardblade Elorim. Her carapace is chaotically striped in white in combat, then follows it with her Devastating Touch or and red, and her fighting style reflects her preference Claws. If a group of characters is within a structure, she for chaos. As a Devastating One, Lilinum is skilled uses her Surge of Division to collapse it on them. in the surge of Division. She delights in effortlessly turning objects and structures to rubble, her own form constantly trailing a cloud of wispy dust. Lilinum and her Shardblade in Dirgehollow.",
    "notes": "Surge Skills: Division +9 (3 ranks) destruction. On a success, a character takes no damage and",
    "presetActions": [
      {
        "name": "The following options are available when an enemy gains Strike: Claws",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 7,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "Attack +7, reach 5 ft., one target. Graze: 2 an Opportunity or Complication during a scene with Lilinum: (1d4) keen damage and 3 (1d6) spirit damage"
      },
      {
        "name": "Hit: 9 (1d4 + 7) Opportunity",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "An enemy can spend to disable Lilinum's keen damage and 3 (1d6) spirit damage"
      },
      {
        "name": "Shroud of Dust feature and prevent her from using her Strike: Shardblade",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 7,
        "defaultDamageFormula": "2d8 + 7",
        "rangeText": "reach 5 ft.",
        "description": "Attack +7, reach 5 ft., one target. Surge of Division and Regenerate actions until the end Graze: 8 (2d8) spirit damage. Hit: 15 (2d8 + 7) spirit damage. of Lilinum's next turn"
      },
      {
        "name": "Complication",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Complication"
      },
      {
        "name": "The GM can spend from an enemy's test Devastating Touch",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 9,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "Attack +9, reach 5 ft., one to have Lilinum use either her Claws or Shardblade action target. Graze: 10 (3d6) spirit damage"
      },
      {
        "name": "Hit: 19 (3d6 + 9) as",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "When she does, she gains an advantage on that spirit damage. attack test. Lilinum, the"
      }
    ],
    "sourceAdversaryName": "Lilinum"
  },
  {
    "name": "Nimbleform Singer",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 1,
      "speed": 3,
      "intellect": 3,
      "willpower": 2,
      "awareness": 3,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 15,
      "spiritual-defense": 15
    },
    "resources": {
      "health": 20,
      "focus": 4,
      "investiture": 0
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 5,
      "light-weaponry": 5,
      "stealth": 4,
      "crafting": 4,
      "deduction": 5,
      "lore": 4,
      "perception": 5,
      "survival": 5
    },
    "features": [
      "Deadly Speed . At the start of each scene, if the nimbleform singer isn't Surprised, they can take a fast turn before any other characters (this doesn't count as their turn this round)",
      "Keen Senses . The nimbleform singer can spend 1 focus to gain an advantage on a Perception test (no action required)"
    ],
    "tactics": "While nimbleform singers rarely fight, they're experts at tracking creatures and surveying an area, and they can easily exploit an enemy's weakness using their Chosen Target action. TINA S O ANA K VETL S",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Mace",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d6 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. Graze: 3 (1d6) impact damage. Hit: 8 (1d6 + 5) impact damage"
      },
      {
        "name": "Strike: Shortbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d6 + 5",
        "rangeText": "range 80/320 ft.",
        "description": "Attack +5, range 80/320 ft., one target. Graze: 3 (1d6) keen damage. Hit: 8 (1d6 + 5) keen damage"
      },
      {
        "name": "Chosen Target (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 120 feet",
        "description": "The nimbleform singer chooses an enemy they can sense within 120 feet of them. For 1 hour, when the nimbleform hits their chosen enemy with a weapon attack, they deal an extra 3 (1d6) damage. In addition, the nimbleform singer gains an advantage on Survival tests to track that enemy"
      }
    ],
    "sourceAdversaryName": "Nimbleform Singer"
  },
  {
    "name": "Shadowform Zealot",
    "role": "Tier unknown",
    "attributes": {
      "strength": 0,
      "speed": 0,
      "intellect": 0,
      "willpower": 0,
      "awareness": 0,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 10,
      "cognitive-defense": 10,
      "spiritual-defense": 10
    },
    "resources": {
      "health": 0,
      "focus": 0,
      "investiture": 0
    },
    "deflect": null,
    "movement": null,
    "senses": null,
    "skills": {},
    "features": [],
    "tactics": "A shadowform zealot is a slippery foe who takes advantage of tactical positioning. They move opponents into areas of shadow using Drag Through Shadows, then gather around to strike using their Shadow Claws. They wear down significant threats with Grieving Dirge, and if A SERIOthey need to position themselves or escape, shadowform ELIS zealots rely on Unbodied and Drag Through Shadows.",
    "notes": null,
    "presetActions": [],
    "sourceAdversaryName": "Shadowform Zealot"
  },
  {
    "name": "Shellmite",
    "role": "Tier 1 Minion – Small Animal",
    "attributes": {
      "strength": 2,
      "speed": 1,
      "intellect": 0,
      "willpower": 1,
      "awareness": 2,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 13,
      "cognitive-defense": 11,
      "spiritual-defense": 12
    },
    "resources": {
      "health": 9,
      "focus": 3,
      "investiture": 0
    },
    "deflect": null,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "stealth": 3,
      "perception": 4
    },
    "features": [
      "Shellmite Tactics Minion . The shellmite's attacks can't critically hit, and they're immediately defeated when they suffer an injury",
      "A shellmite uses their Rugged Camouflage to hide among Rugged Camouflage . An undetected shellmite gains an common rocks. When unlucky travelers walk into a nest of advantage on attack tests. While the shellmite is motionless, shellmites, these crustaceans strike quickly with a Pincer, they're almost indistinguishable from a normal rock, gaining an advantage on their first attack. Shellmites then requiring a successful DC 14 Survival test to identify them. use their Feeding Frenzy to overwhelm intruders, tearing and ripping at clothing and armor with their strong claws, This test gains a disadvantage when the shellmite is in cover while sticking together to take advantage of their numbers. or in an area where the other character's primary sense Shellmites are reliant on surprise, so try placing multiple is obscured. hidden shellmites throughout an area to keep PCs on"
    ],
    "tactics": "Minion . The shellmite's attacks can't critically hit, and they're immediately defeated when they suffer an injury. A shellmite uses their Rugged Camouflage to hide among Rugged Camouflage . An undetected shellmite gains an common rocks. When unlucky travelers walk into a nest of advantage on attack tests. While the shellmite is motionless, shellmites, these crustaceans strike quickly with a Pincer, they're almost indistinguishable from a normal rock, gaining an advantage on their first attack. Shellmites then requiring a successful DC 14 Survival test to identify them. use their Feeding Frenzy to overwhelm intruders, tearing and ripping at clothing and armor with their strong claws, This test gains a disadvantage when the shellmite is in cover while sticking together to take advantage of their numbers. or in an area where the other character's primary sense Shellmites are reliant on surprise, so try placing multiple is obscured. hidden shellmites throughout an area to keep PCs on actions their toes. Strike: Pincer . Attack +2, reach 5 ft., one target. Graze: 2 (1d4) keen damage. Hit: 4 (1d4 + 2) keen damage. Feeding Frenzy (Costs 2 Focus) . The shellmite whips up a frenzy against an enemy within 5 feet of them. Each shellmite within 5 feet of the target can use to join the frenzy. The target takes 2 (1d4) keen damage per frenzied shellmite. T",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Pincer",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 2,
        "defaultDamageFormula": "1d4 + 2",
        "rangeText": "reach 5 ft.",
        "description": "Attack +2, reach 5 ft., one target. Graze: 2 (1d4) keen damage. Hit: 4 (1d4 + 2) keen damage"
      },
      {
        "name": "Feeding Frenzy (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "The shellmite whips up a frenzy against an enemy within 5 feet of them. Each shellmite within 5 feet of the target can use to join the frenzy. The target takes 2 (1d4) keen damage per frenzied shellmite. T"
      }
    ],
    "sourceAdversaryName": "Shellmite"
  },
  {
    "name": "Skybreaker of the Second Ideal",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 3,
      "intellect": 2,
      "willpower": 3,
      "awareness": 4,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 15,
      "cognitive-defense": 15,
      "spiritual-defense": 15
    },
    "resources": {
      "health": 40,
      "focus": 5,
      "investiture": 6
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 6,
      "heavy-weaponry": 5,
      "deduction": 5,
      "discipline": 6,
      "intimidation": 6,
      "lore": 4,
      "insight": 7,
      "perception": 6
    },
    "features": [
      "When the Skybreaker does so, they can spend additional Truthseeker . The Skybreaker gains an advantage on Investiture to extend this effect for a number of rounds equal Deduction and Insight tests made to ascertain truth. to the Investiture spent"
    ],
    "tactics": "",
    "notes": "Surge Skills: Gravitation +6 (2 ranks) Alternatively, they can infuse an ally with a flying",
    "presetActions": [
      {
        "name": "Regenerate (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Regenerate (Costs 1 Investiture)"
      },
      {
        "name": "The Skybreaker Strike: Sidesword",
        "kind": "free",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "1d6 + 6",
        "rangeText": "reach 5 ft.",
        "description": "Attack +6, reach 5 ft., one target. recovers 5 (1d6 + 2) health. They can use this free action Graze: 3 (1d6) keen damage. Hit: 9 (1d6 + 6) keen damage. even while Unconscious or otherwise prevented from using actions"
      },
      {
        "name": "Lashing Shot (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Lashing Shot (Costs 1 Investiture)"
      },
      {
        "name": "Attack +6, range Menace",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": "2d8 + 6",
        "rangeText": null,
        "description": "After the Skybreaker is hit with an attack, they 30 ft., one target. The Skybreaker touches a Medium or make an Intimidation test against the attacker's Cognitive smaller unattended object and launches it at the target. defense. On a success, the attacker loses 1 focus. Graze: 9 (2d8) impact or keen damage. Hit: 15 (2d8 + 6) impact or keen damage. Skybreaker of gravitational attraction; they can use this to fly and run the Second Ideal up walls, or even to send other people and objects flying. Using the surge of Division, Skybreakers can touch Widely seen as fanatics, members of the Skybreaker an object and cause it (or part of it) to burn, turn to order of the Knights Radiant believe in a strict dust, or decay, such as by burning a pattern on a moral code, and they uphold the law above nearly piece of wood. all other things. The Skybreakers were the only Radiant order not to abandon their oaths during the Skybreaker Tactics Recreance, instead operating in secret for millennia A Skybreaker of the Second Ideal is an aerial combatant under the guidance of Nale, the Herald of Justice. who wields Gravitation to devastating effect. They begin In the aftermath of the Everstorm, Nale and most combat with Gravitational Support to gain a tactical other Skybreakers have chosen to follow the singers, advantage, then use Offensive Gravitation and Lashing believing that the singers have the right to Roshar as Shot against foes both near and far, and they freely the original owners of the land. Menace combatants. Surgebinding Skybreakers dedicate themselves to pursuing justice. Skybreakers use the surges of Gravitation and Division, As such, they're likely to prioritize foes who they deem which they receive from bonding with highspren. criminals, initially ignoring others who they don't feel the Through the surge of Gravitation, Skybreakers need to apprehend and punish. can change the direction and strength of an object's"
      }
    ],
    "sourceAdversaryName": "Skybreaker of the Second Ideal"
  },
  {
    "name": "Skyeel",
    "role": "Tier 1 Minion – Medium Animal",
    "attributes": {
      "strength": 2,
      "speed": 3,
      "intellect": 0,
      "willpower": 1,
      "awareness": 3,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 15,
      "cognitive-defense": 11,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 12,
      "focus": 3,
      "investiture": 0
    },
    "deflect": null,
    "movement": "10 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 4,
      "stealth": 4,
      "perception": 5,
      "survival": 4
    },
    "features": [
      "After diving, skyeels must spend time digesting their prey and refilling their sacks before they can take to Enhanced Senses . The skyeel gains an advantage on non- the air again. attack tests that rely on sight",
      "Skyeels are often accompanied by white arrowhead- Minion . The skyeel's attacks can't critically hit, and they're shaped luckspren who swim in schools around them. immediately defeated when they suffer an injury",
      "Slippery . The skyeel doesn't trigger Reactive Strikes"
    ],
    "tactics": "while swimming. A skyeel remains in flight and hidden until they choose a actions target, then the skyeel uses their Dive Bomb to bite and Bite . Attack +4, reach 5 ft., one target. Graze: 2 (1d4) restrain their prey. In the rare instance where a greater keen damage. Hit: 6 (1d4 + 4) keen damage, and if the skyeel attacks a larger target, they use Dive Bomb then target is Medium or smaller, the skyeel can spend 1 focus Constrict their Restrained prey, hoping for an easy meal. to wrap their body around the target. If they do, the target becomes Restrained, the skyeel attaches to the target, and the skyeel can't use their Bite against a different target until Skyeels soar above they release the current one. As , the Restrained target or a character within 5 feet of them can make a DC 12 Athletics the seas of Roshar. test, forcing the skyeel to release the target on a success. Dive Bomb . The skyeel flies up to 60 feet toward a target they can sense on the ground, then uses their Bite against the target. This attack gains an advantage. After the skyeel uses this action, they can't fly again until the end of the scene. ÖNEN & S",
    "notes": null,
    "presetActions": [
      {
        "name": "Dive Bomb to bite and Bite",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d4 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Graze: 2 (1d4) restrain their prey. In the rare instance where a greater keen damage. Hit: 6 (1d4 + 4) keen damage, and if the skyeel attacks a larger target, they use Dive Bomb then target is Medium or smaller, the skyeel can spend 1 focus Constrict their Restrained prey, hoping for an easy meal. to wrap their body around the target. If they do, the target becomes Restrained, the skyeel attaches to the target, and the skyeel can't use their Bite against a different target until Skyeels soar above they release the current one. As , the Restrained target or a character within 5 feet of them can make a DC 12 Athletics the seas of Roshar. test, forcing the skyeel to release the target on a success"
      },
      {
        "name": "Dive Bomb",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "up to 60 feet",
        "description": "The skyeel flies up to 60 feet toward a target they can sense on the ground, then uses their Bite against the target. This attack gains an advantage. After the skyeel uses this action, they can't fly again until the end of the scene. ÖNEN & S"
      }
    ],
    "sourceAdversaryName": "Skyeel"
  },
  {
    "name": "Greater Skyeel",
    "role": "Tier 1 Rival – Medium Animal",
    "attributes": {
      "strength": 3,
      "speed": 3,
      "intellect": 0,
      "willpower": 1,
      "awareness": 3,
      "presence": 0
    },
    "defenses": {
      "physical-defense": 16,
      "cognitive-defense": 11,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 24,
      "focus": 3,
      "investiture": 0
    },
    "deflect": null,
    "movement": "10 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 5,
      "athletics": 3,
      "stealth": 4,
      "perception": 5,
      "survival": 4
    },
    "features": [
      "This Enhanced Senses . The greater skyeel gains an advantage on attack gains an advantage. After the skyeel uses this action, non-attack tests that rely on sight. they can't fly again until the end of the scene",
      "Slippery",
      "The greater skyeel doesn't trigger Reactive Strikes Constrict . The greater skyeel squeezes an enemy they while swimming. have Restrained, dealing 15 (3d6 + 5) impact damage. Under normal circumstances, skyeels never attack humans. Z S FL"
    ],
    "tactics": "",
    "notes": null,
    "presetActions": [
      {
        "name": "Medium Animal Bite",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d8 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., one target. Graze: 3 (1d6) Physical Cognitive Spiritual keen damage. Hit: 9 (1d8 + 5) keen damage, and if the target str def spd int def wil awa def pre is Medium or smaller, the greater skyeel can spend 1 focus 3 16 3 0 11 1 3 13 0 to wrap their body around the target. If they do, the target Health: 24 (19–29) Focus: 3 Investiture: 0 becomes Restrained, the skyeel attaches to the target, and the skyeel can't use their Bite against a different target until Movement: 10 ft., fly 30 ft., swim 40 ft. they release the current one. As , the Restrained target or Senses: 20 ft. (sight) a character within 5 feet of them can make a DC 14 Athletics Physical Skills: Agility +5, Athletics +3, Stealth +4 test, forcing the skyeel to release the target on a success"
      },
      {
        "name": "Spiritual Skills: Perception +5, Survival +4 Dive Bomb",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "up to 60 feet",
        "description": "The greater skyeel flies up to 60 feet toward Languages: none a target they can sense on the ground, without triggering features Reactive Strikes, then uses their Bite against the target"
      },
      {
        "name": "This Enhanced Senses",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The greater skyeel gains an advantage on attack gains an advantage. After the skyeel uses this action, non-attack tests that rely on sight. they can't fly again until the end of the scene"
      },
      {
        "name": "Slippery",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Slippery"
      },
      {
        "name": "The greater skyeel doesn't trigger Reactive Strikes Constrict",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The greater skyeel squeezes an enemy they while swimming. have Restrained, dealing 15 (3d6 + 5) impact damage. Under normal circumstances, skyeels never attack humans. Z S FL"
      }
    ],
    "sourceAdversaryName": "Greater Skyeel"
  },
  {
    "name": "Spear Infantry",
    "role": "Tier 1 Minion – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 2,
      "intellect": 1,
      "willpower": 1,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 12,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 14,
      "focus": 3,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "25 ft.",
    "senses": "10 ft. (sight)",
    "skills": {
      "athletics": 4,
      "heavy-weaponry": 4,
      "light-weaponry": 3,
      "discipline": 2,
      "intimidation": 3,
      "perception": 4
    },
    "features": [
      "Minion. The spear infantry's attacks can't critically hit, and they are immediately defeated when they suffer an injury.",
      "Martial Drill. At the start of each scene, if the spear infantry has its shield and is not Surprised, it gains the benefits of Brace until the start of its first turn.",
      "Military Tactics. Once per round, the spear infantry can spend 1 additional focus to use the Aid or Reactive Strike reaction without using its reaction."
    ],
    "tactics": "A spear infantry soldier topples enemies with Shield Bash and then follows with Shortspear. Their Military Tactics helps pin down fleeing foes or bolster nearby soldiers depending on the flow of battle.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Shortspear",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d8 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 8 (1d8 + 4) keen damage."
      },
      {
        "name": "Shield Bash",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "The spear infantry makes an Athletics test against a target within 5 feet, opposed by the target's choice of Athletics or Agility. On a success, the target is knocked Prone."
      },
      {
        "name": "Military Tactics",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Once per round, the spear infantry can spend 1 additional focus to use Aid or Reactive Strike without consuming its reaction."
      }
    ],
    "sourceAdversaryName": "Spear Infantry"
  },
  {
    "name": "Spearmaster",
    "role": "Tier 1 Minion – Medium Humanoid",
    "attributes": {
      "strength": 3,
      "speed": 2,
      "intellect": 1,
      "willpower": 3,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 15,
      "cognitive-defense": 14,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 14,
      "focus": 3,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 5,
      "athletics": 4,
      "heavy-weaponry": 4,
      "light-weaponry": 4,
      "discipline": 2,
      "intimidation": 3,
      "perception": 4,
      "survival": 3
    },
    "features": [
      "Minion",
      "The spear infantry's attacks can't critically hit, and Defensive Flourish . The spearmaster can wield their they're immediately defeated when they suffer an injury. longspear defensively, allowing them to use the",
      "Brace action Martial Drill . At the start of each scene, if the spear infantry as if they had a shield. has their shield and isn't",
      "Surprised, they gain the benefits of Merciless . The spearmaster gains an additional advantage the Brace action until the start of their first run. on attacks against Prone targets",
      "Military Tactics . Once per round, the spear infantry can"
    ],
    "tactics": "Spear Infantry Tactics A spearmaster is a skilled and careful combatant, taking slow turns so they can make multiple attacks. They spend A spear infantry topples enemies with their Shield Bash focus to knock targets Prone with their Longspear, then and then strikes with their Shortspear. Their Military prioritize attacking Prone targets to take advantage of Tactics can be used to pin down fleeing targets or bolster Merciless. If an enemy gets too close, the spearmaster their fellow soldiers, depending on how the battle is going. tries to Kick them away and line up a Run Through attack. When they have an extra action, they spend it on Gain Advantage or Brace, depending on whether they find themself on the offensive or the defensive. ARI A S O ANT",
    "notes": null,
    "presetActions": [
      {
        "name": "Aid or Reactive Strike Strike: Longspear",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": null,
        "rangeText": "reach 10 ft.",
        "description": "Attack +6, reach 10 ft., one target. reaction without using their ↻ . Graze: 4 (1d8) keen damage"
      },
      {
        "name": "Hit: 10 (1d8 + 6) keen damage, actions and the spearmaster can spend 1 focus to knock the Strike: Shortspear",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": null,
        "rangeText": "reach 5 ft.",
        "description": "Attack +3, reach 5 ft., one target. target Prone. Graze: 4 (1d8) keen damage"
      },
      {
        "name": "Hit: 7 (1d8 + 3) keen damage, Kick",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d4 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Graze: 2 (1d4) and if the target is Prone, they take an extra 4 (1d8) impact damage. Hit: 6 (1d4 + 4) impact damage, and if the keen damage. target is Medium or smaller, the spearmaster can spend 1 focus to push them 5 feet"
      },
      {
        "name": "Strike: Shortbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": 3,
        "defaultDamageFormula": null,
        "rangeText": "range 80/320 ft.",
        "description": "Attack +3, range 80/320 ft., one target"
      },
      {
        "name": "Run Through (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "1d6 + 3",
        "rangeText": "reach 10 ft.",
        "description": "Attack +6, reach 10 ft., Graze: 3 (1d6) keen damage. Hit: 6 (1d6 + 3) keen damage. up to two targets within 5 ft. of each other"
      },
      {
        "name": "Graze: 4 (1d8) Shield Bash",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": "1d8 + 6",
        "rangeText": null,
        "description": "The spear infantry makes an Athletics test keen damage. Hit: 10 (1d8 + 6) keen damage. against the target's Physical defense, knocking them Prone on a success"
      }
    ],
    "sourceAdversaryName": "Spearmaster"
  },
  {
    "name": "Stormform Regal",
    "role": "Tier 2 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 4,
      "intellect": 2,
      "willpower": 4,
      "awareness": 1,
      "presence": 3
    },
    "defenses": {
      "physical-defense": 16,
      "cognitive-defense": 16,
      "spiritual-defense": 14
    },
    "resources": {
      "health": 40,
      "focus": 6,
      "investiture": 5
    },
    "deflect": 1,
    "movement": "30 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 7,
      "athletics": 5,
      "light-weaponry": 6,
      "discipline": 6,
      "intimidation": 7,
      "perception": 4
    },
    "features": [
      "Water Weakness . While the stormform is drenched in water, they can't use their Bolt of Lightning or Electrical Charge",
      "Barbed Carapace . While the stormform is Restrained by the Grapple action or a similar effect, the character restraining the stormform is Afflicted [1d8 keen]"
    ],
    "tactics": "A stormform Regal is a cunning foe, one specialized in closing distances and defending themself. The Regal uses Storm Leap to jump to a weak-looking foe, hoping to goad them into taking damage from Electrical Charge. Meanwhile, the Regal alternates between using their Shortspear and Bolt of Lightning to strike injured enemies. SOL",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Shortspear",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 6,
        "defaultDamageFormula": "1d8 + 6",
        "rangeText": "reach 5 ft.",
        "description": "Attack +6, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 10 (1d8 + 6) keen damage"
      },
      {
        "name": "Bolt of Lightning (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 7,
        "defaultDamageFormula": "2d8 + 7",
        "rangeText": "range 60 ft.",
        "description": "Attack +7, range 60 ft., one target. This attack gains a disadvantage unless the Regal spends 1 focus to ignore it. Graze: 8 (2d8) energy damage. Hit: 15 (2d8 + 7) energy damage"
      },
      {
        "name": "Storm Leap (Costs 1 Investiture)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "up to 60 feet",
        "description": "The Regal jumps up to 60 feet. If they land within 5 feet of an enemy, the Regal can Stormform Regal use the Gain Advantage action as ▷"
      },
      {
        "name": "A singer can attain stormform, a Regal form of power, Electrical Charge",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "After the Regal uses the Move action, by bonding with a stormspren. Stormform Regals have they become electrically charged until the start of their next subtle armor and barbed carapace. The air around turn. While charged, they're immune to energy damage, stormform singers is frequently electrified by flashes of and whenever the charged Regal is hit by an attack by an red lightning. enemy within 5 feet of them, the attacker takes 4 (1d8) Stormform is notably weak to water. Contact with a energy damage. small amount only diminishes their control over their lightning powers, but if a stormform singer is drenched, they can't summon lightning until they dry off"
      }
    ],
    "sourceAdversaryName": "Stormform Regal"
  },
  {
    "name": "Taszo",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 0,
      "speed": 3,
      "intellect": 1,
      "willpower": 2,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 13,
      "cognitive-defense": 13,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 17,
      "focus": 4,
      "investiture": 0
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 3,
      "light-weaponry": 3,
      "deduction": 2,
      "discipline": 4,
      "lore": 2,
      "insight": 4,
      "perception": 4,
      "persuasion": 3
    },
    "features": [
      "Resolved . After Taszo spends focus to resist a character's influence, that character loses 1 focus",
      "Broken Arm . Taszo can only use one hand"
    ],
    "tactics": "",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Sidesword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": "1d6 + 3",
        "rangeText": "reach 5 ft.",
        "description": "Attack +3, reach 5 ft., one target. Graze: 3 (1d6) keen damage. Hit: 8 (1d6 + 3) keen damage"
      },
      {
        "name": "A Friend in Need (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "When an ally within 5 feet of Taszo fails a test, Taszo adds an Opportunity to the test result. O T O S ARK D"
      }
    ],
    "sourceAdversaryName": "Taszo"
  },
  {
    "name": "Thief",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 1,
      "speed": 3,
      "intellect": 2,
      "willpower": 1,
      "awareness": 2,
      "presence": 1
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 13,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 20,
      "focus": 3,
      "investiture": 0
    },
    "deflect": 1,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "agility": 5,
      "light-weaponry": 5,
      "stealth": 5,
      "thievery": 5,
      "deception": 3,
      "perception": 4,
      "persuasion": 3
    },
    "features": [
      "Thievery test against the target's ) Quick Hands . When a character triggers a Reactive Perception. If the target is Disoriented, the target gains a Strike reaction from the thief, the thief can instead use disadvantage on their test. If the thief succeeds, they can ARI ( choose to steal up to 50 marks or one item the target isn't A their Pickpocket as (without spending focus for a S wielding or wearing. O Reactive Strike)",
      "Vanishing Act",
      "At the end of the thief's turn, if they're in cover Slippery",
      "After an enemy ends a Move action within or in an area where their enemy's primary sense is obscured, 5 feet of the thief, the thief can use the Disengage action as . If the thief ends this movement in cover or in ); ANT the thief can make a Stealth test (no action required) with T advantage against the Spiritual defense of each enemy who an area where an enemy's primary sense is obscured, LEF can sense them. Each enemy they succeed against loses enemies affected by that cover or obscured senses gain MPE ( track of them and can no longer sense them until the thief a disadvantage on attacks against the thief until the end U attacks or takes another action that would expose them. of the thief's next turn."
    ],
    "tactics": "A thief begins by using Disorienting Distraction and—if trying to avoid a fight—they immediately follow it with Pickpocket to steal away their prize. In a fight, their Disorienting Distraction is equally useful for making their Dagger strike more lethal. Should they get pinned down, they use Slippery to flee the scene. Thief actions Tier 1 Rival – Medium Humanoid Strike: Dagger . Attack +5, reach 5 ft. or range 20/60 ft., Physical Cognitive Spiritual one target. Graze: 2 (1d4) keen damage. Hit: 7 (1d4 + 5) str def spd int def wil awa def pre keen damage. 1 14 3 2 13 1 2 13 1 On a hit or graze, if the target is Disoriented, they take Health: 20 (16–24) Focus: 3 Investiture: 0 an extra 2 (1d4) keen damage. Deflect: 1 (leather) Disorienting Distraction (Costs 1 Focus) . The thief throws Movement: 30 ft. sand, flour, or a similar substance to distract and confuse Senses: 20 ft. (sight) foes. Each enemy within 10 feet of them must succeed on a Physical Skills: Agility +5, Light Weaponry +5, Stealth +5, DC 13 Agility test or become Disoriented until the end of the Thievery +5 thief's next turn. Spiritual Skills: Deception +3, Perception +4, Persuasion +3 Pickpocket (Costs 2 Focus) . The thief attempts to Languages: defined by culture rifle through the belongings of a humanoid within 5 feet of features them, making an opposed Thievery test against the target's ) Quick Hands . When a character triggers a Reactive Perception. If the target is Disoriented, the target gains a Strike reaction from the thief, the thief can instead use disadvantage on their test. If the thief succeeds, they can ARI ( choose to steal up to 50 marks or one item the target isn't A their Pickpocket as (without spending focus for a S wielding or wearing. O Reactive Strike). Vanishing Act . At the end of the thief's turn, if they're in cover Slippery . After an enemy ends a Move action within or in an area where their enemy's primary sense is obscured, 5 feet of the thief, the thief can use the Disengage action as . If the thief ends this movement in cover or in ); ANT the thief can make a Stealth test (no action required) with T advantage against the Spiritual defense of each enemy who an area where an enemy's primary sense is obscured, LEF can sense them. Each enemy they succeed against loses enemies affected by that cover or obscured senses gain MPE ( track of them and can no longer sense them until the thief a disadvantage on attacks against the thief until the end U attacks or takes another action that would expose them. of the thief's next turn.",
    "notes": null,
    "presetActions": [
      {
        "name": "Medium Humanoid Strike: Dagger",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "1d4 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft. or range 20/60 ft., Physical Cognitive Spiritual one target. Graze: 2 (1d4) keen damage. Hit: 7 (1d4 + 5) str def spd int def wil awa def pre keen damage. 1 14 3 2 13 1 2 13 1 On a hit or graze, if the target is Disoriented, they take Health: 20 (16–24) Focus: 3 Investiture: 0 an extra 2 (1d4) keen damage"
      },
      {
        "name": "Deflect: 1 (leather) Disorienting Distraction (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 10 feet",
        "description": "The thief throws Movement: 30 ft. sand, flour, or a similar substance to distract and confuse Senses: 20 ft. (sight) foes. Each enemy within 10 feet of them must succeed on a Physical Skills: Agility +5, Light Weaponry +5, Stealth +5, DC 13 Agility test or become Disoriented until the end of the Thievery +5 thief's next turn"
      },
      {
        "name": "Spiritual Skills: Deception +3, Perception +4, Persuasion +3 Pickpocket (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Spiritual Skills: Deception +3, Perception +4, Persuasion +3 Pickpocket (Costs 2 Focus)"
      },
      {
        "name": "The thief attempts to Languages: defined by culture rifle through the belongings of a humanoid within 5 feet of features them, making an opposed Thievery test against the target's ) Quick Hands",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "When a character triggers a Reactive Perception. If the target is Disoriented, the target gains a Strike reaction from the thief, the thief can instead use disadvantage on their test. If the thief succeeds, they can ARI ( choose to steal up to 50 marks or one item the target isn't A their Pickpocket as (without spending focus for a S wielding or wearing. O Reactive Strike)"
      },
      {
        "name": "Vanishing Act",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Vanishing Act"
      },
      {
        "name": "At the end of the thief's turn, if they're in cover Slippery",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "At the end of the thief's turn, if they're in cover Slippery"
      },
      {
        "name": "After an enemy ends a Move action within or in an area where their enemy's primary sense is obscured, 5 feet of the thief, the thief can use the Disengage action as",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "If the thief ends this movement in cover or in ); ANT the thief can make a Stealth test (no action required) with T advantage against the Spiritual defense of each enemy who an area where an enemy's primary sense is obscured, LEF can sense them. Each enemy they succeed against loses enemies affected by that cover or obscured senses gain MPE ( track of them and can no longer sense them until the thief a disadvantage on attacks against the thief until the end U attacks or takes another action that would expose them. of the thief's next turn."
      }
    ],
    "sourceAdversaryName": "Thief"
  },
  {
    "name": "Thrill Berserker",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 2,
      "intellect": 1,
      "willpower": 3,
      "awareness": 2,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 14,
      "spiritual-defense": 14
    },
    "resources": {
      "health": 22,
      "focus": 5,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "athletics": 4,
      "heavy-weaponry": 4,
      "intimidation": 5,
      "leadership": 3,
      "perception": 4
    },
    "features": [
      "Infectious Thrill . When an enemy rolls a on an attack test against the berserker, the enemy gains a +3 bonus to that d20 roll. Regardless of whether the attack hits or misses, if any other characters are within 5 feet of the berserker, the enemy must choose one. The enemy's attack also grazes the chosen character (without spending focus)"
    ],
    "tactics": "Deflect: 2 (breastplate) A Thrill berserker rushes into battle, undeterred by Movement: 25 ft. formidable enemies and careful fortifications. They Senses: 10 ft. (sight) fight with alarming ferocity, using Berserker Rage Physical Skills: Athletics +4, Heavy Weaponry +4, Light and Shield Bash to cleave their path, regardless Weaponry +3 of whether friend or foe stands in the way. Cognitive Skills: Intimidation +5 Spiritual Skills: Leadership +3, Perception +4 Languages: defined by culture features Infectious Thrill . When an enemy rolls a on an attack test against the berserker, the enemy gains a +3 bonus to that d20 roll. Regardless of whether the attack hits or misses, if any other characters are within 5 feet of the berserker, the enemy must choose one. The enemy's attack also grazes the chosen character (without spending focus). actions Strike: Longsword . Attack +4, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 8 (1d8 + 4) keen damage, and if the target is Prone, they take an extra 4 (1d8) damage. Strike: Dagger . Attack +3, range 20/60 ft., one target. Graze: 2 (1d4) keen damage. Hit: 5 (1d4 + 3) keen damage. Shield Bash (Costs 1 Focus) . The berserker makes an Athletics test against the Physical defense of a Large or smaller character within 5 feet of them, knocking them Prone on a success. Berserker Rage (Costs 2 Focus) . The Thrill surges within the berserker. Their next Strike targets each character within 5 feet of them and deals an extra 3 (1d6) damage on a hit. Lash Out (Costs 1 Focus) . After the berserker is attacked by an enemy within 5 feet of them, the berserker deals 4 (1d8) keen damage to the attacker.",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Longsword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d8 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 8 (1d8 + 4) keen damage, and if the target is Prone, they take an extra 4 (1d8) damage"
      },
      {
        "name": "Strike: Dagger",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": "1d4 + 3",
        "rangeText": "range 20/60 ft.",
        "description": "Attack +3, range 20/60 ft., one target. Graze: 2 (1d4) keen damage. Hit: 5 (1d4 + 3) keen damage"
      },
      {
        "name": "Shield Bash (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "The berserker makes an Athletics test against the Physical defense of a Large or smaller character within 5 feet of them, knocking them Prone on a success"
      },
      {
        "name": "Berserker Rage (Costs 2 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 2,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "The Thrill surges within the berserker. Their next Strike targets each character within 5 feet of them and deals an extra 3 (1d6) damage on a hit"
      },
      {
        "name": "Lash Out (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": true,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "After the berserker is attacked by an enemy within 5 feet of them, the berserker deals 4 (1d8) keen damage to the attacker"
      }
    ],
    "sourceAdversaryName": "Thrill Berserker"
  },
  {
    "name": "Veth",
    "role": "Tier 1 Boss – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 2,
      "intellect": 1,
      "willpower": 1,
      "awareness": 3,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 12,
      "spiritual-defense": 15
    },
    "resources": {
      "health": 40,
      "focus": 3,
      "investiture": 0
    },
    "deflect": null,
    "movement": "25 ft.",
    "senses": "20 ft.",
    "skills": {
      "athletics": 3,
      "light-weaponry": 3,
      "stealth": 4,
      "discipline": 3,
      "insight": 5,
      "perception": 5
    },
    "features": [
      "Boss . Veth can take both a fast turn and a slow turn each to secondary targets using Exploit Advantage. To benefit round",
      "After an enemy finishes a turn, Veth can spend 1 focus from his Targeted Strikes, he favors targets he has an to immediately use an extra or . Additionally, he can advantage against, such as Prone targets. If harried with spend 1 focus on his turn to remove a condition from himself. ranged attacks, he uses",
      "Intuitive Redirect to make any Targeted Strikes . While Veth has an advantage on an attack, missed attacks hit his enemies. he ignores deflect when dealing damage"
    ],
    "tactics": "Spiritual Skills: Insight +5, Perception +5 Veth uses Insightful Defense against the most obvious Languages: Alethi, Iriali martial threat, then engages them in close combat. He features spends focus quickly to gain extra turns, and he switches Boss . Veth can take both a fast turn and a slow turn each to secondary targets using Exploit Advantage. To benefit round. After an enemy finishes a turn, Veth can spend 1 focus from his Targeted Strikes, he favors targets he has an to immediately use an extra or . Additionally, he can advantage against, such as Prone targets. If harried with spend 1 focus on his turn to remove a condition from himself. ranged attacks, he uses Intuitive Redirect to make any Targeted Strikes . While Veth has an advantage on an attack, missed attacks hit his enemies. he ignores deflect when dealing damage. actions Strike: Sidesword . Attack +3, reach 5 ft., one target. Graze: 3 (1d6) keen damage. Hit: 6 (1d6 + 3) keen damage. Exploit Advantage . Veth moves up to his movement rate. If he moves at least 10 feet and ends this movement within 5 feet of an enemy he hasn't attacked this round, this movement doesn't trigger Reactive Strikes, and he makes a Perception test against the target's Spiritual defense. On a success, Veth gains an advantage on his next attack against the target. Insightful Defense . Veth makes an Insight test against the Spiritual defense of a target he can sense within 60 feet of him. On a success, the target can't gain an advantage on attacks against Veth for 1 minute or until Veth uses this free action on another target. Intuitive Redirect (Costs 1 Focus) . Before an attack misses Veth, he can cause the attack to instead hit a target within 5 feet of him. This target can't be the character who attacked him. PET",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Sidesword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": "1d6 + 3",
        "rangeText": "reach 5 ft.",
        "description": "Attack +3, reach 5 ft., one target. Graze: 3 (1d6) keen damage. Hit: 6 (1d6 + 3) keen damage"
      },
      {
        "name": "Exploit Advantage",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "Veth moves up to his movement rate. If he moves at least 10 feet and ends this movement within 5 feet of an enemy he hasn't attacked this round, this movement doesn't trigger Reactive Strikes, and he makes a Perception test against the target's Spiritual defense. On a success, Veth gains an advantage on his next attack against the target"
      },
      {
        "name": "Insightful Defense",
        "kind": "free",
        "actionCost": 0,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 60 feet",
        "description": "Veth makes an Insight test against the Spiritual defense of a target he can sense within 60 feet of him. On a success, the target can't gain an advantage on attacks against Veth for 1 minute or until Veth uses this free action on another target"
      },
      {
        "name": "Intuitive Redirect (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "Before an attack misses Veth, he can cause the attack to instead hit a target within 5 feet of him. This target can't be the character who attacked him. PET"
      }
    ],
    "sourceAdversaryName": "Veth"
  },
  {
    "name": "Warform Singer",
    "role": "Tier 1 Rival – Medium Humanoid",
    "attributes": {
      "strength": 3,
      "speed": 1,
      "intellect": 1,
      "willpower": 2,
      "awareness": 2,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 13,
      "spiritual-defense": 14
    },
    "resources": {
      "health": 24,
      "focus": 4,
      "investiture": 0
    },
    "deflect": 2,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "athletics": 5,
      "heavy-weaponry": 4,
      "light-weaponry": 3,
      "discipline": 5,
      "intimidation": 4,
      "leadership": 4,
      "perception": 4
    },
    "features": [
      "External Carapace . The warform can use their carapace like"
    ],
    "tactics": "a shield, allowing them to use the Brace action A warform singer is a brutally efficient combatant, Martial Experience . The warform can use their Strike action especially when fighting alongside their warpair—another twice on their turn. warform singer. Warpairs descend on a target together actions with their Warpair Coordination and, using their Martial Strike: Axe . Attack +4, reach 5 ft., one target. The Experience, they make multiple Axe attacks against warform can jump up to 10 feet before or after making a single foe to fell them. In a tight spot, the warform this attack. Graze: 3 (1d6) keen damage. Hit: 7 (1d6 + 4) singer relies on their External Carapace for relief from an keen damage. onslaught while their warpair continues fighting. S Strike: Shortbow . Attack +3, range 80/320 ft., one target. O ANT Graze: 3 (1d6) keen damage. Hit: 6 (1d6 + 3) keen damage. Warpair Coordination (Costs 1 Focus) . After another ARDO S warform within 5 feet of this warform takes the Move action, this warform moves up to their movement rate, ending their AIO EDUmovement within 5 feet of the other warform. C",
    "notes": null,
    "presetActions": [
      {
        "name": "Warpair Coordination and, using their Martial Strike: Axe",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d6 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. The Experience, they make multiple Axe attacks against warform can jump up to 10 feet before or after making a single foe to fell them. In a tight spot, the warform this attack. Graze: 3 (1d6) keen damage. Hit: 7 (1d6 + 4) singer relies on their External Carapace for relief from an keen damage. onslaught while their warpair continues fighting"
      },
      {
        "name": "S Strike: Shortbow",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 3,
        "defaultDamageFormula": "1d6 + 3",
        "rangeText": "range 80/320 ft.",
        "description": "Attack +3, range 80/320 ft., one target. O ANT Graze: 3 (1d6) keen damage. Hit: 6 (1d6 + 3) keen damage"
      },
      {
        "name": "Warpair Coordination (Costs 1 Focus)",
        "kind": "reaction",
        "actionCost": 0,
        "focusCost": 1,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 5 feet",
        "description": "After another ARDO S warform within 5 feet of this warform takes the Move action, this warform moves up to their movement rate, ending their AIO EDUmovement within 5 feet of the other warform. C"
      }
    ],
    "sourceAdversaryName": "Warform Singer"
  },
  {
    "name": "Ylt",
    "role": "Tier 1 Boss – Medium Humanoid",
    "attributes": {
      "strength": 2,
      "speed": 3,
      "intellect": 3,
      "willpower": 3,
      "awareness": 3,
      "presence": 4
    },
    "defenses": {
      "physical-defense": 15,
      "cognitive-defense": 16,
      "spiritual-defense": 17
    },
    "resources": {
      "health": 80,
      "focus": 5,
      "investiture": 6
    },
    "deflect": null,
    "movement": "30 ft.",
    "senses": "20 ft.",
    "skills": {
      "light-weaponry": 5,
      "deduction": 6,
      "discipline": 6,
      "insight": 5,
      "leadership": 6,
      "perception": 5
    },
    "features": [
      "Physical defense, he can Boss . Ylt can take both a fast turn and a slow turn each infuse Tension into his clothing to increase his Physical round",
      "After an enemy finishes a turn, Ylt can spend 1 focus to defense by 2 until the start of his next turn, including immediately use an extra or . Additionally, he can spend against the triggering attack. If the attack hit, this 1 focus on his turn to remove a condition from himself. increase can change it into a miss, and if the attack",
      "Flowing Earth . After Ylt uses the Cohesion surge, he can grazed, he ignores its effects. immediately use Vaulting Stone on himself (no action or third ideal"
    ],
    "tactics": "",
    "notes": null,
    "presetActions": [
      {
        "name": "Empowered condition, gaining an advantage on all tests and Taln's Honorblade",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "Ylt is bonded to the Honorblade of the refilling his Investiture to maximum at the start of his fast Herald Taln. If he loses the weapon, he can summon it as turns"
      },
      {
        "name": "He additionally gains the following action: , and it reappears in his hand at the start of his next fast Offhand Strike (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 5,
        "defaultDamageFormula": "2d10 + 5",
        "rangeText": "reach 5 ft.",
        "description": "Attack +5, reach 5 ft., turn. While not wielding it, he can't use the Cohesion and one target. Graze: 11 (2d10) spirit damage. Hit: 16 (2d10 + 5) Tension surges (including Vaulting Stone, Stone Spear, and spirit damage. Tension Parry). actions"
      }
    ],
    "sourceAdversaryName": "Ylt"
  },
  {
    "name": "Zealot",
    "role": "Tier 1 Minion – Medium Humanoid",
    "attributes": {
      "strength": 3,
      "speed": 1,
      "intellect": 1,
      "willpower": 2,
      "awareness": 1,
      "presence": 2
    },
    "defenses": {
      "physical-defense": 14,
      "cognitive-defense": 13,
      "spiritual-defense": 13
    },
    "resources": {
      "health": 12,
      "focus": 4,
      "investiture": 0
    },
    "deflect": null,
    "movement": "25 ft.",
    "senses": "10 ft.",
    "skills": {
      "agility": 3,
      "heavy-weaponry": 4,
      "intimidation": 3,
      "perception": 3,
      "survival": 3
    },
    "features": [
      "As a battle grows more violent and their Minion . The zealot's attacks can't critically hit, and they're companions become Frenzied, a zealot uses Inspire Zeal to immediately defeated when they suffer an injury. encourage courage and brutality in the face of death",
      "Fanatical . Intimidation and Persuasion tests against the zealot gain a disadvantage",
      "Frenzied . While the zealot is at half health or less, they can't use the Brace action, but their movement rate increases by 10 feet and their damage rolls gain an advantage"
    ],
    "tactics": "Spiritual Skills: Perception +3, Survival +3 A zealot fights with fanaticism. They and their fellow Languages: defined by culture zealots crowd around enemies and attack recklessly with features their Longsword. As a battle grows more violent and their Minion . The zealot's attacks can't critically hit, and they're companions become Frenzied, a zealot uses Inspire Zeal to immediately defeated when they suffer an injury. encourage courage and brutality in the face of death. Fanatical . Intimidation and Persuasion tests against the zealot gain a disadvantage. Frenzied . While the zealot is at half health or less, they can't use the Brace action, but their movement rate increases by 10 feet and their damage rolls gain an advantage. actions Strike: Longsword . Attack +4, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 8 (1d8 + 4) keen damage. Brace . The zealot raises their shield, and attacks against them gain a disadvantage until the start of the zealot's next turn. Inspire Zeal (Costs 1 Focus) . The zealot inspires an ally they can influence within 20 feet of them. That ally can immediately use the Strike action as . A MÓ AR",
    "notes": null,
    "presetActions": [
      {
        "name": "Strike: Longsword",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": true,
        "requiresRoll": true,
        "supportsDamage": true,
        "defaultModifier": 4,
        "defaultDamageFormula": "1d8 + 4",
        "rangeText": "reach 5 ft.",
        "description": "Attack +4, reach 5 ft., one target. Graze: 4 (1d8) keen damage. Hit: 8 (1d8 + 4) keen damage"
      },
      {
        "name": "Brace",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "The zealot raises their shield, and attacks against them gain a disadvantage until the start of the zealot's next turn"
      },
      {
        "name": "Inspire Zeal (Costs 1 Focus)",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 1,
        "requiresTarget": true,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": "within 20 feet",
        "description": "The zealot inspires an ally they can influence within 20 feet of them"
      },
      {
        "name": "That ally can immediately use the Strike action as",
        "kind": "action",
        "actionCost": 1,
        "focusCost": 0,
        "requiresTarget": false,
        "requiresRoll": false,
        "supportsDamage": false,
        "defaultModifier": null,
        "defaultDamageFormula": null,
        "rangeText": null,
        "description": "A MÓ AR"
      }
    ],
    "sourceAdversaryName": "Zealot"
  }
];

function buildStatSheet(entry: RawStonewalkersAdversary): CharacterStatSheet {
  const sheet = createEmptyCharacterStatSheet();
  const attributes = { ...sheet.attributeScores };
  for (const [key, value] of Object.entries(entry.attributes) as Array<[CharacterAttributeKey, number]>) {
    attributes[key] = value;
  }

  const skillRanks = { ...sheet.skillRanks };
  for (const [skillKey, modifier] of Object.entries(entry.skills)) {
    const attributeValue =
      skillKey === 'athletics' || skillKey === 'heavy-weaponry'
        ? entry.attributes.strength
        : skillKey === 'agility' || skillKey === 'light-weaponry' || skillKey === 'stealth' || skillKey === 'thievery'
          ? entry.attributes.speed
          : skillKey === 'crafting' || skillKey === 'deduction' || skillKey === 'lore' || skillKey === 'medicine'
            ? entry.attributes.intellect
            : skillKey === 'discipline' || skillKey === 'intimidation'
              ? entry.attributes.willpower
              : skillKey === 'insight' || skillKey === 'perception' || skillKey === 'survival'
                ? entry.attributes.awareness
                : entry.attributes.presence;
    skillRanks[skillKey] = Math.max(0, modifier - attributeValue);
  }

  const defenseBonuses = { ...sheet.defenseBonuses };
  const basePhysicalDefense = 10 + entry.attributes.strength + entry.attributes.speed;
  const baseCognitiveDefense = 10 + entry.attributes.intellect + entry.attributes.willpower;
  const baseSpiritualDefense = 10 + entry.attributes.awareness + entry.attributes.presence;
  defenseBonuses['physical-defense'] = entry.defenses['physical-defense'] - basePhysicalDefense;
  defenseBonuses['cognitive-defense'] = entry.defenses['cognitive-defense'] - baseCognitiveDefense;
  defenseBonuses['spiritual-defense'] = entry.defenses['spiritual-defense'] - baseSpiritualDefense;

  const derivedOverrides: Partial<Record<CharacterDerivedKey, string | number>> = {};
  if (entry.deflect !== undefined && entry.deflect !== null) {
    derivedOverrides.deflect = entry.deflect;
  }
  if (entry.movement) {
    derivedOverrides['movement-rate'] = entry.movement;
  }
  if (entry.senses) {
    derivedOverrides['senses-range'] = entry.senses;
  }

  return {
    ...sheet,
    attributeScores: attributes,
    skillRanks,
    resourceOverrides: {
      ...sheet.resourceOverrides,
      health: entry.resources.health,
      focus: entry.resources.focus,
      investiture: entry.resources.investiture,
    },
    defenseBonuses,
    derivedOverrides,
  };
}

function buildPresetActions(entry: RawStonewalkersAdversary): CombatPresetAction[] {
  return entry.presetActions.map((action) => ({
    id: createId('preset-action'),
    name: action.name,
    kind: action.kind,
    actionCost: action.actionCost,
    focusCost: action.focusCost,
    requiresTarget: action.requiresTarget,
    requiresRoll: action.requiresRoll,
    supportsDamage: action.supportsDamage,
    defaultModifier: action.defaultModifier ?? undefined,
    defaultDamageFormula: action.defaultDamageFormula ?? undefined,
    rangeText: action.rangeText ?? undefined,
    description: action.description ?? undefined,
  }));
}

export function createStonewalkersAdversaryDrafts(): ParticipantTemplate[] {
  return RAW_STONEWALKERS_ADVERSARIES.map((entry) => ({
    id: createId('enemy-template'),
    name: entry.name,
    side: 'enemy',
    role: entry.role,
    stats: buildStatSheet(entry),
    maxHealth: entry.resources.health,
    maxFocus: entry.resources.focus,
    maxInvestiture: entry.resources.investiture,
    notes: entry.notes ?? undefined,
    imagePath: undefined,
    features: [...entry.features],
    tactics: entry.tactics || undefined,
    sourceAdversaryName: entry.sourceAdversaryName,
    presetActions: buildPresetActions(entry),
  }));
}
