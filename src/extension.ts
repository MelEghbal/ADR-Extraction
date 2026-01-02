import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
const markdownit = require("markdown-it")();

const dotenvResult = dotenv.config({ path: "D:/Courses/first-extension/.env" });
console.log("dotenv config result:", dotenvResult);

export async function generateADR(projectSummary: string): Promise<string> {
  const prompt = `
You are a highly experienced and meticulous **Software Architect**. Your task is to perform a **retrospective architectural analysis** on the provided project code snippets and file structure.

Based on this analysis, you will write one or more **Architecture Decision Records (ADRs)**. **Every ADR must strictly adhere to the comprehensive template and structure provided below.**

**Mandatory Analysis Focus:**
1.  **Data Persistence:** Infer the database technology, ORM, and chosen schema approach.
2.  **Inter-Service Communication:** Determine the protocol (e.g., REST, gRPC, Pub/Sub) and justification.
3.  **Application Structure:** Identify the architecture style (e.g., Layered, Hexagonal, Microservices, Monolith).
4.  **Major Technology Stack:** Justify the selection of the core programming language/framework.
5.  **Deployment/Infrastructure:** Infer the containerization strategy (Docker/Kubernetes) or serverless approach.

**ADR Generation Rules (Must be strictly followed):**
1.  **Output Format:** Generate the ADR content using **Markdown** for maximum readability.
2.  **Template Fidelity:** Use the exact headings provided in the template below.
3.  **Factual Inference:** All sections (especially 'Assumptions', 'Constraints', and 'Positions') must be inferred factually from the code evidence and current industry context, assuming a *proactive* rather than reactive decision process.
4.  **Completeness:** Do not leave any section blank. If a section is not applicable (e.g., 'Related decisions' in the first ADR), state 'N/A at this time' or infer a minimal relevant entry.
5.  **Conciseness:** Be concise and factual within each section, but ensure sufficient detail to fully satisfy the requirement of that field.

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
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not found");

    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: "You are a senior software architect." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error: ${err.message}`);
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

async function showADRInBrowser(
  adrMarkdownContent: string,
  rootPath: string,
  adrFilePath: string,
) {
  const adrFileName = `ADR-${Date.now()}`;
  const outputDir = path.join(rootPath, "docs", "adr");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // convert Markdown to HTML
  const adrBodyHtml = markdownit.render(adrMarkdownContent);

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
  const adrTitleMatch = adrMarkdownContent.match(/^# (.*)/m);
  const adrTitle = adrTitleMatch ? adrTitleMatch[1] : `ADR ${adrFileName}`;
  const fullHtmlContent = adrHtmlTemplate(adrTitle, adrBodyHtml);

  const htmlFilePath = path.join(outputDir, `${adrFileName}.html`);
  fs.writeFileSync(htmlFilePath, fullHtmlContent, "utf8");

  // open the HTML file in the external browser
  const htmlFileUri = vscode.Uri.file(htmlFilePath);
  vscode.env.openExternal(htmlFileUri).then(() => {
    vscode.window.showInformationMessage(
      "ADR HTML opened in external browser.",
    );
  });

  // shows the markdown document
  const doc = await vscode.workspace.openTextDocument(adrFilePath);
  vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}

async function evaluateADR(adrContent: string): Promise<string> {
  const evaluationPrompt = `
You are a highly critical and experienced **Chief Architect**. Your task is to evaluate the following Architecture Decision Record (ADR) against industry best practices and logical coherence.

**Evaluation Criteria (Score 0-10, where 10 is excellent):**
1. **Completeness:** Are all sections of the template fully addressed?
2. **Clarity:** Is the core decision and issue clearly and concisely stated?
3. **Logic/Justification:** Are the 'Argument' and 'Implications' logically sound and directly supported by the inferred context?
4. **Professionalism:** Is the tone appropriate and free of unnecessary fluff?

**Your Output MUST adhere to the following strict format:**

### Overall Score: [X/10]

### Detailed Critique:
- **Completeness:** [Brief summary of section completion]
- **Clarity:** [Brief summary of clarity]
- **Logic:** [Brief summary of logical coherence]
- **Suggestions for Human Improvement:** [Specific, actionable steps to make this ADR indistinguishable from a human-made one]

---
**ADR to Evaluate:**
${adrContent}
`;

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY not found in environment variables");
    }

    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content:
              "You are a senior software architect and a strict ADR reviewer.",
          },
          { role: "user", content: evaluationPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    return (
      data.choices?.[0]?.message?.content?.trim() ??
      "Evaluation failed to return content."
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `API Evaluation Error: ${error.message || "Unknown error"}`,
    );
    console.error("API Evaluation Error:", error);
    return "ERROR: Could not complete evaluation due to network or API issue.";
  }
}

function showEvaluationWindow(
  context: vscode.ExtensionContext,
  evaluationMarkdown: string,
) {
  const panel = vscode.window.createWebviewPanel(
    "adrEvaluation",
    "ADR Quality Evaluation",
    vscode.ViewColumn.One,
    {},
  );
  const evaluationHtmlBody = markdownit.render(evaluationMarkdown);
  panel.webview.html = getEvaluationWebviewContent(evaluationHtmlBody);
}

function getEvaluationWebviewContent(htmlBody: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ADR Evaluation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #8e44ad; border-bottom: 2px solid #8e44ad; padding-bottom: 5px; }
        h3 { color: #2980b9; margin-top: 1.5em; border-bottom: 1px solid #ecf0f1; padding-bottom: 0.3em; }
        .score-box { background-color: #ecf0f1; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 1.2em; border-left: 5px solid #2ecc71; }
        .score-box h3 { margin: 0; border: none; padding: 0; color: #2c3e50; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
        hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
        pre, code { background-color: #f8f8f8; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>ADR Quality Evaluation</h1>
    <div class="score-box">
        ${htmlBody}
    </div>
    <p>This evaluation was performed by a model acting as a Chief Architect.</p>
</body>
</html>
`;
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
          message: "Calling API for ADR generation...",
        });
        const adr = await generateADR(analysis);
        if (adr) {
          progress.report({ message: "ADR generated. Saving files..." });

          const adrFileName = `ADR-${Date.now()}`;
          const outputDir = path.join(rootPath, "docs", "adr");

          // output directory exists
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const adrFilePath = path.join(outputDir, `${adrFileName}.md`);
          fs.writeFileSync(adrFilePath, adr, "utf8");
          vscode.window.showInformationMessage(
            `ADR saved as Markdown: ${path.join(
              "docs",
              "adr",
              `${adrFileName}.md`,
            )}`,
          );

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
            // open the .md file in VS Code
            const doc = await vscode.workspace.openTextDocument(adrFilePath);
            vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } else if (openOption === "Open as Webpage (Styled HTML)") {
            // convert to HTML and open in external browser
            await showADRInBrowser(adr, rootPath, adrFilePath);
          }

          progress.report({
            message: "ADR generated. Now evaluating quality...",
          });

          const evaluationResult = await evaluateADR(adr);
          showEvaluationWindow(context, evaluationResult);

          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const doc = await vscode.workspace.openTextDocument(adrFilePath);
          vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } else {
          vscode.window.showErrorMessage(
            "ADR generation failed. Check the output for API errors.",
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
