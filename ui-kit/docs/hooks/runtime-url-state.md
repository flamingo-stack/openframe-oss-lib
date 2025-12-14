# Runtime URL State Management

**Complete guide to schema-driven URL parameter management for GraphQL and REST APIs**

## Overview

The URL State Management system provides automatic, runtime-driven URL parameter handling that:
- **Parses GraphQL queries at runtime** to extract variable definitions
- **Uses runtime introspection** to understand GraphQL schema types (works behind auth!)
- **Flattens nested input types** automatically (e.g., `filter.severity` → `?severity=`)
- **Syncs bidirectionally** between URL parameters and GraphQL variables
- **Supports both GraphQL and REST** APIs with minimal configuration
- **Zero build-time dependencies** - pure runtime introspection

## Table of Contents

1. [Quick Start](#quick-start)
2. [GraphQL Integration](#graphql-integration)
3. [REST API Integration](#rest-api-integration)
4. [Initialization](#initialization)
5. [URL Parameter Schema](#url-parameter-schema)
6. [Advanced Usage](#advanced-usage)
7. [API Reference](#api-reference)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### GraphQL (Automatic Schema Detection)

```typescript
import { useQueryParams } from '@flamingo/ui-kit/hooks'
import { apiClient } from '@/lib/api-client'

// Your standard GraphQL query string
const GET_LOGS_QUERY = `
  query GetLogs(
    $search: String
    $filter: LogFilterInput
    $cursor: String
    $limit: Int
  ) {
    logs(search: $search, filter: $filter, after: $cursor, first: $limit) {
      edges { node { id message } }
      pageInfo { hasNextPage endCursor }
    }
  }
`

function LogsPage() {
  // Hook automatically:
  // 1. Parses query AST
  // 2. Fetches GraphQL schema
  // 3. Flattens nested types
  // 4. Syncs with URL
  const { variables, setParam } = useQueryParams(GET_LOGS_QUERY, {
    defaultValues: { limit: 20 }
  })

  // Fetch data using variables
  const fetchLogs = async () => {
    const response = await apiClient.post('/api/graphql', {
      query: GET_LOGS_QUERY,
      variables
    })
    return response.data
  }

  // Update URL parameters
  return (
    <div>
      <input
        onChange={(e) => setParam('search', e.target.value)}
        placeholder="Search..."
      />
      <select onChange={(e) => setParam('severity', [e.target.value])}>
        <option>All</option>
        <option>error</option>
        <option>warning</option>
      </select>
    </div>
  )
}

// URL: /logs?search=error&severity=critical&cursor=abc&limit=20
// variables: { search: 'error', filter: { severity: ['critical'] }, cursor: 'abc', limit: 20 }
```

### REST API (Manual Schema)

```typescript
import { useApiParams } from '@flamingo/ui-kit/hooks'

function OrganizationsPage() {
  const { params, urlSearchParams, setParam } = useApiParams({
    search: { type: 'string', default: '' },
    page: { type: 'number', default: 1 },
    limit: { type: 'number', default: 20 },
    tags: { type: 'array', default: [] }
  })

  const fetchOrgs = async () => {
    const response = await fetch(`/api/organizations?${urlSearchParams}`)
    return response.json()
  }

  return (
    <div>
      <input
        value={params.search}
        onChange={(e) => setParam('search', e.target.value)}
      />
      {/* params: { search: 'acme', page: 1, limit: 20, tags: [] } */}
    </div>
  )
}
```

---

## GraphQL Integration

### Step 1: Initialize Introspection

Introspection must be initialized after authentication:

```typescript
// In your auth provider or app layout
import { initializeGraphQLIntrospection } from '@/lib/graphql-client'

useEffect(() => {
  if (isAuthenticated) {
    initializeGraphQLIntrospection()
  }
}, [isAuthenticated])
```

### Step 2: Use useQueryParams Hook

```typescript
const { variables, setParam, setParams, resetParams, isReady } = useQueryParams(
  GRAPHQL_QUERY,
  {
    defaultValues: { limit: 20 },
    debug: false, // Enable debug logging
    skipIntrospection: false // Skip schema introspection (no flattening)
  }
)
```

### How It Works

1. **AST Parsing** - Query string is parsed to extract variable definitions:
   ```graphql
   query GetLogs($search: String, $filter: LogFilterInput) { ... }
   ```

   Extracted variables:
   ```typescript
   {
     search: { type: 'string', ... },
     filter: { type: 'object', graphqlTypeName: 'LogFilterInput' }
   }
   ```

2. **Introspection** - Fetches GraphQL schema to understand `LogFilterInput`:
   ```typescript
   // LogFilterInput fields from schema
   {
     severity: { type: 'array', ... },
     toolType: { type: 'array', ... },
     deviceId: { type: 'string', ... }
   }
   ```

3. **Flattening** - Nested types are flattened to URL parameters:
   ```typescript
   // Flattened schema
   {
     search: { urlParamName: 'search', graphqlPath: 'search' },
     severity: { urlParamName: 'severity', graphqlPath: 'filter.severity' },
     toolType: { urlParamName: 'toolType', graphqlPath: 'filter.toolType' },
     deviceId: { urlParamName: 'deviceId', graphqlPath: 'filter.deviceId' }
   }
   ```

4. **URL Sync** - Parameters sync bidirectionally:
   ```
   URL: ?search=error&severity=critical&toolType=tactical

   variables: {
     search: 'error',
     filter: {
       severity: ['critical'],
       toolType: ['tactical']
     }
   }
   ```

---

## REST API Integration

### Manual Schema Definition

For REST APIs, define your parameter schema manually:

```typescript
const { params, urlSearchParams, setParam, setParams } = useApiParams({
  // String parameter
  search: {
    type: 'string',
    default: '',
    required: false
  },

  // Number parameter
  page: {
    type: 'number',
    default: 1
  },

  // Array parameter (repeated params)
  tags: {
    type: 'array',
    default: []
  },

  // Boolean parameter
  active: {
    type: 'boolean',
    default: true
  }
}, {
  debug: false
})
```

### Using with Fetch/Axios

```typescript
// Direct URLSearchParams
const response = await fetch(`/api/items?${urlSearchParams}`)

// Or use parsed params object
const response = await fetch('/api/items', {
  method: 'POST',
  body: JSON.stringify(params)
})
```

---

## Initialization

### GraphQL Introspection Setup

**File**: `src/lib/graphql-client.ts`

```typescript
import { initializeGraphQLIntrospection } from '@/lib/graphql-client'

// In auth provider, after successful login
export function AuthProvider({ children }) {
  const { isAuthenticated, user } = useAuth()

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize introspection with auth
      initializeGraphQLIntrospection()
    }
  }, [isAuthenticated, user])

  return <>{children}</>
}
```

### Benefits of Runtime Introspection

- ✅ **Works behind authentication** - No build-time schema access needed
- ✅ **Automatic type discovery** - Nested input types are automatically flattened
- ✅ **Caching** - Schema cached in localStorage for 24 hours
- ✅ **Graceful fallback** - Works without introspection (just no flattening)
- ✅ **Zero build dependencies** - No GraphQL Code Generator required

---

## URL Parameter Schema

### Flattening Rules

GraphQL variables are automatically flattened to simple URL parameters:

```typescript
// GraphQL Variables
{
  search: 'error',
  filter: {
    severity: ['critical', 'error'],
    toolType: ['tactical']
  },
  cursor: 'abc123',
  limit: 20
}

// Becomes URL Parameters
?search=error&severity=critical&severity=error&toolType=tactical&cursor=abc123&limit=20
```

**Rules:**
- **Top-level primitives** - Kept as-is (`search`, `cursor`, `limit`)
- **Nested objects** - Flattened to top level (`filter.severity` → `severity`)
- **Arrays** - Use repeated params (`severity=error&severity=critical`)
- **Null/undefined** - Omitted from URL
- **Empty arrays** - Omitted from URL
- **Default values** - Omitted to keep URLs clean

### Type Coercion

URL parameters (strings) are automatically coerced to correct types:

| GraphQL Type | URL Param | Coerced Value |
|--------------|-----------|---------------|
| `String` | `?name=john` | `"john"` |
| `Int` | `?limit=20` | `20` |
| `Float` | `?price=19.99` | `19.99` |
| `Boolean` | `?active=true` | `true` |
| `[String]` | `?tags=foo&tags=bar` | `['foo', 'bar']` |

---

## Advanced Usage

### Custom Parameter Mapping

Override auto-generated parameter names:

```typescript
const { variables } = useQueryParams(QUERY, {
  paramMapping: {
    'search': 'q',          // URL: ?q=... instead of ?search=...
    'severity': 's',        // URL: ?s=... instead of ?severity=...
    'limit': 'pageSize'     // URL: ?pageSize=... instead of ?limit=...
  }
})
```

### Skip Introspection

For simple queries without nested input types:

```typescript
const { variables } = useQueryParams(SIMPLE_QUERY, {
  skipIntrospection: true  // Faster initialization, no nested flattening
})
```

### Debug Mode

Enable detailed logging:

```typescript
const { variables, schema } = useQueryParams(QUERY, {
  debug: true  // Logs AST parsing, introspection, URL conversions
})

// Inspect flattened schema
console.log('Schema:', schema)
```

### Batch Parameter Updates

Update multiple parameters at once:

```typescript
const { setParams } = useQueryParams(QUERY)

// Single update
setParams({
  search: 'error',
  severity: ['critical'],
  limit: 50
})
```

---

## API Reference

### useQueryParams

```typescript
function useQueryParams<TVariables>(
  query: DocumentNode | string,
  options?: UseQueryParamsOptions
): UseQueryParamsReturn<TVariables>
```

**Options:**
```typescript
interface UseQueryParamsOptions {
  defaultValues?: Record<string, any>
  introspectionEndpoint?: string
  introspectionHeaders?: Record<string, string>
  skipIntrospection?: boolean
  paramMapping?: Record<string, string>
  debug?: boolean
}
```

**Returns:**
```typescript
interface UseQueryParamsReturn<TVariables> {
  variables: TVariables              // Ready for GraphQL query
  params: Record<string, any>        // Raw URL params
  schema: Record<string, FlattenedParam>
  setParam: (key: string, value: any) => void
  setParams: (params: Record<string, any>) => void
  clearParams: (keys: string[]) => void
  resetParams: () => void
  isReady: boolean                   // Schema loaded
  isLoading: boolean                 // Initialization in progress
  error: Error | null
}
```

### useApiParams

```typescript
function useApiParams<TParams>(
  schema: ParamSchema,
  options?: UseApiParamsOptions
): UseApiParamsReturn<TParams>
```

**Schema:**
```typescript
interface ParamSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array'
    default?: any
    required?: boolean
  }
}
```

**Returns:**
```typescript
interface UseApiParamsReturn<TParams> {
  params: TParams                    // Parsed params object
  urlSearchParams: URLSearchParams   // For fetch/axios
  setParam: (key: string, value: any) => void
  setParams: (params: Record<string, any>) => void
  clearParams: (keys: string[]) => void
  resetParams: () => void
}
```

---

## Examples

### Complete Logs Table Example

```typescript
import { useQueryParams } from '@flamingo/ui-kit/hooks'
import { apiClient } from '@/lib/api-client'
import { useState } from 'react'

const GET_LOGS_QUERY = `
  query GetLogs($search: String, $filter: LogFilterInput, $cursor: String, $limit: Int) {
    logs(search: $search, filter: $filter, after: $cursor, first: $limit) {
      edges {
        node {
          id
          message
          severity
          timestamp
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function LogsTable() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  // URL state management
  const { variables, setParam, setParams, isReady } = useQueryParams(GET_LOGS_QUERY, {
    defaultValues: { limit: 20 }
  })

  // Fetch logs using variables from URL
  const fetchLogs = async () => {
    if (!isReady) return

    setLoading(true)
    try {
      const response = await apiClient.post('/api/graphql', {
        query: GET_LOGS_QUERY,
        variables
      })
      setData(response.data?.data?.logs)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount and when variables change
  useEffect(() => {
    fetchLogs()
  }, [variables, isReady])

  return (
    <div>
      {/* Search */}
      <input
        type="text"
        placeholder="Search..."
        onChange={(e) => setParam('search', e.target.value)}
      />

      {/* Severity Filter */}
      <select onChange={(e) => setParam('severity', [e.target.value])}>
        <option value="">All Severities</option>
        <option value="error">Error</option>
        <option value="warning">Warning</option>
        <option value="info">Info</option>
      </select>

      {/* Tool Type Filter */}
      <select onChange={(e) => setParam('toolType', [e.target.value])}>
        <option value="">All Tools</option>
        <option value="tactical">Tactical RMM</option>
        <option value="fleet">Fleet MDM</option>
      </select>

      {/* Clear Filters */}
      <button onClick={() => setParams({ search: '', severity: [], toolType: [] })}>
        Clear Filters
      </button>

      {/* Table */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Severity</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data?.edges?.map(({ node }) => (
              <tr key={node.id}>
                <td>{node.message}</td>
                <td>{node.severity}</td>
                <td>{new Date(node.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {data?.pageInfo?.hasNextPage && (
        <button onClick={() => setParam('cursor', data.pageInfo.endCursor)}>
          Next Page
        </button>
      )}
    </div>
  )
}
```

---

## Troubleshooting

### Introspection Fails

**Problem**: Introspection query returns 401/403

**Solution**: Ensure introspection is initialized after authentication:
```typescript
useEffect(() => {
  if (isAuthenticated) {
    initializeGraphQLIntrospection()
  }
}, [isAuthenticated])
```

### Parameters Not Syncing

**Problem**: URL doesn't update when calling `setParam()`

**Solution**: Ensure you're using Next.js App Router with proper routing:
```typescript
// Make sure you're in a Client Component
'use client'

import { useQueryParams } from '@flamingo/ui-kit/hooks'
```

### Nested Types Not Flattened

**Problem**: Input object types aren't being flattened

**Solution**: Check if introspection succeeded:
```typescript
const { isReady, error, schema } = useQueryParams(QUERY, { debug: true })

if (error) {
  console.error('Introspection error:', error)
}

console.log('Schema loaded:', isReady)
console.log('Flattened schema:', schema)
```

### Type Coercion Issues

**Problem**: Numbers becoming strings

**Solution**: Verify your GraphQL schema types match URL param types:
```typescript
// GraphQL
query GetItems($limit: Int) { ... }

// Ensure schema knows it's a number
// (automatic via introspection or AST parsing)
```

---

## Performance Considerations

### Caching

- **Introspection Cache**: 24 hours in localStorage
- **Schema Parsing**: Done once per query on mount (~1-2ms)
- **URL Updates**: Debounced to prevent history spam (optional)

### Bundle Size

- **graphql-js**: ~10KB (used for AST parsing)
- **UI Kit hooks**: ~5KB total
- **Zero additional dependencies**

### Optimization Tips

1. **Skip Introspection** for simple queries without nested types
2. **Use `useMemo`** when deriving data from variables
3. **Debounce search inputs** to reduce URL updates
4. **Cache introspection** across app reloads (automatic)

---

## Migration Guide

### From Manual URL Management

**Before:**
```typescript
const [search, setSearch] = useState('')
const [filters, setFilters] = useState({})
const searchParams = useSearchParams()

useEffect(() => {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  router.push(`?${params.toString()}`)
}, [search, filters])

const variables = { search, filter: filters }
```

**After:**
```typescript
const { variables, setParam } = useQueryParams(QUERY)

// That's it! URL sync is automatic
```

### From Zustand/Redux

**Before:**
```typescript
const search = useStore(state => state.search)
const filters = useStore(state => state.filters)
const setSearch = useStore(state => state.setSearch)

const variables = { search, filter: filters }
```

**After:**
```typescript
const { variables, setParam } = useQueryParams(QUERY)

// URL is now the source of truth, no store needed
```

---

## Best Practices

1. **Initialize introspection after auth** - Ensures schema fetching works
2. **Use default values** - Provides clean initial state
3. **Type your variables** - Use TypeScript generics for type safety
4. **Debug when needed** - Enable debug mode to troubleshoot issues
5. **Keep URLs clean** - Default values are automatically omitted
6. **Batch updates** - Use `setParams()` for multiple changes at once

---

## Related Documentation

- [GraphQL Client Setup](./graphql-client.md)
- [URL State Management API](./api-reference.md)
- [Next.js App Router](https://nextjs.org/docs/app/building-your-application/routing)
