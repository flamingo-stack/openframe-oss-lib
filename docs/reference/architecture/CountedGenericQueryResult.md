# CountedGenericQueryResult Documentation

## Overview

`CountedGenericQueryResult<T>` extends `GenericQueryResult<T>` by adding a `filteredCount` field. This is useful for scenarios where, in addition to paginated results, the total number of items matching the filter criteria is needed (e.g., for UI pagination controls).

## Core Responsibilities
- Inherits all fields from `GenericQueryResult<T>` (items, pageInfo).
- Adds a `filteredCount` integer field representing the total number of filtered items.

## Fields

| Field         | Type                | Description                                 |
|---------------|---------------------|---------------------------------------------|
| items         | List<T>             | The list of result items.                   |
| pageInfo      | CursorPageInfo      | Pagination metadata (cursor-based).         |
| filteredCount | int                 | Total number of items after filtering.      |

## Usage Example

```java
CountedGenericQueryResult<Device> result = new CountedGenericQueryResult<>();
result.setItems(deviceList);
result.setPageInfo(cursorPageInfo);
result.setFilteredCount(42);
```

## Related Components
- [GenericQueryResult.md](GenericQueryResult.md): Base class.
- [module_2.md](module_2.md): Module overview.
