# DeviceFilters Documentation

## Overview

`DeviceFilters` is a DTO that encapsulates multiple filter options for querying devices in the OpenFrame API. It is designed to support complex filtering scenarios, such as filtering by status, device type, OS type, organization, and tags. It also includes a count of devices matching the current filter set.

## Core Responsibilities
- Holds lists of filter options for various device attributes.
- Provides a count of devices matching the filters.

## Fields

| Field           | Type                        | Description                                 |
|-----------------|-----------------------------|---------------------------------------------|
| statuses        | List<DeviceFilterOption>     | Filter options for device status.           |
| deviceTypes     | List<DeviceFilterOption>     | Filter options for device type.             |
| osTypes         | List<DeviceFilterOption>     | Filter options for OS type.                 |
| organizationIds | List<DeviceFilterOption>     | Filter options for organization.            |
| tags            | List<TagFilterOption>        | Filter options for device tags.             |
| filteredCount   | Integer                     | Number of devices matching the filters.     |

## Usage Example

```java
DeviceFilters filters = DeviceFilters.builder()
    .statuses(statusOptions)
    .deviceTypes(typeOptions)
    .osTypes(osOptions)
    .organizationIds(orgOptions)
    .tags(tagOptions)
    .filteredCount(10)
    .build();
```

## Related Components
- [DeviceFilterOption.md](DeviceFilterOption.md): Represents a single filter option.
- [module_2.md](module_2.md): Module overview.

---

Note: `TagFilterOption` is referenced but not defined in this module. See related modules for its definition.