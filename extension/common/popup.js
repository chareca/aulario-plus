const api = globalThis.browser ?? globalThis.chrome;
const ORIGINS = ['https://miaulario.unavarra.es/*', 'https://sso.unavarra.es/*'];
const MAX_INACTIVE_MIN = 60;

const $ = (id) => document.getElementById(id);
const send = (msg) => api.runtime.sendMessage(msg);

function ago(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

async function render() {
  const granted = await api.permissions.contains({ origins: ORIGINS });
  $('perm').classList.toggle('show', !granted);

  const st = await send({ type: 'getStatus' });
  if (!st) return;
  const last = st.last && !st.last.relogin ? st.last : (st.log || []).filter((e) => !e.relogin).pop();

  if (st.nextPing && !st.paused) {
    const s = Math.max(0, Math.round((st.nextPing - Date.now()) / 1000));
    $('nextPing').textContent = `in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  } else {
    $('nextPing').textContent = '–';
  }
  $('toggle').textContent = st.paused ? 'Resume' : 'Pause';
  $('autoLogin').checked = st.autoLogin;

  const dot = $('dot');
  dot.className = 'dot';

  if (st.paused) {
    dot.classList.add('warn');
    $('headline').textContent = 'Paused';
    $('session').textContent = 'Paused';
  } else if (!last) {
    $('headline').textContent = 'No ping yet';
  } else if (last.loggedIn) {
    dot.classList.add('ok');
    $('headline').textContent = 'Connected';
    $('session').textContent = 'Active';
  } else {
    dot.classList.add('bad');
    $('headline').textContent = 'No session';
    $('session').textContent = last.error ? 'Network error' : 'Logged out';
  }

  if (last) {
    const elapsed = Date.now() - last.time;
    $('lastPing').textContent = `${ago(elapsed)} (${last.status || '–'})`;
    $('remaining').textContent = last.loggedIn ? `~${Math.max(0, MAX_INACTIVE_MIN - Math.round(elapsed / 60000))} min` : '–';
  }
}

$('pingNow').addEventListener('click', async () => {
  $('pingNow').disabled = true;
  await send({ type: 'pingNow' });
  $('pingNow').disabled = false;
  render();
});

$('toggle').addEventListener('click', async () => {
  const st = await send({ type: 'getStatus' });
  await send({ type: st.paused ? 'resume' : 'pause' });
  render();
});

$('autoLogin').addEventListener('change', async (e) => {
  await send({ type: 'setAutoLogin', value: e.target.checked });
});

$('grant').addEventListener('click', async () => {
  await api.permissions.request({ origins: ORIGINS });
  await send({ type: 'resume' });
  render();
});

render();
setInterval(render, 1000);
