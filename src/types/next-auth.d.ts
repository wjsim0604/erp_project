import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session { user: { id: string; role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'; mfaVerified?: boolean } & NonNullable<Session['user']> }
  interface User { role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'; mfaVerified?: boolean }
}
declare module 'next-auth/jwt' { interface JWT { role?: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'; mfaVerified?: boolean } }
