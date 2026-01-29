import { useCallback, useEffect, useState } from 'react';
import { formatCoordinates, calculateDistance } from '../../utils/coordinates';
import type { LatLong } from '../../utils/coordinates';
import './InfoPanel.css';

interface InfoPanelProps {
  location: LatLong | null;
  onClose: () => void;
}

interface LocationInfo {
  coordinates: string;
  timezone: string;
  localTime: string;
  distanceFromEquator: string;
  hemisphere: string;
}

export function InfoPanel({ location, onClose }: InfoPanelProps) {
  const [info, setInfo] = useState<LocationInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Calculate location info when location changes
  useEffect(() => {
    if (location) {
      const locationInfo = getLocationInfo(location);
      setInfo(locationInfo);
      // Delay visibility for animation
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
      // Clear info after animation
      setTimeout(() => setInfo(null), 300);
    }
  }, [location]);

  const getLocationInfo = useCallback((loc: LatLong): LocationInfo => {
    const { lat, lng } = loc;

    // Calculate approximate timezone (simplified)
    const timezoneOffset = Math.round(lng / 15);
    const utcSign = timezoneOffset >= 0 ? '+' : '';
    const timezone = `UTC${utcSign}${timezoneOffset}`;

    // Calculate local time at that location
    const now = new Date();
    const utcHours = now.getUTCHours();
    const localHours = (utcHours + timezoneOffset + 24) % 24;
    const localTime = `${localHours.toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    // Distance from equator
    const distanceFromEquator = calculateDistance(lat, lng, 0, lng);

    // Determine hemisphere
    const latHemisphere = lat >= 0 ? 'Northern' : 'Southern';
    const lngHemisphere = lng >= 0 ? 'Eastern' : 'Western';

    return {
      coordinates: formatCoordinates(lat, lng),
      timezone,
      localTime,
      distanceFromEquator: `${distanceFromEquator.toFixed(0)} km`,
      hemisphere: `${latHemisphere} & ${lngHemisphere}`,
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  if (!info && !location) return null;

  return (
    <div className={`info-panel ${isVisible ? 'visible' : ''}`}>
      <div className="info-panel-header">
        <h2>Location Info</h2>
        <button className="close-button" onClick={handleClose} aria-label="Close panel">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="info-panel-content">
        {info && (
          <>
            <div className="info-item">
              <span className="info-label">Coordinates</span>
              <span className="info-value">{info.coordinates}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Timezone (approx)</span>
              <span className="info-value">{info.timezone}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Local Time</span>
              <span className="info-value">{info.localTime}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Distance from Equator</span>
              <span className="info-value">{info.distanceFromEquator}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Hemisphere</span>
              <span className="info-value">{info.hemisphere}</span>
            </div>

            <div className="info-divider" />

            <div className="info-note">
              <p>Click anywhere on the globe to explore different locations.</p>
              <p>The day/night terminator updates in real-time based on actual sun position.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default InfoPanel;
