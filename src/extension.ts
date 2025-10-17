import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
const markdownit = require("markdown-it")();

dotenv.config();

export async function generateADR(projectSummary: string): Promise<string> {
  const prompt = `
You are a highly experienced and meticulous **Software Architect**. Your task is to perform a **retrospective architectural analysis** on the provided project code snippets and file structure.

Based on this analysis, you will write one or more **Architecture Decision Records (ADRs)**. **Every ADR must strictly adhere to the comprehensive template and structure provided below.**

**Mandatory Analysis Focus:**
1.  **Data Persistence:** Infer the database technology, ORM, and chosen schema approach.
2.  **Inter-Service Communication:** Determine the protocol (e.g., REST, gRPC, Pub/Sub) and justification.
3.  **Application Structure:** Identify the architecture style (e.g., Layered, Hexagonal, Microservices, Monolith).
4.  **Major Technology Stack:** Justify the selection of the core programming language/framework.
5.  **Deployment/Infrastructure:** Infer the containerization strategy (Docker/Kubernetes) or serverless approach.

**ADR Generation Rules (Must be strictly followed):**
1.  **Output Format:** Generate the ADR content using **Markdown** for maximum readability.
2.  **Template Fidelity:** Use the exact headings provided in the template below.
3.  **Factual Inference:** All sections (especially 'Assumptions', 'Constraints', and 'Positions') must be inferred factually from the code evidence and current industry context, assuming a *proactive* rather than reactive decision process.
4.  **Completeness:** Do not leave any section blank. If a section is not applicable (e.g., 'Related decisions' in the first ADR), state 'N/A at this time' or infer a minimal relevant entry.
5.  **Conciseness:** Be concise and factual within each section, but ensure sufficient detail to fully satisfy the requirement of that field.

**Comprehensive ADR Template (Use these exact headings and structure):**

# [ADR-XXX] Title of Architectural Decision

* **Issue:** Describe the architectural design issue being addressed, leaving no questions about why this issue is being addressed now. Focus only on issues that require documentation at this lifecycle point.
* **Decision:** Clearly state the selected architectural direction or position.
* **Status:** (For this retrospective analysis, always use 'Decided').
* **Group:** Use a simple grouping like **Integration**, **Presentation**, **Data**, **Security**, or **Deployment**.
* **Assumptions:** Clearly describe the underlying environmental assumptions (cost, schedule, existing technology standards, enterprise architecture) that influenced the decision.
* **Constraints:** Capture any additional constraints to the environment that the **chosen decision** might pose.
* **Positions:** List the viable options or alternatives that were considered. Provide brief explanations of each.
* **Argument:** Outline the comprehensive justification for selecting the chosen position, including factors like implementation cost, total ownership cost, time to market, and resource availability.
* **Implications:** Detail the consequences of the decision. This includes new requirements, required staff training, new scope/schedule items, or the need for other related decisions.
* **Related Decisions:** List any other ADRs or decisions this one depends on or influences.
* **Related Requirements:** Explicitly map this decision to the business objectives or requirements it helps fulfill.
* **Related Artifacts:** List architecture, design, or scope documents impacted by this decision.
* **Related Principles:** State which enterprise or project principles (e.g., "Favor COTS over build," "Maximize Observability") this decision aligns with.
* **Notes:** Capture any ancillary discussion points or issues the team discussed during the decision process.
    
${projectSummary}

Respond only with the ADR in markdown format.
`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3",
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();

    if (data.response) {
      return data.response.trim();
    } else {
      throw new Error("Invalid response format from Ollama");
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Ollama LLaMA 3 Error: ${error.message || "Unknown error"}`,
    );
    console.error("Ollama LLaMA 3 Error:", error);
    return "";
  }
}

async function analyzeProject(rootPath: string): Promise<string> {
  let summary = "";

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (summary.length > 8000) {
        break;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".tsx") || entry.name === "package.json") {
        const content = fs.readFileSync(fullPath, "utf-8");
        summary += `\n### File: ${path.relative(
          rootPath,
          fullPath,
        )}\n${content.slice(0, 20000)}\n`;
      }
    }
  }
  walk(rootPath);
  return summary;
}

async function showADRInBrowser(adrMarkdownContent: string, rootPath: string) {
  const adrFileName = `ADR-${Date.now()}`;
  const outputDir = path.join(rootPath, "docs", "adr");

  // 1. Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 2. Save the original .md file
  const adrFilePath = path.join(outputDir, `${adrFileName}.md`);
  fs.writeFileSync(adrFilePath, adrMarkdownContent, "utf8");
  vscode.window.showInformationMessage(
    `ADR saved to: ${path.join("docs", "adr", `${adrFileName}.md`)}`,
  );

  // 3. Convert Markdown to HTML with clean styling
  const adrBodyHtml = markdownit.render(adrMarkdownContent);

  // Basic, clean CSS style for ADR display
  const adrHtmlTemplate = (title: string, bodyHtml: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; }
        h1, h2, h3, h4 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 0.3em; margin-top: 1.5em; }
        h1:first-child { border-bottom: 2px solid #3498db; }
        code { background-color: #eee; padding: 2px 4px; border-radius: 4px; font-size: 0.9em; }
        pre { background-color: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
        blockquote { border-left: 4px solid #3498db; padding-left: 15px; color: #7f8c8d; margin: 1em 0; background-color: #ecf0f1; padding-top: 5px; padding-bottom: 5px; }
        ul, ol { padding-left: 20px; }
    </style>
</head>
<body>
    ${bodyHtml}
</body>
</html>
`;
  // Extract the main title from the ADR to use in the HTML <title>
  const adrTitleMatch = adrMarkdownContent.match(/^# (.*)/m);
  const adrTitle = adrTitleMatch ? adrTitleMatch[1] : `ADR ${adrFileName}`;
  const fullHtmlContent = adrHtmlTemplate(adrTitle, adrBodyHtml);

  // 4. Save the generated .html file
  const htmlFilePath = path.join(outputDir, `${adrFileName}.html`);
  fs.writeFileSync(htmlFilePath, fullHtmlContent, "utf8");

  // 5. Open the HTML file in the external browser
  const htmlFileUri = vscode.Uri.file(htmlFilePath);
  vscode.env.openExternal(htmlFileUri).then(() => {
    vscode.window.showInformationMessage(
      "ADR HTML opened in external browser.",
    );
  });

  // Also show the markdown document in VS Code for easy editing
  const doc = await vscode.workspace.openTextDocument(adrFilePath);
  vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand("first-extension.selectFolder", async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage("No folder is open!");
      return;
    }

    const rootPath = folders[0].uri.fsPath;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating ADR...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Analyzing project files..." });
        const analysis = await analyzeProject(rootPath);

        progress.report({
          message: "Calling Ollama LLaMA 3 for ADR generation...",
        });
        const adr = await generateADR(analysis);
        if (adr) {
          progress.report({ message: "ADR generated. Saving files..." });

          const adrFileName = `ADR-${Date.now()}`;
          const outputDir = path.join(rootPath, "docs", "adr");

          // 1. Ensure output directory exists
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          // 2. Save the original .md file
          const adrFilePath = path.join(outputDir, `${adrFileName}.md`);
          fs.writeFileSync(adrFilePath, adr, "utf8");
          vscode.window.showInformationMessage(
            `ADR saved as Markdown: ${path.join(
              "docs",
              "adr",
              `${adrFileName}.md`,
            )}`,
          );

          // 3. Prompt user for action
          const openOption = await vscode.window.showQuickPick(
            [
              "Open as Webpage (Styled HTML)",
              "Open as Markdown File (for editing)",
              "Do nothing",
            ],
            {
              title: "How would you like to view the generated ADR?",
              placeHolder: "Select your preferred view.",
            },
          );

          if (openOption === "Open as Markdown File (for editing)") {
            // Open the .md file in VS Code
            const doc = await vscode.workspace.openTextDocument(adrFilePath);
            vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } else if (openOption === "Open as Webpage (Styled HTML)") {
            // Convert to HTML and open in external browser
            await showADRInBrowser(adr, rootPath);
          }
        } else {
          vscode.window.showErrorMessage(
            "ADR generation failed. Check the output for LLaMA 3 errors.",
          );
        }
      },
    );
  });

  const disposable = vscode.commands.registerCommand(
    "first-extension.first-extension-command",
    () => {
      vscode.window.showInformationMessage("Hello World from first-extension!");
    },
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
