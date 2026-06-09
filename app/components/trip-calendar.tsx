"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

type TripEvent = {
  activity: string;
  compactDate: string;
  dateKey: string;
  fullDate: string;
  note: string;
  tripDay: string;
};

type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  events: TripEvent[];
  fullDate: string;
  isInTripRange: boolean;
  monthShort: string;
  weekday: string;
};

type CalendarWeek = {
  days: CalendarDay[];
  key: string;
  label: string;
};

type CalendarSummary = {
  endLabel: string;
  eventCount: number;
  startLabel: string;
  weekCount: number;
  year: number;
};

type Subtask = {
  createdAt: string;
  dateKey: string;
  id: string;
  location: string;
  notes: string;
  time: string;
  title: string;
};

type FormState = {
  location: string;
  notes: string;
  time: string;
  title: string;
};

type TripCalendarProps = {
  events: TripEvent[];
  summary: CalendarSummary;
  weeks: CalendarWeek[];
};

const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm: FormState = {
  location: "",
  notes: "",
  time: "",
  title: "",
};

const subtaskStorageKey = "calify:subtasks";
const subtaskStoreEvent = "calify:subtasks-change";
const emptySubtasks: Subtask[] = [];
let cachedSubtasksSnapshot = emptySubtasks;
let cachedSubtasksValue: string | null = null;

function createSubtaskId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isSubtask(value: unknown): value is Subtask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const subtask = value as Partial<Record<keyof Subtask, unknown>>;

  return (
    typeof subtask.createdAt === "string" &&
    typeof subtask.dateKey === "string" &&
    typeof subtask.id === "string" &&
    typeof subtask.location === "string" &&
    typeof subtask.notes === "string" &&
    typeof subtask.time === "string" &&
    typeof subtask.title === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(subtask.dateKey) &&
    subtask.title.trim().length > 0
  );
}

function readStoredSubtasks() {
  if (typeof window === "undefined") {
    return emptySubtasks;
  }

  try {
    const storedSubtasks = window.localStorage.getItem(subtaskStorageKey);

    if (storedSubtasks === cachedSubtasksValue) {
      return cachedSubtasksSnapshot;
    }

    cachedSubtasksValue = storedSubtasks;

    if (!storedSubtasks) {
      cachedSubtasksSnapshot = emptySubtasks;
      return cachedSubtasksSnapshot;
    }

    const parsedSubtasks: unknown = JSON.parse(storedSubtasks);
    cachedSubtasksSnapshot = Array.isArray(parsedSubtasks)
      ? sortSubtasks(parsedSubtasks.filter(isSubtask))
      : emptySubtasks;

    return cachedSubtasksSnapshot;
  } catch {
    return emptySubtasks;
  }
}

function getServerSubtasksSnapshot() {
  return emptySubtasks;
}

function subscribeToSubtaskStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === subtaskStorageKey) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(subtaskStoreEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(subtaskStoreEvent, onStoreChange);
  };
}

