import { CertificateVerify } from "@/features/certificates/certificate-verify";

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CertificateVerify code={code} />;
}
