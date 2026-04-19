import http from 'http';
import { exec } from 'child_process';

const PORT = 3001;

const runCommand = (cmd) => {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return resolve({ success: false, error: error.message, stderr });
      }
      resolve({ success: true, stdout });
    });
  });
};

const getMediaCommand = async (action) => {
  const hasPlayerctl = (await runCommand('playerctl --version')).success;

  if (hasPlayerctl) {
    switch (action) {
      case 'play-pause': return 'playerctl play-pause';
      case 'next': return 'playerctl next';
      case 'prev': return 'playerctl previous';
      case 'play': return 'playerctl play';
      case 'pause': return 'playerctl pause';
      case 'volume-up': return 'playerctl volume 0.05+';
      case 'volume-down': return 'playerctl volume 0.05-';
      case 'master-volume-up': return 'amixer sset Master 5%+';
      case 'master-volume-down': return 'amixer sset Master 5%-';
    }
  }

  const dbusBase = 'dbus-send --print-reply --dest=org.mpris.MediaPlayer2.Player /org/mpris/MediaPlayer2';
  const dbusInterface = 'org.mpris.MediaPlayer2.Player';
  const dbusPropBase = 'dbus-send --print-reply --dest=org.mpris.MediaPlayer2.Player /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties';
  
  switch (action) {
    case 'play-pause': return `${dbusBase} ${dbusInterface}.PlayPause`;
    case 'next': return `${dbusBase} ${dbusInterface}.Next`;
    case 'prev': return `${dbusBase} ${dbusInterface}.Previous`;
    case 'play': return `${dbusBase} ${dbusInterface}.Play`;
    case 'pause': return `${dbusBase} ${dbusInterface}.Pause`;
    case 'volume-up': return `${dbusPropBase}.Set string:org.mpris.MediaPlayer2.Player string:Volume variant:double:0.1`;
    case 'volume-down': return `${dbusPropBase}.Set string:org.mpris.MediaPlayer2.Player string:Volume variant:double:-0.1`;
    case 'master-volume-up': return 'amixer sset Master 5%+';
    case 'master-volume-down': return 'amixer sset Master 5%-';
  }
  return null;
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const action = url.pathname.slice(1);
  
  if (action) {
    const cmd = await getMediaCommand(action);
    if (!cmd) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Unknown action' }));
      return;
    }

    const result = await runCommand(cmd);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: result.success ? 'success' : 'warning', 
      action, 
      message: result.success ? 'Command executed' : 'No active media player found (Open Spotify/VLC/YouTube)',
      details: result.error 
    }));

    if (!result.success) {
      console.log(`[Aura Bridge] ${action} - Warning: No active player found.`);
    } else {
      console.log(`[Aura Bridge] ${action} - Success`);
    }
  } else {
    res.writeHead(200);
    res.end('Aura Bridge is Online');
  }
});

server.listen(PORT, () => {
  console.log(`\x1b[36m%s\x1b[0m`, `-----------------------------------------`);
  console.log(`\x1b[36m%s\x1b[0m`, ` Aura System Bridge Active on port ${PORT}`);
  console.log(`\x1b[33m%s\x1b[0m`, ` TIP: Open a music player (Spotify, VLC, or`);
  console.log(`\x1b[33m%s\x1b[0m`, ` YouTube in a tab) for this to control it.`);
  console.log(`\x1b[36m%s\x1b[0m`, `-----------------------------------------`);
});
