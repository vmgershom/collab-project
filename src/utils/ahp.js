// Метод аналізу ієрархій

// нормовані локальні пріоритети з матриці попарних порівнянь (геом. середні рядків)
function priorityVector(matrix) {
  const n = matrix.length;
  const gm = matrix.map((row) => Math.pow(row.reduce((a, b) => a * b, 1), 1 / n));
  const sum = gm.reduce((a, b) => a + b, 0);
  return gm.map((g) => g / sum);
}

// перевірка узгодженості матриці: lambda_max, CI, CR
function consistency(matrix, weights) {
  const n = matrix.length;
  const Aw = matrix.map((row) => row.reduce((acc, v, j) => acc + v * weights[j], 0));
  const lambdaMax = Aw.reduce((acc, v, i) => acc + v / weights[i], 0) / n;
  const CI = (lambdaMax - n) / (n - 1);
  const RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.89, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41 };
  const CR = CI / (RI[n] || 1.49);
  return { lambdaMax, CI, CR };
}

// локальні пріоритети альтернатив за критерієм — нормування виміряних показників
// (еквівалент вектора пріоритетів ідеально узгодженої матриці співвідношень a_xy = v_x / v_y)
function normalizeValues(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return values.map(() => 1 / values.length);
  return values.map((v) => v / sum);
}

module.exports = { priorityVector, consistency, normalizeValues };