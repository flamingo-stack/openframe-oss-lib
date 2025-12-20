# Force Tool Reinstallation Request Documentation

## Overview
The `ForceToolReinstallationRequest` class represents a request to reinstall a tool on specified machines.

## Core Attributes
- **machineIds**: A list of machine IDs where the tool should be reinstalled.
- **toolAgentId**: The identifier for the tool agent.

## Example
```java
ForceToolReinstallationRequest request = new ForceToolReinstallationRequest();
request.setMachineIds(Arrays.asList("machine-1", "machine-2"));
request.setToolAgentId("tool-agent-001");
```