import ProfileClient from '@/components/ProfileClient';

export const metadata = {
  title: 'Profile & API',
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileClient />;
}
