/**
 * Runtime contexts for embeddable oss-lib components.
 *
 * BUNDLE-SPLIT CONVENTION — read before adding new files here:
 *   Every module in `src/contexts/` calls `createContext()` at module
 *   top level. The tsup config builds this directory under the CLIENT
 *   bundle (with `"use client"` banner). Importing anything from here
 *   into a SERVER-bundled module (`utils/index.ts` and its `export *`
 *   transitive closure) crashes SSR with
 *   `createContext is not a function`.
 *
 *   Rule of thumb when adding a runtime-aware helper:
 *     - Pure functions that take endpoints/runtime as args → `utils/`.
 *     - React hooks that READ the runtime via useContext → `hooks/`
 *       (with `'use client'` at the top of the file).
 *     - Never re-export from `utils/*` anything that pulls
 *       `src/contexts/*` transitively.
 *
 *   The split between `utils/access-code-client.ts` (pure) and
 *   `hooks/use-access-code-integration.ts` (runtime-aware) is the
 *   reference example.
 */

export {
  EndpointsRuntimeContext,
  useEndpointsRuntime,
  useRequiredEndpointsRuntime,
  type EndpointsRuntime,
} from './endpoints-runtime-context'
