import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

async function splitTiles() {
  const inputPath = join(rootDir, 'public/tiles-source.jpg')
  const outputDir = join(rootDir, 'public/tiles')

  await mkdir(outputDir, { recursive: true })

  const image = sharp(inputPath)
  const metadata = await image.metadata()

  const cols = 4
  const rows = 2  // bierzemy tylko górne 2 rzędy (8 płytek z 12)
  const tileW = Math.floor(metadata.width / cols)
  const tileH = Math.floor(metadata.height / 3)  // dzielimy przez 3 bo zdjęcie ma 3 rzędy

  console.log(`Image: ${metadata.width}x${metadata.height}`)
  console.log(`Tile size: ${tileW}x${tileH}`)

  let index = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const outputPath = join(outputDir, `tile-${index + 1}.jpg`)

      await sharp(inputPath)
        .extract({
          left: col * tileW,
          top: row * tileH,
          width: tileW,
          height: tileH
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath)

      console.log(`Created: tile-${index + 1}.jpg`)
      index++
    }
  }

  console.log('Done! 8 tiles created in public/tiles/')
}

splitTiles().catch(console.error)
