// src/utils/GameUtils.ts
import { Position, Obstacle, Direction } from '../types/GameTypes';

export const positionEquals = (pos1: Position, pos2: Position): boolean => {
  return pos1.x === pos2.x && pos1.y === pos2.y;
};

export const isPositionOccupied = (
  position: Position,
  snake: Position[],
  obstacles: Position[],
  botSnake?: Position[]
): boolean => {
  if (snake.some(pos => positionEquals(pos, position))) return true;
  if (obstacles.some(pos => positionEquals(pos, position))) return true;
  if (botSnake && botSnake.some(pos => positionEquals(pos, position))) return true;
  return false;
};

export const getRandomPosition = (boardSize: number): Position => {
  return {
    x: Math.floor(Math.random() * boardSize),
    y: Math.floor(Math.random() * boardSize)
  };
};

export const getAdjacentPositions = (pos: Position, boardSize: number): Position[] => {
  const adjacent: Position[] = [];
  const directions = [
    { x: 0, y: -1 }, // up
    { x: 1, y: 0 },  // right
    { x: 0, y: 1 },  // down
    { x: -1, y: 0 }  // left
  ];

  for (const dir of directions) {
    const newPos = { x: pos.x + dir.x, y: pos.y + dir.y };
    if (newPos.x >= 0 && newPos.x < boardSize && newPos.y >= 0 && newPos.y < boardSize) {
      adjacent.push(newPos);
    }
  }

  return adjacent;
};

// BFS to check if a position is reachable
export const isReachable = (
  start: Position,
  target: Position,
  obstacles: Position[],
  boardSize: number
): boolean => {
  const visited = new Set<string>();
  const queue: Position[] = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (positionEquals(current, target)) {
      return true;
    }

    const adjacent = getAdjacentPositions(current, boardSize);
    for (const pos of adjacent) {
      const key = `${pos.x},${pos.y}`;
      if (!visited.has(key) && !obstacles.some(obs => positionEquals(obs, pos))) {
        visited.add(key);
        queue.push(pos);
      }
    }
  }

  return false;
};

// Check if a position would create a dead end
export const isDeadEnd = (
  position: Position,
  obstacles: Position[],
  boardSize: number
): boolean => {
  const adjacent = getAdjacentPositions(position, boardSize);
  const openPaths = adjacent.filter(pos => 
    !obstacles.some(obs => positionEquals(obs, pos))
  );
  
  return openPaths.length <= 1;
};

// Generate obstacles for Level 2
export const generateObstacles = (boardSize: number, difficulty: 'easy' | 'medium' | 'hard'): Obstacle[] => {
  const obstacles: Obstacle[] = [];
  const allObstaclePositions: Position[] = [];
  
  const obstacleCount = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 7;
  const maxLength = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8;

  // Create border walls for hard difficulty
  if (difficulty === 'hard') {
    const borderPositions: Position[] = [];
    for (let i = 2; i < boardSize - 2; i++) {
      if (i < 8 || i > boardSize - 9) {
        borderPositions.push({ x: i, y: 0 });
        borderPositions.push({ x: i, y: boardSize - 1 });
        borderPositions.push({ x: 0, y: i });
        borderPositions.push({ x: boardSize - 1, y: i });
      }
    }
    obstacles.push({ positions: borderPositions, type: 'wall' });
    allObstaclePositions.push(...borderPositions);
  }

  // Create random obstacles
  for (let i = 0; i < obstacleCount; i++) {
    const length = Math.floor(Math.random() * (maxLength - 2)) + 3;
    const isVertical = Math.random() > 0.5;
    const positions: Position[] = [];
    
    let attempts = 0;
    let validPlacement = false;
    
    while (!validPlacement && attempts < 50) {
      positions.length = 0;
      const start = getRandomPosition(boardSize);
      
      // Avoid center area for player start
      if (Math.abs(start.x - boardSize / 2) < 3 && Math.abs(start.y - boardSize / 2) < 3) {
        attempts++;
        continue;
      }
      
      validPlacement = true;
      
      for (let j = 0; j < length; j++) {
        const pos = isVertical 
          ? { x: start.x, y: start.y + j }
          : { x: start.x + j, y: start.y };
          
        if (pos.x >= boardSize || pos.y >= boardSize || 
            allObstaclePositions.some(p => positionEquals(p, pos))) {
          validPlacement = false;
          break;
        }
        
        positions.push(pos);
      }
      
      attempts++;
    }
    
    if (validPlacement && positions.length > 0) {
      obstacles.push({ positions, type: 'rock' });
      allObstaclePositions.push(...positions);
    }
  }

  return obstacles;
};

// A* pathfinding for bot AI
export const findPath = (
  start: Position,
  target: Position,
  obstacles: Position[],
  boardSize: number,
  occupiedPositions: Position[] = []
): Position[] => {
  const openSet: Position[] = [start];
  const cameFrom = new Map<string, Position>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  const key = (pos: Position) => `${pos.x},${pos.y}`;
  const heuristic = (pos: Position) => Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y);
  
  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start));
  
  while (openSet.length > 0) {
    let current = openSet[0];
    let currentIndex = 0;
    
    for (let i = 1; i < openSet.length; i++) {
      if ((fScore.get(key(openSet[i])) || Infinity) < (fScore.get(key(current)) || Infinity)) {
        current = openSet[i];
        currentIndex = i;
      }
    }
    
    if (positionEquals(current, target)) {
      const path: Position[] = [];
      let temp: Position | undefined = current;
      
      while (temp) {
        path.unshift(temp);
        temp = cameFrom.get(key(temp));
      }
      
      return path;
    }
    
    openSet.splice(currentIndex, 1);
    
    const neighbors = getAdjacentPositions(current, boardSize);
    
    for (const neighbor of neighbors) {
      if (obstacles.some(obs => positionEquals(obs, neighbor)) ||
          occupiedPositions.some(pos => positionEquals(pos, neighbor))) {
        continue;
      }
      
      const tentativeGScore = (gScore.get(key(current)) || Infinity) + 1;
      
      if (tentativeGScore < (gScore.get(key(neighbor)) || Infinity)) {
        cameFrom.set(key(neighbor), current);
        gScore.set(key(neighbor), tentativeGScore);
        fScore.set(key(neighbor), tentativeGScore + heuristic(neighbor));
        
        if (!openSet.some(pos => positionEquals(pos, neighbor))) {
          openSet.push(neighbor);
        }
      }
    }
  }
  
  return [];
};

export const getDirectionFromPositions = (from: Position, to: Position): Direction => {
  if (to.x > from.x) return 'RIGHT';
  if (to.x < from.x) return 'LEFT';
  if (to.y > from.y) return 'DOWN';
  return 'UP';
};

export const moveInDirection = (position: Position, direction: Direction): Position => {
  switch (direction) {
    case 'UP': return { x: position.x, y: position.y - 1 };
    case 'DOWN': return { x: position.x, y: position.y + 1 };
    case 'LEFT': return { x: position.x - 1, y: position.y };
    case 'RIGHT': return { x: position.x + 1, y: position.y };
  }
};