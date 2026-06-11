import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";

export default function LoginPage() {
  // TODO: implement (form state, call useAuth().login, redirect on success)
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <Card>
        <h1 className="mb-4 text-xl font-semibold">Log in</h1>
        <form className="flex flex-col gap-4">
          <Input id="email" label="Email" type="email" autoComplete="email" />
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />
          <Button type="submit">Log in</Button>
        </form>
      </Card>
    </main>
  );
}
