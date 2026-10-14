import { useParams } from 'react-router-dom'
import { LegalDocumentPage } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

// One legal document. The lib page reads the document and the hub's list of
// legal documents itself (title, version, effective date): the host passes the
// type and the endpoints and states nothing per document.
export function LegalPage() {
  const { docType = 'privacy' } = useParams()
  return (
    <LegalDocumentPage
      docType={docType}
      apiEndpoint={EP.legal(docType)}
      documentsEndpoint={EP.legalDocuments}
      backButton={false}
    />
  )
}
