import { useDialogs } from '../../store/dialogs'
import { DeleteDialog } from './DeleteDialog'
import { MoveDialog } from './MoveDialog'

/** Renders the open dialog. Limits (Task 11) and Add (Task 12) join here; their arguments are in `open`. */
export function DialogHost() {
  const open = useDialogs((s) => s.open)
  const close = useDialogs((s) => s.close)
  if (!open) return null
  switch (open.kind) {
    case 'delete':
      return <DeleteDialog hashes={open.hashes} onClose={close} />
    case 'move':
      return <MoveDialog hashes={open.hashes} onClose={close} />
    default:
      return null
  }
}
