export function setupPage(missing: string[]) {
  const rows = missing.map((key) => `<code>${key}=…</code>`).join("<br>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set up sign-in - Kanban</title>
<style>
:root{color-scheme:light dark;--bg:#fafafa;--card:#fff;--fg:#121212;--muted:#757575;--border:#ededed}
@media (prefers-color-scheme:dark){:root{--bg:#0c0c0c;--card:#181818;--fg:#ededed;--muted:#a0a0a0;--border:#262626}}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:500 14px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.02em}
main{width:min(440px,calc(100% - 32px));background:var(--card);border-radius:16px;box-shadow:0 0 0 1px var(--border),0 12px 32px rgb(0 0 0/.08);padding:24px}
h1{font-size:16px;margin:0 0 6px}p{color:var(--muted);margin:0 0 16px}code{font:12px ui-monospace,monospace;background:var(--bg);box-shadow:0 0 0 1px var(--border);border-radius:6px;padding:2px 6px;line-height:2.2}
ol{color:var(--muted);padding-left:18px;margin:16px 0 0}a{color:inherit}
</style></head><body><main>
<h1>Sign-in isn't configured yet</h1>
<p>Add your Clerk keys to <code>frontend/.env</code>, then restart the dev server.</p>
${rows}
<ol>
<li>Create an app at <a href="https://dashboard.clerk.com">dashboard.clerk.com</a>.</li>
<li>Under <b>SSO connections</b>, enable Google and turn off email, phone and username sign-in.</li>
<li>Copy the publishable and secret keys into <code>frontend/.env</code> and the secret key into <code>backend/.env</code>.</li>
</ol>
</main></body></html>`;
}
