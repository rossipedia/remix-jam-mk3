import * as fs from 'node:fs'
import * as path from 'node:path'
import { Readable } from 'node:stream'

export function serveJavaScript(request: Request): Response | null {
  let url = new URL(request.url)
  let filepath = path.join(import.meta.dirname, '..', url.pathname.slice(1))
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    return null
  }

  let fileStream = Readable.toWeb(fs.createReadStream(filepath))
  // @ts-expect-error need newer node types?
  let gzipStream = fileStream.pipeThrough(new CompressionStream('gzip'))
  // @ts-expect-error need newer node types?
  return new Response(gzipStream, {
    headers: {
      'Content-Type': 'application/javascript',
      'Content-Encoding': 'gzip',
      Vary: 'Accept-Encoding',
      'Cache-Control': 'no-store, must-revalidate',
    },
  })
}
