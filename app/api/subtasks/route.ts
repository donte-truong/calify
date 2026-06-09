import {
  createSubtask,
  deleteSubtask,
  listSubtasks,
  SubtaskStoreError,
} from "@/app/lib/subtasks-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function errorResponse(error: unknown) {
  if (error instanceof SubtaskStoreError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  console.error(error);
  return jsonResponse({ error: "Subtask storage failed." }, 500);
}

export async function GET() {
  try {
    const subtasks = await listSubtasks();

    return jsonResponse({ subtasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "A JSON request body is required." }, 400);
    }

    const subtask = await createSubtask(body);

    return jsonResponse({ subtask }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readJsonBody(request);

    if (!body || typeof body !== "object" || !("id" in body)) {
      return jsonResponse({ error: "A subtask id is required." }, 400);
    }

    const id = await deleteSubtask(String(body.id));

    return jsonResponse({ id });
  } catch (error) {
    return errorResponse(error);
  }
}
