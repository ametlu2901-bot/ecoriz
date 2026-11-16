import { useEffect, useRef } from 'react';
import L from 'leaflet';
import iconoUrl from 'leaflet/dist/images/marker-icon.png';
import icono2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import sombraUrl from 'leaflet/dist/images/marker-shadow.png';

// Vite no resuelve solo las rutas de los íconos de Leaflet.
// Además, Leaflet antepone su propia carpeta de imágenes a estas URL y las duplica;
// al quitar _getIconUrl usa las URL tal cual.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: iconoUrl, iconRetinaUrl: icono2xUrl, shadowUrl: sombraUrl });

const PANAMA = [8.9824, -79.5199];

/**
 * Mapa con Leaflet + OpenStreetMap (D-11).
 *  - posicion: { lat, lng } del punto principal (o null)
 *  - onElegir(lat, lng): si se pasa, el clic en el mapa elige el punto (CU-01)
 *  - otros: [{ lat, lng, texto }] reportes cercanos
 */
export default function MapaReportes({ posicion, onElegir, otros = [], altura = 320, etiqueta = 'Mapa' }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const onElegirRef = useRef(onElegir);
  onElegirRef.current = onElegir;

  useEffect(() => {
    const m = L.map(contenedor.current).setView(posicion ? [posicion.lat, posicion.lng] : PANAMA, 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    capa.current = L.layerGroup().addTo(m);
    m.on('click', (e) => { if (onElegirRef.current) onElegirRef.current(e.latlng.lat, e.latlng.lng); });
    mapa.current = m;
    return () => { m.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapa.current) return;
    capa.current.clearLayers();
    if (posicion) {
      L.marker([posicion.lat, posicion.lng]).addTo(capa.current);
      mapa.current.setView([posicion.lat, posicion.lng], mapa.current.getZoom());
    }
    otros.forEach((o) => {
      L.circleMarker([o.lat, o.lng], { radius: 8, color: '#b45309', fillOpacity: 0.6 })
        .bindTooltip(o.texto).addTo(capa.current);
    });
  }, [posicion, otros]);

  return <div ref={contenedor} className="mapa" style={{ height: altura }} role="region" aria-label={etiqueta} />;
}
