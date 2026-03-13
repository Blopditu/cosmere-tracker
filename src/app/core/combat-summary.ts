import {
  ActorSummary,
  AnalyticsBundle,
  AnalyticsPoint,
  AppData,
  CombatEvent,
  CombatantInstance,
  FightRecord,
  FightSummary,
  SessionRecord,
  SessionSummary,
  Side,
} from './models';

function createActorSummary(actor: CombatantInstance): ActorSummary {
  return {
    actorId: actor.id,
    name: actor.name,
    side: actor.side,
    role: actor.role,
    color: actor.color,
    kills: 0,
    deaths: 0,
    assists: 0,
    supportActions: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    rollCount: 0,
    critCount: 0,
    hitAttempts: 0,
    hits: 0,
    accuracy: 0,
    saveSuccesses: 0,
    saveFailures: 0,
    tagCounts: {},
    badges: [],
  };
}

function sortedTimeline(events: CombatEvent[]): CombatEvent[] {
  return [...events].sort((left, right) => {
    const leftRound = left.round ?? Number.MAX_SAFE_INTEGER;
    const rightRound = right.round ?? Number.MAX_SAFE_INTEGER;
    if (leftRound !== rightRound) {
      return leftRound - rightRound;
    }
    return left.timestamp.localeCompare(right.timestamp);
  });
}

function updateTagCounts(summary: ActorSummary, tags: string[] = []): void {
  for (const tag of tags) {
    summary.tagCounts[tag] = (summary.tagCounts[tag] ?? 0) + 1;
  }
}

function finalizeSummaries(map: Map<string, ActorSummary>): ActorSummary[] {
  const summaries = Array.from(map.values());

  for (const summary of summaries) {
    summary.accuracy = summary.hitAttempts > 0 ? summary.hits / summary.hitAttempts : 0;
  }

  const highestDamage = highestBy(summaries, (entry) => entry.damageDealt);
  const highestSupport = highestBy(summaries, (entry) => entry.supportActions + entry.assists);
  const highestTaken = highestBy(summaries, (entry) => entry.damageTaken);
  const highestAccuracy = highestBy(summaries, (entry) => entry.accuracy);

  if (highestDamage) {
    highestDamage.badges.push('MVP');
  }
  if (highestSupport && !highestSupport.badges.includes('MVP')) {
    highestSupport.badges.push('Clutch Support');
  }
  if (highestTaken) {
    highestTaken.badges.push('Tank');
  }
  if (highestAccuracy && highestAccuracy.hitAttempts > 0) {
    highestAccuracy.badges.push('Playmaker');
  }

  return summaries.sort((left, right) => {
    if (left.side !== right.side) {
      return left.side === 'party' ? -1 : 1;
    }
    return right.damageDealt - left.damageDealt;
  });
}

function highestBy<T>(items: T[], selector: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => {
    if (!best) {
      return item;
    }
    return selector(item) > selector(best) ? item : best;
  }, undefined);
}

export function summarizeFight(fight: FightRecord): FightSummary {
  const summaryMap = new Map<string, ActorSummary>();
  for (const actor of fight.combatants) {
    summaryMap.set(actor.id, createActorSummary(actor));
  }

  for (const event of fight.events) {
    const actorSummary = summaryMap.get(event.actorId);
    if (!actorSummary) {
      continue;
    }

    if (event.rollTotal !== undefined) {
      actorSummary.rollCount += 1;
    }

    switch (event.type) {
      case 'attack-roll':
        actorSummary.hitAttempts += 1;
        if (event.outcome === 'hit' || event.outcome === 'crit') {
          actorSummary.hits += 1;
        }
        if (event.outcome === 'crit') {
          actorSummary.critCount += 1;
        }
        break;
      case 'damage':
        actorSummary.damageDealt += event.amount ?? 0;
        for (const targetId of event.targetIds) {
          summaryMap.get(targetId)!.damageTaken += event.amount ?? 0;
        }
        break;
      case 'healing':
        actorSummary.healingDone += event.amount ?? 0;
        break;
      case 'saving-throw':
        if (event.outcome === 'success') {
          actorSummary.saveSuccesses += 1;
        }
        if (event.outcome === 'failure') {
          actorSummary.saveFailures += 1;
        }
        break;
      case 'support':
        actorSummary.supportActions += 1;
        actorSummary.assists += 1;
        updateTagCounts(actorSummary, event.supportTags);
        break;
      case 'utility':
      case 'condition':
        updateTagCounts(actorSummary, event.supportTags);
        break;
      case 'kill':
        actorSummary.kills += event.targetIds.length || 1;
        for (const targetId of event.targetIds) {
          const targetSummary = summaryMap.get(targetId);
          if (targetSummary) {
            targetSummary.deaths += 1;
          }
        }
        break;
      case 'death':
        actorSummary.deaths += 1;
        break;
      default:
        break;
    }
  }

  const summaries = finalizeSummaries(summaryMap);

  return {
    fight,
    timeline: sortedTimeline(fight.events),
    party: summaries.filter((entry) => entry.side === 'party'),
    enemies: summaries.filter((entry) => entry.side === 'enemy'),
  };
}

