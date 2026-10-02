Steps

1. Edit the same document, .pr-lens/graph.json (or .pr-lens/redesign-graph.json for the redesign diagram). Keep the title exactly the same. The title decides which canvas it belongs to.
2. Validate: npx @coldtea/pr-lens-cli@latest validate <file>
3. Render: npx @coldtea/pr-lens-cli@latest render <file> --theme light
4. Push the drawing the render prints:
   npx @coldtea/pr-lens-cli@latest canvas push .pr-lens/<drawing>/drawn.graph.json --api http://localhost:3000

The link stays the same. The server stores the push as the next version (rev 2, 3, and so on), and it becomes the latest.

Before this works on :3000
- The running server must be the new code. Run npm run build:web and restart node src/server.js.
- Your existing canvases only have their current version, because earlier pushes were overwritten before we added history. Versions start accumulating from their next push.

Seeing the versions
- Open the canvas link. Once it has more than one version, a version picker appears in the header. It defaults to the latest, and you can pick an older one.
- Click Diff to see what changed against the previous version, or use "Compare with" to diff against any other version.
- The library card shows "N versions".

A different title starts a separate canvas, not a new version. If you want the two to be versions of one diagram, keep the title the same.

Ask anything

Set `OPEN_AI_API_KEY`, `OPEN_AI_MODEL`, and `OPEN_AI_BASEURL` (all three required) to enable the Ask anything toolbar button. It streams LLM answers about the canvas.

Optional limits (env vars, defaults shown):
- `ASK_RATE_LIMIT=10` (questions per minute per IP)
- `ASK_DAILY_CAP=500` (total questions across all users per day)

The toolbar button is disabled when these vars are unset.