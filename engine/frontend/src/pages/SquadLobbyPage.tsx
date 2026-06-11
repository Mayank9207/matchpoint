import { useParams } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";

export default function SquadLobbyPage() {
  const { squadId } = useParams<{ squadId: string }>();

  // TODO: implement (load squad, render member list + share code, "Find Match")
  void squadId;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Squad Lobby</h1>
      <Card>
        {/* TODO: member list */}
        <p className="text-sm text-gray-500">Members will appear here.</p>
      </Card>
      <Card>
        {/* TODO: shareable code */}
        <p className="text-sm text-gray-500">Share code</p>
      </Card>
      <Button type="button">Find Match</Button>
    </main>
  );
}
