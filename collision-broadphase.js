// Uniform-grid spatial hash to prune collision checks for large player counts.
// Returns an array of unique index pairs [i, j] with i < j that share a cell or neighbor cell.

export function getBroadphasePairs(players, cellSize = 100) {
  const grid = new Map();
  const pairs = [];
  const neighbors = [
    [0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,-1],[1,-1],[-1,1]
  ];

  // Assign players to cells (consider radius so big bodies map correctly)
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p.isAlive) continue;
    const r = p.radius || 0;
    const minCx = Math.floor((p.x - r) / cellSize);
    const maxCx = Math.floor((p.x + r) / cellSize);
    const minCy = Math.floor((p.y - r) / cellSize);
    const maxCy = Math.floor((p.y + r) / cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = cx + ',' + cy;
        let arr = grid.get(key);
        if (!arr) {
          arr = [];
          grid.set(key, arr);
        }
        arr.push(i);
      }
    }
  }

  // De-dup pairs using a Set
  const seen = new Set();

  for (const [key, indices] of grid.entries()) {
    const [cxStr, cyStr] = key.split(',');
    const cx = parseInt(cxStr, 10);
    const cy = parseInt(cyStr, 10);

    // Compare within the cell
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const i = indices[a], j = indices[b];
        const id = i < j ? (i + '|' + j) : (j + '|' + i);
        if (!seen.has(id)) {
          seen.add(id);
          pairs.push([Math.min(i,j), Math.max(i,j)]);
        }
      }
    }

    // Compare to neighbor cells (only forward neighbors to avoid duplicates)
    for (let n = 0; n < neighbors.length; n++) {
      const [dx, dy] = neighbors[n];
      if (dx < 0 || dy < 0) continue; // forward-only
      const nk = (cx + dx) + ',' + (cy + dy);
      const neigh = grid.get(nk);
      if (!neigh) continue;

      for (let a = 0; a < indices.length; a++) {
        const i = indices[a];
        for (let b = 0; b < neigh.length; b++) {
          const j = neigh[b];
          if (i === j) continue;
          const id = i < j ? (i + '|' + j) : (j + '|' + i);
          if (!seen.has(id)) {
            seen.add(id);
            pairs.push([Math.min(i,j), Math.max(i,j)]);
          }
        }
      }
    }
  }

  return pairs;
}
