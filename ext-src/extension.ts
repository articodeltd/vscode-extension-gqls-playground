import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('gqls-playground.start', () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        if (activeEditor.document.isUntitled || activeEditor.document.languageId === 'graphql') {
          let content = activeEditor.document.getText();
          const filePathFragments = activeEditor.document.fileName.split('/');
          const fileName = filePathFragments[filePathFragments.length - 1];
          ReactPanel.createOrUpdate(context.extensionPath, content, fileName);
          setInterval(() => {
            const currentContent = activeEditor.document.getText();
            if (ReactPanel.currentPanel && content !== currentContent) {
              ReactPanel.currentPanel.contentChanged(currentContent);
              content = currentContent;
            }
          }, 1000);
        }
      }
    }),
  );
}

/**
 * Manages react webview panels
 */
class ReactPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: ReactPanel | undefined;

  private static readonly viewType = 'react';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _content: string;
  private _disposables: vscode.Disposable[] = [];

  public static createOrUpdate(extensionPath: string, content: string, fileName: string) {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : undefined;

    // If we already have a panel, show it.
    // Otherwise, create a new panel.
    if (ReactPanel.currentPanel) {
      ReactPanel.currentPanel.updateAndFocus(content, column);
    } else {
      ReactPanel.currentPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One, content, fileName);
    }
  }

  private constructor(extensionPath: string, column: vscode.ViewColumn, content: string, fileName: string) {
    this._extensionPath = extensionPath;
    this._content = content;

    // Create and show a new webview panel
    this._panel = vscode.window.createWebviewPanel(ReactPanel.viewType, 'Schema Playground: ' + fileName, column, {
      // Enable javascript in the webview
      enableScripts: true,

      // And restric the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [vscode.Uri.file(path.join(this._extensionPath, 'build'))],
    });

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public updateAndFocus(content: string, column?: vscode.ViewColumn) {
    this._content = content;
    this._panel.webview.html = this._getHtmlForWebview();
    this._panel.reveal();
  }

  public contentChanged(content: string) {
    this._panel.webview.postMessage({ command: 'content-changed', content });
  }

  public doRefactor() {
    // Send a message to the webview webview.
    // You can send any JSON serializable data.
    this._panel.webview.postMessage({ command: 'refactor' });
  }

  public dispose() {
    ReactPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview() {
    const manifest = require(path.join(this._extensionPath, 'build', 'asset-manifest.json'));
    const mainScript = manifest['main.js'];
    const mainStyle = manifest['main.css'];

    const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', mainScript));
    const scriptUri = scriptPathOnDisk.with({ scheme: 'vscode-resource' });
    const stylePathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', mainStyle));
    const styleUri = stylePathOnDisk.with({ scheme: 'vscode-resource' });

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
					<meta name="theme-color" content="#000000">
					<title>React</title>
					<link rel="stylesheet" type="text/css" href="${styleUri}">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}';style-src vscode-resource: 'unsafe-inline' http: https: data:;">
					<base href="${vscode.Uri.file(path.join(this._extensionPath, 'build')).with({ scheme: 'vscode-resource' })}/">
				</head>
				
				<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				
				<script nonce="${nonce}">
					window.schemaDSL = \`${this._content}\`;
				</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
