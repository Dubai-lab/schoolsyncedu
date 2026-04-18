import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { schoolSiteService } from '@/services/schoolSiteService';
import type { School } from '@/types/school.types';

// Hostnames that belong to SchoolSync itself — not custom school domains
const PLATFORM_HOSTS = [
  'schoolsyncedu.com',
  'www.schoolsyncedu.com',
  'localhost',
];

function isPlatformHost(hostname: string) {
  return (
    PLATFORM_HOSTS.includes(hostname) ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.localhost')
  );
}

interface DomainContextValue {
  isCustomDomain: boolean;
  school: School | null;       // school resolved from the custom domain
  schoolSlug: string | null;   // convenience shortcut
  isLoading: boolean;
  notFound: boolean;
}

const DomainContext = createContext<DomainContextValue>({
  isCustomDomain: false,
  school: null,
  schoolSlug: null,
  isLoading: false,
  notFound: false,
});

export function DomainProvider({ children }: { children: ReactNode }) {
  const hostname = window.location.hostname;
  const isCustomDomain = !isPlatformHost(hostname);

  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(isCustomDomain);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!isCustomDomain) return;
    schoolSiteService
      .getByCustomDomain(hostname)
      .then((data) => {
        setSchool(data as School | null);
        setNotFound(!data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [hostname, isCustomDomain]);

  return (
    <DomainContext.Provider
      value={{
        isCustomDomain,
        school,
        schoolSlug: school?.slug ?? null,
        isLoading,
        notFound,
      }}
    >
      {children}
    </DomainContext.Provider>
  );
}

export function useDomainContext() {
  return useContext(DomainContext);
}
