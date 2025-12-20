# GenericQueryResult Documentation

## Overview
The `GenericQueryResult` class is a generic DTO that encapsulates a list of items along with pagination information. It allows for flexible querying of various data types.

## Core Components
- **Field**: `items`
  - **Type**: `List<T>`
  - **Description**: A list of items of type T.
- **Field**: `pageInfo`
  - **Type**: `CursorPageInfo`
  - **Description**: Contains pagination information for the query results.