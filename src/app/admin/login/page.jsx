'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login?next=/admin')
  }, [router])

  return null
}
