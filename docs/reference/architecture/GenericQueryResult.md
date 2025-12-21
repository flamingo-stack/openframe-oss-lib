# GenericQueryResult Sub-Module Documentation

## Overview
The `GenericQueryResult` sub-module provides a generic structure for handling query results within the OpenFrame API. It supports pagination and item listing, making it versatile for various data retrieval operations.

## Core Functionality
- **Items**: List of items returned by the query.
- **Page Info**: Information about the pagination state.

## Key Fields
- `items`: List<T>
- `pageInfo`: CursorPageInfo

## Usage
This sub-module is used as a base structure for query results, often extended by other DTOs like `CountedGenericQueryResult` to add additional functionality.

---
For more information on related components, refer to the [Module 1 Documentation](module_1.md).