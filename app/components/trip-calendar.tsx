"use client";

import { useEffect, useMemo, useState } from "react";

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
  endTime: string;
  id: string;
  location: string;
  notes: string;
  time: string;
  title: string;
};

type FormState = {
  endTime: string;
  location: string;
  notes: string;
  time: string;
  title: string;
};

type TaskDetail = {
  eyebrow: string;
  kind: string;
  location?: string;
  note: string;
  time?: string;
  title: string;
};

type TripCalendarProps = {
  events: TripEvent[];
  summary: CalendarSummary;
  weeks: CalendarWeek[];
};

const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm: FormState = {
  endTime: "",
  location: "",
  notes: "",
  time: "",
  title: "",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function apiPath(path: string) {
  return `${basePath}${path}`;
}

function formatTimeRange(startTime: string, endTime?: string) {
  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  }

  if (startTime) {
    return startTime;
  }

  if (endTime) {
    return `Until ${endTime}`;
  }

  return "";
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
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<TaskDetail | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  const subtasksByDate = useMemo(
    () => groupSubtasksByDate(subtasks),
    [subtasks],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSubtasks() {
      try {
        const response = await fetch(apiPath("/api/subtasks"), {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          error?: string;
          subtasks?: Subtask[];
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Subtasks could not be loaded.");
        }

        if (isMounted) {
          setSubtasks(sortSubtasks(data.subtasks ?? []));
          setLoadError("");
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Subtasks could not be loaded.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSubtasks(false);
        }
      }
    }

    loadSubtasks();

    return () => {
      isMounted = false;
    };
  }, []);

  function openSubtaskForm(day: CalendarDay) {
    setSelectedDetail(null);
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

  function openTripEventDetails(tripEvent: TripEvent) {
    setSelectedDetail({
      eyebrow: `${tripEvent.tripDay} - ${tripEvent.fullDate}`,
      kind: "Scheduled Event",
      note: tripEvent.note,
      title: tripEvent.activity,
    });
  }

  function openSubtaskDetails(subtask: Subtask, fullDate: string) {
    setSelectedDetail({
      eyebrow: fullDate,
      kind: "Subtask",
      location: subtask.location,
      note: subtask.notes,
      time: formatTimeRange(subtask.time, subtask.endTime),
      title: subtask.title,
    });
  }

  function closeTaskDetails() {
    setSelectedDetail(null);
  }

  async function saveSubtask(event: React.FormEvent<HTMLFormElement>) {
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
      const response = await fetch(apiPath("/api/subtasks"), {
        body: JSON.stringify({
          dateKey: selectedDay.dateKey,
          ...form,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        subtask?: Subtask;
      };

      if (!response.ok || !data.subtask) {
        throw new Error(data.error ?? "Unable to save subtask.");
      }

      const savedSubtask = data.subtask;

      setSubtasks((currentSubtasks) =>
        sortSubtasks([...currentSubtasks, savedSubtask]),
      );
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

  async function removeSubtask(subtaskId: string) {
    const previousSubtasks = subtasks;

    setSubtasks((currentSubtasks) =>
      currentSubtasks.filter((subtask) => subtask.id !== subtaskId),
    );

    try {
      const response = await fetch(apiPath("/api/subtasks"), {
        body: JSON.stringify({ id: subtaskId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Subtask could not be removed.");
      }

      setLoadError("");
    } catch (error) {
      setSubtasks(previousSubtasks);
      setLoadError("Subtask could not be removed.");
      console.error(error);
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

      <section className="w-full px-5 py-8 sm:px-8 lg:px-10">
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
                              <button
                                className={`block max-h-36 w-full cursor-pointer overflow-hidden border-l-4 px-3 py-2 text-left transition hover:ring-1 hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-teal-600 ${getEventTone(
                                  tripEvent.activity,
                                )}`}
                                key={`${tripEvent.dateKey}-${tripEvent.tripDay}`}
                                onClick={() => openTripEventDetails(tripEvent)}
                                type="button"
                              >
                                <span className="block text-xs font-bold uppercase">
                                  {tripEvent.tripDay}
                                </span>
                                <span className="mt-1 block text-sm font-bold leading-5">
                                  {tripEvent.activity}
                                </span>
                                {tripEvent.note ? (
                                  <span className="mt-2 block break-words text-xs leading-5">
                                    {tripEvent.note}
                                  </span>
                                ) : null}
                              </button>
                            ))}

                            {daySubtasks.map((subtask) => (
                              <article
                                className="relative max-h-36 overflow-hidden border-l-4 border-zinc-400 bg-[#fbfcfb] text-zinc-800"
                                key={subtask.id}
                              >
                                <button
                                  className="block w-full px-3 py-2 pr-11 text-left transition hover:ring-1 hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                                  onClick={() =>
                                    openSubtaskDetails(subtask, day.fullDate)
                                  }
                                  type="button"
                                >
                                  <span className="block text-xs font-bold uppercase text-zinc-500">
                                    {formatTimeRange(
                                      subtask.time,
                                      subtask.endTime,
                                    ) || "Task"}
                                  </span>
                                  <span className="mt-1 block text-sm font-bold leading-5">
                                    {subtask.title}
                                  </span>
                                  {subtask.location ? (
                                    <span className="mt-1 block text-xs font-semibold text-teal-800">
                                      {subtask.location}
                                    </span>
                                  ) : null}
                                  {subtask.notes ? (
                                    <span className="mt-1 block break-words text-xs leading-5 text-zinc-600">
                                      {subtask.notes}
                                    </span>
                                  ) : null}
                                </button>
                                <button
                                  aria-label={`Remove ${subtask.title}`}
                                  className="absolute right-2 top-2 flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-300 bg-white text-xs font-bold text-zinc-500 transition hover:border-rose-400 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                  onClick={() => removeSubtask(subtask.id)}
                                  title="Remove subtask"
                                  type="button"
                                >
                                  x
                                </button>
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
              {isLoadingSubtasks ? (
                <p className="mt-2 text-sm font-medium text-zinc-500">
                  Loading shared subtasks...
                </p>
              ) : null}
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
                        <button
                          className="block max-h-40 w-full overflow-hidden text-left transition hover:text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                          onClick={() => openTripEventDetails(tripEvent)}
                          type="button"
                        >
                          <span className="block text-xs font-bold uppercase text-teal-700">
                            {tripEvent.tripDay} - {tripEvent.fullDate}
                          </span>
                          <span className="mt-1 block font-bold leading-6">
                            {tripEvent.activity}
                          </span>
                          {tripEvent.note ? (
                            <span className="mt-2 block break-words text-sm leading-6 text-zinc-600">
                              {tripEvent.note}
                            </span>
                          ) : null}
                        </button>

                        {eventSubtasks.length ? (
                          <ul className="mt-3 grid gap-2">
                            {eventSubtasks.map((subtask) => {
                              const subtaskTime = formatTimeRange(
                                subtask.time,
                                subtask.endTime,
                              );

                              return (
                                <li
                                  className="relative max-h-28 overflow-hidden border-l-4 border-zinc-300 bg-zinc-50 text-sm"
                                  key={subtask.id}
                                >
                                  <button
                                    className="block w-full px-3 py-2 pr-11 text-left transition hover:ring-1 hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                                    onClick={() =>
                                      openSubtaskDetails(
                                        subtask,
                                        tripEvent.fullDate,
                                      )
                                    }
                                    type="button"
                                  >
                                    <span className="block font-semibold">
                                      {subtaskTime ? `${subtaskTime} - ` : ""}
                                      {subtask.title}
                                    </span>
                                    {subtask.location ? (
                                      <span className="mt-1 block text-xs font-semibold text-teal-800">
                                        {subtask.location}
                                      </span>
                                    ) : null}
                                  </button>
                                  <button
                                    aria-label={`Remove ${subtask.title}`}
                                    className="absolute right-2 top-2 flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-300 bg-white text-xs font-bold text-zinc-500 transition hover:border-rose-400 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    onClick={() => removeSubtask(subtask.id)}
                                    title="Remove subtask"
                                    type="button"
                                  >
                                    x
                                  </button>
                                </li>
                              );
                            })}
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
                  Start Time
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
                  End Time
                  <input
                    className="h-11 border border-zinc-300 px-3 text-base font-normal text-zinc-950 outline-none transition focus:border-teal-600"
                    min={form.time || undefined}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        endTime: event.target.value,
                      }))
                    }
                    type="time"
                    value={form.endTime}
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-zinc-700 sm:col-span-2">
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

      {selectedDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTaskDetails();
            }
          }}
        >
          <section className="max-h-[min(80vh,42rem)] w-full max-w-2xl overflow-auto border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-5 border-b border-zinc-200 pb-4">
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase text-teal-700">
                  {selectedDetail.kind}
                </p>
                <h2 className="mt-1 text-2xl font-bold leading-tight">
                  {selectedDetail.title}
                </h2>
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  {selectedDetail.eyebrow}
                </p>
              </div>
              <button
                aria-label="Close task details"
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-300 bg-white text-sm font-bold text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-950"
                onClick={closeTaskDetails}
                title="Close"
                type="button"
              >
                x
              </button>
            </div>

            <div className="grid gap-4 py-5">
              {selectedDetail.time ? (
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Time
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">
                    {selectedDetail.time}
                  </p>
                </div>
              ) : null}

              {selectedDetail.location ? (
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Location
                  </p>
                  <p className="mt-1 text-sm font-semibold text-teal-800">
                    {selectedDetail.location}
                  </p>
                </div>
              ) : null}

              {selectedDetail.note ? (
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Notes
                  </p>
                  <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
                    {renderNote(selectedDetail.note)}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
