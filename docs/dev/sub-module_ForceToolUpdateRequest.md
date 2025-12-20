# ForceToolUpdateRequest Documentation

## Overview
The `ForceToolUpdateRequest` class is used to create requests for updating tools on specified machines. It contains the following fields:

- **machineIds**: A list of machine IDs that need to be updated.
- **toolAgentId**: The ID of the tool agent responsible for the update.

## Example Usage
```java
ForceToolUpdateRequest request = new ForceToolUpdateRequest();
request.setMachineIds(Arrays.asList("machine1", "machine2"));
request.setToolAgentId("agent123");
```

## Dependencies
This class is part of the `openframe-api-service-core` module.