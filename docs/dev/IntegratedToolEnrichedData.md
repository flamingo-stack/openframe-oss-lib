# Integrated Tool Enriched Data Documentation

## Overview
The `IntegratedToolEnrichedData` class is a data model that encapsulates information about integrated tools, including machine and organization details.

## Core Attributes
- **machineId**: The unique identifier for the machine.
- **hostname**: The name of the machine.
- **organizationId**: The identifier for the organization associated with the machine.
- **organizationName**: The name of the organization.
- **userId**: The identifier for the user associated with the machine.

## Example
```java
IntegratedToolEnrichedData data = new IntegratedToolEnrichedData();
data.setMachineId("12345");
data.setHostname("my-machine");
// Set other attributes accordingly
```