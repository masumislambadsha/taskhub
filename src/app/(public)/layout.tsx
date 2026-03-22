import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="">{children}</main>
      <Footer />
    </>
  );
}
