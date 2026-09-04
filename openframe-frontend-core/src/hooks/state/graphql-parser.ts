/**
 * GraphQL AST Parser for URL State Management
 *
 * Extracts variable definitions from GraphQL DocumentNode at runtime
 * to automatically generate URL parameter handling.
 */

import { type DocumentNode, type VariableDefinitionNode, type TypeNode, visit } from 'graphql';

// `JSType` is OWNED by the search-params leaf (server and client share it).
// Imported, not re-exported: a second export site is a second place to look
// when you want to know where the type lives.
import type { JSType } from '../../utils/search-params';

/**
 * Variable definition extracted from GraphQL query
 */
export interface VariableDefinition {
  /** Variable name (e.g., "search", "filter") */
  name: string;
  /** JavaScript type for URL parameter handling */
  type: JSType;
  /** Whether the variable is required (non-null in GraphQL) */
  required: boolean;
  /** Whether the variable is an array/list */
  isArray: boolean;
  /** Original GraphQL type name (e.g., "String", "LogFilterInput") */
  graphqlTypeName: string;
}

/**
 * Parsed type information from GraphQL TypeNode
 */
interface ParsedType {
  typeName: string;
  isNonNull: boolean;
  isList: boolean;
}

/**
 * Extract all variable definitions from a GraphQL query
 *
 * @param query - GraphQL DocumentNode (from gql template tag)
 * @returns Record of variable definitions keyed by variable name
 *
 * @example
 * const LOGS_QUERY = gql`
 *   query GetLogs($search: String, $filter: LogFilterInput) { ... }
 * `
 *
 * const variables = extractVariablesFromQuery(LOGS_QUERY)
 * // {
 * //   search: { name: 'search', type: 'string', ... },
 * //   filter: { name: 'filter', type: 'object', graphqlTypeName: 'LogFilterInput' }
 * // }
 */
export function extractVariablesFromQuery(query: DocumentNode): Record<string, VariableDefinition> {
  const variables: Record<string, VariableDefinition> = {};

  visit(query, {
    VariableDefinition(node: VariableDefinitionNode) {
      const name = node.variable.name.value;
      const typeInfo = parseGraphQLType(node.type);

      variables[name] = {
        name,
        type: mapGraphQLTypeToJS(typeInfo.typeName),
        required: typeInfo.isNonNull,
        isArray: typeInfo.isList,
        graphqlTypeName: typeInfo.typeName,
      };
    },
  });

  return variables;
}

/**
 * Parse GraphQL TypeNode to extract type information
 * Handles NonNullType, ListType, and NamedType recursively
 *
 * @param typeNode - GraphQL type node from AST
 * @returns Parsed type information
 */
function parseGraphQLType(typeNode: TypeNode): ParsedType {
  let typeName = '';
  let isNonNull = false;
  let isList = false;
  let current: TypeNode = typeNode;

  // Unwrap NonNullType wrapper
  if (current.kind === 'NonNullType') {
    isNonNull = true;
    current = current.type;
  }

  // Handle ListType
  if (current.kind === 'ListType') {
    isList = true;
    current = current.type;

    // ListType can also be wrapped in NonNullType
    if (current.kind === 'NonNullType') {
      current = current.type;
    }
  }

  // Extract the base type name
  if (current.kind === 'NamedType') {
    typeName = current.name.value;
  }

  return {
    typeName,
    isNonNull,
    isList,
  };
}

/**
 * Map GraphQL scalar/input types to JavaScript types
 *
 * @param graphqlType - GraphQL type name (e.g., "String", "Int", "LogFilterInput")
 * @returns JavaScript type for URL parameter handling
 */
function mapGraphQLTypeToJS(graphqlType: string): JSType {
  // GraphQL scalar types
  const scalarTypeMap: Record<string, JSType> = {
    String: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
    ID: 'string',
  };

  // Check if it's a known scalar
  if (scalarTypeMap[graphqlType]) {
    return scalarTypeMap[graphqlType];
  }

  // Unknown types are assumed to be input objects
  // These will be flattened using introspection
  return 'object';
}

/**
 * Check if a GraphQL type is a scalar type
 */
export function isScalarType(graphqlTypeName: string): boolean {
  const scalars = ['String', 'Int', 'Float', 'Boolean', 'ID'];
  return scalars.includes(graphqlTypeName);
}

/**
 * Check if a GraphQL type is an input object type
 */
export function isInputObjectType(graphqlTypeName: string): boolean {
  return !isScalarType(graphqlTypeName);
}
