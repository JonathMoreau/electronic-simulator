// src/linalg.ts
export function solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    if (n === 0) return [];
    // clone
    const M = A.map((r,i) => [...r, b[i]]);
    const cols = n + 1;
    for (let k = 0; k < n; k++) {
      // pivot
      let maxRow = k;
      let maxVal = Math.abs(M[k][k]);
      for (let i = k+1; i < n; i++) {
        const v = Math.abs(M[i][k]);
        if (v > maxVal) { maxVal = v; maxRow = i; }
      }
      if (Math.abs(M[maxRow][k]) < 1e-15) throw new Error('Singular matrix');
      if (maxRow !== k) { const tmp = M[k]; M[k] = M[maxRow]; M[maxRow] = tmp; }
      // normalize
      const pivot = M[k][k];
      for (let j = k; j < cols; j++) M[k][j] /= pivot;
      // eliminate
      for (let i = 0; i < n; i++) {
        if (i === k) continue;
        const f = M[i][k];
        if (f === 0) continue;
        for (let j = k; j < cols; j++) M[i][j] -= f * M[k][j];
      }
    }
    return M.map(r => r[n]);
  }
  