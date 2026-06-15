'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=Credenciais inválidas. Tente novamente.')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: authData, error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/login?message=Erro ao criar conta: ' + error.message)
  }

  // Criação automática do Grupo e Membros (SaaS)
  if (authData.user) {
    const { data: grupo, error: grupoErr } = await supabase
      .from('grupos')
      .insert({ nome: 'Nossa Casa', user_id: authData.user.id })
      .select('id')
      .single()

    if (!grupoErr && grupo) {
      await supabase.from('membros').insert([
        { grupo_id: grupo.id, apelido: 'Cônjuge 1', papel: 'admin' },
        { grupo_id: grupo.id, apelido: 'Cônjuge 2', papel: 'membro' }
      ])
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
