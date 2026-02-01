const { app, BrowserWindow } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Mozzaico',
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // W spakowanej aplikacji używamy app.getAppPath()
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    win.loadFile(indexPath)
  }

  win.setMenuBarVisibility(false)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
