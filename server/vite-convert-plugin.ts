import type { Plugin } from 'vite'
import { convertDocxToPdf } from './convert'

async function readBody(req: import('node:http').IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/** Dev-only POST /api/convert — body is raw DOCX bytes, response is PDF bytes. */
export function convertPlugin(): Plugin {
  return {
    name: 'apdfath-convert',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/convert') {
          next()
          return
        }
        try {
          const docx = await readBody(req)
          if (docx.byteLength < 64) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Empty or invalid DOCX body.' }))
            return
          }
          const pdf = await convertDocxToPdf(docx)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Length', String(pdf.byteLength))
          res.end(pdf)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Conversion failed.'
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}
