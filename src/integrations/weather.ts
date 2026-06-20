// Open-Meteo wrapper. No API key, free, generous limits.
// Docs: https://open-meteo.com/en/docs

export type Geocode = {
  name: string;
  country: string;
  admin1?: string; // region/canton
  latitude: number;
  longitude: number;
  elevation?: number;
};

export async function geocode(query: string): Promise<Geocode | null> {
  const list = await searchLocations(query, 1);
  return list[0] ?? null;
}

export async function searchLocations(query: string, count = 8): Promise<Geocode[]> {
  if (!query || query.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const hits = Array.isArray(data.results) ? data.results : [];
  return hits.map((hit: {
    name: string; country?: string; admin1?: string;
    latitude: number; longitude: number; elevation?: number;
  }) => ({
    name: hit.name,
    country: hit.country ?? "",
    admin1: hit.admin1,
    latitude: hit.latitude,
    longitude: hit.longitude,
    elevation: hit.elevation,
  }));
}

export type DailyForecast = {
  date: string;
  temp_min_c: number;
  temp_max_c: number;
  precipitation_mm: number;
  precipitation_hours: number;
  snowfall_cm: number;
  wind_max_kmh: number;
  sunrise: string;
  sunset: string;
};

export type ForecastSummary = {
  location: { name: string; country: string; elevation_m?: number };
  daily: DailyForecast[];
  summary: {
    min_c: number;
    max_c: number;
    total_precip_mm: number;
    total_snow_cm: number;
    has_rain: boolean;
    has_snow: boolean;
    max_wind_kmh: number;
    short_daylight_h: number; // shortest day's daylight hours, useful for headlamp call
  };
};

function todayPlusDays(offset = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function hoursBetween(iso1: string, iso2: string): number {
  return (new Date(iso2).getTime() - new Date(iso1).getTime()) / 3_600_000;
}

export async function forecast(
  query: string,
  startDate: string | undefined,
  days: number,
): Promise<ForecastSummary | null> {
  const loc = await geocode(query);
  if (!loc) return null;

  // Clamp days into 1..16 (Open-Meteo forecast horizon).
  const safeDays = Math.max(1, Math.min(16, days || 3));

  // If startDate is missing or out of API range, default to tomorrow.
  let sd = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : todayPlusDays(1);
  const sdDate = new Date(sd);
  const todayUtc = new Date(todayPlusDays(0));
  if (Number.isNaN(sdDate.getTime()) || sdDate < todayUtc) sd = todayPlusDays(1);

  const end = new Date(sd);
  end.setUTCDate(end.getUTCDate() + safeDays - 1);
  const ed = end.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    daily:
      "temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_hours,snowfall_sum,wind_speed_10m_max,sunrise,sunset",
    start_date: sd,
    end_date: ed,
    timezone: "auto",
    wind_speed_unit: "kmh",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();

  const daily: DailyForecast[] = [];
  const n = data.daily?.time?.length ?? 0;
  for (let i = 0; i < n; i++) {
    daily.push({
      date: data.daily.time[i],
      temp_min_c: data.daily.temperature_2m_min[i],
      temp_max_c: data.daily.temperature_2m_max[i],
      precipitation_mm: data.daily.precipitation_sum[i] ?? 0,
      precipitation_hours: data.daily.precipitation_hours[i] ?? 0,
      snowfall_cm: (data.daily.snowfall_sum[i] ?? 0) * 1, // already cm in default unit
      wind_max_kmh: data.daily.wind_speed_10m_max[i] ?? 0,
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
    });
  }

  if (daily.length === 0) return null;

  const min_c = Math.min(...daily.map((d) => d.temp_min_c));
  const max_c = Math.max(...daily.map((d) => d.temp_max_c));
  const total_precip_mm = daily.reduce((a, d) => a + d.precipitation_mm, 0);
  const total_snow_cm = daily.reduce((a, d) => a + d.snowfall_cm, 0);
  const max_wind_kmh = Math.max(...daily.map((d) => d.wind_max_kmh));
  const short_daylight_h = Math.min(
    ...daily.map((d) => hoursBetween(d.sunrise, d.sunset)),
  );

  return {
    location: {
      name: [loc.name, loc.admin1].filter(Boolean).join(", "),
      country: loc.country,
      elevation_m: loc.elevation,
    },
    daily,
    summary: {
      min_c: Math.round(min_c),
      max_c: Math.round(max_c),
      total_precip_mm: Math.round(total_precip_mm),
      total_snow_cm: Math.round(total_snow_cm),
      has_rain: total_precip_mm >= 1,
      has_snow: total_snow_cm >= 1,
      max_wind_kmh: Math.round(max_wind_kmh),
      short_daylight_h: Math.round(short_daylight_h * 10) / 10,
    },
  };
}
