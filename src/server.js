const { loadConfig } = require('./config')
const { createStore } = require('./store')
const { createApp } = require('./app')

async function main () {
  const config = loadConfig()
  const store = await createStore({ uri: config.mongoUri, dbName: config.mongoDb })
  const server = createApp({ store, config }).listen(config.port, () => {
    console.log(`pr-canvas-server listening on :${config.port} (db ${config.mongoDb})`)
  })

  function stop () {
    server.close(() => store.close().then(() => process.exit(0)))
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
