import { useState, useRef } from 'react'
import './App.css'

const TILE_COUNT = 8

// Domyślne płytki (wycięte z tiles-source.jpg)
const DEFAULT_TILES = [
  '/tiles/tile-1.jpg',
  '/tiles/tile-2.jpg',
  '/tiles/tile-3.jpg',
  '/tiles/tile-4.jpg',
  '/tiles/tile-5.jpg',
  '/tiles/tile-6.jpg',
  '/tiles/tile-7.jpg',
  '/tiles/tile-8.jpg',
]

// Generuj losową siatkę
function generateRandomGrid(cols, rows) {
  return Array(rows).fill(null).map(() =>
    Array(cols).fill(null).map(() =>
      Math.floor(Math.random() * TILE_COUNT)
    )
  )
}

function App() {
  // 8 slotów na zdjęcia (null = brak zdjęcia, string = data URL)
  const [tileImages, setTileImages] = useState(Array(TILE_COUNT).fill(null))

  // Liczba płytek w kolumnie i wierszu
  const [cols, setCols] = useState(16)
  const [rows, setRows] = useState(16)

  // Siatka, każda komórka = index płytki (0-7)
  const [grid, setGrid] = useState(() => generateRandomGrid(16, 16))

  // Wielkość płytki w centymetrach (szerokość x wysokość)
  const [tileWidthCm, setTileWidthCm] = useState(10)
  const [tileHeightCm, setTileHeightCm] = useState(10)

  // Fuga - rozmiar w mm i kolor
  const [groutSizeMm, setGroutSizeMm] = useState(2)
  const [groutColor, setGroutColor] = useState('#808080')

  // Stan ładowania
  const [isExporting, setIsExporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Ref do ukrytych inputów file
  const fileInputRefs = useRef([])
  const gridRef = useRef(null)

  // Upload zdjęcia dla danego slotu
  const handleImageUpload = (index, e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const newImages = [...tileImages]
      newImages[index] = event.target.result
      setTileImages(newImages)
    }
    reader.readAsDataURL(file)
  }

  // Kliknięcie na slot w palecie = upload
  const handlePaletteClick = (index) => {
    fileInputRefs.current[index]?.click()
  }

  // Przycisk: wygeneruj nową mozaikę
  const handleGenerate = () => {
    setIsGenerating(true)
    // Timeout pozwala UI się zaktualizować przed ciężką operacją
    setTimeout(() => {
      setGrid(generateRandomGrid(cols, rows))
      setIsGenerating(false)
    }, 10)
  }

  // Eksport do JPG w pełnej rozdzielczości źródłowych obrazków
  const handleExport = async () => {
    setIsExporting(true)

    // Załaduj wszystkie obrazki płytek
    const loadImage = (src) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        console.error('Failed to load:', src?.substring(0, 50))
        resolve(null)
      }
      img.src = src
    })

    // Pobierz źródła obrazków
    const sources = Array(TILE_COUNT).fill(null).map((_, i) =>
      tileImages[i] || DEFAULT_TILES[i]
    )

    const images = await Promise.all(sources.map(loadImage))

    // Sprawdź czy wszystkie się załadowały
    const validImages = images.filter(img => img !== null)
    if (validImages.length === 0) {
      setIsExporting(false)
      alert('Nie udało się załadować obrazków')
      return
    }

    // Rozmiar pojedynczej płytki (z pierwszego załadowanego obrazka)
    let tileW = validImages[0].naturalWidth
    let tileH = validImages[0].naturalHeight

    // Maksymalny rozmiar canvasa (większość przeglądarek obsługuje ~16000px)
    const MAX_CANVAS_SIZE = 8000

    // Oblicz proporcjonalny rozmiar fugi
    const groutRatio = (groutSizeMm / 10) / tileWidthCm // fuga w stosunku do szerokości płytki

    // Oblicz potencjalny rozmiar canvasa
    let totalWidth = cols * tileW + (cols - 1) * Math.round(tileW * groutRatio)
    let totalHeight = rows * tileH + (rows - 1) * Math.round(tileH * groutRatio)

    // Skaluj w dół jeśli za duży
    const scale = Math.min(1, MAX_CANVAS_SIZE / Math.max(totalWidth, totalHeight))
    if (scale < 1) {
      tileW = Math.round(tileW * scale)
      tileH = Math.round(tileH * scale)
    }

    const groutPx = Math.round(tileW * groutRatio)

    // Stwórz canvas z fugami
    const canvas = document.createElement('canvas')
    canvas.width = cols * tileW + (cols - 1) * groutPx
    canvas.height = rows * tileH + (rows - 1) * groutPx
    const ctx = canvas.getContext('2d')

    // Wypełnij tłem (kolor fugi)
    ctx.fillStyle = groutColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Rysuj płytki z przesunięciem o fugę
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      for (let colIndex = 0; colIndex < grid[rowIndex].length; colIndex++) {
        const cell = grid[rowIndex][colIndex]
        const img = images[cell]
        if (img) {
          const x = colIndex * (tileW + groutPx)
          const y = rowIndex * (tileH + groutPx)
          ctx.drawImage(img, x, y, tileW, tileH)
        }
      }
    }

    // Pobierz jako JPG
    canvas.toBlob((blob) => {
      setIsExporting(false)
      if (!blob) {
        alert('Nie udało się wygenerować obrazu. Canvas może być za duży.')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `mozaika_${cols}x${rows}.jpg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/jpeg', 0.95)
  }

  // Prawy klik na komórkę - cyklicznie zmień na następny wzór
  const handleContextMenu = (e, row, col) => {
    e.preventDefault()
    const newGrid = grid.map(r => [...r])
    newGrid[row][col] = (grid[row][col] + 1) % TILE_COUNT
    setGrid(newGrid)
  }

  // Styl dla płytki (obrazek)
  const getTileStyle = (index) => {
    const src = tileImages[index] || DEFAULT_TILES[index]
    return {
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }

  return (
    <div className="app">
      <h2>Generator mozaiki płytek</h2>

      <div className="controls">
        <div className="control-row">
          <div className="control-group">
            <span className="group-label">Płytka</span>
            <label className="size-control">
              <input
                type="number"
                min="5"
                max="60"
                step="1"
                value={tileWidthCm}
                onChange={(e) => setTileWidthCm(Number(e.target.value))}
              />
              <span>x</span>
              <input
                type="number"
                min="5"
                max="60"
                step="1"
                value={tileHeightCm}
                onChange={(e) => setTileHeightCm(Number(e.target.value))}
              />
              cm
            </label>
          </div>

          <div className="control-group">
            <span className="group-label">Siatka</span>
            <label className="size-control">
              <input
                type="number"
                min="1"
                max="50"
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
              />
              <span>x</span>
              <input
                type="number"
                min="1"
                max="50"
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="control-group">
            <span className="group-label">Fuga</span>
            <label className="size-control">
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                value={groutSizeMm}
                onChange={(e) => setGroutSizeMm(Number(e.target.value))}
              />
              mm
              <input
                type="color"
                value={groutColor}
                onChange={(e) => setGroutColor(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="buttons">
          <button className="generate-btn" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generuję...' : 'Generuj'}
          </button>
          <button className="export-btn" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Eksportuję...' : 'Eksportuj JPG'}
          </button>
        </div>
      </div>

      <div className="palette">
        <p>Kliknij aby wgrać/zmienić zdjęcie</p>
        <div className="palette-tiles">
          {Array(TILE_COUNT).fill(null).map((_, index) => (
            <div key={index} className="palette-slot">
              <input
                type="file"
                accept="image/*"
                ref={el => fileInputRefs.current[index] = el}
                onChange={(e) => handleImageUpload(index, e)}
                style={{ display: 'none' }}
              />
              <div
                className="palette-tile"
                style={getTileStyle(index)}
                onClick={() => handlePaletteClick(index)}
              />
            </div>
          ))}
        </div>
        
      </div>

      <div className="grid-container">
              <p className="hint">
        Prawy klik na komórkę = zmień na następny wzór
      </p>
        <div
          ref={gridRef}
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${tileWidthCm * 4}px)`,
            gridTemplateRows: `repeat(${rows}, ${tileHeightCm * 4}px)`,
            gap: `${groutSizeMm}px`,
            backgroundColor: groutColor,
          }}
        >
          {grid.map((row, rowIndex) => (
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="cell"
                style={getTileStyle(cell)}
                onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
              />
            ))
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
