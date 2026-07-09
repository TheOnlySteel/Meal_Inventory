import Sheet from './Sheet'

interface Props {
  title: string
  message?: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** iOS action-sheet-style destructive confirmation (replaces window.confirm). */
export default function ConfirmSheet({ title, message, confirmLabel, onConfirm, onClose }: Props) {
  return (
    <Sheet
      onClose={onClose}
      ariaLabel={title}
      panelClassName="flex w-full max-w-lg flex-col gap-2 p-3 pb-6 safe-b"
    >
      {(close) => (
        <>
          <div className="flex flex-col overflow-hidden rounded-2xl bg-elevated float-shadow">
            <div className="flex flex-col gap-1 px-4 pt-4 pb-3 text-center">
              <p className="text-[15px] font-semibold">{title}</p>
              {message && <p className="text-[13px] text-ink2">{message}</p>}
            </div>
            <button
              onClick={() => {
                onConfirm()
                close()
              }}
              className="pressable border-t border-sep py-3.5 text-[17px] font-semibold"
              style={{ color: 'var(--red)' }}
            >
              {confirmLabel}
            </button>
          </div>
          <button
            onClick={close}
            className="pressable rounded-2xl bg-elevated py-3.5 text-[17px] font-semibold text-tint float-shadow"
          >
            Cancel
          </button>
        </>
      )}
    </Sheet>
  )
}
