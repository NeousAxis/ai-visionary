"use client";

// Carte interactive légère, sans bibliothèque : tuiles raster officielles,
// repères numérotés, zoom (+ / −, molette) et déplacement à la souris ou au doigt.
// Suisse : carte nationale swisstopo (données ouvertes de la Confédération).
// Ailleurs : OpenStreetMap. L'attribution est toujours affichée.

import { useEffect, useMemo, useRef, useState } from 'react';

export type MapPoint = { lat: number; lon: number; n: number; label: string; strong?: boolean };
export type MapTarget = { lat: number; lon: number; label: string } | null;

const TILE = 256;
const USE_SWISSTOPO = false;
const CH = { minLat: 45.8, maxLat: 47.85, minLon: 5.9, maxLon: 10.55 };

function project(lat: number, lon: number, z: number) {
    const n = TILE * 2 ** z;
    const x = ((lon + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    return { x, y };
}

function inSwitzerland(p: { lat: number; lon: number }) {
    return p.lat >= CH.minLat && p.lat <= CH.maxLat && p.lon >= CH.minLon && p.lon <= CH.maxLon;
}

export default function AyaMap({ points, target, height = 280, osmLabel, zoomInLabel, zoomOutLabel, label }: {
    points: MapPoint[];
    target: MapTarget;
    height?: number;
    osmLabel: string;
    zoomInLabel: string;
    zoomOutLabel: string;
    /** Description de la carte pour les lecteurs d'écran. */
    label?: string;
}) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(360);
    const all = useMemo(() => [...points, ...(target ? [target] : [])], [points, target]);
    // La carte nationale suisse est très chargée aux échelles d'une petite carte
    // (zoom 11 à 13) : OpenStreetMap reste plus lisible. Interrupteur gardé pour
    // une future carte claire swisstopo.
    const swiss = USE_SWISSTOPO && all.length > 0 && all.every(inSwitzerland);

    // Zoom et centre initiaux : tous les repères visibles, zoom 3 à 14.
    const fit = useMemo(() => {
        if (all.length === 0) return { z: 8, cx: 0, cy: 0 };
        let z = 14;
        for (; z > 3; z--) {
            const ps = all.map((p) => project(p.lat, p.lon, z));
            const w = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
            const h = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
            if (w < width - 90 && h < height - 90) break;
        }
        const ps = all.map((p) => project(p.lat, p.lon, z));
        const cx = (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2;
        const cy = (Math.max(...ps.map((p) => p.y)) + Math.min(...ps.map((p) => p.y))) / 2;
        return { z, cx, cy };
    }, [all, width, height]);

    const [view, setView] = useState(fit);
    useEffect(() => setView(fit), [fit]);

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setWidth(el.clientWidth || 360));
        ro.observe(el);
        setWidth(el.clientWidth || 360);
        return () => ro.disconnect();
    }, []);

    const zoomBy = (d: number) => setView((v) => {
        const z = Math.min(17, Math.max(5, v.z + d));
        const f = 2 ** (z - v.z);
        return { z, cx: v.cx * f, cy: v.cy * f };
    });

    const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
    const onDown = (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    };
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        setView((v) => ({ ...v, cx: d.cx - (e.clientX - d.x), cy: d.cy - (e.clientY - d.y) }));
    };
    const onUp = () => { drag.current = null; };

    const left = view.cx - width / 2;
    const top = view.cy - height / 2;
    const max = 2 ** view.z;
    const tiles: { key: string; src: string; x: number; y: number }[] = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
        for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
            if (ty < 0 || ty >= max) continue;
            const wx = ((tx % max) + max) % max;
            const src = swiss
                ? `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/${view.z}/${wx}/${ty}.jpeg`
                : `https://tile.openstreetmap.org/${view.z}/${wx}/${ty}.png`;
            tiles.push({ key: `${view.z}/${tx}/${ty}`, src, x: tx * TILE - left, y: ty * TILE - top });
        }
    }
    const at = (p: { lat: number; lon: number }) => {
        const q = project(p.lat, p.lon, view.z);
        return { x: q.x - left, y: q.y - top };
    };
    const t = target ? at(target) : null;

    const btn: React.CSSProperties = { width: 36, height: 36, border: '1px solid var(--border-light)', borderRadius: 10, background: '#fff', color: 'var(--text-main)', fontSize: 20, fontWeight: 600, lineHeight: 1, cursor: 'pointer' };

    return (
        <div
            ref={boxRef}
            role="img"
            aria-label={label}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1 : -1); } }}
            style={{ position: 'relative', height, overflow: 'hidden', background: '#E2EFE9', cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
        >
            {tiles.map((tl) => (
                <img key={tl.key} src={tl.src} alt="" draggable={false} width={TILE} height={TILE}
                    style={{ position: 'absolute', left: tl.x, top: tl.y, width: TILE, height: TILE, pointerEvents: 'none' }} />
            ))}
            {t && (
                <>
                    <span aria-hidden="true" style={{ position: 'absolute', left: t.x - 13, top: t.y - 13, width: 26, height: 26, borderRadius: 999, border: '3px solid #CE6A6B', background: 'rgba(206,106,107,0.18)', boxSizing: 'border-box' }} />
                    <span aria-hidden="true" style={{ position: 'absolute', left: t.x - 4, top: t.y - 4, width: 8, height: 8, borderRadius: 999, background: '#CE6A6B' }} />
                </>
            )}
            {points.slice().reverse().map((p) => {
                const q = at(p);
                return (
                    <span key={p.n} title={p.label} style={{
                        position: 'absolute', left: q.x - 14, top: q.y - 34, width: 28, height: 28,
                        borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
                        background: p.strong ? '#356D76' : '#4A919E', border: '2px solid #fff',
                        boxShadow: '0 2px 6px rgba(33,46,83,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ transform: 'rotate(45deg)', color: '#fff', fontSize: 12, fontWeight: 700 }}>{p.n}</span>
                    </span>
                );
            })}
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" aria-label={zoomInLabel} style={btn} onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomBy(1)}>+</button>
                <button type="button" aria-label={zoomOutLabel} style={btn} onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomBy(-1)}>−</button>
            </div>
            <span style={{ position: 'absolute', right: 0, bottom: 0, background: 'rgba(255,255,255,0.85)', color: 'var(--text-body)', fontSize: 10, padding: '2px 6px', borderTopLeftRadius: 6 }}>
                {swiss ? '© swisstopo' : osmLabel}
            </span>
        </div>
    );
}
