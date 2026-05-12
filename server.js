import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { exec } from 'child_process';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

app.use(cors());
app.use(express.json());

// Serve the emulator frontend
app.use(express.static(__dirname));


let watcher = null;
let devApp = null;
let devServer = null;

app.post('/api/serve-directory', (req, res) => {
  const { directory } = req.body;

  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  const absolutePath = path.resolve(directory);

  // Stop previous server and watcher if they exist
  if (devServer) {
    devServer.close();
  }
  if (watcher) {
    watcher.close();
  }

  // Start new static server for the directory on port 8081
  devApp = express();
  devApp.use(cors());
  devApp.use(express.static(absolutePath));
  
  devServer = devApp.listen(8081, () => {
    console.log(`Serving directory ${absolutePath} on http://localhost:8081`);
    
    // Start watching the directory
    watcher = chokidar.watch(absolutePath, {
      ignored: (path) => {
        return path.includes('node_modules') || 
               path.includes('.git') || 
               path.includes('dist') || 
               path.includes('build') ||
               /(^|[\/\\])\../.test(path);
      },
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
      console.log(`File changed: ${filePath}`);
      io.emit('reload');
    });

    res.json({ url: 'http://localhost:8081' });
  });
});

app.post('/api/proxy', async (req, res) => {
  const { url, method = 'GET', headers = {}, body = null } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios({
      url,
      method,
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      data: body,
      responseType: 'text',
      validateStatus: () => true, // Don't throw on error status codes
    });

    let html = response.data;

    // Inject <base> tag to handle relative assets if it's HTML
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      const baseTag = `<base href="${url}">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<html>')) {
        html = html.replace('<html>', `<html><head>${baseTag}</head>`);
      } else {
        html = baseTag + html;
      }
    }

    res.status(response.status).send(html);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Screen Emulator running at http://localhost:${PORT}`);
});
