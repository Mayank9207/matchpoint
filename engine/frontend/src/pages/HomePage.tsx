import Card from "../components/Card";
import Button from "../components/Button";

export default function HomePage() {
  // TODO: implement ("Create Squad" / "Join Squad" actions)
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-bold">MatchPoint</h1>
      <Card>
        <div className="flex flex-col gap-3">
          <Button type="button">Create Squad</Button>
          <Button type="button" variant="secondary">
            Join Squad
          </Button>
        </div>
      </Card>
    </main>
  );
}