function mergeActorSummary(target: ActorSummary, incoming: ActorSummary): ActorSummary {
  target.kills += incoming.kills;
  target.deaths += incoming.deaths;
  target.assists += incoming.assists;
  target.supportActions += incoming.supportActions;
  target.damageDealt += incoming.damageDealt;
  target.damageTaken += incoming.damageTaken;
  target.healingDone += incoming.healingDone;
  target.rollCount += incoming.rollCount;
  target.critCount += incoming.critCount;
  target.hitAttempts += incoming.hitAttempts;
  target.hits += incoming.hits;
  target.saveSuccesses += incoming.saveSuccesses;
  target.saveFailures += incoming.saveFailures;

  for (const [tag, count] of Object.entries(incoming.tagCounts)) {
    target.tagCounts[tag] = (target.tagCounts[tag] ?? 0) + count;
  }

  return target;
}

export function summarizeSession(session: SessionRecord): SessionSummary {
  const fightSummaries = session.fights.map((fight) => summarizeFight(fight));
  const map = new Map<string, ActorSummary>();

  for (const fightSummary of fightSummaries) {
    for (const actor of [...fightSummary.party, ...fightSummary.enemies]) {
      const existing = map.get(actor.actorId);
      if (existing) {
        mergeActorSummary(existing, actor);
      } else {
        map.set(actor.actorId, {
          ...actor,
          badges: [],
          accuracy: 0,
        });
      }
    }
  }

  const summaries = finalizeSummaries(map);

  return {
    session,
    party: summaries.filter((entry) => entry.side === 'party'),
    enemies: summaries.filter((entry) => entry.side === 'enemy'),
    fights: fightSummaries,
  };
}

function point(label: string, side: Side, value: number): AnalyticsPoint {
  return {
    key: `${side}:${label}`,
    label,
    side,
    value,
  };
}

export function buildAnalyticsFromSummaries(summaries: ActorSummary[]): AnalyticsBundle {
  return {
    damageDealt: summaries.map((entry) => point(entry.name, entry.side, entry.damageDealt)),
    damageTaken: summaries.map((entry) => point(entry.name, entry.side, entry.damageTaken)),
    kills: summaries.map((entry) => point(entry.name, entry.side, entry.kills)),
    supportActions: summaries.map((entry) => point(entry.name, entry.side, entry.supportActions)),
    rollVolume: summaries.map((entry) => point(entry.name, entry.side, entry.rollCount)),
    accuracy: summaries.map((entry) =>
      point(entry.name, entry.side, Number((entry.accuracy * 100).toFixed(1))),
    ),
    crits: summaries.map((entry) => point(entry.name, entry.side, entry.critCount)),
  };
}

export function buildAnalytics(data: AppData, sessionId?: string, fightId?: string): AnalyticsBundle {
  const session = sessionId ? data.sessions.find((entry) => entry.id === sessionId) : undefined;

  if (session && fightId) {
    const fight = session.fights.find((entry) => entry.id === fightId);
    const fightSummary = fight ? summarizeFight(fight) : undefined;
    return buildAnalyticsFromSummaries([...(fightSummary?.party ?? []), ...(fightSummary?.enemies ?? [])]);
  }

  if (session) {
    const sessionSummary = summarizeSession(session);
    return buildAnalyticsFromSummaries([...sessionSummary.party, ...sessionSummary.enemies]);
  }

  const summaries = data.sessions.flatMap((entry) => {
    const sessionSummary = summarizeSession(entry);
    return [...sessionSummary.party, ...sessionSummary.enemies];
  });

  return buildAnalyticsFromSummaries(rollUpActorSummariesByName(summaries));
}

export function rollUpActorSummariesByName(summaries: ActorSummary[]): ActorSummary[] {
  const map = new Map<string, ActorSummary>();
  for (const summary of summaries) {
    const key = `${summary.side}:${summary.name}`;
    const existing = map.get(key);
    if (existing) {
      mergeActorSummary(existing, summary);
    } else {
      map.set(key, { ...summary, badges: [], accuracy: 0 });
    }
  }

  return finalizeSummaries(map).sort((left, right) => right.damageDealt - left.damageDealt);
}
