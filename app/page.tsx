import { readFileSync } from "node:fs";
import { join } from "node:path";
import TripCalendar from "@/app/components/trip-calendar";
import { parseCsvRows } from "@/app/lib/csv";

type CalendarEvent = {
  activity: string;
  compactDate: string;
  date: Date;
  dateKey: string;
  fullDate: string;
  note: string;
  tripDay: string;
};

type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  events: CalendarEvent[];
  fullDate: string;
  isInTripRange: boolean;
  monthShort: string;
  weekday: string;
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

const monthShortFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
});

const weekRangeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

function parseTripDate(value: string) {
  const match = value.match(
    /^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/,
  );

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

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getUTCDay());
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
        compactDate: compactDateFormatter.format(date),
        date,
        dateKey: toDateKey(date),
        fullDate: fullDateFormatter.format(date),
        note: row[column.get("Note") ?? 3] ?? "",
        tripDay: row[column.get("Day") ?? 0],
      };
    })
    .sort((first, second) => first.date.getTime() - second.date.getTime());
}

function getActiveWeeks(events: CalendarEvent[], tripStart: Date, tripEnd: Date) {
  const eventsByDate = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dateEvents = eventsByDate.get(event.dateKey) ?? [];
    eventsByDate.set(event.dateKey, [...dateEvents, event]);
  }

  const weekStarts = Array.from(
    new Set(events.map((event) => toDateKey(startOfWeek(event.date)))),
  ).sort();

  return weekStarts.map((weekStartKey) => {
    const [year, month, day] = weekStartKey.split("-").map(Number);
    const weekStart = new Date(Date.UTC(year, month - 1, day));
    const weekEnd = addDays(weekStart, 6);

    return {
      days: Array.from({ length: 7 }, (_, index): CalendarDay => {
        const date = addDays(weekStart, index);
        const dateKey = toDateKey(date);

        return {
          dateKey,
          dayNumber: date.getUTCDate(),
          events: eventsByDate.get(dateKey) ?? [],
          fullDate: fullDateFormatter.format(date),
          isInTripRange:
            date.getTime() >= tripStart.getTime() &&
            date.getTime() <= tripEnd.getTime(),
          monthShort: monthShortFormatter.format(date),
          weekday: weekdayFormatter.format(date),
        };
      }),
      key: weekStartKey,
      label: `${weekRangeFormatter.format(weekStart)} - ${weekRangeFormatter.format(weekEnd)}`,
    };
  });
}

function serializeEvent(event: CalendarEvent) {
  return {
    activity: event.activity,
    compactDate: event.compactDate,
    dateKey: event.dateKey,
    fullDate: event.fullDate,
    note: event.note,
    tripDay: event.tripDay,
  };
}

export default function Home() {
  const events = getEvents();
  const tripStart = events[0];
  const tripEnd = events[events.length - 1];
  const weeks = getActiveWeeks(events, tripStart.date, tripEnd.date);

  return (
    <TripCalendar
      events={events.map(serializeEvent)}
      summary={{
        endLabel: compactDateFormatter.format(tripEnd.date),
        eventCount: events.length,
        startLabel: compactDateFormatter.format(tripStart.date),
        weekCount: weeks.length,
        year: tripEnd.date.getUTCFullYear(),
      }}
      weeks={weeks.map((week) => ({
        ...week,
        days: week.days.map((day) => ({
          ...day,
          events: day.events.map(serializeEvent),
        })),
      }))}
    />
  );
}
