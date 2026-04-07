import { readFileSync, existsSync, rmSync, readdirSync } from "fs";
import * as path from "path";
import { validateSubmission } from "./validate-submissions.js";

const apiUrl = process.env.API_BASE_URL;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

const SUBMISSIONS_ROOT = path.resolve(process.env.SUBMISSIONS_ROOT ?? "./submissions");

if (!apiUrl || !adminUsername || !adminPassword) {
  console.error(
    "Missing API_BASE_URL, ADMIN_USERNAME, or ADMIN_PASSWORD environment variables!",
  );
  process.exit(1);
}

async function main() {
  const metadataPath = process.argv[2];
  if (!metadataPath) {
    console.error("Please provide the path to the metadata.json file.");
    process.exit(1);
  }

  const absoluteMetadataPath = path.resolve(metadataPath);
  if (!existsSync(absoluteMetadataPath)) {
    console.error(`Metadata file not found: ${absoluteMetadataPath}`);
    process.exit(1);
  }

  const dirPath = path.dirname(absoluteMetadataPath);

  const resolvedDir = path.resolve(dirPath);
  if (!resolvedDir.startsWith(SUBMISSIONS_ROOT + path.sep) && resolvedDir !== SUBMISSIONS_ROOT) {
    console.error(
      `Submission directory '${resolvedDir}' is outside the allowed submissions root '${SUBMISSIONS_ROOT}'. Aborting.`,
    );
    process.exit(1);
  }

  console.log(`Processing submission in: ${dirPath}`);

  let metadata: any;
  try {
    metadata = JSON.parse(readFileSync(absoluteMetadataPath, "utf8"));
  } catch (error) {
    console.error("Failed to parse metadata.json:", error);
    process.exit(1);
  }

  const validationErrors = validateSubmission(absoluteMetadataPath);
  if (validationErrors.length > 0) {
    console.error("Validation failed prior to publishing:");
    for (const err of validationErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const categoryName = metadata.type.toLowerCase();

  const filesInDir = readdirSync(dirPath);
  const pdfFileName = filesInDir.find((f) => f.toLowerCase().endsWith(".pdf"));

  if (!pdfFileName) {
    console.error("No PDF file found in the submission directory.");
    process.exit(1);
  }

  const pdfFilePath = path.join(dirPath, pdfFileName);

  try {
    console.log(`Authenticating as ${adminUsername}...`);

    const baseUrl = (apiUrl as string).replace(/\/$/, "");

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminUsername,
        password: adminPassword,
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
    }

    const setCookieHeader = loginRes.headers.get("set-cookie");
    if (!setCookieHeader) {
      throw new Error("No set-cookie header returned from login");
    }

    const authCookie = setCookieHeader.split(";")[0];

    console.log(`Preparing upload for ${pdfFileName}...`);

    const form = new FormData();
    form.append("title", metadata.title);
    form.append("branch", JSON.stringify(metadata.branch));
    form.append("semester", String(metadata.semester));
    form.append("category", categoryName);

    if (metadata.subject) {
      form.append("subject", metadata.subject);
    }


    if (categoryName === "papers") {
      form.append("type", metadata.paperType);
      form.append("year", String(metadata.year));
    }

    const fileBuffer = readFileSync(pdfFilePath);
    const blob = new Blob([fileBuffer], { type: "application/pdf" });
    form.append("file", blob, pdfFileName);

    console.log(`Uploading to ${baseUrl}/api/admin/upload...`);
    const uploadRes = await fetch(`${baseUrl}/api/admin/upload`, {
      method: "POST",
      headers: {
        Cookie: authCookie,
      },
      body: form,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
    }

    const jsonRes = await uploadRes.json();
    console.log(`Successfully uploaded and created record ID:`, jsonRes._id);

    console.log(`Cleaning up submission directory: ${dirPath}...`);
    rmSync(dirPath, { recursive: true, force: true });
    console.log(`Cleaned up ${dirPath}.`);
  } catch (error) {
    console.error("Failed to process submission:", error);
    process.exit(1);
  }
}

main();