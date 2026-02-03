import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

const dotenvResult = dotenv.config({ path: "D:/Courses/first-extension/.env" });
console.log("dotenv config result:", dotenvResult);

export async function generateADR(
  projectSummary: string,
  decisionIndex: number,
): Promise<string> {
  const prompt = `
    You are a senior software architect. Based on the following project summary, generate ONE Architecture Decision Record (ADR) in the exact template format described below. The ADR must strictly follow the Just the Docs Jekyll template (with frontmatter and all sections exactly as shown). Do NOT include anything outside the specified template.

    Template:

        ---
      # These are optional metadata elements. Feel free to remove any of them.
      status: "{proposed | rejected | accepted | deprecated}"
      date: {YYYY-MM-DD when the decision was last updated}
      ---

      # {short title, representative of solved problem and found solution}

      ## Context and Problem Statement

      {Describe the context and problem statement, e.g., in free form using two to three sentences or in the form of an illustrative story. You may want to articulate the problem in form of a question and add links to collaboration boards or issue management systems.}

      <!-- This is an optional element. Feel free to remove. -->
      ## Decision Drivers

      * {decision driver 1, e.g., a force, facing concern, …}
      * {decision driver 2, e.g., a force, facing concern, …}
      * … <!-- numbers of drivers can vary -->

      ## Considered Options

      * {title of option 1}
      * {title of option 2}
      * {title of option 3}
      * … <!-- numbers of options can vary -->

      ## Decision Outcome

      Chosen option: "{title of option 1}", because {justification. e.g., only option, which meets k.o. criterion decision driver | which resolves force {force} | … | comes out best (see below)}.

      <!-- This is an optional element. Feel free to remove. -->
      ### Consequences

      * Good, because {positive consequence, e.g., improvement of one or more desired qualities, …}
      * Bad, because {negative consequence, e.g., compromising one or more desired qualities, …}
      * … <!-- numbers of consequences can vary -->

      <!-- This is an optional element. Feel free to remove. -->
      ### Confirmation

      {Describe how the implementation / compliance of the ADR can/will be confirmed. Is there any automated or manual fitness function? If so, list it and explain how it is applied. Is the chosen design and its implementation in line with the decision? E.g., a design/code review or a test with a library such as ArchUnit can help validate this. Note that although we classify this element as optional, it is included in many ADRs.}

      <!-- This is an optional element. Feel free to remove. -->
      ## Pros and Cons of the Options

      ### {title of option 1}

      <!-- This is an optional element. Feel free to remove. -->
      {example | description | pointer to more information | …}

      * Good, because {argument a}
      * Good, because {argument b}
      <!-- use "neutral" if the given argument weights neither for good nor bad -->
      * Neutral, because {argument c}
      * Bad, because {argument d}
      * … <!-- numbers of pros and cons can vary -->

      ### {title of other option}

      {example | description | pointer to more information | …}

      * Good, because {argument a}
      * Good, because {argument b}
      * Neutral, because {argument c}
      * Bad, because {argument d}
      * …

      <!-- This is an optional element. Feel free to remove. -->
      ## More Information

      {You might want to provide additional evidence/confidence for the decision outcome here and/or document the team agreement on the decision and/or define when/how this decision the decision should be realized and if/when it should be re-visited. Links to other decisions and resources might appear here as well.}

    Now generate the ADR only. Do not produce commentary.

    Project summary:
    ${projectSummary}
    `;

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API key missing.");

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
        // max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    console.error("ADR generation error:", err);
    vscode.window.showErrorMessage(`ADR generation failed: ${err.message}`);
    return "";
  }
}

function summarizeForDecisions(chunks: string[]): string {
  const importantFiles = chunks.filter(
    (c) =>
      c.includes("package.json") ||
      c.includes("Dockerfile") ||
      c.includes("index.ts") ||
      c.includes("main.ts") ||
      c.includes("app.ts"),
  );

  return importantFiles.slice(0, 5).join("\n\n");
}

async function extractTopDecisions(projectSummary: string): Promise<string[]> {
  const prompt = `
      You are a senior software architect.

      From the following project description, identify the
      TOP 5 most important ARCHITECTURAL decisions that should
      be documented as ADRs.

      Rules:
      - Focus only on architectural decisions (not coding style)
      - Each item must be a short title
      - Return a numbered list
      - Do NOT include explanations

      Project:
      ${projectSummary}
    `;

  const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  const data: any = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  const raw = text
    .split("\n")
    .map((l: any) => l.trim())
    .filter(Boolean);

  const decisions = raw.map((line: any) =>
    line
      .replace(/^\d+[\.\)]\s*/, "")
      .replace(/^[-•]\s*/, "")
      .replace(/^Decision:\s*/i, "")
      .trim(),
  );

  return decisions.slice(0, 5);
}

async function analyzeProject(rootPath: string): Promise<string[]> {
  let summaries: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name === "package.json"
      ) {
        const content = fs.readFileSync(fullPath, "utf-8");
        summaries.push(
          `### File: ${path.relative(rootPath, fullPath)}\n${content}`,
        );
      }
    }
  }

  walk(rootPath);
  return summaries;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "first-extension.selectFolder",
    async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No folder open!");
        return;
      }

      const rootPath = folders[0].uri.fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "ADR Generator",
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: "Analyzing project files..." });

            const analysisChunks = await analyzeProject(rootPath);

            if (analysisChunks.length === 0) {
              vscode.window.showWarningMessage(
                "No source files found to analyze.",
              );
              return;
            }

            const projectSummary = summarizeForDecisions(analysisChunks);

            progress.report({
              message: "Identifying key architectural decisions...",
            });

            const decisions = await extractTopDecisions(projectSummary);

            if (decisions.length === 0) {
              vscode.window.showWarningMessage(
                "No architectural decisions detected.",
              );
              return;
            }

            const outputDir = path.join(rootPath, "docs", "decisions");
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }

            for (let i = 0; i < decisions.length; i++) {
              const decisionTitle = decisions[i];

              progress.report({
                message: `Generating ADR ${i + 1}/${
                  decisions.length
                }: ${decisionTitle}`,
              });

              const adrMarkdown = await generateADR(
                `
                    Decision to document:
                    ${decisionTitle}

                    Project context:
                    ${projectSummary}
                  `.trim(),
                i,
              );

              if (!adrMarkdown || adrMarkdown.length < 300) {
                console.warn(`ADR ${i + 1} skipped (empty or too short).`);
                continue;
              }

              const adrFileName = `ADR-${String(i + 1).padStart(3, "0")}.md`;
              const adrFilePath = path.join(outputDir, adrFileName);

              fs.writeFileSync(adrFilePath, adrMarkdown, "utf8");

              // markdown preview
              const doc = await vscode.workspace.openTextDocument(adrFilePath);

              fs.writeFileSync(adrFilePath, adrMarkdown, "utf8");

              const uri = vscode.Uri.file(adrFilePath);

              await vscode.commands.executeCommand("markdown.showPreview", uri);

              await new Promise((resolve) => setTimeout(resolve, 4000));
            }

            vscode.window.showInformationMessage(
              `ADR generation completed (${decisions.length} ADRs created).`,
            );
          } catch (error: any) {
            console.error("ADR generation workflow failed:", error);
            vscode.window.showErrorMessage(
              `ADR generation failed: ${error.message || "Unknown error"}`,
            );
          }
        },
      );
    },
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