function writeStoredSubtasks(nextSubtasks: Subtask[]) {
  const sortedSubtasks = sortSubtasks(nextSubtasks);
  const nextSubtasksValue = JSON.stringify(sortedSubtasks);

  window.localStorage.setItem(subtaskStorageKey, nextSubtasksValue);
  cachedSubtasksSnapshot = sortedSubtasks;
  cachedSubtasksValue = nextSubtasksValue;
  window.dispatchEvent(new Event(subtaskStoreEvent));
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

  if (
    activityText.includes("london") ||
    activityText.includes("paris") ||
    activityText.includes("parish")
  ) {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-950";
}

function renderNote(note: string) {
  if (!note) {
    return null;
  }

  const parts = note.split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part, index) => {
    if (part.startsWith("http")) {
      return (
        <a
          className="font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-950"
          href={part}
          key={`${part}-${index}`}
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

function sortSubtasks(subtasks: Subtask[]) {
  return [...subtasks].sort((first, second) => {
    const dateOrder = first.dateKey.localeCompare(second.dateKey);

    if (dateOrder !== 0) {
      return dateOrder;
    }

    const timeOrder = first.time.localeCompare(second.time);

    if (timeOrder !== 0) {
      return timeOrder;
    }

    return first.createdAt.localeCompare(second.createdAt);
  });
}

function groupSubtasksByDate(subtasks: Subtask[]) {
  const subtasksByDate = new Map<string, Subtask[]>();

  for (const subtask of sortSubtasks(subtasks)) {
    const dateSubtasks = subtasksByDate.get(subtask.dateKey) ?? [];
    subtasksByDate.set(subtask.dateKey, [...dateSubtasks, subtask]);
  }

  return subtasksByDate;
}

export default function TripCalendar({
  events,
  summary,
  weeks,
}: TripCalendarProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const subtasks = useSyncExternalStore(
    subscribeToSubtaskStore,
    readStoredSubtasks,
    getServerSubtasksSnapshot,
  );

  const subtasksByDate = useMemo(
    () => groupSubtasksByDate(subtasks),
    [subtasks],
  );

  function openSubtaskForm(day: CalendarDay) {
    setSelectedDay(day);
    setForm(emptyForm);
    setFormError("");
  }

  function closeSubtaskForm() {
    if (isSaving) {
      return;
    }

    setSelectedDay(null);
    setForm(emptyForm);
    setFormError("");
  }

  function saveSubtask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDay) {
      return;
    }

    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const savedSubtask: Subtask = {
        createdAt: new Date().toISOString(),
        dateKey: selectedDay.dateKey,
        id: createSubtaskId(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        time: form.time,
        title: form.title.trim(),
      };

      writeStoredSubtasks([...subtasks, savedSubtask]);
      setLoadError("");
      closeSubtaskForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save subtask.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function removeSubtask(subtaskId: string) {
    try {
      writeStoredSubtasks(
        subtasks.filter((subtask) => subtask.id !== subtaskId),
      );
      setLoadError("");
    } catch {
      setLoadError("Subtask could not be removed.");
    }
  }

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
              {summary.startLabel} - {summary.endLabel}, {summary.year} with{" "}
              {summary.eventCount} scheduled days across{" "}
              {summary.weekCount} active weeks.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="border border-zinc-200 bg-[#fbfcfb] px-4 py-3">
              <dt className="text-zinc-500">Start</dt>
              <dd className="mt-1 font-semibold">{summary.startLabel}</dd>
            </div>
            <div className="border border-zinc-200 bg-[#fbfcfb] px-4 py-3">
              <dt className="text-zinc-500">End</dt>
              <dd className="mt-1 font-semibold">{summary.endLabel}</dd>
            </div>
            <div className="border border-zinc-200 bg-[#fbfcfb] px-4 py-3">
              <dt className="text-zinc-500">Weeks</dt>
              <dd className="mt-1 font-semibold">{summary.weekCount}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-2xl font-bold">Active Weeks</h2>
              <p className="text-sm font-medium text-zinc-500">
                {summary.weekCount} weeks with scheduled events
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
                  {weeks.flatMap((week) =>
                    week.days.map((day) => {
                      const daySubtasks = subtasksByDate.get(day.dateKey) ?? [];

                      return (
                        <div
                          className={`min-h-44 border-b border-r border-zinc-200 p-3 ${
                            day.isInTripRange
                              ? "bg-white text-zinc-950"
                              : "bg-zinc-50 text-zinc-500"
                          }`}
                          key={day.dateKey}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            openSubtaskForm(day);
                          }}
                        >
                          <div className="flex h-full flex-col gap-3">
                            <div>
                              <div>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-lg font-bold">
                                    {day.dayNumber}
                                  </span>
                                  <span className="text-xs font-bold uppercase text-zinc-400">
                                    {day.monthShort}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold uppercase text-zinc-400">
                                  {day.weekday}
                                </p>
                              </div>
                            </div>

                            {day.events.map((tripEvent) => (
                              <article
                                className={`border-l-4 px-3 py-2 ${getEventTone(
                                  tripEvent.activity,
                                )}`}
                                key={`${tripEvent.dateKey}-${tripEvent.tripDay}`}
                              >
                                <p className="text-xs font-bold uppercase">
                                  {tripEvent.tripDay}
                                </p>
                                <h3 className="mt-1 text-sm font-bold leading-5">
                                  {tripEvent.activity}
                                </h3>
                                {tripEvent.note ? (
                                  <p className="mt-2 break-words text-xs leading-5">
                                    {renderNote(tripEvent.note)}
                                  </p>
                                ) : null}
                              </article>
                            ))}

                            {daySubtasks.map((subtask) => (
                              <article
                                className="border-l-4 border-zinc-400 bg-[#fbfcfb] px-3 py-2 text-zinc-800"
                                key={subtask.id}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold uppercase text-zinc-500">
                                    {subtask.time || "Task"}
                                  </p>
                                  <button
                                    aria-label={`Remove ${subtask.title}`}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-300 bg-white text-xs font-bold text-zinc-500 transition hover:border-rose-400 hover:text-rose-700"
                                    onClick={() => removeSubtask(subtask.id)}
                                    title="Remove subtask"
                                    type="button"
                                  >
                                    x
                                  </button>
                                </div>
                                <h4 className="mt-1 text-sm font-bold leading-5">
                                  {subtask.title}
                                </h4>
                                {subtask.location ? (
                                  <p className="mt-1 text-xs font-semibold text-teal-800">
                                    {subtask.location}
                                  </p>
                                ) : null}
                                {subtask.notes ? (
                                  <p className="mt-1 break-words text-xs leading-5 text-zinc-600">
                                    {subtask.notes}
                                  </p>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="border border-zinc-200 bg-white shadow-sm xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-auto">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-xl font-bold">Itinerary</h2>
              {loadError ? (
                <p className="mt-2 text-sm font-medium text-rose-700">
                  {loadError}
                </p>
              ) : null}
            </div>

            <ol className="divide-y divide-zinc-200">
              {events.map((tripEvent) => {
                const eventSubtasks =
                  subtasksByDate.get(tripEvent.dateKey) ?? [];

                return (
                  <li
                    className="px-5 py-4"
                    key={`${tripEvent.dateKey}-${tripEvent.tripDay}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center border border-zinc-200 bg-[#fbfcfb] text-center">
                        <span className="text-xs font-semibold uppercase text-zinc-500">
                          {tripEvent.compactDate.split(" ")[0]}
                        </span>
                        <span className="text-lg font-bold leading-none">
                          {tripEvent.compactDate.split(" ")[1]}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase text-teal-700">
                          {tripEvent.tripDay} - {tripEvent.fullDate}
                        </p>
                        <h3 className="mt-1 font-bold leading-6">
                          {tripEvent.activity}
                        </h3>
                        {tripEvent.note ? (
                          <p className="mt-2 break-words text-sm leading-6 text-zinc-600">
                            {renderNote(tripEvent.note)}
                          </p>
                        ) : null}

                        {eventSubtasks.length ? (
                          <ul className="mt-3 grid gap-2">
                            {eventSubtasks.map((subtask) => (
                              <li
                                className="border-l-4 border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                                key={subtask.id}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold">
                                    {subtask.time ? `${subtask.time} - ` : ""}
                                    {subtask.title}
                                  </p>
                                  <button
                                    aria-label={`Remove ${subtask.title}`}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-300 bg-white text-xs font-bold text-zinc-500 transition hover:border-rose-400 hover:text-rose-700"
                                    onClick={() => removeSubtask(subtask.id)}
                                    title="Remove subtask"
                                    type="button"
                                  >
                                    x
                                  </button>
                                </div>
                                {subtask.location ? (
                                  <p className="mt-1 text-xs font-semibold text-teal-800">
                                    {subtask.location}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      </section>

      {selectedDay ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSubtaskForm();
            }
          }}
        >
          <form
            className="w-full max-w-lg border border-zinc-200 bg-white p-5 shadow-xl"
            onSubmit={saveSubtask}
          >
            <div className="flex items-start justify-between gap-5 border-b border-zinc-200 pb-4">
              <div>
                <p className="text-sm font-bold uppercase text-teal-700">
                  {selectedDay.fullDate}
                </p>
                <h2 className="mt-1 text-2xl font-bold">Add Subtask</h2>
              </div>
              <button
                aria-label="Close subtask form"
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-300 bg-white text-sm font-bold text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-950"
                onClick={closeSubtaskForm}
                title="Close"
                type="button"
              >
                x
              </button>
            </div>

            <div className="grid gap-4 py-5">
              <label className="grid gap-2 text-sm font-semibold text-zinc-700">
                Title
                <input
                  className="h-11 border border-zinc-300 px-3 text-base font-normal text-zinc-950 outline-none transition focus:border-teal-600"
                  maxLength={120}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      title: event.target.value,
                    }))
                  }
                  required
                  type="text"
                  value={form.title}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-zinc-700">
                  Time
                  <input
                    className="h-11 border border-zinc-300 px-3 text-base font-normal text-zinc-950 outline-none transition focus:border-teal-600"
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        time: event.target.value,
                      }))
                    }
                    type="time"
                    value={form.time}
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-zinc-700">
                  Location
                  <input
                    className="h-11 border border-zinc-300 px-3 text-base font-normal text-zinc-950 outline-none transition focus:border-teal-600"
                    maxLength={160}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        location: event.target.value,
                      }))
                    }
                    type="text"
                    value={form.location}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-zinc-700">
                Notes
                <textarea
                  className="min-h-28 resize-y border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-950 outline-none transition focus:border-teal-600"
                  maxLength={600}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      notes: event.target.value,
                    }))
                  }
                  value={form.notes}
                />
              </label>

              {formError ? (
                <p className="text-sm font-semibold text-rose-700">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
              <button
                className="h-11 border border-zinc-300 bg-white px-4 font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
                disabled={isSaving}
                onClick={closeSubtaskForm}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-11 bg-teal-700 px-5 font-semibold text-white transition hover:bg-teal-800 disabled:bg-zinc-400"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving..." : "Save Subtask"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
