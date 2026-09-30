const { renderAll } = require('@coldtea/pr-lens-renderer')
const { parseGraphDoc } = require('@coldtea/pr-lens-schema')

// A node drawn in the retired-path view but absent from the new-batch-path view.
function foreignNode (rawDoc) {
  const atlases = {}
  for (const rendered of renderAll(parseGraphDoc(rawDoc)).assets) {
    if (rendered.asset.theme === 'light') atlases[rendered.asset.view] = rendered.atlas
  }
  const id = Object.keys(atlases['retired-path'].nodes).find((node) => !atlases['new-batch-path'].nodes[node])
  if (!id) throw new Error('fixture has no node exclusive to retired-path')
  return id
}

module.exports = { foreignNode }
