import LoginForm from './LoginForm'

// Force dynamic rendering — prevent static pregeneration
// which crashes because Supabase env vars aren't available at build time
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm />
}
