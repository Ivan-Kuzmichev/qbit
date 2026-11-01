import { memo, useMemo } from 'react'
import { t } from '../../i18n'
import { compressPieces } from './compressPieces'
import styles from './PieceMap.module.css'

export const PieceMap = memo(function PieceMap({ pieces }: { pieces: readonly number[] }) {
  const cells = useMemo(() => compressPieces(pieces), [pieces])
  return (
    <div className={styles.map} role="img" aria-label={t.details.pieceMap}>
      {cells.map((c, i) => (
        <span key={i} className={styles.cell} data-state={c} />
      ))}
    </div>
  )
})
