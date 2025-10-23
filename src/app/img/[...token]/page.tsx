// Server Component: alias /img/<...token> → /render/<...token>
import { redirect } from "next/navigation";

export default function ImgAliasPage({ params }: any) {
  // params.token is string[]
  const parts: string[] = Array.isArray(params?.token) ? params.token : [];
  const encoded = parts.map(encodeURIComponent).join("/");
  redirect(`/render/${encoded}`);
}
