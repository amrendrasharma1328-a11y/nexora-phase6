import { GEOCODING_ATTRIBUTION, GeocodingError } from '../osm/geocoder.js';

/** @param {{geocoder: {search: (q: string) => Promise<object[]>}}} deps */
export function createGeocodingController({ geocoder }) {
  return {
    async search(req, res) {
      try {
        const results = await geocoder.search(req.query.q);
        return res.status(200).json({ query: String(req.query.q).trim(), results, attribution: GEOCODING_ATTRIBUTION });
      } catch (err) {
        if (err instanceof GeocodingError) {
          return res.status(err.status).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  };
}
