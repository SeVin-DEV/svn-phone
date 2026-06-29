export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-8xl font-bold text-muted/20">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          The page you are looking for doesn't exist or has been moved.
        </p>
      </div>
    </div>
  );
}
