import { installBackgroundHandlers } from '../src/adapters/chrome/installBackgroundHandlers'

export default defineBackground(() => {
  const dispose = installBackgroundHandlers()
  return () => dispose()
})
