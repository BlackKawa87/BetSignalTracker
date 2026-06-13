import { getStatusBg, getStatusLabel } from '../../utils/helpers'
import { SignalStatus } from '../../types'

export function StatusBadge({ status }: { status: SignalStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium ${getStatusBg(status)}`}>
      {getStatusLabel(status)}
    </span>
  )
}
