export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--light-bg)] dark:bg-[var(--dark-bg)] app-wallpaper flex flex-col">
      <div className="h-16 bg-[var(--light-surface)] dark:bg-[var(--dark-surface)] border-b border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
      <main className="flex-grow max-w-7xl mx-auto w-full py-8 sm:px-6 lg:px-8 px-4">
        <div className="space-y-6">
          <div className="h-8 w-48 rounded-md bg-gray-200 dark:bg-[var(--dark-border)] pulse-smooth"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="h-40 rounded-lg bg-gray-100 dark:bg-[#132f4c] border border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-40 rounded-lg bg-gray-100 dark:bg-[#132f4c] border border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-40 rounded-lg bg-gray-100 dark:bg-[#132f4c] border border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-40 rounded-lg bg-gray-100 dark:bg-[#132f4c] border border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-40 rounded-lg bg-gray-100 dark:bg-[#132f4c] border border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-40 rounded-lg bg-gray-100 dark:bg-[#132f4c] border border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full rounded-md bg-gray-200 dark:bg-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-4 w-5/6 rounded-md bg-gray-200 dark:bg-[var(--dark-border)] pulse-smooth"></div>
            <div className="h-4 w-4/6 rounded-md bg-gray-200 dark:bg-[var(--dark-border)] pulse-smooth"></div>
          </div>
        </div>
      </main>
      <div className="h-16 bg-[var(--light-surface)] dark:bg-[var(--dark-surface)] border-t border-gray-200 dark:border-[var(--dark-border)] pulse-smooth"></div>
      <div className="h-16"></div>
    </div>
  );
}
