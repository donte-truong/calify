import { readFileSync } from "node:fs";
import { join } from "node:path";

type CalendarEvent = {
  activity: string;
  date: Date;
  dateKey: string;
  note: string;
  tripDay: string;
};

type CalendarCell = {
  date: Date | null;
  events: CalendarEvent[];
  key: string;
};

const csvPath = join(process.cwd(), "app/data/events.csv");

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const monthLookup = new Map<string, number>(
  monthNames.map((month, index) => [month, index]),
);

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(value.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some(Boolean)) {
      rows.push(row);
    }
  }

  return rows;
}

function parseTripDate(value: string) {
  const match = value.match(/^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);

  if (!match) {
    throw new Error(`Unable to parse event date: ${value}`);
  }

  const [, monthName, day, year] = match;
  const month = monthLookup.get(monthName);

  if (month === undefined) {
    throw new Error(`Unknown event month: ${monthName}`);
  }

  return new Date(Date.UTC(Number(year), month, Number(day)));
}

function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getEvents() {
  const csv = readFileSync(csvPath, "utf8");
  const [headers, ...rows] = parseCsvRows(csv);

  const column = new Map(headers.map((header, index) => [header, index]));

  return rows
    .map((row) => {
      const date = parseTripDate(row[column.get("Date") ?? 2]);

      return {
        activity: row[column.get("Activity") ?? 1],
        date,
        dateKey: toDateKey(date),
        note: row[column.get("Note") ?? 3] ?? "",
        tripDay: row[column.get("Day") ?? 0],
      };
    })
    .sort((first, second) => first.date.getTime() - second.date.getTime());
}

function getCalendarCells(year: number, month: number, eventsByDate: Map<string, CalendarEvent[]>) {
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlankDays = firstDayOfMonth.getUTCDay();
  const cellCount = Math.ceil((leadingBlankDays + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index): CalendarCell => {
    const dayOfMonth = index - leadingBlankDays + 1;

    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      return {
        date: null,
        events: [],
        key: `blank-${year}-${month}-${index}`,
      };
    }

    const date = new Date(Date.UTC(year, month, dayOfMonth));
    const dateKey = toDateKey(date);

    return {
      date,
      events: eventsByDate.get(dateKey) ?? [],
      key: dateKey,
    };
  });
}

