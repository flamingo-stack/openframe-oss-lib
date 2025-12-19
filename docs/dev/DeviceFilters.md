# DeviceFilters Documentation

## Overview
The `DeviceFilters` class provides filtering options for devices based on various criteria.

## Core Components
- **statuses**: A list of device filter options for statuses.
- **deviceTypes**: A list of device filter options for device types.
- **osTypes**: A list of device filter options for operating systems.
- **organizationIds**: A list of organization IDs for filtering.
- **tags**: A list of tag filter options.
- **filteredCount**: The count of filtered devices.

## Methods
- `getStatuses()`: Returns the list of status filter options.
- `setStatuses(List<DeviceFilterOption> statuses)`: Sets the list of status filter options.
- `getDeviceTypes()`: Returns the list of device type filter options.
- `setDeviceTypes(List<DeviceFilterOption> deviceTypes)`: Sets the list of device type filter options.
- `getOsTypes()`: Returns the list of OS type filter options.
- `setOsTypes(List<DeviceFilterOption> osTypes)`: Sets the list of OS type filter options.
- `getOrganizationIds()`: Returns the list of organization IDs.
- `setOrganizationIds(List<DeviceFilterOption> organizationIds)`: Sets the list of organization IDs.
- `getTags()`: Returns the list of tag filter options.
- `setTags(List<TagFilterOption> tags)`: Sets the list of tag filter options.
- `getFilteredCount()`: Returns the count of filtered devices.
- `setFilteredCount(Integer filteredCount)`: Sets the count of filtered devices.