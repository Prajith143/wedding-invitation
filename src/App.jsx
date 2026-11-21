import { useEffect, useRef, useState } from 'react'
import { supabase, isCloudReady, BUCKET } from './supabase'
import { ArrowLeft, ArrowRight, Music2, Pause, Play, Volume2, VolumeX, Upload, Trash2, LogOut, Images, Settings, ExternalLink, Heart, Eye } from 'lucide-react'

const localKey = 'royal-wedding-assets-v1'
const localSettingsKey = 'royal-wedding-settings-v1'
const demo = { title: 'A Beautiful Beginning', subtitle: 'You are cordially invited', openLabel: 'OPEN INVITATION', musicEnabled: true, loop: true }

function getLocalAssets() {
  try { return JSON.parse(localStorage.getItem(localKey) || '[]') } catch { return [] }
}
function saveLocalAssets(items) { localStorage.setItem(localKey, JSON.stringify(items)) }
function getLocalSettings() {
  try { return { ...demo, ...JSON.parse(localStorage.getItem(localSettingsKey) || '{}') } } catch { return demo }
}

export default function App() {
  const [assets, setAssets] = useState([])
  const [settings, setSettings] = useState(demo)
  const [page, setPage] = useState(-1)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(.65)
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('images')
  const audioRef = useRef(null)
  const adminRoute = window.location.pathname.replace(/\/+$/, '').endsWith('/admin')

  async function load() {
    if (!isCloudReady) {
      setAssets(getLocalAssets())
      setSettings(getLocalSettings())
      return
    }
    const { data: rows, error } = await supabase.from('invitation_assets').select('*').eq('published', true).order('sort_order')
    if (!error && rows) setAssets(rows.map(r => ({ ...r, url: r.file_url })))
    const { data: s } = await supabase.from('invitation_settings').select('*').eq('id', 1).maybeSingle()
    if (s) setSettings({ ...demo, title: s.title ?? demo.title, subtitle: s.subtitle ?? demo.subtitle, openLabel: s.open_label ?? demo.openLabel, musicEnabled: s.music_enabled ?? true, loop: s.loop ?? true })
  }

  useEffect(() => {
    load()
    if (isCloudReady) {
      supabase.auth.getSession().then(({ data }) => setSession(data.session))
      const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
      return () => listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
    a.muted = muted
    if (!settings.musicEnabled) { a.pause(); setPlaying(false) }
  }, [volume, muted, settings.musicEnabled, assets])

  const music = assets.find(a => a.kind === 'audio')
  const pages = assets.filter(a => a.kind === 'image')
  async function toggleMusic() {
    const a = audioRef.current
    if (!a || !music) return
    if (a.paused) { try { await a.play(); setPlaying(true) } catch { setMessage('Tap play again to start the music.') } }
    else { a.pause(); setPlaying(false) }
  }
  function begin() {
    setStarted(true)
    setPage(0)
    if (settings.musicEnabled && music && audioRef.current) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  async function signIn(e) {
    e.preventDefault(); setMessage('')
    if (!isCloudReady) { setMessage('Connect Supabase first. See README.md for setup.'); return }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Signed in.')
  }
  async function signOut() { await supabase.auth.signOut(); setSession(null) }

  async function uploadFiles(fileList, kind) {
    const list = Array.from(fileList || [])
    if (!list.length) return
    setBusy(true); setMessage('')
    try {
      for (const file of list) {
        if (kind === 'image' && !file.type.startsWith('image/')) throw new Error('Please select image files only.')
        if (kind === 'audio' && file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) throw new Error('Please select an MP3 file.')
        if (!isCloudReady) {
          const reader = new FileReader()
          const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
          const current = getLocalAssets()
          const item = { id: crypto.randomUUID(), name: file.name, kind, url: dataUrl, file_url: dataUrl, sort_order: current.filter(x => x.kind === kind).length, created_at: new Date().toISOString(), local: true }
          const next = kind === 'audio' ? [...current.filter(x => x.kind !== 'audio'), item] : [...current, item]
          saveLocalAssets(next)
        } else {
          const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
          const path = `${kind}/${safeName}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
          if (upErr) throw upErr
          const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
          const { error: dbErr } = await supabase.from('invitation_assets').insert({
            name: file.name, kind, file_path: path, file_url: publicData.publicUrl,
            sort_order: kind === 'image' ? pages.length + 1 : 0, published: true
          })
          if (dbErr) throw dbErr
        }
      }
      await load()
      setMessage(`${list.length} file(s) uploaded successfully.`)
    } catch (err) { setMessage(err.message || 'Upload failed.') }
    finally { setBusy(false) }
  }

  async function removeAsset(item) {
    if (!confirm(`Delete ${item.name}?`)) return
    if (isCloudReady && session) {
      if (item.file_path) await supabase.storage.from(BUCKET).remove([item.file_path])
      await supabase.from('invitation_assets').delete().eq('id', item.id)
    } else {
      saveLocalAssets(getLocalAssets().filter(x => x.id !== item.id))
    }
    await load()
  }

  async function moveAsset(item, direction) {
    const current = [...assets]
    const same = current.filter(x => x.kind === 'image').sort((a,b) => a.sort_order - b.sort_order)
    const index = same.findIndex(x => x.id === item.id), target = index + direction
    if (target < 0 || target >= same.length) return
    ;[same[index], same[target]] = [same[target], same[index]]
    same.forEach((x, i) => x.sort_order = i)
    if (isCloudReady) {
      for (const x of same) await supabase.from('invitation_assets').update({ sort_order: x.sort_order }).eq('id', x.id)
    } else {
      const all = getLocalAssets().map(x => x.kind === 'image' ? (same.find(y => y.id === x.id) || x) : x)
      saveLocalAssets(all)
    }
    await load()
  }

  async function saveSettings(e) {
    e.preventDefault()
    if (isCloudReady) {
      const { error } = await supabase.from('invitation_settings').upsert({ id: 1, title: settings.title, subtitle: settings.subtitle, open_label: settings.openLabel, music_enabled: settings.musicEnabled, loop: settings.loop })
      if (error) { setMessage(error.message); return }
    } else localStorage.setItem(localSettingsKey, JSON.stringify(settings))
    setMessage('Settings saved.')
  }

  if (adminRoute) {
    return <main className="admin-shell">
      <header className="admin-top"><div className="brand"><span className="brand-mark">✦</span><div><b>ROYAL INVITE</b><small>ADMIN CONTROL CENTER</small></div></div><a href="/" className="view-site"><ExternalLink size={16}/> View website</a></header>
      {!session && isCloudReady ? <section className="login-card"><div className="ornament">✦</div><h1>Admin Login</h1><p>Sign in to manage your invitation</p><form onSubmit={signIn}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password"/></label><button className="primary" type="submit">Sign in securely</button></form>{message && <p className="notice">{message}</p>}</section> :
      !isCloudReady ? <section className="login-card"><div className="ornament">✦</div><h1>Local Admin Mode</h1><p>Upload files for a quick preview on this browser. Connect Supabase for secure login and shared cloud storage.</p><div className="local-tag">LOCAL PREVIEW · THIS DEVICE ONLY</div></section> : null}
      {(session || !isCloudReady) && <section className="dashboard">
        <div className="dash-heading"><div><p className="eyebrow">WEDDING WEBSITE</p><h1>Dashboard</h1><p className="muted">Manage your invitation pages and music.</p></div>{session && <button className="outline" onClick={signOut}><LogOut size={16}/> Sign out</button>}</div>
        <div className="stats"><div><Images/><strong>{pages.length}</strong><span>Invitation pages</span></div><div><Music2/><strong>{music ? 1 : 0}</strong><span>Music tracks</span></div><div><Upload/><strong>{assets.length}</strong><span>Total uploads</span></div></div>
        <div className="tabs"><button className={tab==='images'?'active':''} onClick={()=>setTab('images')}><Images size={16}/> Invitation pages</button><button className={tab==='music'?'active':''} onClick={()=>setTab('music')}><Music2 size={16}/> Music</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><Settings size={16}/> Settings</button></div>
        {tab==='images' && <section className="panel"><div className="panel-title"><div><h2>Invitation images</h2><p>Images are shown exactly as uploaded, without editing.</p></div><label className="upload-btn"><Upload size={17}/> Upload images<input type="file" accept="image/*" multiple onChange={e=>uploadFiles(e.target.files,'image')}/></label></div>{pages.length===0 ? <div className="empty">No invitation pages uploaded yet. Add your first image to begin.</div> : <div className="asset-list">{pages.sort((a,b)=>a.sort_order-b.sort_order).map((item,i)=><div className="asset-row" key={item.id}><img src={item.url} alt={item.name}/><div className="asset-info"><b>{i+1}. {item.name}</b><small>Uploaded: {new Date(item.created_at).toLocaleString()}</small></div><button className="mini" onClick={()=>moveAsset(item,-1)} disabled={i===0}>↑</button><button className="mini" onClick={()=>moveAsset(item,1)} disabled={i===pages.length-1}>↓</button><button className="delete" onClick={()=>removeAsset(item)}><Trash2 size={17}/></button></div>)}</div>}</section>}
        {tab==='music' && <section className="panel"><div className="panel-title"><div><h2>Background music</h2><p>Upload an MP3 that plays across all invitation pages.</p></div><label className="upload-btn"><Upload size={17}/> Upload MP3<input type="file" accept=".mp3,audio/mpeg" onChange={e=>uploadFiles(e.target.files,'audio')}/></label></div>{music ? <div className="music-admin"><Music2/><div><b>{music.name}</b><small>Uploaded: {new Date(music.created_at).toLocaleString()}</small></div><button className="delete" onClick={()=>removeAsset(music)}><Trash2 size={17}/></button></div> : <div className="empty">No MP3 uploaded yet.</div>}</section>}
        {tab==='settings' && <section className="panel"><h2>Website settings</h2><form className="settings-form" onSubmit={saveSettings}><label>Invitation heading<input value={settings.title||''} onChange={e=>setSettings({...settings,title:e.target.value})}/></label><label>Subtitle<input value={settings.subtitle||''} onChange={e=>setSettings({...settings,subtitle:e.target.value})}/></label><label>Open button text<input value={settings.openLabel||'OPEN INVITATION'} onChange={e=>setSettings({...settings,openLabel:e.target.value})}/></label><label className="check"><input type="checkbox" checked={settings.musicEnabled!==false} onChange={e=>setSettings({...settings,musicEnabled:e.target.checked})}/> Enable background music</label><label className="check"><input type="checkbox" checked={settings.loop!==false} onChange={e=>setSettings({...settings,loop:e.target.checked})}/> Loop music</label><button className="primary">Save settings</button></form></section>}
        {message && <p className="notice">{message}</p>}
        <p className="admin-foot">Upload history records file names and timestamps. Cloud mode stores these in Supabase.</p>
      </section>}
    </main>
  }

  return <main className="invite-shell">
    <div className="ambient ambient-one"></div><div className="ambient ambient-two"></div>
    <header className="invite-brand"><span>✦</span><div>WITH LOVE & BLESSINGS<small>A CELEBRATION OF TOGETHERNESS</small></div><span>✦</span></header>
    {!started ? <section className="welcome">
      <div className="welcome-frame"><div className="frame-corner tl"></div><div className="frame-corner tr"></div><div className="frame-corner bl"></div><div className="frame-corner br"></div>
        {pages[0] ? <img className="welcome-image" src={pages[0].url} alt="Wedding invitation"/> : <div className="welcome-art"><div className="floral">❀</div><p className="script">Together with our families</p><h1>{settings.title || demo.title}</h1><div className="gold-line"></div><p>{settings.subtitle || demo.subtitle}</p><div className="rings">♧ ♡ ♧</div><p className="small-caps">A NEW CHAPTER · A FOREVER PROMISE</p></div>}
      </div>
      <button className="open-button" onClick={begin}><Heart size={17} fill="currentColor"/>{settings.openLabel || 'OPEN INVITATION'}<ArrowRight size={17}/></button>
      {!pages.length && <p className="hint">Your invitation images will appear here after you upload them in <a href="/admin">Admin</a>.</p>}
    </section> : <section className="pages-view">
      <div className="page-count">INVITATION PAGE <b>{Math.min(page+1, Math.max(pages.length,1))}</b> / {Math.max(pages.length,1)}</div>
      <div className="page-stage">
        <button className="nav-arrow left" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page<=0} aria-label="Previous page"><ArrowLeft/></button>
        {pages[page] ? <img className="invitation-page" src={pages[page].url} alt={`Invitation page ${page+1}`} /> : <div className="empty-invitation"><div className="floral">❀</div><h2>Your invitation is ready</h2><p>Upload your invitation images from the Admin panel.</p><a href="/admin">Open Admin</a></div>}
        <button className="nav-arrow right" onClick={()=>setPage(p=>Math.min(pages.length-1,p+1))} disabled={page>=pages.length-1} aria-label="Next page"><ArrowRight/></button>
      </div>
      <div className="page-controls"><button className="text-btn" onClick={()=>{setStarted(false);setPage(-1)}}>Back to cover</button><div className="dots">{pages.map((p,i)=><button key={p.id} className={i===page?'dot active':'dot'} onClick={()=>setPage(i)} aria-label={`Go to page ${i+1}`}/>)}</div><span className="page-label">{page+1} of {pages.length}</span></div>
    </section>}
    <footer className="invite-footer"><span>MADE WITH LOVE</span><span className="footer-heart">♥</span><span>FOREVER BEGINS HERE</span></footer>
    {music && settings.musicEnabled!==false && <div className="music-player"><audio ref={audioRef} src={music.url} loop={settings.loop!==false} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/><button onClick={toggleMusic} aria-label={playing?'Pause music':'Play music'}>{playing?<Pause size={17}/>:<Play size={17}/>}</button><Music2 size={17}/><span className="track-name">{music.name}</span><button className="mute-btn" onClick={()=>setMuted(v=>!v)} aria-label="Mute">{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button><input aria-label="Volume" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>}
  </main>
}