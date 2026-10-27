import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Prefer a repo-local work dir — Docker Desktop on macOS often cannot mount os.tmpdir() (/var/folders). */
const WORK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.tmp')

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exit ${code ?? 'unknown'}`)),
    )
  })
}

function missingCommand(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT')
}

async function convertWithDocker(dir: string, image: string): Promise<void> {
  const mount = dir.replace(/\\/g, '/')
  await run('docker', [
    'run',
    '--rm',
    '--entrypoint',
    'soffice',
    '-v',
    `${mount}:/work`,
    image,
    '--headless',
    '--norestore',
    '-env:UserInstallation=file:///tmp/lo-profile',
    '--convert-to',
    'pdf',
    '--outdir',
    '/work',
    '/work/in.docx',
  ])
}

/** Print-faithful DOCX→PDF for the Open dialog. */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  await mkdir(WORK_ROOT, { recursive: true })
  const dir = path.join(WORK_ROOT, `docx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  await mkdir(dir, { recursive: true })
  const input = path.join(dir, 'in.docx')
  const output = path.join(dir, 'in.pdf')
  await writeFile(input, docx)
  try {
    try {
      await run('soffice', ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, input])
    } catch (error) {
      if (!missingCommand(error)) throw error
      const images = ['leasegen-app', 'linuxserver/libreoffice:latest']
      let last: unknown = error
      for (const image of images) {
        try {
          await convertWithDocker(dir, image)
          last = null
          break
        } catch (dockerError) {
          last = dockerError
        }
      }
      if (last) {
        const detail = last instanceof Error ? last.message : 'Docker LibreOffice failed.'
        throw new Error(`PDF conversion unavailable (${detail}).`)
      }
    }
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
