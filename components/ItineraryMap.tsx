import React, { useEffect, useRef, useState } from 'react';
import { DayPlan, Place } from '../types';

interface ItineraryMapProps {
  days: DayPlan[];
}

declare global {
  interface Window {
    google: any;
  }
}

const ItineraryMap: React.FC<ItineraryMapProps> = ({ days }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [polyline, setPolyline] = useState<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Google Maps Script
  useEffect(() => {
    const loadScript = () => {
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        // Script already exists, check if Google Maps is ready
        if (window.google && window.google.maps && window.google.maps.Map) {
          initMap();
        } else {
          // Wait for the script to load
          const checkInterval = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.Map) {
              clearInterval(checkInterval);
              initMap();
            }
          }, 100);

          // Timeout after 10 seconds
          setTimeout(() => clearInterval(checkInterval), 10000);
        }
        return;
      }

      const script = document.createElement('script');
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

      if (!apiKey) {
        console.warn('[ItineraryMap] No Google Maps API key found');
        setMapError('Google Maps API key not configured');
        setIsLoading(false);
        return;
      }

      console.log('[ItineraryMap] Loading Google Maps script...');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly`;
      script.id = 'google-maps-script';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit for the API to fully initialize
        setTimeout(() => {
          if (window.google && window.google.maps && window.google.maps.Map) {
            initMap();
          } else {
            console.error('[ItineraryMap] Google Maps API loaded but not ready');
            setMapError('Google Maps API failed to initialize');
            setIsLoading(false);
          }
        }, 100);
      };
      script.onerror = () => {
        console.error('[ItineraryMap] Failed to load Google Maps script');
        setMapError('Failed to load Google Maps');
        setIsLoading(false);
      };
      document.body.appendChild(script);
    };

    const initMap = () => {
      if (!mapRef.current) {
        console.warn('[ItineraryMap] Map ref not ready');
        return;
      }

      if (!window.google || !window.google.maps || !window.google.maps.Map) {
        console.error('[ItineraryMap] Google Maps API not available');
        return;
      }

      try {
        const initialMap = new window.google.maps.Map(mapRef.current, {
          zoom: 2,
          center: { lat: 20, lng: 0 },
          mapTypeControl: false,
          streetViewControl: false,
          mapId: 'VIBETRIP_MAP', // Required for AdvancedMarkerElement
          styles: [
              {
                  "featureType": "poi",
                  "elementType": "labels",
                  "stylers": [{ "visibility": "off" }]
              }
          ]
        });
        setMap(initialMap);
        setIsLoading(false);
        console.log('[ItineraryMap] Map initialized successfully');
      } catch (error) {
        console.error('[ItineraryMap] Error initializing map:', error);
        setMapError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    loadScript();
  }, []);

  // Update Map Markers and Path when 'days' change
  useEffect(() => {
    if (!map || !days || days.length === 0) return;

    // 1. Clear old markers
    markers.forEach(m => m.setMap(null));
    if (polyline) polyline.setMap(null);

    const newMarkers: any[] = [];
    const pathCoordinates: any[] = [];
    const bounds = new window.google.maps.LatLngBounds();
    const infoWindow = new window.google.maps.InfoWindow();
    const geocoder = new window.google.maps.Geocoder();

    const allPlaces: { place: Place, dayIdx: number, type: string }[] = [];
    
    // Flatten places
    days.forEach((day, idx) => {
        day.morning.forEach(p => allPlaces.push({ place: p, dayIdx: day.day, type: 'Morning' }));
        day.afternoon.forEach(p => allPlaces.push({ place: p, dayIdx: day.day, type: 'Afternoon' }));
        day.evening.forEach(p => allPlaces.push({ place: p, dayIdx: day.day, type: 'Evening' }));
    });

    const processPlaces = async () => {
        for (const item of allPlaces) {
            let position = item.place.coordinates;

            // Fallback: Client-side Geocoding if coordinates missing from AI
            if (!position || (position.lat === 0 && position.lng === 0)) {
                try {
                    const result = await new Promise<any>((resolve) => {
                        geocoder.geocode({ address: item.place.name }, (results: any, status: any) => {
                            if (status === 'OK' && results[0]) {
                                resolve(results[0].geometry.location);
                            } else {
                                resolve(null);
                            }
                        });
                    });
                    if (result) {
                        position = { lat: result.lat(), lng: result.lng() };
                    }
                } catch (e) {
                    console.warn(`Geocoding failed for ${item.place.name}`);
                }
            }

            if (position) {
                // Create custom marker element with day number
                const markerContent = document.createElement('div');
                markerContent.className = 'custom-marker';
                markerContent.innerHTML = `
                    <div style="
                        background: #2563EB;
                        color: white;
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        border: 3px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        cursor: pointer;
                    ">
                        ${item.dayIdx}
                    </div>
                `;

                // Use AdvancedMarkerElement if available, fallback to legacy Marker
                let marker: any;
                if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
                    marker = new window.google.maps.marker.AdvancedMarkerElement({
                        position: position,
                        map: map,
                        title: item.place.name,
                        content: markerContent
                    });
                } else {
                    // Fallback to legacy Marker
                    marker = new window.google.maps.Marker({
                        position: position,
                        map: map,
                        title: item.place.name,
                        label: {
                            text: `${item.dayIdx}`,
                            color: "white",
                            fontSize: "10px"
                        }
                    });
                }

                // Add click listener
                marker.addListener("click", () => {
                    infoWindow.setContent(`
                        <div style="padding:8px;">
                            <strong style="font-size:14px;">${item.place.name}</strong><br/>
                            <span style="color:#666; font-size:12px;">Day ${item.dayIdx} - ${item.type}</span>
                        </div>
                    `);
                    infoWindow.open(map, marker);
                });

                newMarkers.push(marker);
                pathCoordinates.push(position);
                bounds.extend(position);
            }
        }

        // Draw Polyline
        const newPolyline = new window.google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor: "#2563EB", // Blue-600
            strokeOpacity: 0.8,
            strokeWeight: 4,
        });
        newPolyline.setMap(map);

        setMarkers(newMarkers);
        setPolyline(newPolyline);

        if (!pathCoordinates.length) {
             map.setZoom(2);
             map.setCenter({ lat: 20, lng: 0 });
        } else {
             map.fitBounds(bounds);
        }
    };

    processPlaces();

  }, [map, days]);

  return (
    <div className="w-full h-full relative group">
        <div ref={mapRef} className="w-full h-full bg-gray-100" />

        {/* Loading State */}
        {isLoading && !map && !mapError && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400 text-sm">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                 <p>Loading Map...</p>
             </div>
        )}

        {/* Error State */}
        {mapError && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-500 text-sm p-4">
                 <i className="fa-solid fa-map-location-dot text-4xl text-gray-300 mb-3"></i>
                 <p className="font-medium text-gray-700">Map Unavailable</p>
                 <p className="text-xs text-gray-400 mt-1">{mapError}</p>
                 <p className="text-xs text-gray-400 mt-2">Your itinerary is still available below</p>
             </div>
        )}
    </div>
  );
};

export default ItineraryMap;