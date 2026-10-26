import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '../css/app.css';
import {
  OfflineError,
  cacheUser,
  getCachedUser,
  clearOfflineData,
  replaceApplications,
  getApplications,
  getApplication,
  upsertApplication,
  removeApplication,
  getNextLocalId,
  enqueue,
  purgeQueueForLocalId,
  flushSyncQueue,
  getPendingCount,
  filterApplications,
} from './offlineStore.js';

registerSW({ immediate: true });

const STATUSES = ['wishlist', 'applied', 'interview', 'offer', 'rejected'];
const STATUS_LABELS = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};
const EMPTY = { company: '', position: '', status: 'applied', location: '', salary: '', url: '', applied_on: '', notes: '' };

const xsrf = () => decodeURIComponent((document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')) || '').split('=').slice(1).join('='));

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// Same-origin cookie session: the browser sends the session cookie; we echo Laravel's XSRF cookie as a header.
async function http(method, url, body) {
  let r;
  try {
    r = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf() },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new OfflineError();
  }
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) window.dispatchEvent(new Event('unauth'));
  if (r.status === 419) throw new Error('Session expired. Refresh the page and try again.');
  if (!r.ok) throw new Error(d.errors ? Object.values(d.errors)[0][0] : d.message || 'Request failed');
  return d;
}
const api = (method, path, body) => http(method, `/api/applications${path}`, body);

function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pwa-install-dismissed') === '1');

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || !prompt) return null;

  const install = async () => {
    await prompt.prompt();
    setPrompt(null);
  };

  return (
    <div className="install-banner">
      <span>Install Job Tracker on this device for quick access.</span>
      <div className="row">
        <button type="button" onClick={install}>Install</button>
        <button type="button" className="ghost" onClick={() => { sessionStorage.setItem('pwa-install-dismissed', '1'); setDismissed(true); }}>Not now</button>
      </div>
    </div>
  );
}

