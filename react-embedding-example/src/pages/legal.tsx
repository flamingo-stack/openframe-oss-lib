import { useParams } from 'react-router-dom'
import { LegalDocumentPage, useLegalDocuments } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

// One legal document. The hub serves it with its own title, version and
// effective date, so the host states no per-document copy. Which documents
// exist is the hub's list: the home page shows one card per published document.
export function LegalPage() {
  const { docType = 'privacy' } = useParams()
  // The title from the hub's list, so a document that fails to load is still named.
  const { documents } = useLegalDocuments({ apiEndpoint: EP.legalDocuments })
  const title = documents.find((doc) => doc.docType === docType)?.title
  return <LegalDocumentPage docType={docType} title={title} apiEndpoint={EP.legal(docType)} backButton={false} />
}
