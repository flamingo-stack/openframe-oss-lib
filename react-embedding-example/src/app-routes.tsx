import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { PageError } from './components/page-state'
import { HomePage } from './pages/home'
import { OnboardingCatalogPage } from './pages/onboarding-catalog'
import { OnboardingDetailPage } from './pages/onboarding-detail'
import { RoadmapPage } from './pages/roadmap'
import { DeliveryPage } from './pages/delivery'
import { ReleasesPage } from './pages/releases'
import { ReleaseDetailRoute } from './pages/release-detail'
import { LegalPage } from './pages/legal'
import { ContactPage } from './pages/contact'
import { TicketsPage } from './pages/tickets'
import { AuthorsPage } from './pages/authors'
import { KnowledgeBasePage } from './pages/knowledge-base'

// One registry → every surface. Adding a surface is one <Route>.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="onboarding-guides" element={<OnboardingCatalogPage />} />
        <Route path="onboarding-guides/:slug" element={<OnboardingDetailPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
        <Route path="releases" element={<ReleasesPage />} />
        <Route path="releases/:slug" element={<ReleaseDetailRoute />} />
        <Route path="authors" element={<AuthorsPage />} />
        <Route path="legal/:docType" element={<LegalPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        {/* DocsHubPage embed proof — same component the hub mounts at
         *  flamingo.so/knowledge-base and openframe.so/knowledge-base. */}
        <Route path="knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="knowledge-base/*" element={<KnowledgeBasePage />} />
        <Route path="*" element={<PageError title="Page not found" />} />
      </Route>
    </Routes>
  )
}
