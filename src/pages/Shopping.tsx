export default function Shopping() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="px-4 pt-3 pb-3">
          <h1 className="text-[28px] font-bold tracking-tight">Shopping</h1>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-28 text-center">
        <span className="text-4xl">🛒</span>
        <p className="text-[17px] font-semibold">Coming right up</p>
      </main>
    </div>
  )
}
