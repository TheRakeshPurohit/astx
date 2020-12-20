#!/usr/bin/env node

import launch from 'smart-restart'
import path from 'path'

launch({
  main: path.resolve(__dirname, 'runner' + path.extname(__filename)),
  commandOptions: process.argv.filter((a) => a.startsWith('--inspect')),
  command: __filename.endsWith('.ts') ? 'ts-node' : 'node',
  args: process.argv.slice(2),
  restartOnError: false,
  restartOnExit: false,
})
