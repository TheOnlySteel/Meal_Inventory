import Sheet from './Sheet'

interface Action {
  label: string
  tone?: 'destructive' | 'default'
  onSelect: () => void
}

interface Props {
  title: string
  message?: string
  actions: Action[]
  onClose: () => void
}

/** iOS action sheet with multiple choices (ConfirmSheet's multi-action sibling). */
export default function ActionSheet({ title, message, actions, onClose }: Props) {
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
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  a.onSelect()
                  close()
                }}
                className="pressable border-t border-sep py-3.5 text-[17px] font-semibold"
                style={{ color: a.tone === 'destructive' ? 'var(--red)' : 'var(--tint)' }}
              >
                {a.label}
              </button>
            ))}
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
