import '../styles/globals.css';
export const metadata = { title: 'PIXELock' };
export default function RootLayout({ children }:{children:React.ReactNode}){
 return (<html lang="en"><body className="min-h-screen bg-neutral-50 text-neutral-900">{children}</body></html>);
}
