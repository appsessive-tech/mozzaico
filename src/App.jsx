import { useState, useRef } from 'react'
import './App.css'

const TILE_COUNT = 8

// Default tiles
const DEFAULT_TILES = [
  './tiles/tile-1.jpg',
  './tiles/tile-2.jpg',
  './tiles/tile-3.jpg',
  './tiles/tile-4.jpg',
  './tiles/tile-5.jpg',
  './tiles/tile-6.jpg',
  './tiles/tile-7.jpg',
  './tiles/tile-8.jpg',
]

// Generate random grid
function generateRandomGrid(cols, rows, noAdjacentDuplicates = false) {
  const grid = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) {
      if (noAdjacentDuplicates) {
        // Get neighbors to exclude
        const excluded = new Set()
        if (r > 0) excluded.add(grid[r - 1][c]) // top
        if (c > 0) excluded.add(row[c - 1]) // left

        // Available tiles (exclude neighbors)
        const available = []
        for (let i = 0; i < TILE_COUNT; i++) {
          if (!excluded.has(i)) available.push(i)
        }
        row.push(available[Math.floor(Math.random() * available.length)])
      } else {
        row.push(Math.floor(Math.random() * TILE_COUNT))
      }
    }
    grid.push(row)
  }
  return grid
}

function App() {
  // 8 image slots (null = no image, string = data URL)
  const [tileImages, setTileImages] = useState(Array(TILE_COUNT).fill(null))

  // Number of tiles in column and row
  const [cols, setCols] = useState(16)
  const [rows, setRows] = useState(16)

  // Grid, each cell = tile index (0-7)
  const [grid, setGrid] = useState(() => generateRandomGrid(16, 16))

  // Tile size in centimeters (width x height)
  const [tileWidthCm, setTileWidthCm] = useState(10)
  const [tileHeightCm, setTileHeightCm] = useState(10)

  // Grout - size in mm and color
  const [groutSizeMm, setGroutSizeMm] = useState(2)
  const [groutColor, setGroutColor] = useState('#808080')

  // Loading state
  const [isExporting, setIsExporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Option: no adjacent duplicates
  const [noAdjacentDuplicates, setNoAdjacentDuplicates] = useState(false)

  // Ref to hidden file inputs
  const fileInputRefs = useRef([])
  const gridRef = useRef(null)

  // Upload image for given slot
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

  // Click on palette slot = upload
  const handlePaletteClick = (index) => {
    fileInputRefs.current[index]?.click()
  }

  // Button: generate new mosaic
  const handleGenerate = () => {
    setIsGenerating(true)
    // Timeout allows UI to update before heavy operation
    setTimeout(() => {
      setGrid(generateRandomGrid(cols, rows, noAdjacentDuplicates))
      setIsGenerating(false)
    }, 10)
  }

  // Export to JPG at full source image resolution
  const handleExport = async () => {
    setIsExporting(true)

    // Load all tile images
    const loadImage = (src) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        console.error('Failed to load:', src?.substring(0, 50))
        resolve(null)
      }
      img.src = src
    })

    // Get image sources
    const sources = Array(TILE_COUNT).fill(null).map((_, i) =>
      tileImages[i] || DEFAULT_TILES[i]
    )

    const images = await Promise.all(sources.map(loadImage))

    // Check if all loaded
    const validImages = images.filter(img => img !== null)
    if (validImages.length === 0) {
      setIsExporting(false)
      alert('Failed to load images')
      return
    }

    // Single tile size (from first loaded image)
    let tileW = validImages[0].naturalWidth
    let tileH = validImages[0].naturalHeight

    // Max canvas size (most browsers support ~16000px)
    const MAX_CANVAS_SIZE = 8000

    // Calculate proportional grout size (grout relative to tile width)
    const groutRatio = (groutSizeMm / 10) / tileWidthCm

    // Calculate potential canvas size
    let totalWidth = cols * tileW + (cols - 1) * Math.round(tileW * groutRatio)
    let totalHeight = rows * tileH + (rows - 1) * Math.round(tileH * groutRatio)

    // Scale down if too large
    const scale = Math.min(1, MAX_CANVAS_SIZE / Math.max(totalWidth, totalHeight))
    if (scale < 1) {
      tileW = Math.round(tileW * scale)
      tileH = Math.round(tileH * scale)
    }

    const groutPx = Math.round(tileW * groutRatio)

    // Create canvas with grout
    const canvas = document.createElement('canvas')
    canvas.width = cols * tileW + (cols - 1) * groutPx
    canvas.height = rows * tileH + (rows - 1) * groutPx
    const ctx = canvas.getContext('2d')

    // Fill background (grout color)
    ctx.fillStyle = groutColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw tiles with grout offset
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

    // Download as JPG
    canvas.toBlob((blob) => {
      setIsExporting(false)
      if (!blob) {
        alert('Failed to generate image. Canvas may be too large.')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `mosaic_${cols}x${rows}.jpg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/jpeg', 0.95)
  }

  // Right click on cell - cycle to next pattern
  const handleContextMenu = (e, row, col) => {
    e.preventDefault()
    const newGrid = grid.map(r => [...r])

    let next = (grid[row][col] + 1) % TILE_COUNT

    if (noAdjacentDuplicates) {
      // Get neighbors to exclude
      const excluded = new Set()
      if (row > 0) excluded.add(grid[row - 1][col]) // top
      if (row < grid.length - 1) excluded.add(grid[row + 1][col]) // bottom
      if (col > 0) excluded.add(grid[row][col - 1]) // left
      if (col < grid[row].length - 1) excluded.add(grid[row][col + 1]) // right

      // Find next valid tile
      while (excluded.has(next) && next !== grid[row][col]) {
        next = (next + 1) % TILE_COUNT
      }
    }

    newGrid[row][col] = next
    setGrid(newGrid)
  }

  // Style for tile (image)
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
      <h2>Tile Mosaic Generator</h2>

      <div className="controls">
        <div className="control-row">
          <div className="control-group">
            <span className="group-label">Tile</span>
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
            <span className="group-label">Grid</span>
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
            <span className="group-label">Grout</span>
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
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <button className="export-btn" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export JPG'}
          </button>
        </div>

        <label className="checkbox-control">
          <input
            type="checkbox"
            checked={noAdjacentDuplicates}
            onChange={(e) => setNoAdjacentDuplicates(e.target.checked)}
          />
          No adjacent duplicates
        </label>
      </div>

      <div className="palette">
        <p>Click to upload/change image</p>
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
          Right-click on cell = change to next pattern
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
