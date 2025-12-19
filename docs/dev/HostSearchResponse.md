# HostSearchResponse Documentation

## Overview
The `HostSearchResponse` class is a response wrapper for host search results from Fleet MDM. It contains a list of hosts and pagination information.

## Core Components
- **hosts**: A list of `Host` objects representing the search results.
- **page**: The current page number of the results.
- **perPage**: The number of results per page.
- **orderKey**: The key used for ordering the results.
- **orderDirection**: The direction of the order (ascending or descending).
- **query**: The search query used to filter the results.

## Methods
- `getHosts()`: Returns the list of hosts.
- `setHosts(List<Host> hosts)`: Sets the list of hosts.
- `getPage()`: Returns the current page number.
- `setPage(Integer page)`: Sets the current page number.
- `getPerPage()`: Returns the number of results per page.
- `setPerPage(Integer perPage)`: Sets the number of results per page.
- `getOrderKey()`: Returns the order key.
- `setOrderKey(String orderKey)`: Sets the order key.
- `getOrderDirection()`: Returns the order direction.
- `setOrderDirection(String orderDirection)`: Sets the order direction.
- `getQuery()`: Returns the search query.
- `setQuery(String query)`: Sets the search query.