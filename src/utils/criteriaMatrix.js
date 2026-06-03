const { priorityVector, consistency } = require('./ahp');

const CRITERIA_MATRIX = [
  [1, 2, 4, 4],
  [1 / 2, 1, 2, 2],
  [1 / 4, 1 / 2, 1, 1 / 2],
  [1 / 4, 1 / 2, 2, 1],
];

const CRITERIA_WEIGHTS = priorityVector(CRITERIA_MATRIX);
const CRITERIA_CONSISTENCY = consistency(CRITERIA_MATRIX, CRITERIA_WEIGHTS);

module.exports = { CRITERIA_MATRIX, CRITERIA_WEIGHTS, CRITERIA_CONSISTENCY };