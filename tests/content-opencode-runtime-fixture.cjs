#!/usr/bin/env node
// External CLI fixture. Returns only synthetic configuration facts, never credentials.
const http = require('node:http');
const VERSION = '1.19.4';
if (process.argv.includes('--version')) { console.log(VERSION); process.exit(0); }
const cfg = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT);
const facts = { cwd: process.cwd(), home: process.env.HOME, configHome: process.env.XDG_CONFIG_HOME,
  inheritedSecret: Boolean(process.env.OPENAI_API_KEY), inheritedConfig: Boolean(process.env.OPENCODE_CONFIG), testHome: Boolean(process.env.OPENCODE_TEST_HOME),
  flags: ['OPENCODE_DISABLE_PROJECT_CONFIG','OPENCODE_DISABLE_CLAUDE_CODE','OPENCODE_DISABLE_EXTERNAL_SKILLS','OPENCODE_DISABLE_DEFAULT_PLUGINS'].every(k => process.env[k] === 'true'),
  permission: cfg.permission, agentPermission: cfg.agent.content.permission, thinking: cfg.provider['xier-content'].models['deepseek-flash'].options.thinking,
};
const server = http.createServer(async (req, res) => {
  const auth = 'Basic ' + Buffer.from('opencode:' + process.env.OPENCODE_SERVER_PASSWORD).toString('base64');
  if (req.headers.authorization !== auth) { res.writeHead(401).end(); return; }
  let body = ''; for await (const c of req) body += c;
  const json = value => { res.writeHead(200, {'content-type':'application/json'}).end(JSON.stringify(value)); };
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/global/health') return json({ healthy: true, version: VERSION });
  if (url.pathname === '/session' && req.method === 'POST') return json({ id: 'ses-fixture' });
  if (url.pathname === '/session/ses-fixture/message' && req.method === 'POST') return json({ info: { id: 'msg-fixture', sessionID: 'ses-fixture', role: 'assistant', time: { created: 1, completed: 2 }, structured: { replacement: JSON.stringify(facts) } }, parts: [] });
  if (url.pathname === '/session/status') return json({});
  if (url.pathname === '/session/ses-fixture/message') return json([]);
  res.writeHead(404).end();
});
server.listen(Number(process.argv[process.argv.indexOf('--port')+1]), '127.0.0.1');
