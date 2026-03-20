import { useEffect, useState } from 'react'
import { geocodeCity, daysBetween } from '../utils/helpers'
import { getEffectiveStatus } from '../utils/tripStatus'

const weatherCache = new Map()

function wmoToDescription(code) {
  if (code === 0) return 'clear sky'
  if (code <= 2) return 'partly cloudy'
  if (code === 3) return 'overcast'
  if (code <= 49) return 'foggy'
  if (code <= 59) return 'drizzle'
  if (code <= 69) return 'rain'
  if (code <= 79) return 'snow'
  if (code <= 84) return 'showers'
  if (code <= 99) return 'thunderstorm'
  return 'unknown conditions'
}

function getWeatherTarget(trip) {
  if (!trip) return null

  const today = new Date().toISOString().slice(0, 10)
  const status = getEffectiveStatus(trip)
  const destinations = trip.destinations || trip.cities || []
  const itinerary = trip.itinerary || []

  let day = null
  if (status === 'ongoing') {
    day = itinerary.find(d => d.date === today) || itinerary.find(d => d.dayNumber === daysBetween(trip.startDate, today))
  }

  const city = (day?.location || destinations[0]?.city || itinerary[0]?.location || '').trim()
  if (!city) return null

  const countryHint = destinations.find(d => d?.city && d.city === city)?.country || destinations[0]?.country || null
  return { city, countryHint, label: day?.location ? day.location : city }
}

export function useLiveWeatherContext(trip) {
  const [context, setContext] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!trip) {
        setContext('')
        return
      }

      const target = getWeatherTarget(trip)
      if (!target) {
        setContext('')
        return
      }

      const cacheKey = `${target.city}|${target.countryHint || ''}`
      const cached = weatherCache.get(cacheKey)
      if (cached) {
        setContext(cached)
        return
      }

      try {
        const coords = await geocodeCity(target.city, target.countryHint)
        if (!coords) {
          if (!cancelled) setContext('')
          return
        }

        const [lng, lat] = coords
        const forecastRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weathercode&temperature_unit=celsius&timezone=auto`
        )
        if (!forecastRes.ok) {
          if (!cancelled) setContext('')
          return
        }

        const data = await forecastRes.json()
        const current = data.current
        if (!current) {
          if (!cancelled) setContext('')
          return
        }

        const description = wmoToDescription(current.weathercode)
        const weatherText = `Live weather for ${target.label}: ${Math.round(current.temperature_2m)}°C, feels like ${Math.round(current.apparent_temperature)}°C, ${description}.`
        weatherCache.set(cacheKey, weatherText)
        if (!cancelled) setContext(weatherText)
      } catch (error) {
        if (!cancelled) setContext('')
      }
    }

    load()
    return () => { cancelled = true }
  }, [trip?.id, trip?.startDate, trip?.endDate, trip?.itinerary?.length, trip?.destinations?.length, trip?.cities?.length])

  return context
}
