import { readFileSync, existsSync, readdirSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function validateSubmission(metadataPath: string): string[] {
  const errors: string[] = [];
  const dirPath = path.dirname(metadataPath);
  const folderName = path.basename(dirPath);
  const prefix = `[${folderName}]`;

  if (!existsSync(metadataPath)) {
    return [`${prefix} metadata.json not found.`];
  }

  let metadata: any;
  try {
    const raw = readFileSync(metadataPath, "utf8");
    metadata = JSON.parse(raw);
  } catch (error) {
    return [`${prefix} metadata.json is not valid JSON.`];
  }

  const validTypes = ["notes", "papers", "syllabus", "practicals"];
  const validPaperTypes = ["Sessional", "University", "Pre University", "Other"];
  const validBranches = ["CSE", "AIML", "IOT", "IT", "CSIT", "ECE", "EEE", "ECS", "ME", "RA"];
  const minSem = 1;
  const maxSem = 8;

  const requiredFields = ["type", "title", "semester"];
  for (const field of requiredFields) {
    if (isMissing(metadata[field])) {
      errors.push(`${prefix} Missing required field: '${field}'.`);
    }
  }

  if (!isMissing(metadata.type)) {
    const typeLower = metadata.type.toLowerCase();
    if (metadata.type !== typeLower) {
      errors.push(`${prefix} 'type' must be lowercase. Got: '${metadata.type}'. Expected: '${typeLower}'.`);
    }
    if (!validTypes.includes(typeLower)) {
      errors.push(`${prefix} Invalid 'type': '${metadata.type}'. Must be one of: ${validTypes.join(", ")}.`);
    }
  }

  if (!isMissing(metadata.type) && metadata.type !== "syllabus" && isMissing(metadata.subject)) {
    errors.push(`${prefix} Missing required field: 'subject' (required for type '${metadata.type}').`);
  }

  if (!isMissing(metadata.type) && metadata.type === "papers") {
    if (isMissing(metadata.year)) {
      errors.push(`${prefix} Missing required field: 'year' (required for type 'papers').`);
    } else if (!/^\d{4}$/.test(String(metadata.year))) {
      errors.push(`${prefix} 'year' must be a 4-digit number. Got: '${metadata.year}'.`);
    }

    if (isMissing(metadata.paperType)) {
      errors.push(`${prefix} Missing required field: 'paperType' (required for type 'papers').`);
    } else if (!validPaperTypes.includes(metadata.paperType)) {
      errors.push(`${prefix} Invalid 'paperType': '${metadata.paperType}'. Must be one of: ${validPaperTypes.join(", ")}.`);
    }
  }

  if (!Array.isArray(metadata.branch) || metadata.branch.length === 0) {
    errors.push(`${prefix} Missing required field: 'branch' (must be a non-empty array).`);
  } else {
    for (const b of metadata.branch) {
      if (typeof b !== "string" || b !== b.toUpperCase()) {
        errors.push(`${prefix} All 'branch' elements must be uppercase strings. Invalid element found: '${b}'.`);
      } else if (!validBranches.includes(b)) {
        errors.push(`${prefix} Invalid branch: '${b}'. Must be one of: ${validBranches.join(", ")}.`);
      }
    }
  }

  if (!isMissing(metadata.semester)) {
    const semStr = String(metadata.semester);
    if (!/^\d+$/.test(semStr) || Number(metadata.semester) !== Math.floor(Number(metadata.semester))) {
      errors.push(`${prefix} 'semester' must be a whole number. Got: '${metadata.semester}'.`);
    } else {
      const semNum = parseInt(semStr, 10);
      if (semNum < minSem || semNum > maxSem) {
        errors.push(`${prefix} 'semester' must be between ${minSem} and ${maxSem}. Got: '${metadata.semester}'.`);
      }
    }
  }

  if (!isMissing(metadata.title) && String(metadata.title).trim() === "") {
    errors.push(`${prefix} 'title' must not be blank or whitespace-only.`);
  }

  try {
    const filesInDir = readdirSync(dirPath);
    const pdfFiles = filesInDir.filter(f => f.toLowerCase().endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      errors.push(`${prefix} No PDF file found in submission folder.`);
    } else if (pdfFiles.length > 1) {
      errors.push(`${prefix} Multiple PDFs found (${pdfFiles.length}). Only one PDF per folder is allowed.`);
    }

    const unexpectedFiles = filesInDir.filter(
      f => !f.toLowerCase().endsWith(".pdf") && f !== "metadata.json"
    );
    if (unexpectedFiles.length > 0) {
      errors.push(`${prefix} Unexpected files found (only metadata.json + one PDF allowed): ${unexpectedFiles.join(", ")}`);
    }
  } catch (err) {
    errors.push(`${prefix} Could not read submission directory: ${dirPath}`);
  }

  const knownKeys = ["type", "title", "subject", "branch", "semester", "year", "paperType"];
  const unknownKeys = Object.keys(metadata).filter(k => !knownKeys.includes(k));
  if (unknownKeys.length > 0) {
    errors.push(`${prefix} Unknown keys in metadata.json: ${unknownKeys.join(", ")}`);
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Please provide metadata.json file paths to validate.");
    process.exit(1);
  }

  let allErrors: string[] = [];

  for (const filePath of args) {
    const absolutePath = path.resolve(filePath);
    console.log(`Validating: ${absolutePath}`);
    const errors = validateSubmission(absolutePath);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.error(`\nValidation failed with ${allErrors.length} error(s):`);
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    console.error("Please fix the above issues and push again.");
    process.exit(1);
  } else {
    console.log("\nAll submissions passed validation.");
    process.exit(0);
  }
}