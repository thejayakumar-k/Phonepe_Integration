interface PaymentTimerProps {
  timeLeft: number;        // Seconds remaining
  formattedTime: string;   // MM:SS format
  isExpired: boolean;
  sessionMinutes: number;
  compact?: boolean;
}

export function PaymentTimer({ timeLeft, formattedTime, isExpired, sessionMinutes, compact = false }: PaymentTimerProps) {
  const isUrgent = timeLeft <= 60 && timeLeft > 0; // Last minute warning
  const progress = (timeLeft / (sessionMinutes * 60)) * 100;

  if (compact) {
    return (
      <div className={`timer-section compact ${isExpired ? 'expired' : ''} ${isUrgent ? 'urgent' : ''}`}>
        <span className="timer-label">⏱️ Session</span>
        <span className="timer-value">{isExpired ? 'Expired' : formattedTime}</span>
      </div>
    );
  }

  return (
    <div className={`timer-section ${isExpired ? 'expired' : ''} ${isUrgent ? 'urgent' : ''}`}>
      <div className="timer-header">
        <span className="timer-icon">⏱️</span>
        <span className="timer-label">Payment Session</span>
      </div>

      {!isExpired ? (
        <>
          <div className="timer-display">
            <span className="timer-value">{formattedTime}</span>
            <span className="timer-unit">remaining</span>
          </div>

          <div className="timer-progress">
            <div 
              className="timer-progress-bar" 
              style={{ width: `${progress}%` }}
            />
          </div>

          {isUrgent && (
            <p className="timer-warning">
              ⚠️ Less than 1 minute remaining!
            </p>
          )}
        </>
      ) : (
        <div className="timer-expired">
          <span className="expired-icon">⏰</span>
          <p className="expired-text">Payment session expired</p>
          <p className="expired-subtext">
            You can restart the payment session if you still need to complete this payment.
          </p>
        </div>
      )}
    </div>
  );
}
