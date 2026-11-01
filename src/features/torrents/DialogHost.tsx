import { useDialogs } from '../../store/dialogs'
import { AddDialog } from '../add/AddDialog'
import { SpeedLimitsDialog } from '../limits/SpeedLimitsDialog'
import { DeleteDialog } from './DeleteDialog'
import { MoveDialog } from './MoveDialog'

/** Renders the open dialog. Each dialog's arguments are in `open`. */
export function DialogHost() {
  const open = useDialogs((s) => s.open)
  const close = useDialogs((s) => s.close)
  if (!open) return null
  switch (open.kind) {
    case 'delete':
      return <DeleteDialog hashes={open.hashes} onClose={close} />
    case 'move':
      return <MoveDialog hashes={open.hashes} onClose={close} />
    case 'add':
      return <AddDialog tab={open.tab} files={open.files} onClose={close} />
    case 'limits':
      return <SpeedLimitsDialog tab={open.tab} hashes={open.hashes} onClose={close} />
    default:
      return null
  }
}
