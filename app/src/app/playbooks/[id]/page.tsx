import { PlaybookRun } from "@/components/PlaybookRun";
import { SAMPLE_PLAYBOOKS } from "@/lib/sample";

export function generateStaticParams() {
  return SAMPLE_PLAYBOOKS.map((p) => ({ id: p.id }));
}

export default async function PlaybookPage({ params }: PageProps<"/playbooks/[id]">) {
  const { id } = await params;
  return <PlaybookRun id={id} />;
}
