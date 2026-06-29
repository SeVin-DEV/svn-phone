import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';
import { ThemeProvider } from '@/components/theme-provider';

// Pages
import { Dashboard } from '@/pages/dashboard';
import { EmulatorsPage } from '@/pages/emulators';
import { NewEmulatorPage } from '@/pages/emulators/new';
import { EmulatorDetail } from '@/pages/emulators/detail';
import { ProfilesPage } from '@/pages/profiles';
import { RomsPage } from '@/pages/roms';
import { SystemPage } from '@/pages/system';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/emulators" component={EmulatorsPage} />
        <Route path="/emulators/new" component={NewEmulatorPage} />
        <Route path="/emulators/:id" component={EmulatorDetail} />
        <Route path="/profiles" component={ProfilesPage} />
        <Route path="/roms" component={RomsPage} />
        <Route path="/system" component={SystemPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cloud-phone-theme">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
