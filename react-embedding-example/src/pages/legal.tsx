import { useParams } from 'react-router-dom'
import { LegalDocumentPage } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

// One legal document. The hub serves it with its own title, version and
// effective date, so the host states no per-document copy. Which documents
// exist is the hub's list: the home page shows one card per published document.
export function LegalPage() {
  const { docType = 'privacy' } = useParams()
  return <LegalDocumentPage docType={docType} apiEndpoint={EP.legal(docType)} backButton={false} />
}
