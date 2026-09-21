import Layout from '@/components/Layout'

/** Shown while the client profile (a server component) is fetching. */
export default function ClientProfileLoading() {
  const bar = (w: number | string, h: number) => <div className="es-skeleton" style={{ width: w, height: h }} />
  return (
    <Layout currentPage="clients">
      <div data-testid="profile-skeleton" aria-busy="true" aria-label="Loading client">
        <div className="bg-white border border-gray-med rounded p-5 mb-3 flex items-center gap-4">
          {bar(72, 72)}
          <div className="flex-1 flex flex-col gap-3">{bar('45%', 18)}{bar('60%', 12)}{bar('35%', 12)}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="bg-white border border-gray-med rounded p-5 flex flex-col gap-3">
                {bar('30%', 14)}{bar('100%', 44)}{bar('100%', 44)}{bar('80%', 44)}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white border border-gray-med rounded p-5 flex flex-col gap-3">
                {bar('40%', 14)}{bar('90%', 12)}{bar('70%', 12)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
