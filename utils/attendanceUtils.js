export const calculateAttendancePercentage = (present, total) => {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
};

export const calculateLecturesNeeded = (present, total, targetPercentage = 75) => {
  const required = Math.ceil(total * (targetPercentage / 100));
  return Math.max(0, required - present);
};

export const getPercentageColor = (percentage, threshold = 75) => {
  if (percentage >= threshold) return '#4CAF50';
  if (percentage >= threshold * 0.8) return '#FF9800';
  return '#F44336';
};
