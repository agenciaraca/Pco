// pm2 process manager da app AVA PCO em produção (VPS).
//
// Roda o servidor Hono via tsx em PROCESSO ÚNICO (`node --import tsx`), em vez
// do CLI `tsx` que forka um processo-filho — o fork deixaria um órfão segurando
// a porta 3035 no restart (EADDRINUSE). Com processo único o pm2 supervisiona o
// listener real e o restart é limpo.
//
// Env (PORT, SERVE_STATIC, HOST, DATABASE_URL, segredos) vem do `.env`, carregado
// pelo próprio `server/dev.ts` via `import 'dotenv/config'` — por isso não há
// bloco `env` aqui.
//
// Uso no VPS:
//   cd ~/ava-pco && pm2 start ecosystem.config.cjs && pm2 save
//   Boot: cron `@reboot ... pm2 resurrect` (pm2 startup precisaria de sudo).
//   Restart manual: pm2 restart ava-pco   |   Logs: pm2 logs ava-pco

const { join } = require('node:path');

module.exports = {
  apps: [
    {
      name: 'ava-pco',
      script: 'server/dev.ts',
      interpreter: 'node',
      node_args: '--import tsx',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 15,
      restart_delay: 3000,
      min_uptime: '15s',
      kill_timeout: 8000,
      time: true,
      out_file: join(__dirname, 'logs', 'pm2-out.log'),
      error_file: join(__dirname, 'logs', 'pm2-err.log'),
      merge_logs: true,
    },
  ],
};
