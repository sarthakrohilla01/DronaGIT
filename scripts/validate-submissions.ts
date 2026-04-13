import { readFileSync, existsSync, readdirSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function getAllMetadata(submissionsPath: string) {
  const results: { title: string; subject: string; folder: string }[] = [];

  const folders = readdirSync(submissionsPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of folders) {
    const metaPath = path.join(submissionsPath, folder, "metadata.json");
    if (!existsSync(metaPath)) continue;

    try {
      const raw = readFileSync(metaPath, "utf8");
      const data = JSON.parse(raw);
      if (!isMissing(data.title) && !isMissing(data.subject)) {
        results.push({
          title: String(data.title).trim().toLowerCase(),
          subject: String(data.subject).trim().toLowerCase(),
          folder,
        });
      }
    } catch { }
  }

  return results;
}

export function validateSubmission(metadataPath: string): string[] {
  const errors: string[] = [];
  const dirPath = path.dirname(metadataPath);
  const folderName = path.basename(dirPath);
  const prefix = `[${folderName}]`;

  const submissionsPath = path.resolve("submissions");

  if (!existsSync(submissionsPath)) {
    return ["submissions folder not found."];
  }

  if (!existsSync(metadataPath)) {
    return [`${prefix} metadata.json not found.`];
  }

  let metadata: any;
  try {
    const raw = readFileSync(metadataPath, "utf8");
    metadata = JSON.parse(raw);
  } catch {
    return [`${prefix} metadata.json is not valid JSON.`];
  }

  const validTypes = ["notes", "papers", "syllabus", "practicals"];
  const validPaperTypes = [
    "Sessional",
    "University",
    "Pre University",
    "Other",
  ];
  const validBranches = [
    "CSE",
    "AIML",
    "IOT",
    "IT",
    "CSIT",
    "ECE",
    "EEE",
    "ECS",
    "ME",
    "RA",
  ];

  const validActions = ["create", "edit", "delete"];
  const actionLower = metadata.action ? String(metadata.action).trim().toLowerCase() : "create";

  if (!validActions.includes(actionLower)) {
    errors.push(`${prefix} Invalid 'action'. Must be one of: create, edit, delete.`);
    return errors;
  }

  if (actionLower === "delete") {
    if (isMissing(metadata.resourceId)) {
      errors.push(`${prefix} Missing required field: 'resourceId' for delete action.`);
    }
  }

  if (actionLower === "edit") {
    if (isMissing(metadata.resourceId)) {
      errors.push(`${prefix} Missing required field: 'resourceId' for edit action.`);
    }

    if (!isMissing(metadata.type)) {
      const typeLower = metadata.type.toLowerCase();
      if (metadata.type !== typeLower) {
        errors.push(`${prefix} 'type' must be lowercase.`);
      }
      if (!validTypes.includes(typeLower)) {
        errors.push(`${prefix} Invalid 'type'.`);
      }
    }

    if (metadata.type === "papers") {
      if (!isMissing(metadata.year) && !/^\d{4}$/.test(String(metadata.year))) {
        errors.push(`${prefix} 'year' must be 4 digits.`);
      }
      if (!isMissing(metadata.paperType) && !validPaperTypes.includes(metadata.paperType)) {
        errors.push(`${prefix} Invalid 'paperType'.`);
      }
    }

    if (!isMissing(metadata.branch)) {
      if (!Array.isArray(metadata.branch) || metadata.branch.length === 0) {
        errors.push(`${prefix} 'branch' must be a non-empty array.`);
      } else {
        for (const b of metadata.branch) {
          if (typeof b !== "string" || b !== b.toUpperCase()) {
            errors.push(`${prefix} Invalid branch format: '${b}'.`);
          } else if (!validBranches.includes(b)) {
            errors.push(`${prefix} Invalid branch: '${b}'.`);
          }
        }
      }
    }

    if (!isMissing(metadata.semester)) {
      const sem = Number(metadata.semester);
      if (!Number.isInteger(sem) || sem < 1 || sem > 8) {
        errors.push(`${prefix} 'semester' must be between 1 and 8.`);
      }
    }

    if (!isMissing(metadata.title) && String(metadata.title).trim() === "") {
      errors.push(`${prefix} 'title' must not be empty.`);
    }
  }

  if (actionLower === "create") {
    const requiredFields = ["type", "title", "subject", "branch", "semester"];
    for (const field of requiredFields) {
      if (isMissing(metadata[field])) {
        errors.push(`${prefix} Missing required field: '${field}'.`);
      }
    }

    if (!isMissing(metadata.type)) {
      const typeLower = metadata.type.toLowerCase();
      if (metadata.type !== typeLower) {
        errors.push(`${prefix} 'type' must be lowercase.`);
      }
      if (!validTypes.includes(typeLower)) {
        errors.push(`${prefix} Invalid 'type'.`);
      }
    }

    if (metadata.type === "papers") {
      if (isMissing(metadata.year)) {
        errors.push(`${prefix} Missing required field: 'year'.`);
      } else if (!/^\d{4}$/.test(String(metadata.year))) {
        errors.push(`${prefix} 'year' must be 4 digits.`);
      }

      if (isMissing(metadata.paperType)) {
        errors.push(`${prefix} Missing required field: 'paperType'.`);
      } else if (!validPaperTypes.includes(metadata.paperType)) {
        errors.push(`${prefix} Invalid 'paperType'.`);
      }
    }

    if (!isMissing(metadata.branch)) {
      if (!Array.isArray(metadata.branch) || metadata.branch.length === 0) {
        errors.push(`${prefix} 'branch' must be a non-empty array.`);
      } else {
        for (const b of metadata.branch) {
          if (typeof b !== "string" || b !== b.toUpperCase()) {
            errors.push(`${prefix} Invalid branch format: '${b}'.`);
          } else if (!validBranches.includes(b)) {
            errors.push(`${prefix} Invalid branch: '${b}'.`);
          }
        }
      }
    }

    if (!isMissing(metadata.semester)) {
      const sem = Number(metadata.semester);
      if (!Number.isInteger(sem) || sem < 1 || sem > 8) {
        errors.push(`${prefix} 'semester' must be between 1 and 8.`);
      }
    }

    if (!isMissing(metadata.title) && String(metadata.title).trim() === "") {
      errors.push(`${prefix} 'title' must not be empty.`);
    }
  }

  try {
    const files = readdirSync(dirPath);
    const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

    if (actionLower === "create") {
      if (pdfs.length === 0) {
        errors.push(`${prefix} No PDF found.`);
      }
      if (pdfs.length > 1) {
        errors.push(`${prefix} Only one PDF allowed.`);
      }
    } else {
      if (pdfs.length > 0) {
        errors.push(`${prefix} PDFs are not allowed for '${actionLower}' actions.`);
      }
    }

    const invalid = files.filter(
      (f) => !f.toLowerCase().endsWith(".pdf") && f !== "metadata.json",
    );
    if (invalid.length > 0) {
      errors.push(`${prefix} Invalid files: ${invalid.join(", ")}`);
    }
  } catch {
    errors.push(`${prefix} Cannot read folder.`);
  }

  if (actionLower === "create" && !isMissing(metadata.title) && !isMissing(metadata.subject)) {
    const all = getAllMetadata(submissionsPath);
    const currentTitle = String(metadata.title).trim().toLowerCase();
    const currentSubject = String(metadata.subject).trim().toLowerCase();

    const duplicates = all.filter(
      (item) =>
        item.title === currentTitle &&
        item.subject === currentSubject &&
        item.folder !== folderName,
    );

    if (duplicates.length > 0) {
      errors.push(
        `${prefix} Duplicate found: same title and subject already exists.`,
      );
    }
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Provide metadata.json paths.");
    process.exit(1);
  }

  let allErrors: string[] = [];

  for (const file of args) {
    const abs = path.resolve(file);
    const errs = validateSubmission(abs);
    allErrors.push(...errs);
  }

  if (allErrors.length) {
    console.error(`\n${allErrors.length} error(s):`);
    for (const e of allErrors) console.error(`- ${e}`);
    process.exit(1);
  } else {
    console.log("All submissions valid.");
    process.exit(0);
  }
}
