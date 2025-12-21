# LogFilterOptions Documentation

## Overview

`LogFilterOptions` is a DTO for specifying filter criteria when querying audit logs in the OpenFrame API. It supports filtering by date range, event types, tool types, severities, organizations, and device ID.

## Core Responsibilities
- Encapsulates all possible filter criteria for audit log queries.

## Fields

| Field          | Type              | Description                                 |
|----------------|-------------------|---------------------------------------------|
| startDate      | LocalDate         | Start date for filtering logs.              |
| endDate        | LocalDate         | End date for filtering logs.                |
| eventTypes     | List<String>      | Event types to filter by.                   |
| toolTypes      | List<String>      | Tool types to filter by.                    |
| severities     | List<String>      | Severities to filter by.                    |
| organizationIds| List<String>      | Organization IDs to filter by.              |
| deviceId       | String            | Device ID to filter by.                     |

## Usage Example

```java
LogFilterOptions options = LogFilterOptions.builder()
    .startDate(LocalDate.now().minusDays(7))
    .endDate(LocalDate.now())
    .eventTypes(Arrays.asList("LOGIN", "LOGOUT"))
    .toolTypes(Arrays.asList("WEB", "API"))
    .severities(Arrays.asList("INFO", "ERROR"))
    .organizationIds(Arrays.asList("org1", "org2"))
    .deviceId("device123")
    .build();
```

## Related Components
- [module_2.md](module_2.md): Module overview.

---

For related log event and organization filter DTOs, see [module_1.md].