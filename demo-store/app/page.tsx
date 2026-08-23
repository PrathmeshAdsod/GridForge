import { getDemoStoreState } from '@/lib/supabase'
import { LayoutV1 } from './components/LayoutV1'
import { LayoutV2 } from './components/LayoutV2'

// Force dynamic rendering — page must read Supabase state on every request
// so the scraper sees the current layout
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DemoStorePage() {
  const state = await getDemoStoreState()

  return (
    <>
      {/* Layout selector — server renders ACTUALLY DIFFERENT HTML */}
      {state.layout_version === 'v1' ? (
        <LayoutV1 state={state} />
      ) : (
        <LayoutV2 state={state} />
      )}
    </>
  )
}
