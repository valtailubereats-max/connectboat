import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { coordinates, mergeLocations, parseLocations, project, unproject, type ProspectLocationInput, type MapProspect } from '../utils/prospectMap';
import { storage } from '../firebase';

const MAP_LOCATIONS_PATH = 'event-contacts/uk-prospect-locations.json';

// Mounted only within the existing Event Contacts admin guard. The location file
// is private because this Storage path is protected by the existing admin rule.
export default function UKProspectMap({ contacts, loading, onClose, onOpenContact }: {
  contacts: ProspectLocationInput[]; loading: boolean; onClose: () => void; onOpenContact: (id: string) => void;
}) {
  const [prepared, setPrepared] = useState<ProspectLocationInput[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(5);
  const [center, setCenter] = useState<[number, number]>([55.5, -3.5]);
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState(false);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(true);
  const [savingLocations, setSavingLocations] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; centerX: number; centerY: number; zoom: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSavedLocations = async () => {
      try {
        const bytes = await getBytes(ref(storage, MAP_LOCATIONS_PATH), 2 * 1024 * 1024);
        const parsed = parseLocations(JSON.parse(new TextDecoder().decode(bytes)));
        if (!parsed.some(row => coordinates(row))) throw new Error('Saved map data has no valid UK coordinates.');
        if (!cancelled) setPrepared(parsed);
      } catch (loadError) {
        const code = (loadError as { code?: string }).code;
        if (!cancelled && code !== 'storage/object-not-found') {
          setError(loadError instanceof Error ? loadError.message : 'Could not load saved map locations.');
        }
      } finally {
        if (!cancelled) setLoadingSavedLocations(false);
      }
    };
    loadSavedLocations();
    return () => { cancelled = true; };
  }, []);
  const rows = useMemo(() => mergeLocations(contacts, prepared).map((row, index) => ({ ...row, mapId: 'row-' + index })), [contacts, prepared]);
  const statuses = useMemo(() => Array.from(new Set(rows.map(r => r.invitationStatus || 'Pending'))).sort(), [rows]);
  const matching = useMemo(() => rows.filter(row =>
    (status === 'All' || (row.invitationStatus || 'Pending') === status) &&
    [row.company, row.name, row.address, row.postcode, row.city, row.email].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
  ), [rows, status, search]);
  const points = useMemo(() => matching.flatMap((row): MapProspect[] => {
    const pair = coordinates(row);
    return pair ? [{ ...row, latitude: pair[0], longitude: pair[1] }] : [];
  }), [matching]);
  const selected = points.find(point => point.mapId === selectedId);
  const [cx, cy] = project(center[0], center[1], zoom);
  const tiles = [];
  for (let x = Math.floor(cx / 256) - 3; x <= Math.floor(cx / 256) + 3; x++) {
    for (let y = Math.floor(cy / 256) - 2; y <= Math.floor(cy / 256) + 2; y++) {
      if (x >= 0 && y >= 0 && x < 2 ** zoom && y < 2 ** zoom) tiles.push({ x, y });
    }
  }
  const reset = () => { setCenter([55.5, -3.5]); setZoom(5); setTileError(false); };
  const move = (lat: number, lng: number) => setCenter(([a, b]) => [Math.max(49.1, Math.min(61, a + lat)), Math.max(-8.3, Math.min(2, b + lng))]);
  const clampCenter = ([lat, lng]: [number, number]): [number, number] => [Math.max(49.1, Math.min(61, lat)), Math.max(-8.3, Math.min(2, lng))];
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, a, input, select')) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, centerX: cx, centerY: cy, zoom };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragMap = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setCenter(clampCenter(unproject(active.centerX - (event.clientX - active.startX), active.centerY - (event.clientY - active.startY), active.zoom)));
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const loadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('Location file must be smaller than 15 MB.');
      const parsed = parseLocations(JSON.parse(await file.text()));
      if (!parsed.some(row => coordinates(row))) throw new Error('No valid UK coordinates found. Include latitude/longitude or lat/lng.');
      setPrepared(parsed); setError(''); setSelectedId(null); reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read locations.'); }
  };
  const saveLocations = async () => {
    if (!prepared.length || savingLocations) return;
    setSavingLocations(true);
    try {
      const file = new Blob([JSON.stringify({ prospects: prepared })], { type: 'application/json' });
      await uploadBytes(ref(storage, MAP_LOCATIONS_PATH), file, { contentType: 'application/json' });
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save map locations.');
    } finally {
      setSavingLocations(false);
    }
  };
  const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700';
  return (
    <section id="uk-prospect-map" aria-label="UK Prospect Map" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-900">UK Prospect Map</h2><p className="text-xs text-slate-500">Admin only · Saved locations load automatically.</p></div>
        <button type="button" onClick={onClose} className={button}>Close map</button>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <input aria-label="Search prospects on map" value={search} onChange={e => setSearch(e.target.value)} placeholder="Company, address, postcode…" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select aria-label="Map invitation status" value={status} onChange={e => setStatus(e.target.value)} className={button}><option value="All">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
        <input ref={fileInput} type="file" accept=".json,.geojson,application/json" onChange={loadFile} className="hidden" />
        <button type="button" onClick={() => fileInput.current?.click()} className={button}>Load prepared locations</button>
        {prepared.length > 0 && <button type="button" onClick={saveLocations} disabled={savingLocations} className={button}>{savingLocations ? 'Saving…' : 'Save locations permanently'}</button>}
        {prepared.length > 0 && <button type="button" onClick={() => { setPrepared([]); setSelectedId(null); }} className={button}>Hide locations for now</button>}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      <p aria-live="polite" className="mb-3 text-sm text-slate-600">{loading || loadingSavedLocations ? 'Loading map data…' : points.length + ' located · ' + (matching.length - points.length) + ' without valid UK coordinates · ' + matching.length + ' matching'}</p>
      {!loading && points.length === 0 && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No matching locations. Load prepared JSON/GeoJSON, or use contacts with saved coordinates. Addresses alone are not plotted.</p>}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="relative h-[480px] touch-none overflow-hidden rounded-xl bg-slate-100 cursor-grab active:cursor-grabbing"
          aria-label="Map of UK prospects"
          onPointerDown={startDrag}
          onPointerMove={dragMap}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={event => {
            event.preventDefault();
            setZoom(value => Math.max(4, Math.min(18, value + (event.deltaY < 0 ? 1 : -1))));
          }}
        >
          {tiles.map(tile => <img key={zoom + '-' + tile.x + '-' + tile.y} src={'https://tile.openstreetmap.org/' + zoom + '/' + tile.x + '/' + tile.y + '.png'} alt="" draggable={false} onError={() => setTileError(true)} style={{ position: 'absolute', width: 256, height: 256, maxWidth: 'none', left: 'calc(50% + ' + (tile.x * 256 - cx) + 'px)', top: 'calc(50% + ' + (tile.y * 256 - cy) + 'px)' }} />)}
          {points.map(point => {
            const [px, py] = project(point.latitude, point.longitude, zoom);
            return <button key={point.mapId} type="button" title={point.company || point.name || 'Prospect'} aria-label={'Select ' + (point.company || point.name || 'prospect')} onClick={() => setSelectedId(point.mapId)} className={'absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ' + (selectedId === point.mapId ? 'z-10 bg-amber-500 ring-4 ring-amber-200' : 'bg-indigo-600')} style={{ left: 'calc(50% + ' + (px - cx) + 'px)', top: 'calc(50% + ' + (py - cy) + 'px)' }} />;
          })}
          <div className="absolute left-2 top-2 flex gap-1">
            <button type="button" aria-label="Zoom in" disabled={zoom >= 18} onClick={() => setZoom(z => Math.min(18, z + 1))} className={button}>+</button>
            <button type="button" aria-label="Zoom out" disabled={zoom <= 5} onClick={() => setZoom(z => Math.max(5, z - 1))} className={button}>−</button>
            <button type="button" onClick={reset} className={button}>UK view</button>
          </div>
          <div className="absolute bottom-7 left-2 grid grid-cols-3 gap-1">
            <span /><button type="button" aria-label="Pan north" onClick={() => move(180 / 2 ** zoom, 0)} className={button}>↑</button><span />
            <button type="button" aria-label="Pan west" onClick={() => move(0, -360 / 2 ** zoom)} className={button}>←</button>
            <button type="button" aria-label="Pan south" onClick={() => move(-180 / 2 ** zoom, 0)} className={button}>↓</button>
            <button type="button" aria-label="Pan east" onClick={() => move(0, 360 / 2 ** zoom)} className={button}>→</button>
          </div>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="absolute bottom-0 right-0 bg-white/90 px-2 text-xs text-slate-700">© OpenStreetMap contributors</a>
          <div className="pointer-events-none absolute bottom-0 left-0 bg-white/90 px-2 text-xs text-slate-700">Drag to move · Scroll to zoom</div>
        </div>
        <div className="space-y-3">
          {selected && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm break-words">
            <h3 className="font-black">{selected.company || selected.name || 'Prospect'}</h3>
            {selected.name && <p>{selected.name}</p>}
            <p>{[selected.address, selected.city, selected.postcode].filter(Boolean).join(', ')}</p>
            <p>{selected.invitationStatus || 'Pending'}</p><p>{selected.email}</p><p>{selected.whatsapp || selected.phone}</p><p>{selected.website}</p>
            <p className="mt-2 text-xs text-slate-500">{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</p>
            {contacts.some(c => c.id === selected.id) && selected.id && <button type="button" className={button + ' mt-3'} onClick={() => onOpenContact(selected.id!)}>Open existing contact</button>}
          </div>}
          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
            {points.map(point => <button key={point.mapId} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-indigo-50" onClick={() => { setSelectedId(point.mapId); setCenter([point.latitude, point.longitude]); setZoom(13); }}><strong>{point.company || point.name || 'Prospect'}</strong><span className="block text-xs text-slate-500">{point.invitationStatus || 'Pending'}</span></button>)}
          </div>
        </div>
      </div>
      {tileError && <p role="status" className="mt-2 text-sm text-amber-800">Map background could not load. The prospect list remains available.</p>}
    </section>
  );
}
