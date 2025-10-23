// src/app/img/[token]/page.tsx
import { redirect } from "next/navigation";

// Minimal typing so it always satisfies Next's PageProps inference
export default function ImgAliasPage({ params }: any) {
  const token = encodeURIComponent(params?.token ?? "");
  redirect(`/render/${token}`);
}
