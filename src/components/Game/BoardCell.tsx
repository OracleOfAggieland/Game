// src/components/Game/BoardCell.tsx
import React from 'react';

interface BoardCellProps {
  type: 'empty' | 'head' | 'body' | 'food' | 'powerup';
  color?: string;
}

const BoardCell: React.FC<BoardCellProps> = React.memo(({ type, color }) => {
  const getCellClass = () => {
    switch (type) {
      case 'head':
        return 'cell snake-head';
      case 'body':
        return 'cell snake-body';
      case 'food':
        return 'cell food';
      case 'powerup':
        return 'cell powerup';
      default:
        return 'cell';
    }
  };

  const getCellStyle = () => {
    if (color && (type === 'head' || type === 'body')) {
      return { backgroundColor: color };
    }
    return {};
  };

  return (
    <div 
      className={getCellClass()} 
      style={getCellStyle()}
    />
  );
});

BoardCell.displayName = 'BoardCell';

export default BoardCell;