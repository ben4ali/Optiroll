import { useMemo } from 'react';
import * as THREE from 'three';
import { IS_BLACK, MAX_PITCH, MIN_PITCH, PITCH_RANGE } from './constants';

interface GridLinesProps {
  viewWidth: number;
  viewHeight: number;
  hitLineY: number;
  showKeyDividers: boolean;
}

export function GridLines({
  viewWidth,
  viewHeight,
  hitLineY,
  showKeyDividers,
}: GridLinesProps) {
  if (!showKeyDividers) return null;

  const lineGeometry = useMemo(() => {
    const colWidth = viewWidth / PITCH_RANGE;
    const halfWidth = viewWidth / 2;
    const points: number[] = [];

    for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
      if (IS_BLACK[p]) continue;
      const x = (p - MIN_PITCH) * colWidth - halfWidth;
      points.push(x, hitLineY, -0.01);
      points.push(x, hitLineY + viewHeight, -0.01);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [viewWidth, viewHeight, hitLineY]);

  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      opacity: 0.04,
    });
  }, []);

  return (
    <lineSegments
      geometry={lineGeometry}
      material={lineMaterial}
      frustumCulled={false}
    />
  );
}
