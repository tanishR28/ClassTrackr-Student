export const calculateAttendancePercentage = (present, total) => {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
};

export const calculateLecturesNeeded = (present, total, targetPercentage = 75) => {
  const required = Math.ceil(total * (targetPercentage / 100));
  return Math.max(0, required - present);
};

export const getPercentageColor = (percentage) => {
  if (percentage >= 75) return '#4CAF50';
  if (percentage >= 60) return '#FF9800';
  return '#F44336';
};
