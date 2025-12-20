# MachineQueryFilter Documentation

## Overview
The `MachineQueryFilter` class is used to define various filters that can be applied when querying for machines in the system. It includes properties for filtering based on statuses, device types, OS types, organization IDs, and tag names.

## Core Properties
- **statuses**: A list of statuses to filter machines.
- **deviceTypes**: A list of device types to filter machines.
- **osTypes**: A list of operating system types to filter machines.
- **organizationIds**: A list of organization IDs to filter machines.
- **tagNames**: A list of tag names to filter machines.

## Example Usage
```java
MachineQueryFilter filter = new MachineQueryFilter();
filter.setStatuses(Arrays.asList("active", "inactive"));
filter.setDeviceTypes(Arrays.asList("laptop", "desktop"));
```