function Tracker({ user, onLogout, online }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    setErr('');
    try {
      if (online) {
        await flushSyncQueue(api);
        const all = await api('GET', '');
        await replaceApplications(all);
        setItems(filterApplications(all, q));
        setPending(await getPendingCount());
        return;
      }
    } catch (e) {
      if (!(e instanceof OfflineError)) {
        setErr(e.message);
      }
    }

    const cached = await getApplications();
    setItems(filterApplications(cached, q));
    setPending(await getPendingCount());
  }, [q, online]);

  useEffect(() => {
    const t = setTimeout(load, online ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, online]);

  const act = async (fn) => {
    setErr('');
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const createApplication = async (payload) => {
    if (online) {
      await api('POST', '', payload);
      return;
    }
    const id = await getNextLocalId();
    const now = new Date().toISOString();
    await upsertApplication({ id, ...payload, created_at: now, updated_at: now });
    await enqueue({ op: 'create', localId: id, body: payload });
  };

  const updateApplication = async (id, body) => {
    if (online) {
      await api('PUT', `/${id}`, body);
      return;
    }
    const existing = await getApplication(id);
    if (!existing) throw new Error('Application not found locally.');
    await upsertApplication({ ...existing, ...body, updated_at: new Date().toISOString() });
    await enqueue({ op: 'update', id, body });
  };

  const deleteApplicationRemote = async (id) => {
    if (online) {
      await api('DELETE', `/${id}`);
      return;
    }
    if (id < 0) {
      await removeApplication(id);
      await purgeQueueForLocalId(id);
      return;
    }
    await removeApplication(id);
    await enqueue({ op: 'delete', id });
  };

  const add = (e) => {
    e.preventDefault();
    act(async () => {
      const payload = { ...f, url: f.url || null, applied_on: f.applied_on || null };
      await createApplication(payload);
      setF(EMPTY);
      setOpen(false);
    });
  };
  const move = (id, status) => act(() => updateApplication(id, { status }));
  const del = (id) => confirm('Delete this application?') && act(() => deleteApplicationRemote(id));

  const dragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  };
  const dragEnd = () => { setDragId(null); setOverCol(null); };
  const colDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverCol(status);
  };
  const colDrop = (e, status) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    dragEnd();
    const item = items.find((i) => i.id === id);
    if (item && item.status !== status) move(id, status);
  };

  const count = (s) => items.filter((i) => i.status === s).length;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const activeCount = count('applied') + count('interview');

  return (
    <div className="app-shell">
      <InstallBanner />
      <div className="wrap">
        {!online && (
          <div className="offline-banner" role="status">
            You&apos;re offline. Changes are saved on this device and will sync when you&apos;re back online.
            {pending > 0 && ` (${pending} pending)`}
          </div>
        )}
        {online && pending > 0 && (
          <div className="sync-banner" role="status">Syncing {pending} offline change{pending === 1 ? '' : 's'}…</div>
        )}

        <header className="app-header">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">JT</div>
            <div>
              <h1>Job Tracker</h1>
              <p>Manage your pipeline in one place</p>
            </div>
          </div>
          <div className="user-bar">
            <span className="user-pill">{user.name}</span>
            <button type="button" className="ghost" onClick={onLogout}>Log out</button>
          </div>
        </header>

        <div className="toolbar">
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value">{items.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Active</span>
              <span className="stat-value">{activeCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Offers</span>
              <span className="stat-value">{count('offer')}</span>
            </div>
          </div>
          <div className="toolbar-actions">
            <div className="search-wrap">
              <input
                placeholder="Search company or role…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search applications"
              />
            </div>
            <button type="button" className={open ? 'ghost' : 'primary-outline'} onClick={() => setOpen(!open)}>
              {open ? 'Cancel' : '+ New application'}
            </button>
          </div>
        </div>

        {err && <div className="err" role="alert">{err}</div>}

        {open && (
          <form className="card form-panel" onSubmit={add}>
            <h2 className="form-title">Add application</h2>
            <p className="form-sub">Track a new role — you can move it across the board anytime.</p>
            <div className="grid2">
              <div><label>Company *</label><input value={f.company} onChange={set('company')} required /></div>
              <div><label>Position *</label><input value={f.position} onChange={set('position')} required /></div>
              <div>
                <label>Status</label>
                <select value={f.status} onChange={set('status')}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div><label>Applied on</label><input type="date" value={f.applied_on} onChange={set('applied_on')} /></div>
              <div><label>Location</label><input value={f.location} onChange={set('location')} placeholder="City or remote" /></div>
              <div><label>Salary</label><input value={f.salary} onChange={set('salary')} placeholder="e.g. $120k" /></div>
            </div>
            <label>Job URL</label><input type="url" value={f.url} onChange={set('url')} placeholder="https://..." />
            <label>Notes</label><textarea rows="3" value={f.notes} onChange={set('notes')} placeholder="Recruiter, next steps, etc." />
            <div className="row" style={{ marginTop: 16 }}>
              <button type="submit">Save application</button>
            </div>
          </form>
        )}

        <div className="board">
          {STATUSES.map((s) => {
            const colItems = items.filter((i) => i.status === s);
            return (
              <div
                className={`col col--${s}${overCol === s ? ' drag-over' : ''}`}
                key={s}
                onDragOver={(e) => colDragOver(e, s)}
                onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
                onDrop={(e) => colDrop(e, s)}
              >
                <div className="col-head">
                  <h3 className="col-title">{STATUS_LABELS[s]}</h3>
                  <span className="col-count">{colItems.length}</span>
                </div>
                {colItems.length === 0 && (
                  <div className="col-empty">Drop applications here</div>
                )}
                {colItems.map((i) => {
                  const meta = [i.location, i.salary, i.applied_on].filter(Boolean).join(' · ');
                  return (
                    <div
                      className={`card board-card${dragId === i.id ? ' dragging' : ''}${i.id < 0 ? ' pending-sync' : ''}`}
                      key={i.id}
                      draggable
                      onDragStart={(e) => dragStart(e, i.id)}
                      onDragEnd={dragEnd}
                    >
                      <p className="job-company">{i.company}</p>
                      <p className="job-position">{i.position}</p>
                      {meta && <div className="job-meta">{meta}</div>}
                      {i.url && (
                        <a className="job-link" href={i.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          View posting →
                        </a>
                      )}
                      {i.notes && <div className="job-notes">{i.notes}</div>}
                      <div className="card-actions">
                        <span className={`status-badge status-badge--${i.status}`}>{STATUS_LABELS[i.status]}</span>
                        <button type="button" className="del" onClick={() => del(i.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AuthForm({ onAuth, online }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!online) {
      setErr('Connect to the internet to sign in or register.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const user = (await http('POST', `/api/${mode}`, f)).user;
      await cacheUser(user);
      onAuth(user);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      {!online && (
        <div className="offline-banner auth-offline" role="status">
          You&apos;re offline. Sign in requires an internet connection. If you were signed in before, reopen the installed app while online once to refresh your session.
        </div>
      )}
      <form className="card auth-card" onSubmit={submit}>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-lead">
          {mode === 'login' ? 'Sign in to manage your job search pipeline.' : 'Start tracking applications in minutes.'}
        </p>
        {mode === 'register' && <><label>Name</label><input value={f.name} onChange={set('name')} required autoComplete="name" /></>}
        <label>Email</label><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
        <label>Password{mode === 'register' && ' (min 8 characters)'}</label>
        <input type="password" value={f.password} onChange={set('password')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {err && <div className="err" role="alert">{err}</div>}
        <div className="auth-actions">
          <button type="submit" disabled={busy || !online}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Root() {
  const online = useOnline();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    (async () => {
      try {
        const d = await http('GET', '/api/me');
        if (d.user) await cacheUser(d.user);
        setUser(d.user);
      } catch (e) {
        if (e instanceof OfflineError) {
          setUser((await getCachedUser()) ?? null);
        } else {
          setUser(null);
        }
      }
    })();
    const off = () => setUser(null);
    window.addEventListener('unauth', off);
    return () => window.removeEventListener('unauth', off);
  }, []);

  const logout = async () => {
    if (online) await http('POST', '/api/logout').catch(() => {});
    await clearOfflineData();
    setUser(null);
  };

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }
  if (!user) return <AuthForm onAuth={setUser} online={online} />;
  return <Tracker user={user} onLogout={logout} online={online} />;
}

createRoot(document.getElementById('root')).render(<Root />);
