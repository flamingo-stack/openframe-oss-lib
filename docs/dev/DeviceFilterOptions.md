# DeviceFilterOptions Documentation

## Overview
The `DeviceFilterOptions` class provides a structured way to filter devices based on various criteria. It includes properties for filtering by statuses, device types, OS types, organization IDs, and tag names.

## Core Properties
- **statuses**: A list of device statuses to filter devices.
- **deviceTypes**: A list of device types to filter devices.
- **osTypes**: A list of operating system types to filter devices.
- **organizationIds**: A list of organization IDs to filter devices.
- **tagNames**: A list of tag names to filter devices.

## Example Usage
```java
DeviceFilterOptions options = new DeviceFilterOptions();
options.setStatuses(Arrays.asList(DeviceStatus.ACTIVE, DeviceStatus.INACTIVE));
options.setDeviceTypes(Arrays.asList(DeviceType.LAPTOP, DeviceType.DESKTOP));
```