import { DEMO_PERSONAS, type DemoPersonaKey } from '@ru-lost-found/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/misc';
import { authApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../auth/authContext';

/**
 * One-click sign-in as a sample person. `available` stays false until the API confirms the
 * demo is switched on; while a sleeping server wakes up, `checking` is true.
 */
function useDemoSignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: queryKeys.demoStatus,
    queryFn: authApi.demoStatus,
    staleTime: Infinity,
    retry: 1,
  });
  const start = useMutation({
    mutationFn: (persona: DemoPersonaKey) => authApi.demoSignIn(persona),
    onSuccess: (session) => {
      signIn(session);
      navigate('/', { replace: true });
      window.scrollTo(0, 0); // the buttons sit halfway down the landing page
    },
    onError: (error) => toast.error(error.message),
  });
  return {
    available: status.data?.enabled === true,
    checking: status.isPending,
    start: start.mutate,
    startingAs: start.isPending ? start.variables : undefined,
  };
}

/** Persona cards for the landing page; nothing when this deployment has no demo. */
export function DemoPersonaCards() {
  const demo = useDemoSignIn();
  if (!demo.checking && !demo.available) return null;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {DEMO_PERSONAS.map((persona) => (
        <article
          key={persona.key}
          className="flex flex-col rounded-2xl bg-white p-6 text-left shadow-card"
        >
          <div className="flex items-center gap-3">
            <Avatar name={`${persona.firstName} ${persona.lastName}`} url={null} />
            <div>
              <h3 className="font-sans text-lg font-semibold text-gray-900">
                {persona.firstName} {persona.lastName}
              </h3>
              <p className="text-sm font-medium text-primary">{persona.role}</p>
            </div>
          </div>
          <p className="mt-4 text-gray-700">{persona.story}</p>
          <p className="mt-2 text-sm text-gray-500">{persona.tryThis}</p>
          <Button
            size="lg"
            className="mt-6 w-full"
            loading={demo.checking || demo.startingAs === persona.key}
            disabled={demo.startingAs !== undefined}
            onClick={() => demo.start(persona.key)}
          >
            Try as {persona.firstName} <ArrowRight className="h-4 w-4" />
          </Button>
        </article>
      ))}
    </div>
  );
}

/** A short "just looking?" line for the sign-in page. */
export function DemoSignInLinks() {
  const demo = useDemoSignIn();
  if (!demo.available) return null;

  return (
    <div className="mt-6 rounded-xl bg-white/70 p-4 text-center text-sm text-gray-600">
      <p>Just looking around? Try it as a sample student:</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {DEMO_PERSONAS.map((persona) => (
          <Button
            key={persona.key}
            size="sm"
            variant="outline"
            loading={demo.startingAs === persona.key}
            disabled={demo.startingAs !== undefined}
            onClick={() => demo.start(persona.key)}
          >
            {persona.firstName} ({persona.role.replace(/^The /, '').toLowerCase()})
          </Button>
        ))}
      </div>
    </div>
  );
}
