import { useEffect, useState } from 'react';
import { formatDateTime } from '../utils/upi';

export function DateTimeDisplay() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <div className="datetime-display">{formatDateTime(now)}</div>;
}
