import UnlockClient from '@/components/UnlockClient';

// Next 15 can pass params as an async value; await it and pass token to client
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <UnlockClient token={decodeURIComponent(token)} />;
}
