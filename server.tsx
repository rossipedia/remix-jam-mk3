import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { serveJavaScript } from './lib/serve-js'

async function handleRequest(request: Request) {
  let jsResponse = serveJavaScript(request)
  if (jsResponse) return jsResponse

  let html = `
    <html>
      <head>
        <title>Remix Jam</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet">
      </head>
      <style>
        body { font-family: 'Inter', sans-serif; background: #000; }
      </style>
      <body>
        <script async type="module" src="/dist/app.js"></script>
      </body>
    </html>
  `

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

let server = http.createServer(createRequestListener(handleRequest))

server.listen(44100, () => {
  console.log('Server is running on http://localhost:44100')
})
