import UnlockClient from '@/components/UnlockClient';

// In Next.js 15, dynamic route params may be async at runtime.
// TypeScript's PageProps doesn't reflect that yet, so we accept `any` and await it.
export default async function Page(props: { params: any }) {
  const { token } = await props.params;
  return <UnlockClient token={token as string} />;
}
