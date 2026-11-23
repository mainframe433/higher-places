# Higher Places

Prototype of a map-first app for adults (21+) to discover and share scenic spots around Phoenix, Arizona.

- `index.html`: night version, the main version
- `day.html`: bright daytime version

The live street map uses [MapLibre GL JS](https://maplibre.org/) with free [OpenFreeMap](https://openfreemap.org/) tiles (© OpenMapTiles, © OpenStreetMap contributors). If the map tiles can't load, the app falls back to a drawn preview map.

Private circles (invite-code groups for sharing spots) run on a free [Supabase](https://supabase.com/) project. The database rules live in Supabase; `.github/workflows/keep-alive.yml` pings it daily so the free project doesn't pause.

Spots are general scenic locations. Members are responsible for following local laws.
