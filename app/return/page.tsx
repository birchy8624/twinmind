import BillingReturn from './BillingReturn'

type ReturnPageProps = {
  searchParams?: {
    session_id?: string
  }
}

export default function ReturnPage({ searchParams }: ReturnPageProps) {
  return <BillingReturn searchParams={searchParams} />
}
