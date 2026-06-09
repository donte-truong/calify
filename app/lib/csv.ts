export function parseCsvRows(csv: string) {
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

export function escapeCsvValue(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\"", "\"\"")}"`;
}
