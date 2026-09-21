/**
 * NASA Visible Earth & EarthData Satellite Map Provider
 * Standard EPSG:4326 (WGS-84 Equirectangular) authentic global satellite imagery.
 */

export interface NasaMapLayer {
  id: string;
  name: string;
  description: string;
  category: 'day' | 'night' | 'natural';
  url: string;
  thumbnailUrl: string;
  attribution: string;
}

export const NASA_MAP_LAYERS: NasaMapLayer[] = [
  {
    id: 'blue-marble-bathymetry',
    name: 'NASA Blue Marble (True Color Satellite)',
    description: 'Authentic NASA Visible Earth global satellite photography showing continental topography, vegetation, and ocean bathymetry.',
    category: 'day',
    url: '/textures/earth-blue-marble.jpg',
    thumbnailUrl: '/textures/earth-blue-marble.jpg',
    attribution: 'NASA Visible Earth / Blue Marble',
  },
  {
    id: 'black-marble-night',
    name: 'NASA Black Marble (Earth at Night)',
    description: 'NASA Suomi-NPP VIIRS Day/Night Band composite showing global city lights and nocturnal illumination.',
    category: 'night',
    url: '/textures/earth-night.jpg',
    thumbnailUrl: '/textures/earth-night.jpg',
    attribution: 'NASA / NOAA / Suomi-NPP VIIRS',
  },
  {
    id: 'earth-topology',
    name: 'NASA SRTM Topography & Landforms',
    description: 'NASA Shuttle Radar Topography Mission (SRTM) global elevation relief map.',
    category: 'natural',
    url: '/textures/earth-topology.png',
    thumbnailUrl: '/textures/earth-topology.png',
    attribution: 'NASA JPL / SRTM',
  },
];
