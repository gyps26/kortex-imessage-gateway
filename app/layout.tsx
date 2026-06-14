import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) { 
  return ( 
    <html lang="en" suppressHydrationWarning> 
      <body className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ToastProvider>
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body> 
    </html> 
  ); 
}