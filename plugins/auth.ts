// Hydrate the current user from the Supabase session cookie at app start, on
// both the server and client, so the header/account state is ready before
// pages render.
export default defineNuxtPlugin(async () => {
  const { fetchMe } = useAuth()
  await fetchMe()
})
