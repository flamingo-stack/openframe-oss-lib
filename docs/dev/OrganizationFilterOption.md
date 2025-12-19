# OrganizationFilterOption Documentation

## Overview
The `OrganizationFilterOption` class represents an organization filter option used in audit logs. It provides a way to filter logs based on the organization associated with the logs.

## Core Attributes
- **id**: Unique identifier for the organization.
- **name**: Name of the organization.

## Methods
- **getId()**: Returns the ID of the organization.
- **getName()**: Returns the name of the organization.

## Example Usage
```java
OrganizationFilterOption option = new OrganizationFilterOption();
option.setId("org-1");
option.setName("Organization One");
```