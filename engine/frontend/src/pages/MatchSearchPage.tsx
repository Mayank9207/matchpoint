import { useParams } from "react-router-dom";
import RadarAnimation from "../components/RadarAnimation";

export default function MatchSearchPage() {
  const { squadId } = useParams<{ squadId: string }>();

  // TODO: implement (call matches.findMatch, show searching state, navigate to result)
  void squadId;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 p-4">
      <RadarAnimation />
      <p className="text-sm text-gray-500">Searching for a match…</p>
    </main>
  );
}
