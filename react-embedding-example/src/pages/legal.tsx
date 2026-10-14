import { useNavigate, useParams } from 'react-router-dom'
import { LegalDocumentPage } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

// The hub serves each legal document with its own title, version and effective
// date, and lists them all (`EP.legalDocuments`), so the host states no
// per-document copy and names no document: the switcher shows every document
// the hub has published, and one it adds needs no change here.
export function LegalPage() {
  const { docType = 'privacy' } = useParams()
  const navigate = useNavigate()
  return (
    <LegalDocumentPage
      docType={docType}
      apiEndpoint={EP.legal(docType)}
      documents={{ apiEndpoint: EP.legalDocuments, onSelect: (next) => navigate(`/legal/${next}`) }}
      backButton={false}
    />
  )
}
