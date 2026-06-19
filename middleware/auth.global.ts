// Gate every route on auth. We key off the resolved `user` (shared useState,
// populated by plugins/auth before middleware runs) rather than the raw token
// cookie: that way an invalid/expired token (user stays null) also bounces to
// /login, and `useCookie`'s per-call refs don't cause stale reads on SSR.
const PUBLIC_ROUTES = ['/login', '/register']

export default defineNuxtRouteMiddleware((to) => {
  const { user } = useAuth()
  const isPublic = PUBLIC_ROUTES.includes(to.path)

  if (!user.value && !isPublic) {
    return navigateTo('/login')
  }
  if (user.value && isPublic) {
    return navigateTo('/')
  }
})
