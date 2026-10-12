'use server';
import { AuthError } from 'next-auth';
import { signIn } from '@/server/auth';

export async function loginAction(_state: { error: string | null }, formData: FormData) {
  try {
    await signIn('credentials', { email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? ''), totp: String(formData.get('totp') ?? ''), redirectTo: '/' });
  } catch (error) {
    if (error instanceof AuthError) return { error: '이메일 또는 비밀번호를 확인해 주세요.' };
    throw error;
  }
  return { error: null };
}
