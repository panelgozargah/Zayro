import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "زَیرو | کتابخانه هوشمند کتاب‌های درسی",
  description:
    "اپلیکیشن خواندن کتاب‌های درسی رسمی ایران — پایه اول تا نهم، با کتاب‌خوان پیشرفته، ذخیره ادامه مطالعه، جست‌وجو و حالت شب.",
  keywords: ["کتاب درسی", "PDF", "پایه نهم", "متوسطه اول", "دبستان", "زَیرو", "Zayro"],
  authors: [{ name: "Zayro" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "زَیرو | کتابخانه هوشمند کتاب‌های درسی",
    description: "همه کتاب‌های درسی پایه ۱ تا ۹ — همیشه همراهت",
    siteName: "Zayro",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground noise">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
