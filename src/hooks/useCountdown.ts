import { useState, useEffect, useCallback } from 'react';

interface UseCountdownReturn {
  timeLeft: number;        // Seconds remaining
  isExpired: boolean;      // Whether timer has expired
  formattedTime: string;   // Formatted MM:SS string
  start: (seconds: number) => void;
  stop: () => void;
  reset: (seconds: number) => void;
}

export function useCountdown(): UseCountdownReturn {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [targetTime, setTargetTime] = useState<number | null>(null);

  useEffect(() => {
    if (!isRunning || targetTime === null) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
      
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        setIsRunning(false);
        setTargetTime(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, targetTime]);

  const start = useCallback((seconds: number) => {
    const target = Date.now() + seconds * 1000;
    setTargetTime(target);
    setTimeLeft(seconds);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setTargetTime(null);
  }, []);

  const reset = useCallback((seconds: number) => {
    start(seconds);
  }, [start]);

  const isExpired = timeLeft <= 0 && !isRunning && targetTime !== null;

  const formattedTime = formatTime(timeLeft);

  return {
    timeLeft,
    isExpired,
    formattedTime,
    start,
    stop,
    reset,
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
