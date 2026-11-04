import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Staff Login | Manasu Restaurant',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
