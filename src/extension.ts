import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
// import { OpenAI } from "openai";
import * as dotenv from "dotenv";

dotenv.config();

// const openai = new OpenAI({
//   apiKey:
//     "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",
// });

export async function generateADR(projectSummary: string): Promise<string> {
  const prompt = `
You are a software architect. Based on the following project code snippets and structure, write a concise Architecture Decision Record (ADR) documenting the major design decisions made in the codebase.

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
  //   try {
  //     const chatCompletion = await openai.chat.completions.create({
  //       model: "gpt-3.5-turbo",
  //       messages: [{ role: "user", content: prompt }],
  //       temperature: 0.2,
  //     });

  //     return chatCompletion.choices[0].message.content || "";
  //   } catch (error: any) {
  //     vscode.window.showErrorMessage(
  //       `OpenAI Error: ${error.message || "Unknown error"}`,
  //     );
  //     console.error("OpenAI Error:", error);
  //     return "";
  //   }
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
        )}\n${content.slice(0, 300)}\n`;
      }
    }
  }
  walk(rootPath);
  return summary;
}

async function showADR(adr: string) {
  const doc = await vscode.workspace.openTextDocument({
    content: adr,
    language: "markdown",
  });
  vscode.window.showTextDocument(doc);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand("first-extension.selectFolder", async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage("No folder is open!");
      return;
    }

    const rootPath = folders[0].uri.fsPath;
    vscode.window.showErrorMessage(`Analyzing project at ${rootPath}`);

    // const analysis = await analyzeProject(rootPath);
    // const adr = await generateADR(analysis);
    // await showADR(adr);

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating ADR...",
        cancellable: false,
      },
      async (progress) => {
        const analysis = await analyzeProject(rootPath);
        const adr = await generateADR(analysis);
        await showADR(adr);
      },
    );
  });

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "first-extension" is now active!',
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "first-extension.first-extension-command",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from first-extension!");
    },
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
