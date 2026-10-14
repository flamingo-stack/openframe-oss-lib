import { useParams } from 'react-router-dom'
import { LegalDocumentPage } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

// The hub serves each legal document with its own title, version and effective
// date (and lists them all at `/api/legal`), so the host states no per-document
// copy: a document the hub adds needs no change here.
export function LegalPage() {
  const { docType = 'privacy' } = useParams()
  return <LegalDocumentPage docType={docType} apiEndpoint={EP.legal(docType)} backButton={false} />
}