function getEventTone(activity: string) {
  const activityText = activity.toLowerCase();

  if (activityText.includes("fly")) {
    return "border-sky-300 bg-sky-50 text-sky-950";
  }

  if (activityText.includes("train")) {
    return "border-teal-300 bg-teal-50 text-teal-950";
  }

  if (activityText.includes("vatican") || activityText.includes("rome")) {
    return "border-rose-300 bg-rose-50 text-rose-950";
  }

  if (activityText.includes("london") || activityText.includes("paris") || activityText.includes("parish")) {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-950";
}

function renderNote(note: string) {
  if (!note) {
    return null;
  }

  const parts = note.split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part) => {
    if (part.startsWith("http")) {
      return (
        <a
          className="font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-950"
          href={part}
          key={part}
          rel="noreferrer"
          target="_blank"
        >
          {part.replace(/^https?:\/\//, "")}
        </a>
      );
    }

    return part;
  });
}

export default function Home() {
  const events = getEvents();
  const eventsByDate = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dateEvents = eventsByDate.get(event.dateKey) ?? [];
    eventsByDate.set(event.dateKey, [...dateEvents, event]);
  }

  const months = Array.from(
    new Map(
      events.map((event) => [
        `${event.date.getUTCFullYear()}-${event.date.getUTCMonth()}`,
        {
          month: event.date.getUTCMonth(),
          year: event.date.getUTCFullYear(),
        },
      ]),
    ).values(),
  );

  const tripStart = events[0];
  const tripEnd = events[events.length - 1];

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase text-teal-700">
              Calify
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Europe Trip Calendar
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
              {compactDateFormatter.format(tripStart.date)} -{" "}
              {compactDateFormatter.format(tripEnd.date)},{" "}
              {tripEnd.date.getUTCFullYear()} with {events.length} scheduled
              days across two summer months.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="border border-zinc-200 bg-[#fbfcfb] px-4 py-3">
              <dt className="text-zinc-500">Start</dt>
              <dd className="mt-1 font-semibold">
                {compactDateFormatter.format(tripStart.date)}
              </dd>
            </div>
            <div className="border border-zinc-200 bg-[#fbfcfb] px-4 py-3">
              <dt className="text-zinc-500">End</dt>
              <dd className="mt-1 font-semibold">
                {compactDateFormatter.format(tripEnd.date)}
              </dd>
            </div>
            <div className="border border-zinc-200 bg-[#fbfcfb] px-4 py-3">
              <dt className="text-zinc-500">Events</dt>
              <dd className="mt-1 font-semibold">{events.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-8">
            {months.map(({ month, year }) => {
              const calendarCells = getCalendarCells(year, month, eventsByDate);

              return (
                <section
                  className="overflow-hidden border border-zinc-200 bg-white shadow-sm"
                  key={`${year}-${month}`}
                >
                  <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                    <h2 className="text-2xl font-bold">
                      {monthNames[month]} {year}
                    </h2>
                    <p className="text-sm font-medium text-zinc-500">
                      {calendarCells.filter((cell) => cell.events.length > 0).length}{" "}
                      scheduled days
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[780px]">
                      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
                        {calendarWeekdays.map((weekday) => (
                          <div
                            className="border-r border-zinc-200 px-3 py-2 text-xs font-bold uppercase text-zinc-500 last:border-r-0"
                            key={weekday}
                          >
                            {weekday}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7">
                        {calendarCells.map((cell) => (
                          <div
                            className="min-h-40 border-b border-r border-zinc-200 bg-white p-3 last:border-r-0"
                            key={cell.key}
                          >
                            {cell.date ? (
                              <div className="flex h-full flex-col gap-3">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-lg font-bold">
                                    {cell.date.getUTCDate()}
                                  </span>
                                  <span className="text-xs font-semibold uppercase text-zinc-400">
                                    {weekdayFormatter.format(cell.date)}
                                  </span>
                                </div>

                                {cell.events.map((event) => (
                                  <article
                                    className={`border-l-4 px-3 py-2 ${getEventTone(
                                      event.activity,
                                    )}`}
                                    key={`${event.dateKey}-${event.tripDay}`}
                                  >
                                    <p className="text-xs font-bold uppercase">
                                      {event.tripDay}
                                    </p>
                                    <h3 className="mt-1 text-sm font-bold leading-5">
                                      {event.activity}
                                    </h3>
                                    {event.note ? (
                                      <p className="mt-2 break-words text-xs leading-5">
                                        {renderNote(event.note)}
                                      </p>
                                    ) : null}
                                  </article>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="border border-zinc-200 bg-white shadow-sm xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-auto">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-xl font-bold">Itinerary</h2>
            </div>

            <ol className="divide-y divide-zinc-200">
              {events.map((event) => (
                <li className="px-5 py-4" key={`${event.dateKey}-${event.tripDay}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center border border-zinc-200 bg-[#fbfcfb] text-center">
                      <span className="text-xs font-semibold uppercase text-zinc-500">
                        {compactDateFormatter.format(event.date).split(" ")[0]}
                      </span>
                      <span className="text-lg font-bold leading-none">
                        {event.date.getUTCDate()}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-teal-700">
                        {event.tripDay} - {fullDateFormatter.format(event.date)}
                      </p>
                      <h3 className="mt-1 font-bold leading-6">
                        {event.activity}
                      </h3>
                      {event.note ? (
                        <p className="mt-2 break-words text-sm leading-6 text-zinc-600">
                          {renderNote(event.note)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
    </main>
  );
}
