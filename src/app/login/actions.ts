'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
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
  if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
    redirect('/login?message=Criacao de contas desativada.')
  }

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
    const grupoId = randomUUID()
    const { error: grupoErr } = await supabase
      .from('grupos')
      .insert({ id: grupoId, nome: 'Nossa Casa' })

    if (grupoErr) {
      redirect('/login?message=Erro ao criar grupo.')
    }

    const { error: membroErr } = await supabase
      .from('membros')
      .insert({ grupo_id: grupoId, user_id: authData.user.id, apelido: 'Cônjuge 1', papel: 'admin' })

    if (membroErr) {
      redirect('/login?message=Erro ao vincular usuario ao grupo.')
    }

    const { error: parceiroErr } = await supabase
      .from('membros')
      .insert({ grupo_id: grupoId, apelido: 'Cônjuge 2', papel: 'membro' })

    if (parceiroErr) {
      redirect('/login?message=Erro ao criar segundo membro do grupo.')
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
