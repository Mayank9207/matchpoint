import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";

export default function SignupPage() {
  // TODO: implement (form state, call useAuth().signup, redirect on success)
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <Card>
        <h1 className="mb-4 text-xl font-semibold">Sign up</h1>
        <form className="flex flex-col gap-4">
          <Input id="display_name" label="Display name" type="text" />
          <Input id="email" label="Email" type="email" autoComplete="email" />
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
          />
          <Button type="submit">Create account</Button>
        </form>
      </Card>
    </main>
  );
}
