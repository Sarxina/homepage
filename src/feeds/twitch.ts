// The next stream, read from the channel's own Twitch schedule. Twitch publishes the schedule as an iCalendar feed
// that needs no key and can be read from any page.

export type Stream = { title: string; starts: number; ends: number };

const WEEK = 7 * 86_400_000;

type Field = { params: string; value: string };

// The VEVENT blocks of a calendar, each as its fields by name.
function events(ics: string): Record<string, Field>[] {
  const lines = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); // long lines are folded onto the next with a space
  const found: Record<string, Field>[] = [];
  let current: Record<string, Field> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      if (current) found.push(current);
      current = null;
    } else if (current) {
      const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (m) current[m[1]] = { params: m[2], value: m[3] };
    }
  }
  return found;
}

function unescape(text: string) {
  return text.replace(/\\([,;\\nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c)).trim();
}

// "20261016T160000" as if it were UTC: the wall-clock time, kept apart from its time zone so that weeks can be added
// to it across a clock change.
function wallTime(stamp: string) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(stamp);
  if (!m) return null;
  return { wall: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), utc: m[7] === 'Z' };
}

// How far a time zone is ahead of UTC at a moment, in milliseconds.
function zoneOffset(zone: string, at: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at;
}

// A wall-clock time in a time zone, as a moment.
function moment(wall: number, zone: string | null) {
  if (!zone) return wall;
  try {
    const guess = wall - zoneOffset(zone, wall);
    return wall - zoneOffset(zone, guess);
  } catch {
    return wall; // a zone this browser does not know
  }
}

export async function nextStream(broadcasterId: string, now = Date.now()): Promise<Stream | null> {
  const response = await fetch(`https://api.twitch.tv/helix/schedule/icalendar?broadcaster_id=${broadcasterId}`);
  if (!response.ok) throw new Error(`Twitch schedule: ${response.status}`);

  let next: Stream | null = null;
  for (const event of events(await response.text())) {
    const start = event.DTSTART && wallTime(event.DTSTART.value);
    const end = event.DTEND && wallTime(event.DTEND.value);
    if (!start || !end) continue;
    const zone = start.utc ? null : (/TZID=\/?([^;:]+)/.exec(event.DTSTART.params)?.[1] ?? null);
    const weekly = /FREQ=WEEKLY/.test(event.RRULE?.value ?? '');

    // The first time it is on that has not ended yet. Twitch's repeating streams repeat weekly.
    for (let week = 0; week <= (weekly ? 520 : 0); week++) {
      const ends = moment(end.wall + week * WEEK, zone);
      if (ends <= now) continue;
      const starts = moment(start.wall + week * WEEK, zone);
      if (!next || starts < next.starts) next = { title: unescape(event.SUMMARY?.value ?? ''), starts, ends };
      break;
    }
  }
  return next;
}
