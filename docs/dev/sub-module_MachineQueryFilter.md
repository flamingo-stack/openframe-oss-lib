# MachineQueryFilter Documentation

## Overview
The `MachineQueryFilter` class is used to filter machine data based on various attributes. It contains the following fields:

- **statuses**: A list of statuses to filter machines by.
- **deviceTypes**: A list of device types to filter machines by.
- **osTypes**: A list of operating system types to filter machines by.
- **organizationIds**: A list of organization IDs to filter machines by.
- **tagNames**: A list of tag names to filter machines by.

## Example Usage
```java
MachineQueryFilter filter = new MachineQueryFilter();
filter.setStatuses(Arrays.asList("active", "inactive"));
filter.setDeviceTypes(Arrays.asList("laptop", "desktop"));
```

## Dependencies
This class is part of the `openframe-data-mongo` module.