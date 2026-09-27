'use strict'

const fs = require('fs')
const path = require('path')

// MarsDB uses fast.js at runtime. Its published benchmark bundles obsolete
// Underscore code, which is never imported by the application. Do not ship it.
const root = path.dirname(require.resolve('fast.js/package.json'))
fs.rmSync(path.join(root, 'dist', 'bench.js'), { force: true })
fs.rmSync(path.join(root, 'dist', 'bench.js.map'), { force: true })

// doublearray's browser test fixture embeds jQuery 2; runtime does not import it.
const doublearrayRoot = path.dirname(require.resolve('doublearray/package.json'))
fs.rmSync(path.join(doublearrayRoot, 'test'), { recursive: true, force: true })
