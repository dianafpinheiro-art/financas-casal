import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  const tmpId = Date.now() + '-' + Math.round(Math.random() * 100000)
  const tmpPath = path.join(os.tmpdir(), `fatura-${tmpId}.pdf`)
  fs.writeFileSync(tmpPath, buffer)
  
  try {
    const workerPath = path.join(process.cwd(), 'src', 'scripts', 'pdf-worker.js')
    const { stdout } = await execAsync(`node "${workerPath}" "${tmpPath}"`, {
      maxBuffer: 10 * 1024 * 1024 // 10MB max stdout
    })
    return stdout
  } catch (error) {
    console.error("Erro interno no PDF Worker:", error)
    throw new Error("Não foi possível extrair texto do PDF.")
  } finally {
    try {
      fs.unlinkSync(tmpPath)
    } catch(e) {}
  }
}
