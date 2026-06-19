export interface AppUser {
  id: string
  email: string
  name: string | null
}

/**
 * Auth state + actions, backed by Supabase Auth. Session lives in cookies
 * (via @supabase/ssr in useSupabase), so SSR data fetches stay authenticated;
 * `user` is shared state populated by plugins/auth.ts at startup and by
 * login/register/logout.
 */
export function useAuth() {
  const user = useState<AppUser | null>('auth-user', () => null)
  const supabase = useSupabase()

  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error || !data.user) {
      throw new Error(
        error?.status === 400
          ? 'Incorrect email or password.'
          : 'Could not sign in. Please try again.',
      )
    }
    user.value = await toAppUser(supabase, data.user)
  }

  async function register(
    email: string,
    password: string,
    name?: string,
  ): Promise<void> {
    const trimmedName = name?.trim() || null
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: trimmedName } },
    })
    if (error) {
      throw new Error(
        error.message.toLowerCase().includes('already')
          ? 'An account with that email already exists.'
          : error.message.toLowerCase().includes('password')
            ? 'Check your email and use a password of at least 8 characters.'
            : 'Could not create the account. Please try again.',
      )
    }
    if (!data.session || !data.user) {
      // Email confirmation is enabled: no session yet.
      throw new Error('Check your inbox to confirm your email, then sign in.')
    }
    user.value = await toAppUser(supabase, data.user, trimmedName)
  }

  async function fetchMe(): Promise<void> {
    const { data } = await supabase.auth.getUser()
    user.value = data.user ? await toAppUser(supabase, data.user) : null
  }

  async function logout(): Promise<void> {
    await supabase.auth.signOut()
    user.value = null
    await navigateTo('/login')
  }

  return { user, isAuthenticated, login, register, fetchMe, logout }
}

async function toAppUser(
  supabase: ReturnType<typeof useSupabase>,
  authUser: { id: string; email?: string },
  knownName?: string | null,
): Promise<AppUser> {
  let name = knownName ?? null
  if (knownName === undefined) {
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', authUser.id)
      .single()
    name = data?.name ?? null
  }
  return { id: authUser.id, email: authUser.email ?? '', name }
}
