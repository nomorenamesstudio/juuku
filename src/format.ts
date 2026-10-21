export const formatTime = (seconds: number | undefined) => {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Hours and minutes from a rounded total, so 59.98 minutes reads as 1 hr 0 min. */
export const formatTotal = (seconds: number) => {
  const minutes = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
};
