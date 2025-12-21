# GenericQueryResult Documentation

## Overview

`GenericQueryResult<T>` is a generic Data Transfer Object (DTO) designed to encapsulate the results of a paginated query. It is parameterized by the type `T`, allowing it to be reused for any entity type in the OpenFrame API. This class is foundational for API responses that require pagination and structured result sets.

## Core Responsibilities
- Holds a list of result items of type `T`.
- Contains pagination information via a `CursorPageInfo` object.

## Fields

| Field      | Type                | Description                                 |
|------------|---------------------|---------------------------------------------|
| items      | List<T>             | The list of result items.                   |
| pageInfo   | CursorPageInfo      | Pagination metadata (cursor-based).         |

## Usage Example

```java
GenericQueryResult<Device> result = new GenericQueryResult<>();
result.setItems(deviceList);
result.setPageInfo(cursorPageInfo);
```

## Related Components
- [CountedGenericQueryResult.md](CountedGenericQueryResult.md): Extends this class to add a filtered count.
- [module_2.md](module_2.md): Module overview.

---

For more on pagination, see the `CursorPageInfo` class (not documented here).