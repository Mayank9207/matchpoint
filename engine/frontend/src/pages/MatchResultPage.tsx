import { useParams } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";

export default function MatchResultPage() {
  const { matchId } = useParams<{ matchId: string }>();

  // TODO: implement (load match, show assigned room + distance, confirm/cancel)
  void matchId;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Match Found</h1>
      <Card>
        {/* TODO: room details + distance */}
        <p className="text-sm text-gray-500">Assigned room details here.</p>
      </Card>
      <div className="flex gap-3">
        <Button type="button">Confirm</Button>
        <Button type="button" variant="secondary">
          Cancel
        </Button>
      </div>
    </main>
  );
}
