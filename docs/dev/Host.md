# Host Documentation

## Overview
The `Host` class represents a host in the Fleet MDM system. It contains various attributes that describe the host's configuration, status, and performance metrics.

## Core Attributes
- **id**: Unique identifier for the host.
- **hostname**: The hostname of the host.
- **uuid**: Universally unique identifier for the host.
- **platform**: The platform on which the host is running.
- **createdAt**: Timestamp of when the host was created.
- **updatedAt**: Timestamp of the last update.
- **osVersion**: Operating system version of the host.
- **cpuBrand**: Brand of the CPU.
- **memory**: Memory size of the host.
- **status**: Current status of the host.

## Methods
- **getId()**: Returns the ID of the host.
- **getHostname()**: Returns the hostname.
- **getUuid()**: Returns the UUID.
- **getPlatform()**: Returns the platform.
- **getOsVersion()**: Returns the OS version.
- **getCpuBrand()**: Returns the CPU brand.
- **getMemory()**: Returns the memory size.
- **getStatus()**: Returns the current status.

## Example Usage
```java
Host host = new Host();
host.setId(1L);
host.setHostname("host1");
host.setUuid("uuid-123");
host.setPlatform("Linux");
host.setOsVersion("Ubuntu 20.04");
```