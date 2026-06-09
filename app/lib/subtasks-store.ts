import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { escapeCsvValue, parseCsvRows } from "@/app/lib/csv";

export type StoredSubtask = {
  createdAt: string;
  dateKey: string;
  endTime: string;
  id: string;
  location: string;
  notes: string;
  time: string;
  title: string;
};

type SubtaskInput = {
  dateKey?: unknown;
  endTime?: unknown;
  location?: unknown;
  notes?: unknown;
  time?: unknown;
  title?: unknown;
};

const subtaskHeaders = [
  "id",
  "dateKey",
  "title",
  "time",
  "endTime",
  "location",
  "notes",
  "createdAt",
] as const;

const dataDirectory =
  process.env.CALIFY_DATA_DIR ?? join(process.cwd(), "app/data");
const subtaskPath = join(dataDirectory, "subtasks.csv");

let writeQueue = Promise.resolve();

export class SubtaskStoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeValue(value: string) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sortSubtasks(subtasks: StoredSubtask[]) {
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

function getCell(
  row: string[],
  column: Map<string, number>,
  header: string,
  fallbackIndex?: number,
) {
  const index = column.get(header) ?? fallbackIndex;

  if (index === undefined) {
    return "";
  }

  return row[index] ?? "";
}

async function ensureSubtaskFile() {
  await mkdir(dirname(subtaskPath), { recursive: true });

  try {
    await readFile(subtaskPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    try {
      await writeFile(subtaskPath, `${subtaskHeaders.join(",")}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") {
        throw writeError;
      }
    }
  }
}

async function readSubtaskCsv() {
  await ensureSubtaskFile();
  return readFile(subtaskPath, "utf8");
}

async function writeSubtasks(subtasks: StoredSubtask[]) {
  await mkdir(dirname(subtaskPath), { recursive: true });

  const rows = sortSubtasks(subtasks).map((subtask) =>
    subtaskHeaders
      .map((header) => escapeCsvValue(subtask[header]))
      .join(","),
  );
  const csv = `${subtaskHeaders.join(",")}\n${rows.join("\n")}${
    rows.length ? "\n" : ""
  }`;
  const tempPath = `${subtaskPath}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tempPath, csv, "utf8");
  await rename(tempPath, subtaskPath);
}

async function withWriteLock<T>(operation: () => Promise<T>) {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

export async function listSubtasks() {
  const csv = await readSubtaskCsv();
  const [headers = [], ...rows] = parseCsvRows(csv);
  const column = new Map(headers.map((header, index) => [header, index]));

  return sortSubtasks(
    rows
      .map((row) => ({
        createdAt: getCell(row, column, "createdAt", 6),
        dateKey: getCell(row, column, "dateKey", 1),
        endTime: getCell(row, column, "endTime"),
        id: getCell(row, column, "id", 0),
        location: getCell(row, column, "location", 4),
        notes: getCell(row, column, "notes", 5),
        time: getCell(row, column, "time", 3),
        title: getCell(row, column, "title", 2),
      }))
      .filter((subtask) => subtask.id && subtask.dateKey && subtask.title),
  );
}

export async function createSubtask(input: SubtaskInput) {
  const dateKey = normalizeText(input.dateKey, 10);
  const endTime = normalizeText(input.endTime, 20);
  const location = normalizeText(input.location, 160);
  const notes = normalizeText(input.notes, 600);
  const time = normalizeText(input.time, 20);
  const title = normalizeText(input.title, 120);

  if (!isDateKey(dateKey)) {
    throw new SubtaskStoreError("A valid date is required.");
  }

  if (!title) {
    throw new SubtaskStoreError("A title is required.");
  }

  if (!isTimeValue(time) || !isTimeValue(endTime)) {
    throw new SubtaskStoreError("Times must use HH:MM format.");
  }

  if (time && endTime && endTime < time) {
    throw new SubtaskStoreError("End time must be after start time.");
  }

  return withWriteLock(async () => {
    const subtasks = await listSubtasks();
    const subtask: StoredSubtask = {
      createdAt: new Date().toISOString(),
      dateKey,
      endTime,
      id: randomUUID(),
      location,
      notes,
      time,
      title,
    };

    await writeSubtasks([...subtasks, subtask]);

    return subtask;
  });
}

export async function deleteSubtask(id: string) {
  const subtaskId = normalizeText(id, 80);

  if (!subtaskId) {
    throw new SubtaskStoreError("A subtask id is required.");
  }

  return withWriteLock(async () => {
    const subtasks = await listSubtasks();
    const nextSubtasks = subtasks.filter(
      (subtask) => subtask.id !== subtaskId,
    );

    if (nextSubtasks.length === subtasks.length) {
      throw new SubtaskStoreError("Subtask not found.", 404);
    }

    await writeSubtasks(nextSubtasks);

    return subtaskId;
  });
}
