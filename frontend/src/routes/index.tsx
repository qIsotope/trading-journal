import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">Trading Journal</h1>
      <p className="text-muted-foreground">
        Welcome to your trading journal. Start tracking your trades!
      </p>
    </div>
  )
}
