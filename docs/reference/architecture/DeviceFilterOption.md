# DeviceFilterOption Documentation

## Overview

`DeviceFilterOption` is a DTO representing a single filter option for device queries. It is used within `DeviceFilters` to specify possible values for filtering devices by status, type, OS, or organization.

## Core Responsibilities
- Encapsulates a filter value, its display label, and the count of matching devices.

## Fields

| Field   | Type     | Description                                 |
|---------|----------|---------------------------------------------|
| value   | String   | The filter value (e.g., status code).        |
| label   | String   | Human-readable label for the filter.         |
| count   | Integer  | Number of devices matching this filter.      |

## Usage Example

```java
DeviceFilterOption option = DeviceFilterOption.builder()
    .value("ACTIVE")
    .label("Active Devices")
    .count(5)
    .build();
```

## Related Components
- [DeviceFilters.md](DeviceFilters.md): Uses this class for filter lists.
- [module_2.md](module_2.md): Module overview.
